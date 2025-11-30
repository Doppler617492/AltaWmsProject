# Cungu API Dual-Credential Architecture

**Overview**: How the system manages two different API credentials simultaneously  
**Created**: 2025-11-29

---

## Architecture Diagram

```
Frontend Request
    │
    ├─→ POST /api/fresh/integrations/cungu/sync
    │
    └─→ Nginx (https://admin.cungu.com)
         │
         └─→ Backend (http://backend:8000)
              │
              └─→ CunguSyncController
                   │
                   ├─→ CunguReceivingService
                   │    │
                   │    └─→ CunguClient.postGet(payload, 'documents')
                   │         │
                   │         ├─→ resolveCredentials('documents')
                   │         │    └─→ Returns {username: 'CunguWMS', password: 'C!g#2W4s5#$M6'}
                   │         │
                   │         ├─→ ensureToken(credentials)
                   │         │    └─→ Checks cache key "CunguWMS:C!g#2W4s5#$M6"
                   │         │    └─→ Authenticates if token expired/missing
                   │         │
                   │         └─→ performPost(payload, credentials)
                   │              └─→ Makes request with Document API token
                   │
                   ├─→ CunguShippingService
                   │    │
                   │    └─→ CunguClient.postGet(payload, 'documents')
                   │         └─→ Same as above (uses Document API credentials)
                   │
                   └─→ CunguStockService
                        │
                        └─→ CunguClient.postGet(payload, 'stock')
                             │
                             ├─→ resolveCredentials('stock')
                             │    └─→ Returns {username: 'TestCungu', password: 'webshopapi24'}
                             │
                             ├─→ ensureToken(credentials)
                             │    └─→ Checks cache key "TestCungu:webshopapi24"
                             │    └─→ Authenticates if token expired/missing
                             │
                             └─→ performPost(payload, credentials)
                                  └─→ Makes request with Stock API token
```

---

## Credential Resolution Logic

### CunguClient.resolveCredentials(apiType)

```typescript
private resolveCredentials(apiType: 'documents' | 'stock'): {
  username: string;
  password: string;
} {
  if (apiType === 'stock') {
    // Stock API credentials
    return {
      username: process.env.CUNGU_STOCK_API_USERNAME || 'TestCungu',
      password: process.env.CUNGU_STOCK_API_PASSWORD || 'webshopapi24',
    };
  } else {
    // Document API (default)
    return {
      username: process.env.CUNGU_API_USERNAME || 'CunguWMS',
      password: process.env.CUNGU_API_PASSWORD || 'C!g#2W4s5#$M6',
    };
  }
}
```

**When called:**
- By CunguShippingService: `postGet(payload, 'documents')` → Uses CunguWMS
- By CunguReceivingService: `postGet(payload, 'documents')` → Uses CunguWMS
- By CunguStockService: `postGet(payload, 'stock')` → Uses TestCungu

---

## Token Caching Strategy

### Multi-Credential Token Cache

```typescript
private cachedTokens: Map<string, CachedToken> = new Map();
// Key format: "username:password"
// Example: "CunguWMS:C!g#2W4s5#$M6" → token value and expiry
// Example: "TestCungu:webshopapi24" → different token and expiry
```

### Why This Matters

**Scenario**: Both Document API and Stock API are called simultaneously

```
Time T=0:00
├─ CunguShippingService calls postGet(payload, 'documents')
│   ├─ resolveCredentials('documents') → CunguWMS creds
│   ├─ ensureToken(CunguWMS credentials)
│   │   └─ Checks cache["CunguWMS:C!g#2W4s5#$M6"] → empty
│   │   └─ Authenticates CunguWMS → gets token_A
│   │   └─ Stores in cache["CunguWMS:C!g#2W4s5#$M6"] = token_A
│   └─ performPost(payload, token_A) → Success
│
└─ CunguStockService calls postGet(payload, 'stock')
    ├─ resolveCredentials('stock') → TestCungu creds
    ├─ ensureToken(TestCungu credentials)
    │   └─ Checks cache["TestCungu:webshopapi24"] → empty
    │   └─ Authenticates TestCungu → gets token_B
    │   └─ Stores in cache["TestCungu:webshopapi24"] = token_B
    └─ performPost(payload, token_B) → Success

Result: ✅ Both services use correct credentials and tokens
        ✅ No cross-credential contamination
        ✅ Each service gets its own token
```

---

## Environment Variable Hierarchy

```
┌─────────────────────────────────────────────┐
│ NestJS Application Startup                   │
├─────────────────────────────────────────────┤
│                                              │
│ process.env (built-in)                      │
│  ↓ (reads from)                             │
│                                              │
│ 1. docker-compose.yml "environment:" block  │ ← Primary (highest priority)
│    - CUNGU_API_PASSWORD: 'C!g#2W4s5#$$M6'   │ ← Double $$ escaping
│                                              │
│ 2. .env file (if not overridden)            │ ← Fallback (if not in #1)
│    - CUNGU_API_PASSWORD=C!g#2W4s5#$M6       │ ← Single $ (no escaping needed)
│                                              │
│ 3. Hardcoded defaults in code               │ ← Last resort
│    - 'CunguWMS', 'TestCungu', etc.          │
│                                              │
└─────────────────────────────────────────────┘
```

### Loading Priority Example

**If all three sources have values:**
```javascript
const username = 
  process.env.CUNGU_API_USERNAME ||  // #1: docker-compose (wins)
  'CunguWMS';                        // #3: hardcoded default

// In our setup:
// #1: docker-compose has "CunguWMS" → USED
// #2: .env has "CunguWMS" → IGNORED
// #3: hardcoded "CunguWMS" → IGNORED
```

---

## Persistence Guarantee

### On Server Restart

```
Before Restart:
├─ Persistent disk: /opt/alta-wms/
│   ├─ backend/src/integrations/cungu/*.ts
│   ├─ docker-compose.yml
│   └─ .env
└─ Docker container: running with old image

Restart triggered
    ↓
Docker daemon stops
    ↓
Docker daemon starts
    ↓
docker-compose up -d
    ↓
Reads docker-compose.yml ✅ from disk
    ↓
Sees "build: context: ."
    ↓
Reads Dockerfile ✅ from disk
    ↓
build process:
    COPY backend/ . ✅ copies from persistent disk
    npm run build ✅ compiles latest source code with dual-credential logic
    ↓
Creates NEW image with compiled code
    ↓
Container starts with env vars from docker-compose.yml ✅
    ↓

After Restart:
├─ Persistent disk: /opt/alta-wms/ (unchanged)
├─ Docker image: NEW, built from persistent source
├─ Environment variables: Loaded from docker-compose.yml
└─ Result: ✅ System works identically as before restart
```

---

## Authentication Flow Diagram

```
User clicks "Sync" button
    │
    ├─→ Frontend sends POST /api/fresh/integrations/cungu/sync
    │
    ├─→ Nginx routes to http://backend:8000/integrations/cungu/sync
    │
    ├─→ CunguSyncController.sync()
    │   │
    │   ├─→ await receivingService.fetchDocuments(filters)
    │   │   │
    │   │   └─→ client.postGet(payload, 'documents')
    │   │       │
    │   │       ├─ resolveCredentials('documents')
    │   │       │   └─ Returns: {username: 'CunguWMS', password: 'C!g#2W4s5#$M6'}
    │   │       │
    │   │       ├─ ensureToken(credentials)
    │   │       │   ├─ getTokenCacheKey(credentials) → "CunguWMS:C!g#2W4s5#$M6"
    │   │       │   ├─ cachedTokens.get("CunguWMS:...") → null/expired
    │   │       │   └─ authenticate(credentials)
    │   │       │       └─ POST /login with CunguWMS creds
    │   │       │           └─ Cungu API returns token_1
    │   │       │           └─ Store: cachedTokens["CunguWMS:..."] = token_1
    │   │       │
    │   │       └─ performPost(payload, credentials)
    │   │           └─ POST /get with Authorization: Bearer token_1
    │   │               └─ Cungu API returns documents (if any)
    │   │
    │   ├─→ await shippingService.fetchDocuments(filters)
    │   │   └─→ [same as above, uses 'documents' → CunguWMS credentials]
    │   │
    │   └─→ await stockService.fetchStocks(filters)
    │       │
    │       └─→ client.postGet(payload, 'stock')
    │           │
    │           ├─ resolveCredentials('stock')
    │           │   └─ Returns: {username: 'TestCungu', password: 'webshopapi24'}
    │           │
    │           ├─ ensureToken(credentials)
    │           │   ├─ getTokenCacheKey(credentials) → "TestCungu:webshopapi24"
    │           │   ├─ cachedTokens.get("TestCungu:...") → null/expired
    │           │   └─ authenticate(credentials)
    │           │       └─ POST /login with TestCungu creds
    │           │           └─ Cungu API returns token_2
    │           │           └─ Store: cachedTokens["TestCungu:..."] = token_2
    │           │
    │           └─ performPost(payload, credentials)
    │               └─ POST /get with Authorization: Bearer token_2
    │                   └─ Cungu API returns stock data (if any)
    │
    └─→ Return: {receivingCount, shippingCount, stockCount, errors}
        │
        └─→ Frontend displays result
            └─→ 200 OK = ✅ sync successful
```

---

## Error Handling

### 401 Unauthorized (Invalid Credentials)

```typescript
if (response.status === 401) {
  if (retryCount >= this.maxRetries) {
    // Max retries exceeded
    this.logger.error(`Max retries (${this.maxRetries}) exceeded for 401 errors with ${credentials.username}`);
    throw new Error(`Authentication failed after multiple retries for ${credentials.username}`);
    // Controller converts this to ServiceUnavailableException (503)
  }
  
  // Retry with fresh token
  this.logger.warn(`Received 401 - refreshing token and retrying (attempt ${retryCount + 1}/${this.maxRetries})`);
  
  // Invalidate cached token
  const cacheKey = this.getTokenCacheKey(credentials);
  const cached = this.cachedTokens.get(cacheKey);
  if (cached) {
    cached.expiresAt = 0;  // Force expiration
  }
  
  // Authenticate again
  await this.ensureToken(credentials);
  
  // Retry the request
  return this.performPost<TResponse>(payload, credentials, retryCount + 1);
}
```

### Error Response Structure

```typescript
// If sync endpoint gets 401
{
  "statusCode": 503,
  "message": "Cungu API authentication failed. Please check API credentials (CUNGU_STOCK_API_USERNAME/PASSWORD).",
  "error": "Service Unavailable"
}

// If specific document import fails
{
  "receivingCount": 5,
  "shippingCount": 0,
  "stockCount": 0,
  "receivingImported": 3,
  "shippingImported": 0,
  "errors": [
    "Error importing receiving document REC-001: Invalid SKU",
    "Error importing receiving document REC-002: Duplicate entry"
  ]
}
```

---

## Configuration Verification Checklist

- [x] CunguClient has `postGet<T>(payload, apiType)` signature
- [x] resolveCredentials() returns correct credentials per apiType
- [x] Token cache uses "username:password" as key
- [x] CunguShippingService calls `postGet(payload, 'documents')`
- [x] CunguReceivingService calls `postGet(payload, 'documents')` (2 places)
- [x] CunguStockService calls `postGet(payload, 'stock')`
- [x] docker-compose.yml has all 4 CUNGU env vars
- [x] Password in docker-compose has $$M6 (double $)
- [x] .env has all 5 CUNGU env vars
- [x] Password in .env has $M6 (single $)
- [x] Backend rebuilt with --no-cache
- [x] Backend container running with new image
- [x] Sync endpoint returns 200 without 401 errors

---

## Testing the System

### Test 1: Verify Credentials Are Used
```bash
# Check logs for authentication messages
docker-compose logs backend | grep -i "authenticat"

# Should see:
# - "Authenticating against Cungu API with username: CunguWMS"
# - "Authenticating against Cungu API with username: TestCungu"
```

### Test 2: Verify Token Caching
```bash
# Call sync twice rapidly
curl https://admin.cungu.com/api/fresh/integrations/cungu/sync -X POST
curl https://admin.cungu.com/api/fresh/integrations/cungu/sync -X POST

# Check logs - second call should use cached token (no new authentication)
docker-compose logs backend | grep "Authenticat"

# Should see only 2 authentications total (one per credential type)
# Not 4 (which would indicate no caching)
```

### Test 3: Verify Persistence After Restart
```bash
# Restart services
docker-compose down
docker-compose up -d

# Wait for startup
sleep 5

# Test sync endpoint
curl https://admin.cungu.com/api/fresh/integrations/cungu/sync -X POST

# Should get 200 OK, not 401
# Should see same authentication messages as before
```

---

## Summary

The dual-credential system works by:

1. **Request arrives** at CunguSyncController
2. **Services specify API type** when calling `client.postGet(payload, 'documents'|'stock')`
3. **CunguClient resolves correct credentials** based on API type
4. **Independent token caching** prevents cross-credential contamination
5. **Each credential set** maintains separate authentication state
6. **Retries handle transient failures** with fresh token generation
7. **All configuration is persistent** on disk (survives restarts)
8. **Environment variable hierarchy** ensures correct values at runtime

**Result**: ✅ Seamless dual-credential support with automatic credential routing and independent token management.

