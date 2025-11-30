# Cungu API Dual-Credential Implementation Snapshots

This directory contains production snapshots of the complete Cungu API dual-credential implementation for Alta WMS.

## Available Snapshots

### snapshot_20251129_151908
**Created**: 2025-11-29 15:19:08  
**Status**: ✅ Production Ready  
**Size**: 104K (uncompressed), 29K (compressed .tar.gz)

Complete backup of:
- 9 TypeScript source files with dual-credential implementation
- 2 configuration files (docker-compose.yml, .env)
- 5 documentation files

**Access**:
- **Directory**: `snapshot_20251129_151908/`
- **Compressed Archive**: `snapshot_20251129_151908.tar.gz`

---

## Quick Start

### For Disaster Recovery

```bash
# Extract snapshot
tar -xzf snapshot_20251129_151908.tar.gz

# Restore to server
cp -r snapshot_20251129_151908/backend/src/integrations/cungu/* /opt/alta-wms/backend/src/integrations/cungu/
cp snapshot_20251129_151908/docker-compose.yml /opt/alta-wms/
cp snapshot_20251129_151908/.env /opt/alta-wms/

# Rebuild and restart
cd /opt/alta-wms
docker-compose build --no-cache backend
docker-compose up -d
```

### For Review & Reference

```bash
# View snapshot contents
ls -la snapshot_20251129_151908/

# Read architecture documentation
cat snapshot_20251129_151908/CUNGU_ARCHITECTURE.md

# View source files
cat snapshot_20251129_151908/backend/src/integrations/cungu/cungu.client.ts
```

---

## Snapshot Contents

Each snapshot contains:

### Source Code
```
backend/src/integrations/cungu/
├── cungu.client.ts                 # Core API client with dual-credential logic
├── cungu-shipping.service.ts       # Fetch shipping documents (Document API)
├── cungu-receiving.service.ts      # Fetch receiving documents (Document API)
├── cungu-stock.service.ts          # Fetch stock data (Stock API)
├── cungu-sync.controller.ts        # REST endpoint orchestration
├── cungu-sync.service.ts           # Core sync logic
├── cungu.module.ts                 # NestJS module declaration
├── cungu.types.ts                  # TypeScript interfaces
└── cungu-scheduler.service.ts      # Optional scheduled sync
```

### Configuration
```
├── docker-compose.yml              # Production deployment config with env vars
└── .env                            # Environment variable fallback
```

### Documentation
```
├── SNAPSHOT_MANIFEST.md            # Complete inventory (THIS IS WHAT YOU NEED)
├── CUNGU_ARCHITECTURE.md           # Technical deep-dive
├── CUNGU_DEPLOYMENT_CHECKLIST.md   # Verification steps
├── CUNGU_API_PERSISTENCE.md        # Persistence guarantees
└── CUNGU_SYNC_SETUP.md             # Original setup guide
```

---

## Credentials in This Snapshot

### Document API (Shipping/Receiving)
- **Username**: `CunguWMS`
- **Password**: `C!g#2W4s5#$M6`
- **Endpoint**: http://cungu.pantheonmn.net:3003
- **Used by**: CunguShippingService, CunguReceivingService

### Stock API
- **Username**: `TestCungu`
- **Password**: `webshopapi24`
- **Endpoint**: http://cungu.pantheonmn.net:3003
- **Used by**: CunguStockService

---

## Key Implementation Details

### Dual-Credential Routing
```typescript
// Services never specify credentials directly
await client.postGet(payload, 'documents');  // Uses CunguWMS
await client.postGet(payload, 'stock');      // Uses TestCungu
```

### Token Management
- Independent token caching per credential set
- 55-minute TTL per token
- Automatic token refresh on 401 errors
- Concurrent request safety with serialized authentication per credential

### Password Escaping
- **docker-compose.yml**: `'C!g#2W4s5#$$M6'` (YAML escaping, double $$)
- **.env file**: `C!g#2W4s5#$M6` (No escaping, literal $)
- Both result in same password in running container

---

## Files Size Reference

| File | Size | Purpose |
|------|------|---------|
| cungu.client.ts | 6.6K | Core dual-credential client |
| cungu-sync.service.ts | 9.2K | Sync orchestration logic |
| cungu-stock.service.ts | 7.8K | Stock API integration |
| cungu-receiving.service.ts | 5.7K | Receiving documents |
| cungu-sync.controller.ts | 4.6K | REST endpoint |
| cungu-shipping.service.ts | 3.7K | Shipping documents |
| cungu-scheduler.service.ts | 2.3K | Optional scheduling |
| cungu.types.ts | 2.0K | TypeScript types |
| cungu.module.ts | 1.1K | Module declaration |
| docker-compose.yml | 2.3K | Docker config |
| .env | 3.2K | Environment variables |
| Documentation (5 files) | ~39K | Technical docs |
| **Total** | **~104K** | Complete snapshot |

---

## Verification Checklist

After restoration, verify with:

```bash
# 1. Check files exist
ls -la /opt/alta-wms/backend/src/integrations/cungu/ | wc -l
# Expected: 9 files

# 2. Check configuration
grep CUNGU_API /opt/alta-wms/docker-compose.yml | wc -l
# Expected: 4 lines (username and password for each API)

# 3. Rebuild
cd /opt/alta-wms
docker-compose build --no-cache backend
# Expected: Build succeeds with no errors

# 4. Start services
docker-compose up -d
sleep 10

# 5. Test sync endpoint
curl -X POST https://admin.cungu.com/api/fresh/integrations/cungu/sync \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: 200 OK with sync results

# 6. Check logs for credentials
docker-compose logs backend | grep -i "authenticating"
# Expected: Two authentication lines (one per credential set)
```

---

## Restoration Troubleshooting

### Problem: Files don't exist after extraction
```bash
# Verify extract worked
tar -tzf snapshot_20251129_151908.tar.gz | grep cungu.client.ts
# Should show: snapshot_20251129_151908/backend/src/integrations/cungu/cungu.client.ts
```

### Problem: Build fails with TypeScript errors
```bash
# Ensure you extracted ALL files including .env
ls -la snapshot_20251129_151908/ | grep -E "\.env|docker-compose"
# Should show both files

# Rebuild with verbose output
docker-compose build --no-cache --verbose backend
```

### Problem: 401 Unauthorized errors after restart
```bash
# Check environment variables were loaded
docker-compose config | grep CUNGU_API_PASSWORD
# Should show: C!g#2W4s5#$M6

# Verify container has variables
docker-compose exec backend env | grep CUNGU
# Should show 4 CUNGU_* variables
```

### Problem: Only one credential being used
```bash
# This means both services aren't being called
# Check logs for which services are running
docker-compose logs backend | grep -i "CunguService"

# Manually trigger sync endpoint
curl -X POST https://admin.cungu.com/api/fresh/integrations/cungu/sync \
  -H "Content-Type: application/json" \
  -d '{
    "receiving": {"dateFrom": "2024-01-01", "warehouses": ["Main"]},
    "shipping": {"dateFrom": "2024-01-01", "warehouses": ["Main"]},
    "stocks": {"changedSince": "2024-01-01"}
  }'
```

---

## Snapshot Management

### Creating New Snapshots

```bash
# In workspace root
mkdir -p snapshots
date_stamp=$(date +%Y%m%d_%H%M%S)
snapshot_dir="snapshots/snapshot_$date_stamp"
mkdir -p "$snapshot_dir/backend/src/integrations/cungu"

# Copy source files
cp backend/src/integrations/cungu/*.ts "$snapshot_dir/backend/src/integrations/cungu/"

# Copy config
cp docker-compose.yml .env "$snapshot_dir/"

# Copy documentation
cp CUNGU_*.md "$snapshot_dir/"

# Create manifest
cp snapshots/snapshot_*/SNAPSHOT_MANIFEST.md "$snapshot_dir/" && \
  sed -i "s/2025-11-29.*/$date_stamp/" "$snapshot_dir/SNAPSHOT_MANIFEST.md"

# Compress
tar -czf "snapshots/snapshot_$date_stamp.tar.gz" "$snapshot_dir/"
```

### Comparing Snapshots

```bash
# Show differences between snapshots
diff -r snapshot_20251129_151908/backend/src/integrations/cungu/ \
        snapshot_20251128_120000/backend/src/integrations/cungu/

# Find which snapshot has the latest version
ls -lh snapshots/snapshot_*.tar.gz | tail -3
```

---

## Integration with Version Control

To add snapshot to git (optional):

```bash
# Add to .gitignore (snapshots can be large)
echo "snapshots/*.tar.gz" >> .gitignore

# Track manifest files
git add snapshots/snapshot_20251129_151908/*.md
git add snapshots/snapshot_20251129_151908/backend/src/integrations/cungu/

# Commit with meaningful message
git commit -m "feat: dual-credential Cungu API implementation snapshot

- Snapshot date: 2025-11-29 15:19:08
- 9 TypeScript files with dual-credential support
- CunguWMS (documents) and TestCungu (stock) credentials
- Tested and verified working end-to-end
- Production ready for deployment"
```

---

## Important Notes

1. **Credentials are embedded** - Keep snapshot directory access restricted
2. **Always test restoration** - Never rely on untested disaster recovery
3. **Keep multiple copies** - Store snapshot in:
   - Local workspace: `/Users/doppler/Desktop/apps/Alta WMS/snapshots/`
   - Server backup: `/opt/alta-wms/backups/snapshots/`
   - Cloud storage (optional): S3, Google Drive, etc.
4. **Update snapshots regularly** - Create new snapshot after significant changes

---

## See Also

- **SNAPSHOT_MANIFEST.md** - Detailed inventory of all files and credentials
- **CUNGU_ARCHITECTURE.md** - How the dual-credential system works
- **CUNGU_DEPLOYMENT_CHECKLIST.md** - Step-by-step verification
- **CUNGU_API_PERSISTENCE.md** - Guarantees and edge cases

---

**Last Updated**: 2025-11-29  
**Status**: Production Ready ✅  
**Next Snapshot**: TBD
