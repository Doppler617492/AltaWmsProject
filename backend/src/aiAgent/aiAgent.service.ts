import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item } from '../entities/item.entity';
import { StockLocation } from '../entities/stock-location.entity';
import { Location } from '../entities/location.entity';
import { WarehouseService } from '../warehouse/warehouse.service';
import { ReceivingDocument, ReceivingStatus } from '../entities/receiving-document.entity';
import { ReceivingItem, ItemStatus } from '../entities/receiving-item.entity';

@Injectable()
export class AiAgentService {
  constructor(
    @InjectRepository(Item)
    private itemRepository: Repository<Item>,
    @InjectRepository(StockLocation)
    private stockLocationRepository: Repository<StockLocation>,
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    @InjectRepository(ReceivingDocument)
    private receivingDocumentRepository: Repository<ReceivingDocument>,
    @InjectRepository(ReceivingItem)
    private receivingItemRepository: Repository<ReceivingItem>,
    private warehouseService: WarehouseService,
  ) {}

  async askAgent(question: string): Promise<{ answer: string; highlight?: any; path?: string[] }> {
    // Log pitanje na server
    console.log(`🤖 AI Agent received question: "${question}"`);
    
    // Pokušaj da prepoznaš pitanje o lokaciji artikla po SKU
    const locationMatch = question.match(/(?:gde|gdje|na kojoj|koja lokacija).*?(?:artikal|artikla|item|sku|šifra)?\s*([A-Z0-9]{10,})/i);
    
    if (locationMatch) {
      const sku = locationMatch[1];
      return this.findItemLocationWithPath(sku);
    }
    
    // Pokušaj da prepoznaš pitanje po imenu artikla
    const nameMatch = question.match(/(?:gde|gdje|na kojoj|koja lokacija).*?([A-Za-z0-9\s\(\)]+)/i);
    
    if (nameMatch) {
      const itemName = nameMatch[1].trim();
      return this.findItemLocationByName(itemName);
    }

    // Pokušaj da prepoznaš pitanje o regalu
    const rackMatch = question.match(/(?:prikaži|pokaži|idi do|regal)\s*(\d+)\s*(?:strana\s*([AB]))?/i);
    if (rackMatch) {
      const rackNumber = rackMatch[1];
      const side = rackMatch[2] || 'A';
      return this.findRackLocation(rackNumber, side);
    }

    // Pokušaj da prepoznaš pitanje o prolazu
    const aisleMatch = question.match(/(?:prikaži|pokaži|idi do|prolaz)\s*(\d+)/i);
    if (aisleMatch) {
      const aisleNumber = aisleMatch[1];
      return this.findAisleLocation(aisleNumber);
    }

    // Receiving Assistant komande
    if (question.match(/prijeme.*?(?:u toku|nekomplet)/i)) {
      return this.findInProgressReceiving();
    }

    const freeLocationsMatch = question.match(/(?:koja|koje) lokaci(?:ija|je).*?(?:slobodn|prazn)/i);
    if (freeLocationsMatch) {
      return this.findFreeLocations();
    }

    const receivingTasksMatch = question.match(/(?:prikaži|pokaži|koji).*?(?:zadaci|taskovi).*?(?:u toku)/i);
    if (receivingTasksMatch) {
      return this.findReceivingTasks();
    }

    const locationPathMatch = question.match(/(?:generiši|prikaži|pokaži).*?(?:putanju|route).*?(?:lokacij)/i);
    if (locationPathMatch) {
      return this.generateLocationPath();
    }
    
    // Za fazu 0 vraćamo dummy odgovor
    return {
      answer: 'Još nisam obučen za ovu operaciju.',
    };
  }

  private async findItemLocationWithPath(sku: string): Promise<{ answer: string; highlight?: any; path?: string[] }> {
    try {
      const pathData = await this.warehouseService.getPathToItem(sku);
      
      if (!pathData) {
        return {
          answer: `Ne vidim artikal sa šifrom ${sku} u skladištu.`,
        };
      }

      const locations = pathData.locations.map(loc => 
        `${loc.location_code} (paleta ${loc.item_info.pallet_id}) količina ${loc.item_info.quantity} ${loc.item_info.uom}`
      ).join('; ');

      const firstLocation = pathData.locations[0];
      
      if (!firstLocation) {
        return {
          answer: `Artikal ${sku} (${pathData.item.name}) nije trenutno u skladištu.`,
        };
      }
      
      return {
        answer: `Artikal ${sku} (${pathData.item.name}) se nalazi na: ${locations}.`,
        highlight: {
          type: 'location',
          code: firstLocation.location_code,
          coordinates: firstLocation.coordinates
        },
        path: firstLocation.path
      };
    } catch (error) {
      console.error('Error finding item location with path:', error);
      return {
        answer: 'Greška pri pretraživanju lokacije artikla.',
      };
    }
  }

  private async findItemLocationByName(itemName: string): Promise<{ answer: string }> {
    try {
      const items = await this.itemRepository
        .createQueryBuilder('item')
        .leftJoinAndSelect('item.stockLocations', 'stock')
        .where('item.name ILIKE :name OR item.sku ILIKE :name', { name: `%${itemName}%` })
        .getMany();

      if (items.length === 0) {
        return {
          answer: `Ne vidim artikal "${itemName}" u skladištu.`,
        };
      }

      const results = items.map(item => {
        if (!item.stockLocations || item.stockLocations.length === 0) {
          return `${item.sku} (${item.name}) nije trenutno u skladištu.`;
        }

        const locations = item.stockLocations.map(loc => 
          `${loc.location_code} (paleta ${loc.pallet_id}) količina ${loc.quantity_value} ${loc.quantity_uom}`
        ).join('; ');

        return `${item.sku} (${item.name}) se nalazi na: ${locations}.`;
      });

      return {
        answer: results.join('\n'),
      };
    } catch (error) {
      console.error('Error finding item location by name:', error);
      return {
        answer: 'Greška pri pretraživanju lokacije artikla.',
      };
    }
  }

  private async findRackLocation(rackNumber: string, side: string): Promise<{ answer: string; highlight?: any }> {
    try {
      const locations = await this.locationRepository
        .createQueryBuilder('location')
        .leftJoinAndSelect('location.rack', 'rack')
        .leftJoinAndSelect('rack.aisle', 'aisle')
        .where('rack.name = :name AND rack.side = :side', { 
          name: `REGAL ${rackNumber}`, 
          side: side 
        })
        .getMany();

      if (locations.length === 0) {
        return {
          answer: `Ne vidim REGAL ${rackNumber} strana ${side} u skladištu.`,
        };
      }

      const firstLocation = locations[0];
      const aisleCode = firstLocation.rack.aisle.code;
      
      return {
        answer: `REGAL ${rackNumber} strana ${side} se nalazi u ${aisleCode}.`,
        highlight: {
          type: 'rack',
          rack: `REGAL ${rackNumber}`,
          side: side,
          aisle: aisleCode
        }
      };
    } catch (error) {
      console.error('Error finding rack location:', error);
      return {
        answer: 'Greška pri pretraživanju lokacije regala.',
      };
    }
  }

  private async findAisleLocation(aisleNumber: string): Promise<{ answer: string; highlight?: any }> {
    try {
      const locations = await this.locationRepository
        .createQueryBuilder('location')
        .leftJoinAndSelect('location.rack', 'rack')
        .leftJoinAndSelect('rack.aisle', 'aisle')
        .where('aisle.code = :code', { code: `PROLAZ ${aisleNumber}` })
        .getMany();

      if (locations.length === 0) {
        return {
          answer: `Ne vidim PROLAZ ${aisleNumber} u skladištu.`,
        };
      }

      const firstLocation = locations[0];
      const zoneName = firstLocation.rack.aisle.zone.name;
      
      return {
        answer: `PROLAZ ${aisleNumber} se nalazi u ${zoneName}.`,
        highlight: {
          type: 'aisle',
          aisle: `PROLAZ ${aisleNumber}`,
          zone: zoneName
        }
      };
    } catch (error) {
      console.error('Error finding aisle location:', error);
      return {
        answer: 'Greška pri pretraživanju lokacije prolaza.',
      };
    }
  }

  // Receiving Assistant methods
  private async findInProgressReceiving(): Promise<{ answer: string }> {
    try {
      const documents = await this.receivingDocumentRepository.find({
        where: { status: ReceivingStatus.IN_PROGRESS },
        relations: ['supplier', 'items', 'items.item'],
      });

      if (documents.length === 0) {
        return {
          answer: 'Nema prijema u toku.',
        };
      }

      const results = documents.map(doc => 
        `${doc.document_number} - ${doc.supplier.name} (${doc.items.length} artikala)`
      ).join('\n');

      return {
        answer: `Prijemi u toku:\n${results}`,
      };
    } catch (error) {
      console.error('Error finding in-progress receiving:', error);
      return {
        answer: 'Greška pri pretraživanju prijema.',
      };
    }
  }

  private async findFreeLocations(): Promise<{ answer: string }> {
    try {
      const emptyLocations = await this.locationRepository
        .createQueryBuilder('location')
        .leftJoinAndSelect('location.statuses', 'status')
        .where('status.occupancy = :occupancy', { occupancy: 'empty' })
        .getMany();

      if (emptyLocations.length === 0) {
        return {
          answer: 'Nema slobodnih lokacija u skladištu.',
        };
      }

      return {
        answer: `Pronađeno ${emptyLocations.length} slobodnih lokacija.`,
      };
    } catch (error) {
      console.error('Error finding free locations:', error);
      return {
        answer: 'Greška pri pretraživanju slobodnih lokacija.',
      };
    }
  }

  private async findReceivingTasks(): Promise<{ answer: string }> {
    try {
      const tasks = await this.receivingItemRepository.find({
        where: { status: ItemStatus.PENDING },
        relations: ['receivingDocument', 'item'],
      });

      if (tasks.length === 0) {
        return {
          answer: 'Nema zadataka za prijem.',
        };
      }

      const results = tasks.map(task => 
        `${task.item.name} - ${task.expected_quantity} kom (Dokument: ${task.receivingDocument.document_number})`
      ).join('\n');

      return {
        answer: `Zadaci za prijem:\n${results}`,
      };
    } catch (error) {
      console.error('Error finding receiving tasks:', error);
      return {
        answer: 'Greška pri pretraživanju zadataka.',
      };
    }
  }

  private async generateLocationPath(): Promise<{ answer: string; path?: string[] }> {
    try {
      // Example path for receiving workflow
      const path = ['ULAZ', 'PROLAZ 1', 'REGAL 1', 'LOKACIJA 1A-1-1'];
      return {
        answer: 'Predložena putanja: ULAZ → PROLAZ 1 → REGAL 1 → LOKACIJA 1A-1-1',
        path,
      };
    } catch (error) {
      console.error('Error generating location path:', error);
      return {
        answer: 'Greška pri generisanju putanje.',
      };
    }
  }
}