import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Zone } from '../entities/zone.entity';
import { Aisle } from '../entities/aisle.entity';
import { Rack } from '../entities/rack.entity';
import { Location } from '../entities/location.entity';
import { LocationStatus, OccupancyStatus } from '../entities/location-status.entity';
import { StockLocation } from '../entities/stock-location.entity';
import { Item } from '../entities/item.entity';

@Injectable()
export class WarehouseService {
  constructor(
    @InjectRepository(Zone)
    private zoneRepository: Repository<Zone>,
    @InjectRepository(Aisle)
    private aisleRepository: Repository<Aisle>,
    @InjectRepository(Rack)
    private rackRepository: Repository<Rack>,
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    @InjectRepository(LocationStatus)
    private statusRepository: Repository<LocationStatus>,
    @InjectRepository(StockLocation)
    private stockLocationRepository: Repository<StockLocation>,
    @InjectRepository(Item)
    private itemRepository: Repository<Item>,
  ) {}

  // Map methods removed

  async getLocationDetails(code: string) {
    const location = await this.locationRepository.findOne({
      where: { code },
      relations: ['rack', 'rack.aisle', 'rack.aisle.zone', 'stockLocations', 'stockLocations.item', 'statuses']
    });

    if (!location) {
      return null;
    }

    return {
      id: location.id,
      code: location.code,
      row: location.row,
      column: location.column,
      x: location.x,
      y: location.y,
      width: location.width,
      height: location.height,
      capacity: location.capacity,
      is_active: location.is_active,
      status: location.statuses[0]?.occupancy || OccupancyStatus.EMPTY,
      rack: {
        name: location.rack.name,
        side: location.rack.side,
        aisle: {
          code: location.rack.aisle.code,
          zone: {
            name: location.rack.aisle.zone.name,
            color: location.rack.aisle.zone.color
          }
        }
      },
      items: location.stockLocations.map(stock => ({
        item: {
          id: stock.item.id,
          sku: stock.item.sku,
          name: stock.item.name
        },
        pallet_id: stock.pallet_id,
        quantity_value: stock.quantity_value,
        quantity_uom: stock.quantity_uom,
        received_at: stock.received_at
      }))
    };
  }

  async getLocationStock(code: string) {
    const location = await this.locationRepository.findOne({
      where: { code },
      relations: ['stockLocations', 'stockLocations.item']
    });

    if (!location) {
      return { items: [] };
    }

    const items = location.stockLocations.map(stock => ({
      sku: stock.item.sku,
      item_sku: stock.item.sku,
      naziv: stock.item.name,
      item_name: stock.item.name,
      qty: stock.quantity_value,
      quantity: stock.quantity_value,
      uom: stock.quantity_uom,
      paleta: stock.pallet_id || 'BEZ PALETE',
      pallet_id: stock.pallet_id
    }));

    return { items };
  }

  async getWarehouseOverview() {
    const zones = await this.zoneRepository.find({
      relations: ['aisles', 'aisles.racks', 'aisles.racks.locations', 'aisles.racks.locations.statuses']
    });

    const overview = zones.map(zone => {
      let totalLocations = 0;
      let emptyLocations = 0;
      let partialLocations = 0;
      let fullLocations = 0;

      zone.aisles.forEach(aisle => {
        aisle.racks.forEach(rack => {
          rack.locations.forEach(location => {
            totalLocations++;
            const status = location.statuses[0]?.occupancy || OccupancyStatus.EMPTY;
            switch (status) {
              case OccupancyStatus.EMPTY:
                emptyLocations++;
                break;
              case OccupancyStatus.PARTIAL:
                partialLocations++;
                break;
              case OccupancyStatus.FULL:
                fullLocations++;
                break;
            }
          });
        });
      });

      return {
        zone: {
          id: zone.id,
          name: zone.name,
          color: zone.color
        },
        statistics: {
          total_locations: totalLocations,
          empty_locations: emptyLocations,
          partial_locations: partialLocations,
          full_locations: fullLocations,
          occupancy_rate: totalLocations > 0 ? ((partialLocations + fullLocations) / totalLocations * 100).toFixed(1) : '0'
        }
      };
    });

    return { zones: overview };
  }

  async getPathToItem(sku: string) {
    const item = await this.itemRepository.findOne({
      where: { sku },
      relations: ['stockLocations', 'stockLocations.location', 'stockLocations.location.rack', 'stockLocations.location.rack.aisle', 'stockLocations.location.rack.aisle.zone']
    });

    if (!item || !item.stockLocations.length) {
      return null;
    }

    const paths = item.stockLocations
      .filter(stock => stock.location) // Filter out null locations
      .map(stock => {
        const location = stock.location;
        const rack = location.rack;
        const aisle = rack.aisle;
        const zone = aisle.zone;

        return {
          location_code: location.code,
          path: ['ULAZ', zone.name, aisle.code, `${rack.name} ${rack.side}`, location.code],
          coordinates: {
            x: location.x,
            y: location.y
          },
          item_info: {
            sku: item.sku,
            name: item.name,
            quantity: stock.quantity_value,
            uom: stock.quantity_uom,
            pallet_id: stock.pallet_id
          }
        };
      });

    return {
      item: {
        sku: item.sku,
        name: item.name
      },
      locations: paths
    };
  }

  async updateLocationCoordinates(locationId: number, x: number, y: number) {
    await this.locationRepository.update(locationId, { x, y });
    return { success: true };
  }
}
