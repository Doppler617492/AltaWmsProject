import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { CunguReceivingService, ReceivingSyncFilters } from './cungu-receiving.service';
import { CunguShippingService, ShippingSyncFilters } from './cungu-shipping.service';
import { CunguStockService, StockSyncFilters } from './cungu-stock.service';

export interface CunguSyncRequest {
  receiving?: ReceivingSyncFilters;
  shipping?: ShippingSyncFilters;
  stocks?: StockSyncFilters;
  persist?: boolean; // Whether to persist documents to database
  userId?: number; // User ID for creating documents (defaults to system user)
}

export interface CunguSyncResult {
  receivingCount: number;
  shippingCount: number;
  stockCount: number;
  receivingImported?: number;
  shippingImported?: number;
  errors?: string[];
}

@Injectable()
export class CunguSyncService {
  private readonly logger = new Logger(CunguSyncService.name);
  private shippingServiceInternal: any = null;
  private receivingServiceInternal: any = null;

  constructor(
    private readonly receivingService: CunguReceivingService,
    private readonly shippingService: CunguShippingService,
    private readonly stockService: CunguStockService,
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * Executes a bundle sync against the Cungu API.
   * If persist=true, documents will be imported into the local database.
   */
  async sync(request: CunguSyncRequest = {}): Promise<CunguSyncResult> {
    const result: CunguSyncResult = {
      receivingCount: 0,
      shippingCount: 0,
      stockCount: 0,
      receivingImported: 0,
      shippingImported: 0,
      errors: [],
    };
    const shouldPersist = request.persist !== false; // Default to true
    const userId = request.userId || 1; // Default to system user (ID 1)

    // Lazy load services to avoid circular dependencies
    if (shouldPersist) {
      try {
        if (!this.shippingServiceInternal) {
          // Try to get ShippingService by class reference
          const { ShippingService } = await import('../../shipping/shipping.service');
          this.shippingServiceInternal = this.moduleRef.get(ShippingService, { strict: false });
          if (this.shippingServiceInternal) {
            this.logger.log('Successfully loaded ShippingService for persistence');
          } else {
            this.logger.warn('ShippingService not found in module context');
          }
        }
        if (!this.receivingServiceInternal) {
          // Try to get ReceivingService by class reference
          const { ReceivingService } = await import('../../receiving/receiving.service');
          this.receivingServiceInternal = this.moduleRef.get(ReceivingService, { strict: false });
          if (this.receivingServiceInternal) {
            this.logger.log('Successfully loaded ReceivingService for persistence');
          } else {
            this.logger.warn('ReceivingService not found in module context');
          }
        }
      } catch (e: any) {
        this.logger.error(`Could not load internal services for persistence: ${e?.message || String(e)}`, e?.stack);
        // If services are not available, we'll skip persistence but continue with sync
      }
    }

    if (request.receiving) {
      const docs = await this.receivingService.fetchDocuments(request.receiving);
      // Filter by warehouse client-side if needed (destinationLocation/NasObjekat field contains warehouse name)
      const filteredDocs = request.receiving.warehouse
        ? docs.filter(doc => doc.destinationLocation?.toLowerCase().includes(request.receiving.warehouse.toLowerCase()))
        : docs;
      result.receivingCount = filteredDocs.length;
      this.logger.log(`Fetched ${filteredDocs.length} receiving documents from Cungu${request.receiving.warehouse ? ` (filtered by warehouse: ${request.receiving.warehouse})` : ''}`);
      
      // Persist documents if requested
      if (shouldPersist && filteredDocs.length > 0 && this.receivingServiceInternal) {
        let imported = 0;
        for (const doc of filteredDocs) {
          try {
            const importBody = {
              document_number: doc.documentNumber,
              supplier_name: doc.sourceLocation || 'Cungu Import',
              document_date: doc.documentDate,
              store_name: doc.destinationLocation,
              responsible_person: doc.responsiblePerson,
              lines: doc.lines.map(line => ({
                item_sku: line.sku,
                item_name: line.name,
                requested_qty: line.quantity,
                uom: line.uom,
              })),
              notes: doc.note || `Tip dokumenta: ${doc.documentType} | Status: ${doc.status}`,
            };
            await this.receivingServiceInternal.importFromJson(importBody, userId);
            imported++;
          } catch (e: any) {
            const errorMsg = `Error importing receiving document ${doc.documentNumber}: ${e?.message || String(e)}`;
            this.logger.warn(errorMsg);
            result.errors?.push(errorMsg);
          }
        }
        result.receivingImported = imported;
        this.logger.log(`Imported ${imported}/${filteredDocs.length} receiving documents into database`);
      }
    }

    if (request.shipping) {
      const docs = await this.shippingService.fetchDocuments(request.shipping);
      // Filter by warehouse client-side if needed (NasObjekat field contains warehouse name)
      const filteredDocs = request.shipping.warehouse
        ? docs.filter(doc => doc.sourceLocation?.toLowerCase().includes(request.shipping.warehouse.toLowerCase()))
        : docs;
      result.shippingCount = filteredDocs.length;
      this.logger.log(`Fetched ${filteredDocs.length} shipping documents from Cungu${request.shipping.warehouse ? ` (filtered by warehouse: ${request.shipping.warehouse})` : ''}`);
      
      // Persist documents if requested
      if (shouldPersist && filteredDocs.length > 0 && this.shippingServiceInternal) {
        let imported = 0;
        for (const doc of filteredDocs) {
          try {
            const importBody = {
              order_number: doc.documentNumber,
              customer_name: doc.primaryDestination || doc.secondaryDestination || 'Cungu Import',
              issuer_name: doc.sourceLocation,
              responsible_person: doc.responsiblePerson,
              document_date: doc.documentDate,
              store_name: doc.primaryDestination || doc.secondaryDestination,
              lines: doc.lines.map(line => ({
                item_sku: line.sku,
                item_name: line.name,
                requested_qty: line.quantity,
                uom: line.uom,
              })),
            };
            await this.shippingServiceInternal.importFromJson(importBody, userId);
            imported++;
          } catch (e: any) {
            const errorMsg = `Error importing shipping document ${doc.documentNumber}: ${e?.message || String(e)}`;
            this.logger.warn(errorMsg);
            result.errors?.push(errorMsg);
            // If document already exists, that's OK - skip it
            if (!e?.message?.includes('već postoji') && !e?.message?.includes('already exists')) {
              this.logger.error(errorMsg);
            }
          }
        }
        result.shippingImported = imported;
        this.logger.log(`Imported ${imported}/${filteredDocs.length} shipping documents into database`);
      }
    }

    if (request.stocks) {
      const stocks = await this.stockService.fetchStocks(request.stocks);
      result.stockCount = stocks.length;
      this.logger.log(`Fetched ${stocks.length} stock records from Cungu`);
      // TODO: persist stocks when needed
    }

    return result;
  }
}


