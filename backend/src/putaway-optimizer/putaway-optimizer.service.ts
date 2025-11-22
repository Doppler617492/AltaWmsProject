import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item } from '../entities/item.entity';
import { ReceivingItem } from '../entities/receiving-item.entity';
import { Location } from '../entities/location.entity';
import { Inventory } from '../entities/inventory.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { ReceivingDocument } from '../entities/receiving-document.entity';

export interface ScoringCandidate {
  location_code: string;
  zone: string | null;
  rack: string | null;
  level: string | null;
  capacity_total: number;
  capacity_used: number;
  capacity_free: number;
  same_sku_already_here: boolean;
  distance_to_dock_m: number;
  safety_flag: string | null;
  score: number;
  reasons: string[];
}

@Injectable()
export class PutawayOptimizerService {
  constructor(
    @InjectRepository(Item)
    private itemRepo: Repository<Item>,
    @InjectRepository(ReceivingItem)
    private receivingItemRepo: Repository<ReceivingItem>,
    @InjectRepository(Location)
    private locationRepo: Repository<Location>,
    @InjectRepository(Inventory)
    private inventoryRepo: Repository<Inventory>,
    @InjectRepository(InventoryMovement)
    private movementRepo: Repository<InventoryMovement>,
    @InjectRepository(ReceivingDocument)
    private receivingDocRepo: Repository<ReceivingDocument>,
  ) {}

  async getSuggestions(receivingItemId: number, userId: number, userRole: string) {
    const receivingItem = await this.receivingItemRepo.findOne({
      where: { id: receivingItemId },
      relations: ['receivingDocument', 'item', 'location'],
    });

    if (!receivingItem) {
      throw new NotFoundException('Receiving item not found');
    }

    // RBAC check: magacioner can only see items from their assigned documents
    if (userRole === 'magacioner') {
      const doc = receivingItem.receivingDocument;
      if (!doc || (doc as any).assigned_to !== userId) {
        throw new ForbiddenException('Možete videti samo stavke iz dodeljenih prijema');
      }
    }

    const item = await this.itemRepo.findOne({ where: { id: receivingItem.item_id } });
    if (!item) {
      throw new NotFoundException('Item not found');
    }

    const qtyToPlace = Number(receivingItem.expected_quantity || 0) - Number(receivingItem.received_quantity || 0);
    if (qtyToPlace <= 0) {
      throw new BadRequestException('Nema količine za smještanje');
    }

    // Get all locations with capacity
    const allLocations = await this.locationRepo.find({
      relations: ['rack', 'rack.aisle', 'rack.aisle.zone'],
    });

    const candidates: ScoringCandidate[] = [];

    // Check inventory movements for item turnover (how often it goes out)
    const outboundMovements = await this.movementRepo
      .createQueryBuilder('m')
      .where('m.item_id = :itemId', { itemId: item.id })
      .andWhere("m.reason IN ('PICK', 'SHIP')")
      .orderBy('m.created_at', 'DESC')
      .limit(100)
      .getMany();
    const highTurnover = outboundMovements.length > 20; // Heuristic: frequent outbound = high turnover

    for (const loc of allLocations) {
      if (!loc.capacity || loc.capacity <= 0) continue;

      // Get current inventory at this location
      const currentInv = await this.inventoryRepo.find({
        where: { location_id: loc.id },
      });
      const used = currentInv.reduce((sum, inv) => sum + parseFloat(inv.quantity || '0'), 0);
      const free = loc.capacity - used;

      if (free < qtyToPlace * 0.1) continue; // Skip if less than 10% needed space available

      const sameSkuHere = currentInv.some(inv => inv.item_id === item.id);
      const zone = (loc as any).rack?.aisle?.zone?.name || null;
      const rack = (loc as any).rack?.name || null;
      const level = loc.row ? String(loc.row) : null;

      // Distance to dock (simplified: zone A = closest, zone B/C = further)
      const distanceToDock = this.estimateDistanceToDock(zone, (loc as any).rack?.aisle?.code);

      // Scoring algorithm
      let score = 50; // Base score
      const reasons: string[] = [];

      // Bonuses
      if (sameSkuHere) {
        score += 40;
        reasons.push('Isti materijal već ovdje (konsolidacija)');
      }

      // Zone matching (if item has preferred zone, check if location matches)
      // For now, we'll check if location zone matches item category pattern
      const itemZoneMatch = this.checkZoneMatch(item, zone);
      if (itemZoneMatch) {
        score += 20;
        reasons.push('Zona odgovara tipu artikla');
      }

      // Distance bonus for high-turnover items
      if (highTurnover && distanceToDock < 20) {
        score += 10;
        reasons.push(`Blizu doka (${distanceToDock}m)`);
      }

      // Home zone bonus (if location zone matches item's preferred zone pattern)
      // This could be enhanced with item.zone_preference field in the future

      // Low fill ratio bonus (easier to visually check)
      const fillRatio = used / loc.capacity;
      if (fillRatio < 0.3) {
        score += 5;
        reasons.push('Popunjenost ispod 30%');
      } else if (fillRatio < 0.9) {
        reasons.push('Popunjenost ispod 90%');
      }

      // Penalties
      const projectedFill = (used + qtyToPlace) / loc.capacity;
      if (projectedFill > 1.0) {
        score -= 50;
        reasons.push('Prelazi kapacitet');
      } else if (projectedFill > 0.95) {
        score -= 20;
        reasons.push('Skoro pun kapacitet');
      }

      // Level penalty (high level + heavy item = safety risk)
      const isHighLevel = level && ['L4', 'L5', '4', '5'].includes(String(level).toUpperCase());
      const isHeavy = (item as any).weight_kg && parseFloat(String((item as any).weight_kg)) > 50;
      let safetyFlag: string | null = null;
      if (isHighLevel && isHeavy) {
        score -= 30;
        safetyFlag = 'VISOKA POZICIJA ZA TEŽAK ARTIKAL';
        reasons.push('Težak artikl na visini');
      }

      // HAZMAT check
      const isHazmatLocation = zone && ['HAZMAT', 'MATERIAL_STORAGE'].includes(zone.toUpperCase());
      const isHazmatItem = (item as any).hazmat || false;
      if (isHazmatLocation && !isHazmatItem) {
        score -= 10;
        reasons.push('Lokacija je HAZMAT, artikl nije');
      }

      // Capacity free bonus
      if (free >= qtyToPlace * 1.5) {
        score += 5;
        reasons.push('Mnogo slobodnog kapaciteta');
      }

      candidates.push({
        location_code: loc.code,
        zone,
        rack,
        level,
        capacity_total: loc.capacity,
        capacity_used: used,
        capacity_free: free,
        same_sku_already_here: sameSkuHere,
        distance_to_dock_m: distanceToDock,
        safety_flag: safetyFlag,
        score: Math.max(0, Math.min(100, score)), // Clamp 0-100
        reasons: reasons, // Changed from 'reason' to 'reasons'
      });
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Return top 10 candidates
    const topCandidates = candidates.slice(0, 10);

    // Determine item class and turn class
    const itemWeight = (item as any).weight_kg ? parseFloat(String((item as any).weight_kg)) : null;
    const itemLength = (item as any).length_mm ? parseFloat(String((item as any).length_mm)) : null;
    const itemClass = itemWeight && itemWeight > 50 ? 'TEŠKO' : 
                     itemLength && itemLength > 3000 ? 'DUG MATERIJAL' : 
                     itemWeight && itemWeight < 5 ? 'LAGANO' : 'STANDARDNO';
    const turnClass = highTurnover ? 'FAST' : 
                     outboundMovements.length > 10 ? 'MEDIUM' : 'SLOW';

    return {
      item: {
        sku: item.sku,
        name: item.name,
        qty_to_place: qtyToPlace,
        uom: receivingItem.quantity_uom || 'KOM',
        class: itemClass,
        turn_class: turnClass,
        hazmat: (item as any).hazmat || false,
        dimensions: {
          length_mm: itemLength,
          weight_kg: itemWeight,
        },
      },
      candidates: topCandidates,
      best_choice: topCandidates.length > 0 ? topCandidates[0].location_code : null,
    };
  }

  async applySuggestion(
    receivingItemId: number,
    locationCode: string,
    quantity: number,
    userId: number,
    userRole: string,
  ) {
    const receivingItem = await this.receivingItemRepo.findOne({
      where: { id: receivingItemId },
      relations: ['receivingDocument', 'item'],
    });

    if (!receivingItem) {
      throw new NotFoundException('Receiving item not found');
    }

    // RBAC check
    if (userRole === 'magacioner') {
      const doc = receivingItem.receivingDocument;
      if (!doc || (doc as any).assigned_to !== userId) {
        throw new ForbiddenException('Možete primeniti samo na stavke iz dodeljenih prijema');
      }
    }

    const location = await this.locationRepo.findOne({
      where: { code: locationCode } as any,
    });

    if (!location) {
      throw new NotFoundException(`Location ${locationCode} not found`);
    }

    // Check capacity
    const currentInv = await this.inventoryRepo.find({
      where: { location_id: location.id },
    });
    const used = currentInv.reduce((sum, inv) => sum + parseFloat(inv.quantity || '0'), 0);
    const available = location.capacity - used;

    const qtyToApply = Math.min(quantity, available);
    const remainingQty = quantity - qtyToApply;

    if (qtyToApply <= 0) {
      throw new BadRequestException('Nema dovoljno kapaciteta na lokaciji');
    }

    // Update receiving item
    const currentReceived = Number(receivingItem.received_quantity || 0);
    receivingItem.received_quantity = currentReceived + qtyToApply;
    receivingItem.location_id = location.id;
    await this.receivingItemRepo.save(receivingItem);

    // Update or create inventory
    let inventory = await this.inventoryRepo.findOne({
      where: { item_id: receivingItem.item_id, location_id: location.id },
    });

    if (inventory) {
      const currentQty = parseFloat(inventory.quantity || '0');
      inventory.quantity = String(currentQty + qtyToApply);
    } else {
      inventory = this.inventoryRepo.create({
        item_id: receivingItem.item_id,
        location_id: location.id,
        quantity: String(qtyToApply),
      });
    }
    await this.inventoryRepo.save(inventory);

    // Log movement
    const receivingDoc = receivingItem.receivingDocument;
    await this.movementRepo.manager.query(
      `INSERT INTO inventory_movements (item_id, from_location_id, to_location_id, quantity_change, reason, reference_document_id, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        receivingItem.item_id,
        null, // From dock/receiving
        location.id,
        qtyToApply,
        'PUTAWAY_SUGGESTED',
        receivingDoc?.id || null,
        userId,
      ]
    );

    return {
      status: 'ok',
      message: `Stavka postavljena na ${locationCode}`,
      remaining_qty: remainingQty,
      applied_qty: qtyToApply,
    };
  }

  private estimateDistanceToDock(zone: string | null, aisleCode: string | null): number {
    // Simplified: Zone A aisles 1-3 = close, Zone B/C = far
    if (!zone) return 50;
    if (zone === 'A') {
      if (aisleCode && ['1', '2', '3'].some(a => aisleCode.includes(a))) return 12;
      return 20;
    }
    if (zone === 'B') return 30;
    if (zone === 'C') return 40;
    return 50; // Default/unknown
  }

  private checkZoneMatch(item: Item, zone: string | null): boolean {
    // Heuristic: match item SKU/category pattern with zone
    // For now, simple pattern matching
    if (!zone) return false;
    
    const sku = item.sku || '';
    const name = item.name || '';
    
    // Aluminum items → Zone A
    if ((sku.toLowerCase().includes('al') || name.toLowerCase().includes('aluminij')) && zone === 'A') {
      return true;
    }
    
    // Small parts → typically smaller zones or specific racks
    // Heavy items → typically Zone A (ground level)
    
    return false; // Default: no automatic match
  }
}

