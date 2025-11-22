import { Injectable } from '@nestjs/common';

@Injectable()
export class WarehouseStructureService {
  getOverview() {
    return {
      aisles: ['PROLAZ_1', 'PROLAZ_2', 'PROLAZ_3', 'PROLAZ_4', 'PROLAZ_5', 'PROLAZ_6'],
      zones: ['OTPREMA', 'VIRTUELNA', 'RAMA', 'MAGACIN']
    };
  }

  private generateAisleData(code: string) {
    const aisleNum = parseInt(code.replace('PROLAZ_', ''));

    // Side A: REGAL 1-4, each with 3 levels (C, B, A), 10 slots per level
    const sideA = [];
    for (let rack = 1; rack <= 4; rack++) {
      const levels = [];
      for (let lev = 2; lev >= 0; lev--) {
        const levelLetter = ['C', 'B', 'A'][lev];
        const slots = [];
        for (let i = 1; i <= 10; i++) {
          const slotCode = `${aisleNum}${rack}${levelLetter}${String(i).padStart(2, '0')}`;
          slots.push({
            slot_code: slotCode,
            display: `${rack}${levelLetter}-${i}`,
            hasStock: Math.random() > 0.55,
            level: lev
          });
        }
        levels.push({ levelIndex: lev, slots });
      }
      sideA.push({ rackLabel: `REGAL ${rack}`, levels });
    }

    // Side B: REGAL 5-8, each with 3 levels (C, B, A), 10 slots per level
    const sideB = [];
    for (let rack = 5; rack <= 8; rack++) {
      const levels = [];
      for (let lev = 2; lev >= 0; lev--) {
        const levelLetter = ['C', 'B', 'A'][lev];
        const slots = [];
        for (let i = 1; i <= 10; i++) {
          const slotCode = `${aisleNum}${rack}${levelLetter}${String(i).padStart(2, '0')}`;
          slots.push({
            slot_code: slotCode,
            display: `${rack}${levelLetter}-${i}`,
            hasStock: Math.random() > 0.55,
            level: lev
          });
        }
        levels.push({ levelIndex: lev, slots });
      }
      sideB.push({ rackLabel: `REGAL ${rack}`, levels });
    }

    return {
      code,
      label: `PROLAZ ${aisleNum}`,
      flow: {
        startPointLabel: 'Početna tačka kretanja',
        showForklift: true,
        arrowsSideA: ['→','→','→','→'],
        arrowsSideB: ['←','←','←','←'],
        laneLabelTop: 'STRANA B',
        laneLabelBottom: 'STRANA A'
      },
      nav: { 
        prev: aisleNum > 1 ? `PROLAZ_${aisleNum - 1}` : null, 
        next: aisleNum < 8 ? `PROLAZ_${aisleNum + 1}` : null 
      },
      sideA,
      sideB
    };
  }

  getAisle(code: string) {
    return this.generateAisleData(code);
  }

  getSlotStock(slotCode: string) {
    return {
      slot_code: slotCode,
      items: [
        { pallet_id: '100001', sku: 'MAT000123', name: 'AL PALICE 50x50', qty: '3 KOM', total_in_warehouse: '30 KOM' },
        { pallet_id: '100007', sku: 'MAT000987', name: 'ČELIČNI PROFIL', qty: '2 KOM', total_in_warehouse: '80 KOM' }
      ]
    };
  }

  getZoneStock(zoneKey: string) {
    return {
      zone: zoneKey,
      pallets: [
        { pallet_id: '100001', items: [ { sku: 'MAT000123', name: 'Artikal 1', qty: '10 KOM' }, { sku: 'MAT000456', name: 'Artikal 2', qty: '8 KOM' } ] },
        { pallet_id: '100002', items: [ { sku: 'MAT000999', name: 'Artikal XYZ', qty: '3 KOM' } ] }
      ]
    };
  }
}


