import { Injectable, Logger } from '@nestjs/common';
import { CunguClient } from './cungu.client';
import { CunguStockRecord } from './cungu.types';

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

export interface StockSyncFilters {
  subjects?: string[];
  warehouse?: string;
  changedSince?: string;
  rawFilters?: Record<string, any>;
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
}


