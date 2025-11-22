import { DataSource } from 'typeorm';
import { Zone } from '../entities/zone.entity';
import { Aisle } from '../entities/aisle.entity';
import { Rack } from '../entities/rack.entity';
import { Location } from '../entities/location.entity';
import { LocationStatus, OccupancyStatus } from '../entities/location-status.entity';
import { StockLocation } from '../entities/stock-location.entity';

export async function seedWarehouse(dataSource: DataSource) {
  const zoneRepo = dataSource.getRepository(Zone);
  const aisleRepo = dataSource.getRepository(Aisle);
  const rackRepo = dataSource.getRepository(Rack);
  const locationRepo = dataSource.getRepository(Location);
  const statusRepo = dataSource.getRepository(LocationStatus);
  const stockLocationRepo = dataSource.getRepository(StockLocation);

  // Always clear and reseed warehouse for real structure
  await zoneRepo.clear();
  await aisleRepo.clear();
  await rackRepo.clear();
  await locationRepo.clear();
  console.log('🏗️ Cleared old data, starting warehouse seed...');

  // Create zones
  const zone1 = await zoneRepo.save({
    name: 'GLAVNO SKLADIŠTE',
    color: '#FFD600',
    is_virtual: false,
  });

  const zone2 = await zoneRepo.save({
    name: 'OTPREMNA ZONA',
    color: '#FF6B35',
    is_virtual: false,
  });

  // Create 10 aisles as per your real warehouse structure
  const aisles = [];
  for (let i = 1; i <= 10; i++) {
    const aisle = await aisleRepo.save({
      zone_id: zone1.id,
      code: `PROLAZ ${i}`,
      order_index: i,
    });
    aisles.push(aisle);
  }

  // Create racks (10 per aisle)
  // PROLAZ 7 has only A side, all others have both A and B sides
  const racks = [];
  for (const aisle of aisles) {
    const isAisle7 = aisle.order_index === 7;
    
    for (let i = 1; i <= 10; i++) {
      // Always create A side
      const rackA = await rackRepo.save({
        aisle_id: aisle.id,
        name: `REGAL ${i}`,
        side: 'A',
        length: 2.0,
        height: 4.0,
      });
      racks.push({ ...rackA, aisle });

      // Create B side only if not aisle 7
      if (!isAisle7) {
        const rackB = await rackRepo.save({
          aisle_id: aisle.id,
          name: `REGAL ${i}`,
          side: 'B',
          length: 2.0,
          height: 4.0,
        });
        racks.push({ ...rackB, aisle });
      }
    }
  }

  // Create locations (4 levels × 3 pallet positions = 12 per rack)
  const locations = [];
  let locationCounter = 0;

  const levelLabels = ['4', '3', '2', '1']; // Top to bottom

  for (const rack of racks) {
    for (let level = 1; level <= 4; level++) {
      for (let pos = 1; pos <= 3; pos++) {
        const levelLabel = levelLabels[level - 1];
        const x = 100 + (rack.aisle.order_index - 1) * 200 + (rack.side === 'A' ? 0 : 100) + (pos - 1) * 50;
        const y = 100 + (rack.id % 12) * 80 + (level - 1) * 20;

        const location = await locationRepo.save({
          rack_id: rack.id,
          code: `${rack.aisle.code.replace('PROLAZ ', '')}${rack.side}-${levelLabel}-${pos}`,
          row: level,
          column: pos,
          x,
          y,
          width: 40,
          height: 15,
          capacity: 1,
          is_active: true,
        });
        locations.push(location);

        // Create location status
        await statusRepo.save({
          location_id: location.id,
          occupancy: OccupancyStatus.EMPTY,
        });

        locationCounter++;
      }
    }
  }

  // Update existing stock locations to reference new locations
  const existingStockLocations = await stockLocationRepo.find();
  for (const stockLoc of existingStockLocations) {
    // Find matching location by code
    const matchingLocation = locations.find(loc => 
      loc.code === stockLoc.location_code || 
      loc.code.replace('-', '-') === stockLoc.location_code.replace('-', '-')
    );

    if (matchingLocation) {
      stockLoc.location_id = matchingLocation.id;
      await stockLocationRepo.save(stockLoc);

      // Update location status to occupied
      await statusRepo.update(
        { location_id: matchingLocation.id },
        { occupancy: OccupancyStatus.PARTIAL }
      );
    }
  }

  console.log(`✅ Warehouse seeded successfully:`);
  console.log(`   Zones: 2 | Aisles: 10 | Racks: ${racks.length} | Locations: ${locationCounter}`);
}
