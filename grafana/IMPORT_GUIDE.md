# Grafana Dashboard Import Guide

## 🎯 Quick Access

**Grafana URL**: http://46.224.54.239:3100

**Login**:
- Username: `admin`
- Password: `admin` (change on first login)

---

## 📊 Dashboards Ready to Use

All 3 dashboards have been automatically provisioned and are ready to use:

### 1. 📈 **Produktivnost Radnika** (Worker Productivity)
- **UID**: `worker-productivity`
- **Panels**: 7 panels
  - Obrađeni Artikli po Radniku (bar chart)
  - Prosečno Vreme po Dokumentu (gauge)
  - Prosečno Vreme po Artiklu (gauge)
  - Stopa Grešaka po Radniku (stacked bar)
  - Heatmap Produktivnosti po Satima (heatmap)
  - Top 5 Najbrži Radnici (table)
  - Top 5 Najsporiji Radnici (table)

### 2. 📦 **Operacije Prijema** (Receiving Operations)
- **UID**: `receiving-operations`
- **Panels**: 7 panels
  - Dnevni Obim Prijema (time series)
  - Prosečno Vreme Obrade (gauge)
  - Prijemi sa Problemima (stat)
  - Artikli po Dokumentu (stat)
  - Pantheon vs Stvarna Količina (bar chart)
  - Dobavljači sa Kašnjenjem (bar chart)
  - Aktivni Prijemi u Toku (table)

### 3. 🚚 **Operacije Otpreme / Dispatch** (Shipping/Dispatch)
- **UID**: `shipping-dispatch`
- **Panels**: 8 panels (bonus!)
  - Dnevni Obim Otpreme (time series)
  - Prosečno Vreme Obrade (gauge)
  - Otpreme sa Greškama (stat)
  - Aktivne Otpreme (stat)
  - Najsporije Otpreme (table)
  - Produktivnost Radnika (Otprema) (bar chart)
  - Distribucija po Prodavnicama (pie chart)
  - Otpreme sa Kašnjenjem (table)

---

## 🚀 How to Access Dashboards

### Method 1: Dashboard List (Easiest)
1. Login to Grafana: http://46.224.54.239:3100
2. Click **☰ Menu** (top left)
3. Click **Dashboards**
4. You'll see all 3 dashboards under "Alta WMS" folder:
   - Produktivnost Radnika
   - Operacije Prijema
   - Operacije Otpreme / Dispatch

### Method 2: Direct Links
Once Grafana assigns internal IDs, you can bookmark:
- Worker Productivity: `http://46.224.54.239:3100/d/worker-productivity`
- Receiving Operations: `http://46.224.54.239:3100/d/receiving-operations`
- Shipping Dispatch: `http://46.224.54.239:3100/d/shipping-dispatch`

### Method 3: Search
1. Press **`/`** (forward slash) to open search
2. Type dashboard name
3. Press Enter

---

## ⚙️ Dashboard Settings

All dashboards include:

✅ **Auto-refresh**: Every 30 seconds  
✅ **Time range**: Last 7-30 days (adjustable via top-right picker)  
✅ **Timezone**: Europe/Podgorica  
✅ **Data source**: PostgreSQL-WMS (pre-configured)  
✅ **Serbian language**: All labels in Serbian  

---

## 🎨 Design Features

- **Neon color scheme**: Cyan (#00d9ff), Yellow (#ffd400), Green (#4ade80), Red (#f87171)
- **Gradient fills**: Bars and gauges with gradient effects
- **Rounded corners**: Modern 8-12px border radius
- **Large KPIs**: Bold numeric values with icons
- **Interactive**: Click and drag to zoom, hover for details

---

## 🔧 Customization Tips

### Change Time Range
- Click **time picker** (top right): "Last 7 days ▼"
- Select: Last 24 hours, 7 days, 30 days, or custom range

### Filter Data
Dashboards currently show all data. To add filters:
1. Click **⚙️ Dashboard settings** (top right)
2. Go to **Variables** tab
3. Add new variable (e.g., `$worker`, `$store`, `$shift`)
4. Edit panel queries to use: `WHERE user_id = $worker`

### Edit Panels
1. Click panel title → **Edit**
2. Modify SQL query
3. Adjust visualization settings
4. Click **Save** (top right)

### Export Dashboard
1. Click **⚙️ Dashboard settings**
2. Click **JSON Model** (left sidebar)
3. Copy JSON or click **Save to file**

---

## 📊 Data Refresh

- **Real-time**: Dashboards refresh every 30 seconds automatically
- **Manual refresh**: Click 🔄 icon (top right)
- **Data lag**: ~0 seconds (queries run directly on production DB)

---

## 🐛 Troubleshooting

### "No data" in panels
**Solution**:
1. Check time range - may need to go back further (e.g., Last 30 days)
2. Verify database has data for selected period
3. Check PostgreSQL data source connection: Configuration → Data sources → PostgreSQL-WMS

### Dashboard not appearing
**Solution**:
```bash
ssh root@46.224.54.239
cd /opt/alta-wms
ls -la grafana/dashboards/  # Should show 3 .json files
docker logs alta-wms-grafana --tail 50  # Check for errors
docker restart alta-wms-grafana
```

### Slow queries
**Solution**: Add database indexes (see README.md "Performance Issues" section)

### Can't login
**Reset admin password**:
```bash
ssh root@46.224.54.239
docker exec -it alta-wms-grafana grafana-cli admin reset-admin-password admin
```

---

## 📈 Next Steps

1. **Set up alerts**: 
   - Edit panels → Alert tab
   - Create alert rules (e.g., "Notify if avg processing time > 30 min")
   - Configure notification channels (email, Slack, etc.)

2. **Create custom dashboards**:
   - Use existing dashboards as templates
   - Combine panels from different dashboards
   - Add new metrics based on business needs

3. **Share dashboards**:
   - Click **Share** icon (top right)
   - Get shareable link or embed iframe
   - Create public snapshots

4. **Schedule reports**:
   - Install Grafana Image Renderer plugin
   - Set up automated PDF reports via email

---

## 🔗 Resources

- **Grafana Documentation**: https://grafana.com/docs/
- **PostgreSQL Data Source**: https://grafana.com/docs/grafana/latest/datasources/postgres/
- **Query Examples**: See `/opt/alta-wms/grafana/README.md`

---

## 📞 Support

For issues or questions:
1. Check logs: `docker logs alta-wms-grafana`
2. Review full documentation: `/opt/alta-wms/grafana/README.md`
3. Contact development team

---

**Last Updated**: 26 November 2025  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
