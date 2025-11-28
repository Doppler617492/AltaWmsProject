# Stock Sync Scheduler Setup

## Overview
The system now includes an automated daily stock synchronization scheduler that syncs all store inventory every day at midnight (00:00).

## How It Works

### Schedule
- **Time**: 24:00 (midnight / 00:00 next day)
- **Frequency**: Daily
- **Timezone**: Server time (UTC+2 based on deployment)

### Process
When the scheduler triggers at midnight:
1. `StockSchedulerService` invokes `stockService.syncAllStoreInventory()`
2. Fetches stock data from Cungu API for all 12 stores
3. Updates `store_inventory` table with current quantities and article names
4. Logs results to application logs (visible via `docker logs`)

### What Gets Synced
- Article names from Pantheon catalog (`getIdent` API)
- Stock quantities from Cungu (`getStock` API)
- All 12 stores: Bar, Bar Centar, Berane, Bijelo Polje, Budva 2, H.Novi (Meljine), H.Novi Centar, Kotor Centar, Niksic, Podgorica 2, Podgorica Centar, Ulcinj Centar

## Code Location
- **Scheduler Service**: `/backend/src/stock/stock-scheduler.service.ts`
- **Stock Service**: `/backend/src/stock/stock.service.ts`
- **Stock Module**: `/backend/src/stock/stock.module.ts`

## Monitoring

### View Logs
```bash
# Connect to production server
ssh root@46.224.54.239

# View backend logs
docker logs alta-wms-backend-prod | grep -i "scheduler\|nightly\|inventory sync"
```

### Expected Log Messages
- **Start**: `Starting nightly store inventory sync at midnight...`
- **Success**: `✅ Nightly inventory sync completed: 12 stores, X created, Y updated`
- **Error**: `❌ Nightly inventory sync failed: [error message]`

### Manual Sync
Users can still manually trigger syncs via the admin panel:
1. Navigate to Stock → Inventar (Pantheon) tab
2. Click "Sinhroniži Zalihe" button
3. Monitor progress and completion

## Implementation Details

### Cron Expression
```typescript
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
```

This uses NestJS Schedule module's built-in cron expression that triggers at 00:00 daily.

### Error Handling
If sync fails:
- Error is logged to application logs
- Sync is retried the next day
- Manual sync can be triggered immediately via UI

### Database Updates
The sync updates the `store_inventory` table with:
- `store_id`: Store identifier
- `sku`: Article SKU
- `quantity`: Current stock quantity
- `name`: Article name from Pantheon catalog
- `last_synced`: Timestamp of last sync

## Configuration
No additional configuration needed. The scheduler is enabled by default in production.

### Environment Variables Required
- `DB_HOST`: Database host (production: `alta-wms-db-prod`)
- `DB_PORT`: Database port (5432)
- `DB_USER`: Database user (`wms_user`)
- `DB_PASS`: Database password
- `CUNGU_STOCK_API_USERNAME`: Cungu API username (`TestCungu`)
- `CUNGU_STOCK_API_PASSWORD`: Cungu API password (`webshopapi24`)

## Deployment History
- **Date**: 28 November 2025
- **Change**: Enabled nightly stock sync scheduler
- **Status**: Active and running in production
- **Backend Version**: 2.1.0

## Future Enhancements
Potential improvements:
1. Add configurable schedule time via environment variable
2. Implement sync retry logic with exponential backoff
3. Add metrics/monitoring dashboard for sync health
4. Slack notifications for sync completion/failures
5. Ability to pause/resume scheduler via admin panel
