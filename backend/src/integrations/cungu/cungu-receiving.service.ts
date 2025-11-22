import { Injectable, Logger } from '@nestjs/common';
import { CunguClient } from './cungu.client';
import { CunguIssueDocument } from './cungu.types';

export interface ExternalReceivingDocument {
  documentNumber: string;
  documentType: string;
  documentDate: string;
  sourceLocation?: string;
  destinationLocation?: string;
  responsiblePerson?: string;
  status: string;
  note?: string;
  lines: Array<{
    position: number;
    sku: string;
    name: string;
    quantity: number;
    uom: string;
  }>;
}

export interface ReceivingSyncFilters {
  dateFrom?: string;
  dateTo?: string;
  docTypes?: string[];
  status?: string;
  warehouse?: string;
  rawFilters?: Record<string, any>;
}

@Injectable()
export class CunguReceivingService {
  private readonly logger = new Logger(CunguReceivingService.name);

  constructor(private readonly client: CunguClient) {}

  /**
   * Fetches receiving documents from Cungu WMS.
   * The method name is subject to confirmation – the current plan is to use `GetReceiptDocWMS`.
   */
  async fetchDocuments(filters: ReceivingSyncFilters = {}): Promise<ExternalReceivingDocument[]> {
    const methodName = process.env.CUNGU_RECEIVING_METHOD || 'GetReceiptDocWMS';
    const payload = this.buildPayload(methodName, filters);

    this.logger.debug(
      `Fetching receiving documents from Cungu (method=${methodName}, filters=${JSON.stringify(
        payload.filters,
      )})`,
    );

    const data = await this.client.postGet<CunguIssueDocument[] | { data: CunguIssueDocument[] }>(
      payload,
    );

    const documentsArray = Array.isArray(data)
      ? data
      : Array.isArray((data as any)?.data)
      ? ((data as any).data as CunguIssueDocument[])
      : [];

    return documentsArray.map(doc => this.mapDocument(doc));
  }

  private buildPayload(method: string, filters: ReceivingSyncFilters) {
    const cunguFilters: Record<string, any> = filters.rawFilters ? { ...filters.rawFilters } : {};

    if (filters.dateFrom) {
      cunguFilters['m.adDate'] = {
        operator: cunguFilters['m.adDate']?.operator || '>=',
        value: filters.dateFrom,
      };
    }

    if (filters.dateTo) {
      cunguFilters['m.adDate'] = {
        operator: 'between',
        value: [filters.dateFrom ?? filters.dateTo, filters.dateTo],
      };
    }

    if (filters.docTypes?.length) {
      cunguFilters['m.acDocType'] = { operator: 'in', value: filters.docTypes };
    }

    if (filters.status) {
      cunguFilters['m.acVerifyStatus'] = { operator: '=', value: filters.status };
    }

    // Note: According to Cungu API v1.2 documentation, m.acKey is for specific document/group filtering
    // Warehouse filtering should be done client-side after fetching, or use m.acKey with exact match
    // For now, we'll skip warehouse filter on m.acKey as it may not match the expected format
    // If warehouse filtering is needed, consider filtering by NasObjekat field in the response
    // if (filters.warehouse) {
    //   cunguFilters['m.acKey'] = { operator: 'like', value: `%${filters.warehouse}%` };
    // }

    return {
      method,
      filters: cunguFilters,
      offset: 0,
      limit: Number(process.env.CUNGU_SYNC_PAGE_SIZE || 500),
    };
  }

  private mapDocument(doc: CunguIssueDocument): ExternalReceivingDocument {
    return {
      documentNumber: doc.BrojDokumenta,
      documentType: doc.TipDokumenta,
      documentDate: doc.DatumDokumenta,
      sourceLocation: doc.Posiljalac,
      destinationLocation: doc.NasObjekat,
      responsiblePerson: doc.OdgovornaOsoba,
      status: doc.StatusDokumenta,
      note: doc.Napomena,
      lines: (doc.Objekti || []).map(line => ({
        position: line.Poz,
        sku: line.Ident,
        name: line.Naziv,
        quantity: line.Kolicina,
        uom: line.JM,
      })),
    };
  }
}


