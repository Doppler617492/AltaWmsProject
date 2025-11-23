# 🔐 TV Kiosk Token - Production Setup Guide

## 📋 How It Works

The **TV Kiosk Token** is a shared secret used to authenticate WebSocket connections to the `/ws/performance` namespace. This allows:
- **TV Dashboard** (wallboard) to connect without user login
- **Admin Dashboard** to connect for real-time performance updates
- **PWA** to connect for live notifications

### Authentication Flow

```
┌─────────────────┐         ┌──────────────────┐         ┌──────────────┐
│  Frontend       │         │  Backend         │         │  WebSocket   │
│  (Browser)      │────────▶│  Gateway         │────────▶│  Connection  │
└─────────────────┘         └──────────────────┘         └──────────────┘
     │                              │                              │
     │ Sends token in:              │ Validates:                   │
     │ - x-kiosk-token header       │ - TV_KIOSK_TOKEN env var     │
     │ - kioskToken query param     │ - OR valid JWT token         │
     │ - Authorization header       │                              │
     │                              │                              │
```

## 🔒 Security Model

### Why It's "Public" (But Still Secure)

1. **`NEXT_PUBLIC_TV_KIOSK_TOKEN`** is exposed in the browser JavaScript
   - This is **intentional** - it's a kiosk token, not a user credential
   - Anyone can see it in the browser's source code
   - **This is OK** because:
     - It only grants access to read-only performance data
     - It doesn't allow modifying data or accessing user accounts
     - It's similar to an API key for public dashboards

2. **`TV_KIOSK_TOKEN`** stays on the server
   - Never exposed to the browser
   - Only used for validation on the backend
   - Must match the frontend token

### What the Token Protects

✅ **Allows:**
- Viewing performance metrics (read-only)
- Receiving real-time updates via WebSocket
- Connecting TV wallboards without login

❌ **Does NOT allow:**
- Modifying data
- Accessing user accounts
- Bypassing JWT authentication for API endpoints
- Accessing sensitive business data

## 🚀 Production Setup

### Step 1: Generate a Strong Token

```bash
# Generate a secure random token (64 characters)
openssl rand -base64 48

# Example output:
# lzCjLU8TpsvJyxFcmf1mfBIWcFb083qP2Yi8sBs56HyTHhmThkKy7GKxecgky0H5iFAx1pWKh02tvxLML01BN1OxHZcrsTMF372fkiy7npqRhfuV95ZYb6b8rzUi2TxJhJ8EdQ1KvwFNW1iHLjYlng97j8ChshufSOqsG0keMzboNwHP9tBsTT08IqOof4Ib7Fz9ixLz5IGd4KtX9LMSJUTdyl4XFKMTMPQ9W3Yr12wUWC8fqmZ3PzWYviPZq3Hn
```

### Step 2: Set Backend Environment Variable

**On your production server**, create/update `.env` file:

```bash
# Backend .env file (server-side only, never commit to Git)
TV_KIOSK_TOKEN=lzCjLU8TpsvJyxFcmf1mfBIWcFb083qP2Yi8sBs56HyTHhmThkKy7GKxecgky0H5iFAx1pWKh02tvxLML01BN1OxHZcrsTMF372fkiy7npqRhfuV95ZYb6b8rzUi2TxJhJ8EdQ1KvwFNW1iHLjYlng97j8ChshufSOqsG0keMzboNwHP9tBsTT08IqOof4Ib7Fz9ixLz5IGd4KtX9LMSJUTdyl4XFKMTMPQ9W3Yr12wUWC8fqmZ3PzWYviPZq3Hn
```

**For Docker Compose:**

```yaml
# docker-compose.prod.yml
services:
  backend:
    environment:
      TV_KIOSK_TOKEN: ${TV_KIOSK_TOKEN}  # Reads from .env file
```

### Step 3: Set Frontend Environment Variables

**During build time**, set the same token for all frontends:

```bash
# For Admin Frontend
NEXT_PUBLIC_TV_KIOSK_TOKEN=lzCjLU8TpsvJyxFcmf1mfBIWcFb083qP2Yi8sBs56HyTHhmThkKy7GKxecgky0H5iFAx1pWKh02tvxLML01BN1OxHZcrsTMF372fkiy7npqRhfuV95ZYb6b8rzUi2TxJhJ8EdQ1KvwFNW1iHLjYlng97j8ChshufSOqsG0keMzboNwHP9tBsTT08IqOof4Ib7Fz9ixLz5IGd4KtX9LMSJUTdyl4XFKMTMPQ9W3Yr12wUWC8fqmZ3PzWYviPZq3Hn

# For PWA Frontend
NEXT_PUBLIC_TV_KIOSK_TOKEN=lzCjLU8TpsvJyxFcmf1mfBIWcFb083qP2Yi8sBs56HyTHhmThkKy7GKxecgky0H5iFAx1pWKh02tvxLML01BN1OxHZcrsTMF372fkiy7npqRhfuV95ZYb6b8rzUi2TxJhJ8EdQ1KvwFNW1iHLjYlng97j8ChshufSOqsG0keMzboNwHP9tBsTT08IqOof4Ib7Fz9ixLz5IGd4KtX9LMSJUTdyl4XFKMTMPQ9W3Yr12wUWC8fqmZ3PzWYviPZq3Hn

# For TV Frontend
NEXT_PUBLIC_TV_KIOSK_TOKEN=lzCjLU8TpsvJyxFcmf1mfBIWcFb083qP2Yi8sBs56HyTHhmThkKy7GKxecgky0H5iFAx1pWKh02tvxLML01BN1OxHZcrsTMF372fkiy7npqRhfuV95ZYb6b8rzUi2TxJhJ8EdQ1KvwFNW1iHLjYlng97j8ChshufSOqsG0keMzboNwHP9tBsTT08IqOof4Ib7Fz9ixLz5IGd4KtX9LMSJUTdyl4XFKMTMPQ9W3Yr12wUWC8fqmZ3PzWYviPZq3Hn
```

**Important:** Use the **SAME token** for all three frontends and the backend!

### Step 4: Docker Compose Production Setup

Update your `.env` file (on the server, not in Git):

```bash
# .env file (server-side, chmod 600)
TV_KIOSK_TOKEN=lzCjLU8TpsvJyxFcmf1mfBIWcFb083qP2Yi8sBs56HyTHhmThkKy7GKxecgky0H5iFAx1pWKh02tvxLML01BN1OxHZcrsTMF372fkiy7npqRhfuV95ZYb6b8rzUi2TxJhJ8EdQ1KvwFNW1iHLjYlng97j8ChshufSOqsG0keMzboNwHP9tBsTT08IqOof4Ib7Fz9ixLz5IGd4KtX9LMSJUTdyl4XFKMTMPQ9W3Yr12wUWC8fqmZ3PzWYviPZq3Hn
```

Your `docker-compose.prod.yml` should already be configured:

```yaml
services:
  backend:
    environment:
      TV_KIOSK_TOKEN: ${TV_KIOSK_TOKEN}  # ✅ Reads from .env

  frontend-admin:
    environment:
      NEXT_PUBLIC_TV_KIOSK_TOKEN: ${TV_KIOSK_TOKEN}  # ✅ Same token

  frontend-pwa:
    environment:
      NEXT_PUBLIC_TV_KIOSK_TOKEN: ${TV_KIOSK_TOKEN}  # ✅ Same token

  frontend-tv:
    environment:
      NEXT_PUBLIC_TV_KIOSK_TOKEN: ${TV_KIOSK_TOKEN}  # ✅ Same token
```

### Step 5: Build and Deploy

```bash
# 1. Set the token in .env file (on server)
nano .env
# Add: TV_KIOSK_TOKEN=your-generated-token-here

# 2. Build and start services
docker compose -f docker-compose.prod.yml up -d --build

# 3. Verify backend has the token
docker compose -f docker-compose.prod.yml exec backend env | grep TV_KIOSK_TOKEN

# 4. Verify frontends have the token (check build logs)
docker compose -f docker-compose.prod.yml logs frontend-admin | grep NEXT_PUBLIC_TV_KIOSK_TOKEN
```

## 🔍 How It's Used in Code

### Backend (Server-Side)

```typescript
// backend/src/performance/performance.gateway.ts
const expected = process.env.TV_KIOSK_TOKEN || '';

// Accepts connection if:
// 1. Token matches, OR
// 2. No token configured (dev mode), OR
// 3. Valid JWT token (for logged-in users)
```

### Frontend (Client-Side)

```typescript
// frontend/src/components/layout/MainLayout.tsx
const token = process.env.NEXT_PUBLIC_TV_KIOSK_TOKEN || '';

// Sends token in WebSocket connection:
socket = io(`${base}/ws/performance`, {
  extraHeaders: { 'x-kiosk-token': token },
  query: { kioskToken: token }
});
```

## ⚠️ Important Security Notes

### ✅ Safe to Expose

- `NEXT_PUBLIC_TV_KIOSK_TOKEN` in browser JavaScript is **intentional**
- It's a kiosk token, not a user credential
- Only grants read-only access to performance metrics
- Similar to public API keys for dashboards

### 🔒 Keep Secret

- **Never commit** `.env` files to Git
- **Never share** the token in public repositories
- **Rotate** the token if compromised
- **Use different tokens** for dev/staging/production

### 🛡️ Additional Protection

The backend also accepts **JWT tokens** as a fallback:
- Logged-in users can connect with their JWT token
- This provides an alternative authentication method
- More secure for admin users

## 🐛 Troubleshooting

### Error: "Unauthorized" in Browser Console

**Problem:** Token mismatch between frontend and backend

**Solution:**
1. Check backend has `TV_KIOSK_TOKEN` set:
   ```bash
   docker compose exec backend env | grep TV_KIOSK_TOKEN
   ```

2. Check frontend was built with `NEXT_PUBLIC_TV_KIOSK_TOKEN`:
   ```bash
   # Rebuild frontend with correct token
   docker compose -f docker-compose.prod.yml up -d --build frontend-admin
   ```

3. Verify tokens match:
   ```bash
   # Backend token
   docker compose exec backend printenv TV_KIOSK_TOKEN
   
   # Frontend token (check build-time env)
   docker compose exec frontend-admin printenv NEXT_PUBLIC_TV_KIOSK_TOKEN
   ```

### WebSocket Connection Fails

**Problem:** Nginx not configured for WebSocket upgrade

**Solution:** Ensure Nginx config includes:
```nginx
location /socket.io/ {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_pass http://backend:8000;
}
```

## 📝 Summary

1. **Generate** a strong token: `openssl rand -base64 48`
2. **Set** `TV_KIOSK_TOKEN` in backend `.env` file
3. **Set** `NEXT_PUBLIC_TV_KIOSK_TOKEN` for all frontends (same value)
4. **Build** frontends with the token (it gets baked into JavaScript)
5. **Deploy** - token is now active

**Remember:** The token being visible in browser JavaScript is **by design** - it's a kiosk token for public dashboards, not a secret credential.

