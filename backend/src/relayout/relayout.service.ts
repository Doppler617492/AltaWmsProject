import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from '../entities/location.entity';
import { Inventory } from '../entities/inventory.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { Item } from '../entities/item.entity';

export interface PressureMapItem {
  zone: string | null;
  aisle: string | null;
  rack: string | null;
  capacity_total: number;
  capacity_used: number;
  utilization_pct: number;
  fast_movers_inside_pct: number;
  avg_distance_to_dock_m: number;
  split_sku_count: number;
  risk: 'CRITICAL' | 'UNDERUTILIZED' | 'GOOD';
}

export interface RelayoutRecommendation {
  action: 'PREMESTI SKU' | 'ZATVORI LOKACIJU' | 'RAZDELI SKU';
  sku?: string;
  location_code?: string;
  reason: string;
  current_locations?: string[];
  suggest_new_zone?: string;
  proposed_use?: string;
  impact?: string;
}

@Injectable()
export class RelayoutService {
  constructor(
    @InjectRepository(Location)
    private locationRepo: Repository<Location>,
    @InjectRepository(Inventory)
    private inventoryRepo: Repository<Inventory>,
    @InjectRepository(InventoryMovement)
    private movementRepo: Repository<InventoryMovement>,
    @InjectRepository(Item)
    private itemRepo: Repository<Item>,
  ) {}

  async getPressureMap() {
    const allLocations = await this.locationRepo.find({
      relations: ['rack', 'rack.aisle', 'rack.aisle.zone'],
    });

    // Group by rack
    const byRack = new Map<string, {
      zone: string | null;
      aisle: string | null;
      rack: string;
      locations: Location[];
    }>();

    for (const loc of allLocations) {
      const rack = (loc as any).rack;
      const rackCode = rack?.name || 'UNKNOWN';
      const zone = (rack)?.aisle?.zone?.name || null;
      const aisle = (rack)?.aisle?.code || null;

      if (!byRack.has(rackCode)) {
        byRack.set(rackCode, {
          zone,
          aisle,
          rack: rackCode,
          locations: [],
        });
      }
      byRack.get(rackCode).locations.push(loc);
    }

    const pressureMap: PressureMapItem[] = [];

    for (const [rackCode, data] of byRack.entries()) {
      let totalCapacity = 0;
      let totalUsed = 0;
      const itemsInRack = new Set<number>();
      const skuLocations = new Map<number, Set<number>>(); // item_id -> set of location_ids

      for (const loc of data.locations) {
        if (!loc.capacity || loc.capacity <= 0) continue;

        totalCapacity += loc.capacity;

        const inv = await this.inventoryRepo.find({
          where: { location_id: loc.id },
        });

        const used = inv.reduce((sum, i) => sum + parseFloat(i.quantity || '0'), 0);
        totalUsed += used;

        inv.forEach(i => {
          itemsInRack.add(i.item_id);
          if (!skuLocations.has(i.item_id)) {
            skuLocations.set(i.item_id, new Set());
          }
          skuLocations.get(i.item_id).add(loc.id);
        });
      }

      if (totalCapacity === 0) continue;

      const utilization = (totalUsed / totalCapacity) * 100;

      // Calculate fast movers percentage (items with >20 outbound movements in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let fastMoverCount = 0;
      for (const itemId of itemsInRack) {
        const movements = await this.movementRepo
          .createQueryBuilder('m')
          .where('m.item_id = :itemId', { itemId })
          .andWhere("m.reason IN ('PICK', 'SHIP')")
          .andWhere('m.created_at >= :since', { since: thirtyDaysAgo })
          .getCount();

        if (movements > 20) {
          fastMoverCount++;
        }
      }

      const fastMoversPct = itemsInRack.size > 0 ? (fastMoverCount / itemsInRack.size) * 100 : 0;

      // Estimate distance to dock (simplified: Zone A = close, B/C = far)
      const avgDistance = this.estimateAvgDistance(data.zone, data.aisle);

      // Count split SKUs (same SKU in multiple locations in this rack)
      let splitSkuCount = 0;
      for (const [itemId, locIds] of skuLocations.entries()) {
        if (locIds.size > 1) {
          splitSkuCount++;
        }
      }

      // Determine risk
      let risk: 'CRITICAL' | 'UNDERUTILIZED' | 'GOOD' = 'GOOD';
      if (utilization > 90 && fastMoversPct > 50) {
        risk = 'CRITICAL';
      } else if (utilization < 50 && avgDistance > 30) {
        risk = 'UNDERUTILIZED';
      }

      pressureMap.push({
        zone: data.zone,
        aisle: data.aisle,
        rack: rackCode,
        capacity_total: totalCapacity,
        capacity_used: totalUsed,
        utilization_pct: Math.round(utilization * 10) / 10,
        fast_movers_inside_pct: Math.round(fastMoversPct * 10) / 10,
        avg_distance_to_dock_m: Math.round(avgDistance * 10) / 10,
        split_sku_count: splitSkuCount,
        risk,
      });
    }

    return pressureMap.sort((a, b) => {
      if (a.risk === 'CRITICAL' && b.risk !== 'CRITICAL') return -1;
      if (b.risk === 'CRITICAL' && a.risk !== 'CRITICAL') return 1;
      return b.utilization_pct - a.utilization_pct;
    });
  }

  async getRecommendations() {
    const recommendations: RelayoutRecommendation[] = [];

    // 1. Find fast-movers in critical zones
    const pressureMap = await this.getPressureMap();
    const criticalZones = pressureMap.filter(p => p.risk === 'CRITICAL');

    for (const critical of criticalZones) {
      // Get all locations in this rack
      const locations = await this.locationRepo
        .createQueryBuilder('loc')
        .leftJoinAndSelect('loc.rack', 'rack')
        .leftJoinAndSelect('rack.aisle', 'aisle')
        .leftJoinAndSelect('aisle.zone', 'zone')
        .where('rack.name = :rackCode', { rackCode: critical.rack })
        .getMany();

      // Find fast-moving items in this zone
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      for (const loc of locations) {
        const inv = await this.inventoryRepo.find({
          where: { location_id: loc.id },
        });

        for (const invItem of inv) {
          const movements = await this.movementRepo
            .createQueryBuilder('m')
            .where('m.item_id = :itemId', { itemId: invItem.item_id })
            .andWhere("m.reason IN ('PICK', 'SHIP')")
            .andWhere('m.created_at >= :since', { since: thirtyDaysAgo })
            .getCount();

          if (movements > 20) {
            const item = await this.itemRepo.findOne({ where: { id: invItem.item_id } });
            if (!item) continue;

            // Find other locations with same SKU
            const otherInv = await this.inventoryRepo.find({
              where: { item_id: invItem.item_id },
            });
            const currentLocations = otherInv.map(i => {
              const otherLoc = locations.find(l => l.id === i.location_id);
              return otherLoc?.code || null;
            }).filter(Boolean);

            // Find underutilized zone for relocation
            const underutilized = pressureMap.find(p => 
              p.risk === 'UNDERUTILIZED' && p.zone !== critical.zone
            );

            if (underutilized && !recommendations.find(r => r.sku === item.sku)) {
              recommendations.push({
                action: 'PREMESTI SKU',
                sku: item.sku,
                reason: `Fast-mover zagušava zonu ${critical.zone} (${critical.utilization_pct}% popunjena).`,
                current_locations: currentLocations,
                suggest_new_zone: `${underutilized.zone} / ${underutilized.aisle} / ${underutilized.rack}`,
                impact: `Oslobodićeš ${Math.round((critical.utilization_pct - underutilized.utilization_pct) / 10)}% prostora u zoni ${critical.zone}.`,
              });
            }
          }
        }
      }
    }

    // 2. Find over-capacity locations with safety flags
    const allLocations = await this.locationRepo.find({
      relations: ['rack', 'rack.aisle', 'rack.aisle.zone'],
    });

    for (const loc of allLocations) {
      if (!loc.capacity || loc.capacity <= 0) continue;

      const inv = await this.inventoryRepo.find({
        where: { location_id: loc.id },
      });
      const used = inv.reduce((sum, i) => sum + parseFloat(i.quantity || '0'), 0);
      const fillRatio = used / loc.capacity;

      // Check for heavy items on high levels
      const isHighLevel = loc.row && ['4', '5'].includes(String(loc.row));
      let hasHeavyItems = false;
      for (const i of inv) {
        const item = await this.itemRepo.findOne({ where: { id: i.item_id } });
        if (item && (item as any).weight_kg && parseFloat(String((item as any).weight_kg)) > 50) {
          hasHeavyItems = true;
          break;
        }
      }

      if (fillRatio > 1.0 && isHighLevel && hasHeavyItems) {
        recommendations.push({
          action: 'ZATVORI LOKACIJU',
          location_code: loc.code,
          reason: `Slot je over-capacity i označen safety_flag=HEAVY_HIGH`,
          proposed_use: 'Rezervisati samo za lagane artikle <5kg.',
        });
      }
    }

    // 3. Find split SKUs (same SKU in multiple locations in same zone)
    const byZone = new Map<string, Map<number, number[]>>(); // zone -> item_id -> location_ids[]

    for (const loc of allLocations) {
      const zone = (loc as any).rack?.aisle?.zone?.name || 'UNKNOWN';
      const inv = await this.inventoryRepo.find({
        where: { location_id: loc.id },
      });

      for (const invItem of inv) {
        if (!byZone.has(zone)) {
          byZone.set(zone, new Map());
        }
        const zoneMap = byZone.get(zone);
        if (!zoneMap.has(invItem.item_id)) {
          zoneMap.set(invItem.item_id, []);
        }
        zoneMap.get(invItem.item_id).push(loc.id);
      }
    }

    for (const [zone, itemMap] of byZone.entries()) {
      for (const [itemId, locIds] of itemMap.entries()) {
        if (locIds.length > 3) {
          const item = await this.itemRepo.findOne({ where: { id: itemId } });
          if (!item) continue;

          const locationCodes = locIds.map(id => {
            const loc = allLocations.find(l => l.id === id);
            return loc?.code || '';
          }).filter(Boolean);

          if (!recommendations.find(r => r.sku === item.sku && r.action === 'RAZDELI SKU')) {
            recommendations.push({
              action: 'RAZDELI SKU',
              sku: item.sku,
              reason: `SKU je splitovan na ${locIds.length} različitih lokacija u zoni ${zone}`,
              current_locations: locationCodes,
              impact: 'Konsoliduj u 1-2 lokacije radi bolje efikasnosti.',
            });
          }
        }
      }
    }

    return recommendations.slice(0, 20); // Top 20 recommendations
  }

  private estimateAvgDistance(zone: string | null, aisle: string | null): number {
    if (!zone) return 50;
    if (zone === 'A') {
      if (aisle && ['1', '2', '3'].some(a => aisle.includes(a))) return 12;
      return 20;
    }
    if (zone === 'B') return 30;
    if (zone === 'C') return 40;
    return 50;
  }
}

