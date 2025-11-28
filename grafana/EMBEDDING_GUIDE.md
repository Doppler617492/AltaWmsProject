# Grafana Embedding Guide - Alta WMS Analytics

## ✅ Configuration Complete

Your Grafana dashboards are now configured for **anonymous access** and **embedded viewing** in the Alta WMS analytics page.

---

## 🎯 What Was Configured

### 1. **Anonymous Access** (No Login Required)
```ini
[auth.anonymous]
enabled = true
org_name = Main Org.
org_role = Viewer
```
Users can view dashboards without logging in - they have **Viewer** role (read-only).

### 2. **Embedding Enabled**
```ini
[security]
allow_embedding = true
cookie_samesite = none
```
Dashboards can be embedded in iframes from your admin.cungu.com domain.

### 3. **Database Connection Fixed**
```yaml
jsonData:
  database: 'wms'  # Explicitly set database name
```
PostgreSQL connection now includes the database name in jsonData, fixing the 400 Bad Request errors.

---

## 🔗 Accessing Dashboards

### Direct URLs (Anonymous - No Login):
```
Worker Productivity:
http://46.224.54.239:3100/d/worker-productivity

Receiving Operations:
http://46.224.54.239:3100/d/receiving-operations

Shipping/Dispatch:
http://46.224.54.239:3100/d/shipping-dispatch
```

### Embedded in Analytics Page:
Visit: **https://admin.cungu.com/analytics**

Click: **"▶ Prikaži dashboard"** button

The dashboards will appear embedded directly in your analytics page with:
- ✅ No login required
- ✅ TV mode (kiosk) for clean display
- ✅ Auto-refresh every 30 seconds
- ✅ 7-day time range by default
- ✅ Tab navigation between 3 dashboards

---

## 📱 Iframe Embed Code

If you want to embed in other pages, use this iframe code:

```html
<!-- Worker Productivity Dashboard -->
<iframe 
  src="http://46.224.54.239:3100/d/worker-productivity?orgId=1&from=now-7d&to=now&timezone=Europe%2FPodgorica&refresh=30s&kiosk=tv"
  width="100%" 
  height="800px" 
  style="border:none;"
  allowfullscreen>
</iframe>

<!-- Receiving Operations Dashboard -->
<iframe 
  src="http://46.224.54.239:3100/d/receiving-operations?orgId=1&from=now-7d&to=now&timezone=Europe%2FPodgorica&refresh=30s&kiosk=tv"
  width="100%" 
  height="800px" 
  style="border:none;"
  allowfullscreen>
</iframe>

<!-- Shipping/Dispatch Dashboard -->
<iframe 
  src="http://46.224.54.239:3100/d/shipping-dispatch?orgId=1&from=now-7d&to=now&timezone=Europe%2FPodgorica&refresh=30s&kiosk=tv"
  width="100%" 
  height="800px" 
  style="border:none;"
  allowfullscreen>
</iframe>
```

---

## 🎨 URL Parameters Explained

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `orgId=1` | Organization ID | Required for anonymous access |
| `from=now-7d` | Start time | Show last 7 days |
| `to=now` | End time | Up to current time |
| `timezone=Europe%2FPodgorica` | Timezone | Display times in local timezone |
| `refresh=30s` | Auto-refresh | Update data every 30 seconds |
| `kiosk=tv` | TV mode | Hide Grafana header/sidebar for clean embed |

### Available Kiosk Modes:
- `kiosk` - Hide top nav, show search/time picker
- `kiosk=tv` - Hide everything (cleanest for embedding) ✅ **Recommended**

### Time Range Options:
```
from=now-1h   → Last hour
from=now-6h   → Last 6 hours
from=now-12h  → Last 12 hours
from=now-24h  → Last day
from=now-7d   → Last 7 days (default)
from=now-30d  → Last 30 days
from=now-90d  → Last 90 days
```

---

## 🔐 Security Notes

### Anonymous Access Scope:
- ✅ **Enabled**: View dashboards (read-only)
- ❌ **Disabled**: Create/edit dashboards
- ❌ **Disabled**: Access data sources
- ❌ **Disabled**: Admin functions

### Admin Access Still Available:
```
URL: http://46.224.54.239:3100/login
Username: admin
Password: admin

(Change password in UI: Profile → Change Password)
```

---

## 🚀 Deployment Steps Completed

1. ✅ Created `grafana.ini` with anonymous access + embedding
2. ✅ Fixed `datasources.yml` to include database in jsonData
3. ✅ Updated `docker-compose.grafana.yml` to mount grafana.ini
4. ✅ Uploaded all configuration files to production
5. ✅ Restarted Grafana container with new config
6. ✅ Updated `frontend/pages/analytics.tsx` with embedded dashboards

---

## 🧪 Testing

### Test Anonymous Access:
1. Open incognito/private browser window
2. Go to: `http://46.224.54.239:3100/d/worker-productivity`
3. Dashboard should load **without** login prompt
4. Data should display correctly (no "default database" errors)

### Test Embedded View:
1. Go to: `https://admin.cungu.com/analytics`
2. Click **"▶ Prikaži dashboard"** button
3. Dashboard iframe should load inline
4. Switch between tabs (Worker, Receiving, Shipping)
5. All 3 dashboards should load without errors

---

## 🐛 Troubleshooting

### Issue: "Login Required" message appears
**Solution**: Check Grafana logs for anonymous access:
```bash
docker logs alta-wms-grafana | grep anonymous
```
Should see: `anonymous authentication enabled`

### Issue: "Default database not configured"
**Solution**: Verify datasource configuration:
```bash
docker exec alta-wms-grafana cat /etc/grafana/provisioning/datasources/datasources.yml
```
Should contain: `database: 'wms'` in jsonData section

### Issue: Iframe shows blank/loading forever
**Solution**: Check CORS and embedding settings:
```bash
docker exec alta-wms-grafana cat /etc/grafana/grafana.ini | grep -A2 security
```
Should show: `allow_embedding = true`

### Issue: 404 on dashboard URLs
**Solution**: Verify dashboard files are mounted:
```bash
docker exec alta-wms-grafana ls -lh /var/lib/grafana/dashboards/
```
Should list 3 JSON files (~22KB each)

---

## 📊 Dashboard Features

### Worker Productivity (7 panels):
- Items processed per worker (bar chart)
- Average time per document (gauge)
- Average time per item (gauge)
- Error rate by worker (stacked bar)
- Hourly productivity heatmap
- Top 5 fastest workers (green table)
- Top 5 slowest workers (red table)

### Receiving Operations (7 panels):
- Daily receiving volume (time series)
- Average processing time (gauge)
- Exceptions with issues (stat)
- Items per document (stat)
- Pantheon vs actual comparison (bar chart)
- Supplier delays (bar chart)
- Active receiving documents (live table)

### Shipping/Dispatch (8 panels):
- Daily shipping volume (time series)
- Average processing time (gauge)
- Orders with errors (stat)
- Active shipments (stat)
- Slowest shipments (top 10 table)
- Worker productivity (bar chart)
- Store distribution (donut chart)
- Late shipments (table, >15 min)

---

## 🔄 Next Steps (Optional)

### 1. **Change Admin Password**
```bash
# Login at http://46.224.54.239:3100/login
# Go to: Profile → Preferences → Change Password
```

### 2. **Add More Dashboards**
- Copy existing dashboard JSON
- Modify queries/panels as needed
- Upload to `/opt/alta-wms/grafana/dashboards/`
- Restart Grafana to auto-import

### 3. **Setup Alerts**
- Create alert rules in Grafana UI
- Configure notification channels (email, Slack, etc.)
- Set thresholds for critical metrics

### 4. **Performance Optimization**
- Adjust `refresh` parameter if 30s is too frequent
- Consider caching for heavy queries
- Add query result caching in PostgreSQL

### 5. **Secure HTTPS Access**
- Setup reverse proxy (Nginx) with SSL
- Update `root_url` in grafana.ini
- Use `https://` in iframe URLs

---

## 📞 Support

If you encounter any issues:

1. Check Grafana logs: `docker logs alta-wms-grafana`
2. Verify container is running: `docker ps | grep grafana`
3. Test database connection: `docker exec alta-wms-grafana wget -O- http://localhost:3000/api/health`
4. Review this guide's troubleshooting section

---

## ✨ Summary

🎉 **Grafana dashboards are now live and embedded in your analytics page!**

- ✅ No login required for users
- ✅ Embedded directly in https://admin.cungu.com/analytics
- ✅ Real-time data with 30-second auto-refresh
- ✅ 3 comprehensive dashboards (22 panels total)
- ✅ Beautiful neon cyan design matching your brand
- ✅ All data from live PostgreSQL production database

Users can now access advanced analytics visualizations without leaving your main application! 🚀
