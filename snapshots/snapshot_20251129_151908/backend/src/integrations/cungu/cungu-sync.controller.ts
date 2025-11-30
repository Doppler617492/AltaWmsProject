import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CunguSyncService } from './cungu-sync.service';
import { CunguSyncRequestDto } from './dto/cungu-sync-request.dto';
import { CunguReceivingService, ReceivingSyncFilters } from './cungu-receiving.service';
import { CunguShippingService, ShippingSyncFilters } from './cungu-shipping.service';
import { CunguStockService, StockSyncFilters } from './cungu-stock.service';

const FEATURE_FLAG = 'CUNGU_API_ENABLED';

@Controller('integrations/cungu')
export class CunguSyncController {
  constructor(
    private readonly syncService: CunguSyncService,
    private readonly receivingService: CunguReceivingService,
    private readonly shippingService: CunguShippingService,
    private readonly stockService: CunguStockService,
  ) {}

  @Post('sync')
  async triggerSync(@Body() body: CunguSyncRequestDto, @Req() req: any) {
    this.ensureIntegrationEnabled();
    try {
      // Default persist to true and use current user ID
      const syncRequest = {
        ...body,
        persist: body.persist !== false, // Default to true
        userId: body.userId || req.user?.id || 1, // Use current user or system user
      };
      return this.syncService.sync(syncRequest);
    } catch (error: any) {
      if (error.message?.includes('Authentication failed')) {
        throw new ServiceUnavailableException(
          'Cungu API authentication failed. Please check API credentials (CUNGU_STOCK_API_USERNAME/PASSWORD).',
        );
      }
      throw error;
    }
  }

  @Get('receiving/preview')
  async previewReceiving(@Query() query: Record<string, string>) {
    this.ensureIntegrationEnabled();
    try {
      const filters: ReceivingSyncFilters = this.mapReceivingQuery(query);
      return this.receivingService.fetchDocuments(filters);
    } catch (error: any) {
      if (error.message?.includes('Authentication failed')) {
        throw new ServiceUnavailableException(
          'Cungu API authentication failed. Please check API credentials.',
        );
      }
      throw error;
    }
  }

  @Get('shipping/preview')
  async previewShipping(@Query() query: Record<string, string>) {
    this.ensureIntegrationEnabled();
    try {
      const filters: ShippingSyncFilters = this.mapShippingQuery(query);
      return this.shippingService.fetchDocuments(filters);
    } catch (error: any) {
      if (error.message?.includes('Authentication failed')) {
        throw new ServiceUnavailableException(
          'Cungu API authentication failed. Please check API credentials.',
        );
      }
      throw error;
    }
  }

  @Get('stocks/preview')
  async previewStocks(@Query() query: Record<string, string>) {
    this.ensureIntegrationEnabled();
    try {
      const filters: StockSyncFilters = this.mapStockQuery(query);
      return this.stockService.fetchStocks(filters);
    } catch (error: any) {
      if (error.message?.includes('Authentication failed')) {
        throw new ServiceUnavailableException(
          'Cungu API authentication failed. Please check API credentials.',
        );
      }
      throw error;
    }
  }

  private ensureIntegrationEnabled(): void {
    if (process.env[FEATURE_FLAG] !== 'true') {
      throw new ServiceUnavailableException(
        'Cungu API integration is currently disabled. Set CUNGU_API_ENABLED=true to enable calls.',
      );
    }
  }

  private mapReceivingQuery(query: Record<string, string>): ReceivingSyncFilters {
    const filters: ReceivingSyncFilters = {};
    if (query.dateFrom) filters.dateFrom = query.dateFrom;
    if (query.dateTo) filters.dateTo = query.dateTo;
    if (query.status) filters.status = query.status;
    if (query.warehouse) filters.warehouse = query.warehouse;
    if (query.docTypes) filters.docTypes = query.docTypes.split(',').map(t => t.trim());
    return filters;
  }

  private mapShippingQuery(query: Record<string, string>): ShippingSyncFilters {
    const filters: ShippingSyncFilters = {};
    if (query.dateFrom) filters.dateFrom = query.dateFrom;
    if (query.dateTo) filters.dateTo = query.dateTo;
    if (query.status) filters.status = query.status;
    if (query.warehouse) filters.warehouse = query.warehouse;
    if (query.docTypes) filters.docTypes = query.docTypes.split(',').map(t => t.trim());
    return filters;
  }

  private mapStockQuery(query: Record<string, string>): StockSyncFilters {
    const filters: StockSyncFilters = {};
    if (query.changedSince) filters.changedSince = query.changedSince;
    if (query.subjects) filters.subjects = query.subjects.split(',').map(s => s.trim());
    if (query.warehouse) filters.warehouse = query.warehouse;
    return filters;
  }
}



