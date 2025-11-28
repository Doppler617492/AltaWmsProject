import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StockService } from './stock.service';

@Injectable()
export class StockSchedulerService {
  private readonly logger = new Logger(StockSchedulerService.name);

  constructor(private readonly stockService: StockService) {}

  // Run every night at midnight (00:00)
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleNightlyInventorySync() {
    this.logger.log('Starting nightly store inventory sync at midnight...');
    
    try {
      const result = await this.stockService.syncAllStoreInventory('scheduled_' + Date.now());
      this.logger.log(
        `✅ Nightly inventory sync completed: ${result.total_stores} stores, ` +
        `${result.total_created} created, ${result.total_updated} updated`
      );
      
      if (result.errors && result.errors.length > 0) {
        this.logger.warn(`Sync errors: ${result.errors.join('; ')}`);
      }
    } catch (error) {
      this.logger.error(`❌ Nightly inventory sync failed: ${error.message}`, error.stack);
    }
  }
}
