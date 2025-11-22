import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CunguSyncService } from './cungu-sync.service';

/**
 * Lightweight scheduler that periodically calls the Cungu sync routine.
 * Actual cron functionality (with Nest ScheduleModule) can be added later; for now we use setTimeout.
 */
@Injectable()
export class CunguSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CunguSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly syncService: CunguSyncService) {}

  onModuleInit() {
    const enabled = process.env.CUNGU_API_ENABLED === 'true';
    const minutes = Number(process.env.CUNGU_SYNC_INTERVAL_MINUTES || 0);

    if (!enabled) {
      this.logger.log('Cungu API integration disabled – scheduler will not start.');
      return;
    }

    if (Number.isNaN(minutes) || minutes <= 0) {
      this.logger.log('Cungu sync scheduler is disabled (set CUNGU_SYNC_INTERVAL_MINUTES>0 to enable).');
      return;
    }

    this.scheduleNext(minutes);
    this.logger.log(`Cungu sync scheduler initialised. Interval: ${minutes} minute(s).`);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext(minutes: number) {
    const delay = minutes * 60 * 1000;
    this.timer = setTimeout(async () => {
      try {
        await this.runScheduledSync();
      } catch (error) {
        this.logger.error(`Scheduled Cungu sync failed: ${(error as Error).message}`, error as Error);
      } finally {
        this.scheduleNext(minutes);
      }
    }, delay);
  }

  private async runScheduledSync() {
    this.logger.log('Starting scheduled Cungu sync cycle…');
    await this.syncService.sync({
      receiving: {
        dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        warehouse: process.env.CUNGU_DEFAULT_WAREHOUSE || 'Veleprodajni',
      },
      shipping: {
        dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        warehouse: process.env.CUNGU_DEFAULT_WAREHOUSE || 'Veleprodajni',
      },
      stocks: {
        warehouse: process.env.CUNGU_DEFAULT_WAREHOUSE || 'Veleprodajni',
      },
    });
    this.logger.log('Scheduled Cungu sync cycle finished.');
  }
}



