import { ReceivingSyncFilters } from '../cungu-receiving.service';
import { ShippingSyncFilters } from '../cungu-shipping.service';
import { StockSyncFilters } from '../cungu-stock.service';

export class CunguSyncRequestDto {
  receiving?: ReceivingSyncFilters;
  shipping?: ShippingSyncFilters;
  stocks?: StockSyncFilters;
  persist?: boolean; // Whether to persist documents to database (default: true)
  userId?: number; // User ID for creating documents (default: system user ID 1)
}



