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
  warehouse?: string; // Legacy single warehouse
  warehouses?: string[]; // Multiple warehouses
  rawFilters?: Record<string, any>;
}

@Injectable()
export class CunguReceivingService {
  private readonly logger = new Logger(CunguReceivingService.name);

  constructor(private readonly client: CunguClient) {}

  /**
   * Fetches receiving documents from Cungu WMS.
   * According to Cungu API v1.2 documentation Section 5:
   * - Receiving documents have type 20B0 (and potentially other 20Bx types)
   * - They have Posiljalac field (sender) and NasObjekat (our warehouse receiving)
   * - Shipping documents have types like 20ET, 20CT, 209T, 200R
   */
  async fetchDocuments(filters: ReceivingSyncFilters = {}): Promise<ExternalReceivingDocument[]> {
    const methodName = process.env.CUNGU_RECEIVING_METHOD || 'GetIssueDocWMS';
    
    // First try: Search WITH document type filter for known receiving types
    let receivingFilters: ReceivingSyncFilters = {
      ...filters,
      docTypes: filters.docTypes || ['20B0', '20B1', '20B2', '20B3', '20B4', '20B5', '20B', '20P0', '20P1', '20P'],
    };
    
    let payload = this.buildPayload(methodName, receivingFilters);

    this.logger.debug(
      `Fetching receiving documents from Cungu (method=${methodName}, filters=${JSON.stringify(
        payload.filters,
      )})`,
    );

    let data = await this.client.postGet<CunguIssueDocument[] | { data: CunguIssueDocument[] }>(
      payload,
      'documents',
    );

    let documentsArray = Array.isArray(data)
      ? data
      : Array.isArray((data as any)?.data)
      ? ((data as any).data as CunguIssueDocument[])
      : [];

    // If no documents found with type filter, try WITHOUT type filter and filter by Posiljalac field
    if (documentsArray.length === 0) {
      this.logger.debug('No documents found with type filter - trying without docType filter...');
      const broadFilters: ReceivingSyncFilters = {
        ...filters,
        docTypes: undefined, // Remove type filter
      };
      payload = this.buildPayload(methodName, broadFilters);
      
      data = await this.client.postGet<CunguIssueDocument[] | { data: CunguIssueDocument[] }>(
        payload,
        'documents',
      );
      
      documentsArray = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.data)
        ? ((data as any).data as CunguIssueDocument[])
        : [];
      
      // Filter for receiving docs: must have Posiljalac (sender) field
      documentsArray = documentsArray.filter(doc => !!doc.Posiljalac);
      
      // Log unique document types found
      const uniqueTypes = [...new Set(documentsArray.map(d => d.TipDokumenta))];
      if (uniqueTypes.length > 0) {
        this.logger.log(`Found receiving document types: ${uniqueTypes.join(', ')}`);
      }
    }

    // Log document structure for debugging
    if (documentsArray.length > 0) {
      this.logger.debug(`Sample receiving doc: ${JSON.stringify(documentsArray[0], null, 2)}`);
    }
    
    this.logger.log(`Fetched ${documentsArray.length} receiving documents from Cungu`);

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
        operator: 'BETWEEN',
        value: [filters.dateFrom ?? filters.dateTo, filters.dateTo],
      };
    }

    if (filters.docTypes?.length) {
      cunguFilters['m.acDocType'] = { operator: 'IN', value: filters.docTypes };
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


