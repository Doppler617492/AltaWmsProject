import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PantheonItem } from '../entities/pantheon-item.entity';
import { CunguClient } from '../integrations/cungu/cungu.client';
import { CunguFilterDescriptor, CunguRequestPayload } from '../integrations/cungu/cungu.types';

interface SyncOptions {
  force?: boolean;
  full?: boolean;
  limit?: number;
}

interface CatalogResponseRow {
  Ident: string;
  Naziv: string;
  Dobavljac?: string;
  DobSifra?: string;
  PrimKlasif?: string;
  JM?: string;
  Barkodovi?: Array<{ Barkod: string }>;
  adTimeChg?: string;
}

@Injectable()
export class PantheonCatalogService {
  private readonly logger = new Logger(PantheonCatalogService.name);
  private readonly minSyncIntervalMs: number;
  private syncInFlight: Promise<SyncResult> | null = null;

  constructor(
    private readonly cunguClient: CunguClient,
    @InjectRepository(PantheonItem)
    private readonly catalogRepository: Repository<PantheonItem>,
  ) {
    this.minSyncIntervalMs =
      Number(process.env.CUNGU_CATALOG_MIN_INTERVAL_MS) || 30 * 60 * 1000; // 30 min default
  }

  async listItems(params: { search?: string; limit?: number; offset?: number }) {
    const { search, limit = 50, offset = 0 } = params || {};
    this.logger.log(`listItems called: search="${search}", limit=${limit}, offset=${offset}`);
    
    const qb = this.catalogRepository.createQueryBuilder('it');
    
    if (search && search.trim()) {
      const searchTerm = search.trim();
      const termPattern = `%${searchTerm}%`;
      const exactTerm = searchTerm.toLowerCase();
      const exactTermUpper = searchTerm.toUpperCase();
      const exactTermStart = `${searchTerm}%`;
      
      this.logger.log(`Applying search filter: termPattern="${termPattern}"`);
      
      // Traži po šifri (ident), nazivu (naziv) ili barkodovima
      // Koristimo ILIKE za case-insensitive pretragu
      // Za barkodove, konvertujemo JSONB array u tekst i pretražujemo
      qb.where(
        `(
          it.ident ILIKE :termPattern OR 
          it.naziv ILIKE :termPattern OR
          CAST(it.barcodes AS text) ILIKE :termPattern
        )`,
        { termPattern },
      );
      
      // Prioritet: prvo tačna poklapanja po šifri, zatim po nazivu, zatim po barkodu, zatim početak šifre/naziva
      qb.addOrderBy(
        `CASE 
          WHEN LOWER(it.ident) = :exactTerm THEN 1
          WHEN UPPER(it.ident) = :exactTermUpper THEN 1
          WHEN LOWER(it.naziv) = :exactTerm THEN 2
          WHEN CAST(it.barcodes AS text) LIKE :exactTermStart THEN 3
          WHEN it.ident ILIKE :exactTermStart THEN 4
          WHEN it.naziv ILIKE :exactTermStart THEN 5
          ELSE 6
        END`,
        'ASC',
      );
      qb.setParameter('exactTerm', exactTerm);
      qb.setParameter('exactTermUpper', exactTermUpper);
      qb.setParameter('exactTermStart', exactTermStart);
    } else {
      // Bez pretrage - samo sortiraj po ident
      qb.orderBy('it.ident', 'ASC');
    }
    
    qb.offset(offset).limit(limit);
    
    try {
      const [items, total] = await qb.getManyAndCount();
      this.logger.log(`Query executed: found ${items.length} items (total: ${total}, offset: ${offset})`);
      
      const lastSyncRow = await this.catalogRepository
        .createQueryBuilder('it')
        .select('MAX(it.synced_at)', 'max')
        .getRawOne();
      const lastSyncedAt = lastSyncRow?.max ? new Date(lastSyncRow.max) : null;
      
      return {
        items,
        total,
        lastSyncedAt,
      };
    } catch (error) {
      this.logger.error(`Error in listItems: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async syncCatalog(options: SyncOptions = {}): Promise<SyncResult> {
    if (this.syncInFlight) {
      this.logger.log('Sync already running – awaiting existing promise');
      return this.syncInFlight;
    }

    const exec = this.performSync(options).finally(() => {
      this.syncInFlight = null;
    });
    this.syncInFlight = exec;
    return exec;
  }

  private async performSync(options: SyncOptions): Promise<SyncResult> {
    const now = new Date();
    const lastSyncRow = await this.catalogRepository
      .createQueryBuilder('it')
      .select('MAX(it.synced_at)', 'max')
      .getRawOne();
    const lastSyncedAt = lastSyncRow?.max ? new Date(lastSyncRow.max) : null;

    if (!options.force && lastSyncedAt && now.getTime() - lastSyncedAt.getTime() < this.minSyncIntervalMs) {
      this.logger.log('Skipping Pantheon sync – minimum interval not reached');
      return { skipped: true, lastSyncedAt };
    }

    const limit = options.limit ?? 500;
    let offset = 0;
    let processed = 0;
    let pages = 0;
    let upserted = 0;
    const filters: Record<string, CunguFilterDescriptor> = {};
    if (!options.full && lastSyncedAt) {
      const dateValue = lastSyncedAt.toISOString().slice(0, 10);
      filters['adTimeChg'] = { operator: '>=', value: dateValue };
    }

    this.logger.log(`Starting Pantheon catalog sync (offset=${offset}, limit=${limit}, filters=${JSON.stringify(filters)})`);

    // Fetch paginated
    while (true) {
      const payload: CunguRequestPayload = {
        method: 'getIdent',
        offset,
        limit,
      };
      if (Object.keys(filters).length) {
        payload.filters = filters;
      }

      const response = await this.cunguClient.postGet<CatalogResponseRow[] | { data: CatalogResponseRow[] }>(payload);
      const rows: CatalogResponseRow[] = Array.isArray(response)
        ? response
        : Array.isArray((response as any)?.data)
        ? (response as any).data
        : [];

      if (!rows.length) {
        break;
      }

      pages += 1;
      processed += rows.length;
      const mapped = rows.map((row) => ({
        ident: row.Ident?.trim() || '',
        naziv: row.Naziv?.trim() || '',
        supplier_name: row.Dobavljac?.trim() || null,
        supplier_code: row.DobSifra?.trim() || null,
        primary_classification: row.PrimKlasif?.trim() || null,
        unit: row.JM?.trim() || null,
        barcodes: Array.isArray(row.Barkodovi)
          ? row.Barkodovi.map((entry) => (entry?.Barkod || '').trim()).filter(Boolean)
          : [],
        changed_at: row.adTimeChg ? new Date(row.adTimeChg) : null,
        synced_at: now,
      }));

      const valid = mapped.filter((row) => row.ident && row.naziv);
      if (valid.length) {
      const result = await this.catalogRepository
          .createQueryBuilder()
          .insert()
          .into(PantheonItem)
          .values(valid)
          .onConflict(
            `("ident") DO UPDATE SET 
              naziv = EXCLUDED.naziv,
              supplier_name = EXCLUDED.supplier_name,
              supplier_code = EXCLUDED.supplier_code,
              primary_classification = EXCLUDED.primary_classification,
              unit = EXCLUDED.unit,
              barcodes = EXCLUDED.barcodes,
              changed_at = EXCLUDED.changed_at,
              synced_at = EXCLUDED.synced_at`,
          )
          .execute();
        if (Array.isArray(result.identifiers) && result.identifiers.length) {
          upserted += result.identifiers.length;
        } else {
          upserted += valid.length;
        }
      }

      if (rows.length < limit) {
        break;
      }
      offset += rows.length;
      // Delay between pages to avoid stressing the upstream API
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    this.logger.log(
      `Pantheon catalog sync finished – pages=${pages}, processed=${processed}, upserted=${upserted}`,
    );

    return {
      skipped: false,
      lastSyncedAt: now,
      processed,
      upserted,
      pages,
    };
  }
}

export interface SyncResult {
  skipped?: boolean;
  processed?: number;
  upserted?: number;
  pages?: number;
  lastSyncedAt: Date | null;
}


