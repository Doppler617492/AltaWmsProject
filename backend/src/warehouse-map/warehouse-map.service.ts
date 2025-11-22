import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from '../entities/location.entity';
import { LocationLabel, LabelStatus } from '../entities/location-label.entity';
import { Inventory } from '../entities/inventory.entity';

export interface ZonePalletDto {
  palletCode: string;
  items: { sku: string; name: string; qty: number; uom: string }[];
}

export interface ZoneDto {
  zoneCode: string;
  pallets: ZonePalletDto[];
}

export interface SlotDto {
  slotCode: string;         // display label e.g. 1A-1
  wmsLocationCode: string;  // database code e.g. 1A0001
  hasStock: boolean;
  totalQty: number;
}

export interface RackLevelDto {
  levelName: string; // e.g. 1A, 1B, 1C
  slots: SlotDto[];
}

export interface RackBlockDto {
  rackLabel: string; // e.g. REGAL 1
  levels: RackLevelDto[];
}

export interface AisleDto {
  aisleCode: string;      // PROLAZ_1
  displayName: string;    // PROLAZ 1
  flow: {
    arrowsSideA: string[];
    arrowsSideB: string[];
    startPointLabel?: string;
  };
  sideA: RackBlockDto[];
  sideB: RackBlockDto[];
}

export interface WarehouseStructureDto {
  aisles: AisleDto[];
  zones: {
    virtualZone: ZoneDto;
    shippingZone: ZoneDto;
    materialStorage: ZoneDto;
    ramp: ZoneDto;
  };
}

@Injectable()
export class WarehouseMapService {
  constructor(
    @InjectRepository(Location)
    private locationRepo: Repository<Location>,
    @InjectRepository(LocationLabel)
    private labelRepo: Repository<LocationLabel>,
    @InjectRepository(Inventory)
    private inventoryRepo: Repository<Inventory>,
  ) {}
  private generateAisle(aisleIndex: number): AisleDto {
    const makeRackBlock = (rackFrom: number, rackTo: number): RackBlockDto[] => {
      const blocks: RackBlockDto[] = [];
      for (let rack = rackFrom; rack <= rackTo; rack++) {
        const levels: RackLevelDto[] = [];
        for (const levelName of ['1C', '1B', '1A']) {
          const slots: SlotDto[] = [];
          for (let s = 1; s <= 3; s++) {
            const slotCode = `${levelName}-${s}`;
            const wmsLocationCode = `${levelName.replace('1','')}${String(s).padStart(4, '0')}`.replace('-', '');
            const hasStock = Math.random() > 0.5;
            const totalQty = hasStock ? Math.floor(Math.random() * 50) + 1 : 0;
            slots.push({ slotCode: `${levelName}-${s}`, wmsLocationCode, hasStock, totalQty });
          }
          levels.push({ levelName, slots });
        }
        blocks.push({ rackLabel: `REGAL ${rack}`, levels });
      }
      return blocks;
    };

    return {
      aisleCode: `PROLAZ_${aisleIndex}`,
      displayName: `PROLAZ ${aisleIndex}`,
      flow: {
        arrowsSideA: ['→','→','→'],
        arrowsSideB: ['←','←','←'],
        startPointLabel: 'Početna tačka kretanja'
      },
      sideA: makeRackBlock(1, 5),
      sideB: makeRackBlock(6, 10)
    };
  }

  getOverviewStructure(): WarehouseStructureDto {
    const aisles: AisleDto[] = Array.from({ length: 10 }, (_, i) => this.generateAisle(i + 1));
    return {
      aisles,
      zones: {
        virtualZone: {
          zoneCode: 'VIRTUELNA',
          pallets: [
            { palletCode: '100001', items: [{ sku: 'MAT-001', name: 'Profil A', qty: 10, uom: 'KOM' }]},
            { palletCode: '100002', items: [{ sku: 'MAT-002', name: 'Profil B', qty: 8, uom: 'KOM' }]}
          ]
        },
        shippingZone: {
          zoneCode: 'OTPREMNA',
          pallets: [
            { palletCode: '200001', items: [{ sku: 'MAT-003', name: 'Set C', qty: 4, uom: 'KOM' }]}
          ]
        },
        materialStorage: {
          zoneCode: 'MAGACIN',
          pallets: []
        },
        ramp: {
          zoneCode: 'RAMPA',
          pallets: []
        }
      }
    };
  }

  getAisle(aisleCode: string): AisleDto {
    const idx = parseInt(aisleCode.replace('PROLAZ_', '')) || 1;
    return this.generateAisle(idx);
  }

  async getLiveStock() {
    // Get all real locations from DB
    const allLocations = await this.locationRepo.find({
      relations: ['rack', 'rack.aisle', 'rack.aisle.zone'],
    });

    // Get all labels for label_status
    const allLabels = await this.labelRepo.find();
    const labelMap = new Map(allLabels.map(l => [l.location_code, l.status]));

    const liveStock = [];

    for (const loc of allLocations) {
      // Get inventory at this location
      const inv = await this.inventoryRepo.find({
        where: { location_id: loc.id },
      });
      const totalQty = inv.reduce((sum, i) => sum + parseFloat(i.quantity || '0'), 0);
      const capacity = loc.capacity || 1000;
      const fillPercent = capacity > 0 ? Math.round((totalQty / capacity) * 100) : 0;

      let status = 'EMPTY';
      if (fillPercent > 100) status = 'OVERLOADED';
      else if (fillPercent >= 76) status = 'FULL';
      else if (fillPercent >= 26) status = 'NORMAL';
      else if (fillPercent >= 1) status = 'LOW';

      // Get label status
      const labelStatus = labelMap.get(loc.code) || LabelStatus.NEW;

      liveStock.push({
        slot_code: loc.code,
        location_code: loc.code,
        fill_percent: fillPercent,
        capacity,
        total_qty: totalQty,
        status,
        label_status: labelStatus,
      });
    }

    // Also include generated slots for demo (if no real locations exist)
    if (liveStock.length === 0) {
      const aisles = [1, 2, 3, 4, 5];
      for (const aisleNum of aisles) {
        const aisleData = this.generateAisle(aisleNum);
        for (const rack of [...aisleData.sideA, ...aisleData.sideB]) {
          for (const level of rack.levels) {
            for (const slot of level.slots) {
              const fillPercent = Math.floor(Math.random() * 120);
              const capacity = 500;
              const totalQty = Math.floor((fillPercent / 100) * capacity);

              let status = 'EMPTY';
              if (fillPercent > 100) status = 'OVERLOADED';
              else if (fillPercent >= 76) status = 'FULL';
              else if (fillPercent >= 26) status = 'NORMAL';
              else if (fillPercent >= 1) status = 'LOW';

              const labelStatus = labelMap.get(slot.wmsLocationCode) || LabelStatus.NEW;

              liveStock.push({
                slot_code: slot.wmsLocationCode,
                location_code: slot.slotCode,
                fill_percent: fillPercent,
                capacity,
                total_qty: totalQty,
                status,
                label_status: labelStatus,
              });
            }
          }
        }
      }
    }

    return liveStock;
  }
}


