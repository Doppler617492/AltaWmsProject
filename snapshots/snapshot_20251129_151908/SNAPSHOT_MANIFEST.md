# Cungu API Dual-Credential Implementation - Snapshot

**Snapshot Date**: 2025-11-29 15:19:08  
**Purpose**: Complete backup of Cungu API integration with dual-credential support  
**Status**: ✅ PRODUCTION READY

---

## Snapshot Contents

### Source Code Files (9 files)
Located in: `backend/src/integrations/cungu/`

#### Core Implementation
1. **cungu.client.ts** (6.6K)
   - Dual-credential logic
   - Per-credential token caching
   - Independent authentication for Document API and Stock API
   - Automatic retry on 401 with fresh token
   - Key methods:
     - `postGet<T>(payload, apiType)` - Main entry point with credential routing
     - `resolveCredentials(apiType)` - Returns correct credentials based on API type
     - `ensureToken(credentials)` - Gets or refreshes token for specific credential set
     - `authenticate(credentials)` - Authenticates against Cungu API

2. **cungu-shipping.service.ts** (3.7K)
   - Fetches shipping documents from Cungu
   - Uses Document API credentials (CunguWMS)
   - Calls: `postGet(payload, 'documents')`
   - Maps Cungu response to ExternalShippingDocument format

3. **cungu-receiving.service.ts** (5.7K)
   - Fetches receiving documents from Cungu
   - Uses Document API credentials (CunguWMS)
   - Calls: `postGet(payload, 'documents')` (2 locations for resilience)
   - Supports fallback to broad search if filtered search returns nothing
   - Maps Cungu response to ExternalReceivingDocument format

4. **cungu-stock.service.ts** (7.8K)
   - Fetches stock data from Cungu
   - Uses Stock API credentials (TestCungu)
   - Calls: `postGet(payload, 'stock')`
   - Maps Cungu response to stock items

5. **cungu-sync.controller.ts** (4.6K)
   - REST endpoint: POST `/integrations/cungu/sync`
   - Orchestrates sync of receiving, shipping, and stock data
   - Error handling converts 401 to 503 ServiceUnavailableException
   - Query parameter mapping for preview endpoints

6. **cungu-sync.service.ts** (9.2K)
   - Core sync logic
   - Fetches documents and optionally persists to database
   - Lazy-loads ShippingService and ReceivingService to avoid circular dependencies
   - Returns CunguSyncResult with import counts and errors

#### Supporting Files
7. **cungu.module.ts** (1.1K)
   - NestJS module declaration
   - Imports and exports CunguClient, services, and controller

8. **cungu.types.ts** (2.0K)
   - TypeScript interfaces for Cungu API
   - Request/response types
   - Document mapping types

9. **cungu-scheduler.service.ts** (2.3K)
   - Optional scheduled sync (disabled by default)
   - Configurable via CUNGU_SYNC_INTERVAL_MINUTES env var

### Configuration Files (2 files)

#### docker-compose.yml (2.3K)
```yaml
environment:
  CUNGU_API_USERNAME: CunguWMS
  CUNGU_API_PASSWORD: 'C!g#2W4s5#$$M6'  ← Double $$ for YAML escaping
  CUNGU_STOCK_API_USERNAME: TestCungu
  CUNGU_STOCK_API_PASSWORD: webshopapi24
```
**Note**: Located in root of project, primary source for environment variables

#### .env (3.2K)
```env
CUNGU_API_ENABLED=true
CUNGU_API_USERNAME=CunguWMS
CUNGU_API_PASSWORD=C!g#2W4s5#$M6
CUNGU_STOCK_API_USERNAME=TestCungu
CUNGU_STOCK_API_PASSWORD=webshopapi24
```
**Note**: Fallback configuration, loaded if not overridden by docker-compose.yml

### Documentation Files (5 files)

1. **CUNGU_SYNC_SETUP.md** (13K)
   - Original setup and troubleshooting guide

2. **CUNGU_API_PERSISTENCE.md** (5.3K)
   - Explains persistence guarantees
   - Server restart scenarios
   - Backup recommendations

3. **CUNGU_DEPLOYMENT_CHECKLIST.md** (6.7K)
   - Verification checklist
   - File locations and sizes
   - Test results
   - Post-restart verification steps

4. **CUNGU_ARCHITECTURE.md** (14K)
   - Technical architecture details
   - Dual-credential design explanation
   - Token caching strategy
   - Authentication flow diagrams
   - Error handling patterns

5. **SNAPSHOT_MANIFEST.md** (this file)
   - Complete inventory of snapshot contents
   - Implementation details
   - Credential specifications
   - Key endpoints and features

---

## Implementation Summary

### Dual-Credential Architecture

**Document API** (for Shipping/Receiving documents)
- Username: `CunguWMS`
- Password: `C!g#2W4s5#$M6`
- Used by: CunguShippingService, CunguReceivingService
- Call pattern: `postGet(payload, 'documents')`

**Stock API** (for inventory synchronization)
- Username: `TestCungu`
- Password: `webshopapi24`
- Used by: CunguStockService
- Call pattern: `postGet(payload, 'stock')`

### Key Features

✅ **Automatic credential routing** - Services don't need to know which credentials to use
✅ **Independent token caching** - Each credential set maintains its own token
✅ **Automatic token refresh** - Expired tokens are automatically refreshed
✅ **Retry logic** - 401 errors trigger token refresh and automatic retry (max 3 attempts)
✅ **Concurrent request safety** - Multiple simultaneous API calls with different credentials work correctly
✅ **Graceful error handling** - 401 errors converted to 503 for proper HTTP semantics
✅ **Backward compatible** - Old code using single credential still works with defaults

### Environment Variable Hierarchy

1. **docker-compose.yml** (highest priority)
   - Set at container runtime
   - Overrides all other sources

2. **.env file** (fallback)
   - Read at startup if not in docker-compose
   - Useful for local development

3. **Hardcoded defaults in code** (last resort)
   - CunguWMS, TestCungu, etc.
   - Used if nothing else is configured

### Password Escaping Details

**docker-compose.yml**: `'C!g#2W4s5#$$M6'`
- Uses single quotes to prevent YAML parsing
- Double $$ becomes single $ when passed to container
- Final value in container: `C!g#2W4s5#$M6`

**.env file**: `C!g#2W4s5#$M6`
- Single $ is literal in .env files
- .env does not use variable expansion
- Final value in container: `C!g#2W4s5#$M6`

Both approaches result in the same credentials being used.

---

## Endpoints

### Sync Endpoint
```
POST /integrations/cungu/sync
Content-Type: application/json

Request body (optional):
{
  "receiving": { "dateFrom": "2025-01-01", "warehouses": ["Main"] },
  "shipping": { "dateFrom": "2025-01-01", "warehouses": ["Main"] },
  "stocks": { "changedSince": "2025-01-01" },
  "persist": true,
  "userId": 1
}

Response (200 OK):
{
  "receivingCount": 5,
  "shippingCount": 3,
  "stockCount": 0,
  "receivingImported": 5,
  "shippingImported": 3,
  "errors": []
}

Response (503 Service Unavailable):
{
  "statusCode": 503,
  "message": "Cungu API authentication failed. Please check API credentials...",
  "error": "Service Unavailable"
}
```

### Preview Endpoints (GET)
- `/integrations/cungu/receiving/preview?dateFrom=2025-01-01` - Preview receiving documents
- `/integrations/cungu/shipping/preview?dateFrom=2025-01-01` - Preview shipping documents
- `/integrations/cungu/stocks/preview?changedSince=2025-01-01` - Preview stock data

---

## Testing & Verification

### Test Sync (from browser or curl)
```bash
curl -X POST https://admin.cungu.com/api/fresh/integrations/cungu/sync \
  -H "Authorization: Bearer test" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: 200 OK with sync results

### Check Logs for Credential Usage
```bash
docker-compose logs backend | grep -i "authenticating"
```

Expected output:
```
Authenticating against Cungu API with username: CunguWMS
Authenticating against Cungu API with username: TestCungu
```

### Verify Token Caching
Call sync endpoint twice:
```bash
curl -X POST https://admin.cungu.com/api/fresh/integrations/cungu/sync -d '{}'
curl -X POST https://admin.cungu.com/api/fresh/integrations/cungu/sync -d '{}'
```

Check logs - should see "Authenticating" only 2 times total (once per credential type), not 4.

---

## Deployment & Persistence

### Files on Server
```
/opt/alta-wms/
├── backend/src/integrations/cungu/
│   ├── cungu.client.ts ✅
│   ├── cungu-shipping.service.ts ✅
│   ├── cungu-receiving.service.ts ✅
│   ├── cungu-stock.service.ts ✅
│   ├── cungu-sync.controller.ts ✅
│   ├── cungu-sync.service.ts ✅
│   ├── cungu.module.ts ✅
│   ├── cungu.types.ts ✅
│   └── cungu-scheduler.service.ts ✅
├── docker-compose.yml ✅ (with CUNGU env vars)
└── .env ✅ (with CUNGU env vars)
```

### Server Restart Process
1. docker-compose.yml read from disk ✅
2. Source files read from disk ✅
3. npm run build recompiles TypeScript ✅
4. Docker image rebuilt with new code ✅
5. Container starts with env vars from docker-compose.yml ✅

Result: System continues working with dual-credential support

---

## Known Limitations & Notes

1. **Document API uses same endpoint** as Stock API
   - Both hit http://cungu.pantheonmn.net:3003
   - Differentiation is via credentials, not URL

2. **Token TTL** is hardcoded to 55 minutes
   - Can be configured via CUNGU_API_TOKEN_TTL env var
   - Default: 55 * 60 * 1000 ms

3. **Max retries** is hardcoded to 3
   - On 401: refresh token and retry up to 3 times
   - After 3 failures: throw authentication error

4. **Concurrent authentication** is serialized per credential
   - Multiple requests with same credentials share auth promise
   - Prevents duplicate authentication calls
   - Different credentials authenticate in parallel

5. **No connection pooling** at Cungu client level
   - Uses Node.js fetch (connection managed by runtime)
   - Consider HTTP agent if performance becomes bottleneck

---

## Restoration Instructions

To restore from this snapshot:

```bash
# 1. Copy source files
cp -r backend/src/integrations/cungu/* /opt/alta-wms/backend/src/integrations/cungu/

# 2. Restore docker-compose.yml
cp docker-compose.yml /opt/alta-wms/

# 3. Restore .env
cp .env /opt/alta-wms/

# 4. Rebuild backend
cd /opt/alta-wms
docker-compose build --no-cache backend

# 5. Restart services
docker-compose up -d

# 6. Verify
docker-compose logs backend | grep "listening on port"
curl -X POST https://admin.cungu.com/api/fresh/integrations/cungu/sync -d '{}'
```

---

## Snapshot Integrity

**All files are production-ready code** committed to:
- Local workspace: `/Users/doppler/Desktop/apps/Alta WMS/`
- Server deployment: `/opt/alta-wms/`
- Docker builds: Rebuild on restart from persistent source

**No temporary or ephemeral changes** - Everything is persistent.

---

## Changelog (This Session)

**2025-11-29 (Session Date)**

1. ✅ Synced Cungu integration files from local to server
2. ✅ Fixed password escaping: `$M6` → `$$M6` in docker-compose.yml
3. ✅ Added CUNGU_STOCK_API credentials to .env
4. ✅ Rebuilt backend container with --no-cache
5. ✅ Tested sync endpoint - confirmed 200 OK without 401 errors
6. ✅ Verified dual-credential code is running in production
7. ✅ Created comprehensive documentation
8. ✅ Created this snapshot for disaster recovery

---

## Version Information

- **Backend**: NestJS 10.0.0
- **Node.js**: 18-alpine (in Docker)
- **TypeScript**: 5.x
- **Socket.io**: 4.7.5
- **PostgreSQL**: 16

---

## Support & Troubleshooting

See the included documentation files:
- **CUNGU_ARCHITECTURE.md** - How it works
- **CUNGU_DEPLOYMENT_CHECKLIST.md** - Verification steps
- **CUNGU_API_PERSISTENCE.md** - Persistence guarantees
- **CUNGU_SYNC_SETUP.md** - Original setup guide

