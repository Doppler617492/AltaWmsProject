import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Store } from '../entities/store.entity';
import { CunguStockService } from '../integrations/cungu/cungu-stock.service';

@Injectable()
export class StoresService {
  private readonly logger = new Logger(StoresService.name);

  constructor(
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    private readonly cunguStockService: CunguStockService,
  ) {}

  async findAll(): Promise<Store[]> {
    return this.storeRepository.find({
      where: { is_active: true },
      order: { name: 'ASC' },
    });
  }

  async findByCodes(codes: string[]): Promise<Store[]> {
    if (!codes.length) return [];
    return this.storeRepository.find({
      where: { code: In(codes) },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Store> {
    return this.storeRepository.findOne({ where: { id } });
  }

  async create(storeData: Partial<Store>): Promise<Store> {
    const store = this.storeRepository.create(storeData);
    return this.storeRepository.save(store);
  }

  async update(id: number, storeData: Partial<Store>): Promise<Store> {
    await this.storeRepository.update(id, storeData);
    return this.findOne(id);
  }

  async delete(id: number): Promise<void> {
    await this.storeRepository.delete(id);
  }

  /**
   * Sync stores from Cungu getStock API by extracting unique store names from Objekti arrays.
   * Uses ORIGINAL Pantheon names (no MP conversion).
   */
  async syncStoresFromStockAPI(): Promise<{ created: number; updated: number; total: number }> {
    this.logger.log('Syncing stores from Cungu Stock API (Objekti field)...');
    
    try {
      // Fetch stock items to get all unique store names
      const stockItems = await this.cunguStockService.fetchStockItems({
        minQuantity: 0,
      });

      // Extract unique store names from all Objekti arrays
      const pantheonStoreNamesSet = new Set<string>();
      for (const item of stockItems) {
        if (item.Objekti && Array.isArray(item.Objekti)) {
          for (const obj of item.Objekti) {
            if (obj.Objekat) {
              pantheonStoreNamesSet.add(obj.Objekat);
            }
          }
        }
      }

      const uniquePantheonNames = Array.from(pantheonStoreNamesSet).sort();
      this.logger.log(`Found ${uniquePantheonNames.length} unique stores in stock data`);
      this.logger.debug(`Pantheon store names: ${uniquePantheonNames.join(', ')}`);

      let created = 0;
      let updated = 0;

      for (const pantheonName of uniquePantheonNames) {
        // Use Pantheon name directly (no custom MP mapping)
        // Generate a code from the Pantheon name
        // "Prodavnica - Podgorica Centar" -> "PRODAVNICA_PODGORICA_CENTAR"
        const code = pantheonName
          .toUpperCase()
          .replace(/\s+/g, '_')
          .replace(/[^A-Z0-9_]/g, '');

        // Check if store exists by exact name (Pantheon name)
        const existing = await this.storeRepository.findOne({
          where: { name: pantheonName },
        });

        if (existing) {
          // Update code if needed
          let changed = false;
          if (existing.code !== code) {
            existing.code = code;
            changed = true;
          }
          if (changed) {
            await this.storeRepository.save(existing);
            updated++;
            this.logger.debug(`Updated store: ${code} - ${pantheonName}`);
          }
        } else {
          // Create new store with original Pantheon name
          const store = this.storeRepository.create({
            code,
            name: pantheonName, // Use original Pantheon name
            is_active: true,
          });
          await this.storeRepository.save(store);
          created++;
          this.logger.log(`Created store: ${code} - ${pantheonName}`);
        }
      }

      this.logger.log(`Store sync complete: ${created} created, ${updated} updated (total: ${uniquePantheonNames.length})`);
      return { created, updated, total: uniquePantheonNames.length };
    } catch (error) {
      this.logger.error(`Error syncing stores from Stock API: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Sync stores from Cungu API (GetSubjectWMS where Skladiste='T')
   * Creates or updates stores in the database
   */
  async syncFromCungu(): Promise<{ created: number; updated: number; total: number }> {
    this.logger.log('Syncing stores from Cungu API...');
    
    try {
      // Fetch all subjects from Cungu where Skladiste='T' (is a warehouse/store)
      const subjects = await this.cunguStockService.fetchStocks({
        rawFilters: {
          'Skladiste': { operator: '=', value: 'T' },
        },
      });

      this.logger.log(`Fetched ${subjects.length} stores from Cungu API`);

      let created = 0;
      let updated = 0;

      for (const subject of subjects) {
        // Skip if no warehouse code
        if (!subject.warehouseCode || subject.warehouseCode !== 'T') {
          continue;
        }

        const code = String(subject.subjectId); // Use subject ID as code
        const name = subject.subjectName;

        // Check if store already exists
        const existing = await this.storeRepository.findOne({ where: { code } });

        if (existing) {
          // Update existing store
          if (existing.name !== name) {
            existing.name = name;
            await this.storeRepository.save(existing);
            updated++;
            this.logger.debug(`Updated store: ${code} - ${name}`);
          }
        } else {
          // Create new store
          const store = this.storeRepository.create({
            code,
            name,
            is_active: true,
          });
          await this.storeRepository.save(store);
          created++;
          this.logger.debug(`Created store: ${code} - ${name}`);
        }
      }

      this.logger.log(`Store sync complete: ${created} created, ${updated} updated`);
      return { created, updated, total: subjects.length };
    } catch (error) {
      this.logger.error(`Error syncing stores from Cungu: ${error.message}`, error.stack);
      throw error;
    }
  }
}

