import { Injectable, Logger } from '@nestjs/common';
import { CunguClient } from './cungu.client';
import { CunguStockRecord, CunguStockItem } from './cungu.types';

export interface ExternalStockRecord {
  subjectId: number;
  subjectName: string;
  warehouseCode?: string;
  isCustomer: boolean;
  isSupplier: boolean;
  address?: string;
  city?: string;
  country?: string;
}

export interface StockItemRecord {
  sku: string;
  name: string;
  quantity: number;
  unit?: string;
  warehouse?: string;
  lastChanged?: string;
}

export interface StockSyncFilters {
  subjects?: string[];
  warehouse?: string;
  changedSince?: string;
  rawFilters?: Record<string, any>;
}

export interface StockQueryFilters {
  sku?: string;
  skus?: string[];
  warehouse?: string;
  minQuantity?: number;
  changedSince?: string;
}

@Injectable()
export class CunguStockService {
  private readonly logger = new Logger(CunguStockService.name);

  constructor(private readonly client: CunguClient) {}

  async fetchStocks(filters: StockSyncFilters = {}): Promise<ExternalStockRecord[]> {
    const methodName = process.env.CUNGU_STOCK_METHOD || 'GetSubjectWMS';
    const payload = this.buildPayload(methodName, filters);

    this.logger.debug(
      `Fetching stock snapshot from Cungu (method=${methodName}, filters=${JSON.stringify(
        payload.filters,
      )})`,
    );

    const data = await this.client.postGet<CunguStockRecord[] | { data: CunguStockRecord[] }>(
      payload,
    );

    const payloadArray = Array.isArray(data)
      ? data
      : Array.isArray((data as any)?.data)
      ? ((data as any).data as CunguStockRecord[])
      : [];

    return payloadArray.map(record => this.mapRecord(record));
  }

  private buildPayload(method: string, filters: StockSyncFilters) {
    const cunguFilters: Record<string, any> = filters.rawFilters ? { ...filters.rawFilters } : {};

    if (filters.changedSince) {
      cunguFilters['c.adTimeChg'] = { operator: '>=', value: filters.changedSince };
    }

    if (filters.subjects?.length) {
      cunguFilters['c.acSubject'] = {
        operator: filters.subjects.length === 1 ? '=' : 'in',
        value: filters.subjects.length === 1 ? filters.subjects[0] : filters.subjects,
      };
    }

    if (filters.warehouse) {
      // Cungu API doesn't support 'like' operator, use '=' for exact match or remove filter
      // If warehouse filter is needed, it should be an exact match
      cunguFilters['warehouse'] = { operator: '=', value: filters.warehouse };
    }

    return {
      method,
      filters: cunguFilters,
      offset: 0,
      limit: Number(process.env.CUNGU_SYNC_PAGE_SIZE || 500),
    };
  }

  private mapRecord(record: CunguStockRecord): ExternalStockRecord {
    return {
      subjectId: record.IdSubjekta,
      subjectName: record.NazivSubjekta,
      warehouseCode: record.Skladiste,
      isCustomer: record.Kupac === 'T',
      isSupplier: record.Dobavljac === 'T',
      address: record.Adresa,
      city: record.Grad,
      country: record.Drzava,
    };
  }

  /**
   * Fetch stock items using getStock method with pagination
   * Returns actual inventory quantities per article with Objekti breakdown
   * Automatically paginates through all results
   */
  async fetchStockItems(filters: StockQueryFilters = {}): Promise<CunguStockItem[]> {
    const pageSize = Number(process.env.CUNGU_SYNC_PAGE_SIZE || 500);
    const allItems: CunguStockItem[] = [];
    let offset = 0;
    let hasMore = true;
    let pageCount = 0;

    this.logger.log(
      `🔵 STARTING PAGINATION: pageSize=${pageSize}, filters=${JSON.stringify(filters)}`,
    );

    while (hasMore) {
      pageCount++;
      const payload = this.buildStockQueryPayload(filters, offset);
      this.logger.log(`🟡 PAGINATION LOOP ITERATION ${pageCount}: offset=${offset}, pageSize=${pageSize}`);

      this.logger.debug(
        `Fetching stock page ${pageCount} (offset=${offset}, limit=${pageSize}, filters=${JSON.stringify(
          payload.filters,
        )})`,
      );

      const data = await this.client.postGet<CunguStockItem[] | { data: CunguStockItem[] }>(
        payload,
      );

      const pageData = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.data)
        ? ((data as any).data as CunguStockItem[])
        : [];

      if (!pageData || pageData.length === 0) {
        hasMore = false;
        this.logger.log(`🟢 PAGE ${pageCount}: Empty response - PAGINATION COMPLETE`);
      } else {
        allItems.push(...pageData);
        this.logger.log(
          `🟢 PAGE ${pageCount}: ${pageData.length} items (total: ${allItems.length})`,
        );

        if (pageData.length < pageSize) {
          hasMore = false;
          this.logger.log(`🟢 PAGE ${pageCount}: Last page (${pageData.length} < ${pageSize}) - STOPPING`);
        } else {
          offset += pageSize;
          this.logger.log(`🟡 Continuing to page ${pageCount + 1} with offset ${offset}`);
        }
      }
    }

    this.logger.log(
      `✅ PAGINATION COMPLETE: Fetched ${allItems.length} items in ${pageCount} pages`,
    );

    return allItems;
  }

  // Fetch a single page of stock items (for memory-efficient page-by-page processing)
  async fetchStockItemsPage(offset: number, limit: number): Promise<CunguStockItem[]> {
    const payload = {
      method: 'getStock',
      offset,
      limit,
    };
    
    this.logger.debug(`Fetching page: offset=${offset}, limit=${limit}`);
    const data = await this.client.postGet<CunguStockItem[] | { data: CunguStockItem[] }>(payload);
    
    const pageData = Array.isArray(data)
      ? data
      : Array.isArray((data as any)?.data)
      ? ((data as any).data as CunguStockItem[])
      : [];
    
    return pageData;
  }

  private buildStockQueryPayload(filters: StockQueryFilters, offset: number = 0) {
    const cunguFilters: Record<string, any> = {};

    if (filters.changedSince) {
      cunguFilters['c.adTimeChg'] = { operator: '>=', value: filters.changedSince };
    }

    // Only add stock filter if minQuantity is explicitly > 0 (not just defined as 0)
    if (filters.minQuantity !== undefined && filters.minQuantity > 0) {
      cunguFilters['c.anStock'] = { operator: '>=', value: filters.minQuantity };
    }

    if (filters.sku) {
      cunguFilters['c.acIdent'] = { operator: '=', value: filters.sku };
    } else if (filters.skus?.length) {
      cunguFilters['c.acIdent'] = {
        operator: filters.skus.length === 1 ? '=' : 'in',
        value: filters.skus.length === 1 ? filters.skus[0] : filters.skus,
      };
    }

    // Only include filters if we have any, otherwise API returns error "Each filter must have both operator and value"
    const payload: any = {
      method: 'getStock',
      offset: offset,
      limit: Number(process.env.CUNGU_SYNC_PAGE_SIZE || 500),
    };

    if (Object.keys(cunguFilters).length > 0) {
      payload.filters = cunguFilters;
    }

    return payload;
  }





  /**
   * Get inventory for a specific store by filtering Objekti array.
   * Matches by store name with whitespace trimming (Cungu has trailing spaces in some names).
   */
  getStoreInventoryFromStock(stockItems: CunguStockItem[], storeName: string, storeCode: string) {
    const inventory: Array<{
      sku: string;
      name?: string;
      quantity: number;
      objekat: string;
    }> = [];

    const normalizedStoreName = storeName.trim().toLowerCase();

    for (const item of stockItems) {
      // Find matching store in Objekti array - trim whitespace for comparison
      const storeStock = item.Objekti?.find(obj => 
        obj.Objekat?.trim().toLowerCase() === normalizedStoreName
      );

      if (storeStock && storeStock.Zaliha >= 0) {
        inventory.push({
          sku: item.Ident,
          quantity: storeStock.Zaliha,
          objekat: storeStock.Objekat,
        });
      }
    }

    return inventory;
  }
}


