# Alta WMS - Grafana Dashboards

## 📊 Pregled

Kompletan paket Grafana dashboard-a za **Alta WMS** sistem sa ultra-modernim dizajnom i vizualizacijama.

### Uključeni Dashboard-i:

1. **Produktivnost Radnika** (`worker-productivity.json`) - 7 panela
2. **Operacije Prijema** (`receiving-operations.json`) - 7 panela  
3. **Operacije Otpreme** (`shipping-dispatch.json`) - 7 panela

---

## 🚀 Brza Instalacija

### 1. Dodaj Grafana u Docker Compose

U `docker-compose.prod.yml` dodaj:

```yaml
grafana:
  image: grafana/grafana:latest
  container_name: alta-wms-grafana
  restart: unless-stopped
  ports:
    - "3100:3000"
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin
    - GF_INSTALL_PLUGINS=
  volumes:
    - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
    - ./grafana/datasources.yml:/etc/grafana/provisioning/datasources/datasources.yml
    - grafana-data:/var/lib/grafana
  networks:
    - wms-network
  depends_on:
    - db

volumes:
  grafana-data:
```

### 2. Kreiraj Data Source Konfiguraciju

Kreiraj `grafana/datasources.yml`:

```yaml
apiVersion: 1

datasources:
  - name: PostgreSQL-WMS
    type: postgres
    access: proxy
    url: alta-wms-db-prod:5432
    database: wms
    user: wms_user
    secureJsonData:
      password: 'Dekodera19892603@@@'
    jsonData:
      sslmode: 'disable'
      postgresVersion: 1600
      timescaledb: false
```

### 3. Konfiguriši Dashboard Provisioning

Kreiraj `grafana/dashboards/dashboards.yml`:

```yaml
apiVersion: 1

providers:
  - name: 'Alta WMS Dashboards'
    orgId: 1
    folder: 'Alta WMS'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
```

### 4. Pokreni Grafana

```bash
cd /opt/alta-wms
docker compose -f docker-compose.prod.yml up -d grafana
```

### 5. Pristupi Grafana

- **URL**: http://46.224.54.239:3100
- **Username**: admin
- **Password**: admin (promeniti pri prvom logovanju)

---

## 📈 Dashboard Detalji

### 1. Produktivnost Radnika

**Fajl**: `worker-productivity.json`

**Paneli**:
1. **Obrađeni Artikli po Radniku** - KPI + bar chart sa vremenskim filterom
2. **Prosečno Vreme po Dokumentu** - Duration metrics grouped by worker
3. **Prosečno Vreme po Artiklu** - Item-level performance tracking
4. **Stopa Grešaka po Radniku** - Stacked bar chart (pogrešna lokacija, artikl, količina)
5. **Heatmap Produktivnosti** - Hourly activity heatmap (workers vs hours)
6. **Top 5 Najbrži/Najsporiji** - Side-by-side comparison tables
7. **Prisustvo & Aktivnost Smene** - Gauge + table for shift tracking

**Korišćene tabele**:
- `task_assignees` (started_at, completed_at, user_id)
- `users` (full_name, shift)
- `shipping_order_lines`, `receiving_items`
- `inventory_movements` (reason field for error tracking)

### 2. Operacije Prijema

**Fajl**: `receiving-operations.json`

**Paneli**:
1. **Dnevni/Nedeljni Obim Prijema** - Volume charts per day/week
2. **Prosečno Vreme Obrade Prijema** - Avg duration from open → complete
3. **Izuzeci / Problematični Prijemi** - Documents with discrepancies/photos
4. **Artikli po Prijemnom Dokumentu** - Distribution histogram
5. **Pantheon vs Stvarna Količina** - Mismatch percentage analysis
6. **Dobavljači sa Najviše Kašnjenja** - Bar chart supplier delays
7. **Aktivni Prijemi u Toku** - Current in-progress documents

**Korišćene tabele**:
- `receiving_documents` (status, created_at, started_at, completed_at)
- `receiving_items` (expected_quantity, received_quantity)
- `receiving_photos` (for exception tracking)
- `suppliers`

### 3. Operacije Otpreme / Dispatch

**Fajl**: `shipping-dispatch.json`

**Paneli**:
1. **Dnevni/Nedeljni Obim Otpreme** - Dispatch volume grouped by store/worker/shift
2. **Vreme Obrade Dokumenta** - Timeline: created_at → picked_at → completed_at
3. **Greške pri Otpremi** - Error matrix (wrong item, shortage, surplus, location)
4. **Najsporije Otpreme** - Top 10 slowest completed documents table
5. **Produktivnost Radnika (Otprema)** - Items processed per worker
6. **Distribucija po Prodavnicama** - Volume per store (PG, Budva, Bar, etc)
7. **Kašnjenje Otpreme** - Documents delayed beyond threshold

**Korišćene tabele**:
- `shipping_orders` (status, created_at, started_at, completed_at, store_name)
- `shipping_order_lines` (requested_qty, picked_qty, has_discrepancy)
- `task_assignees` (user assignments)
- `stores`

---

## 🎨 Dizajn

**Color Palette**:
- **Primary**: `#00d9ff` (Cyan/Teal)
- **Secondary**: `#ffd400` (Yellow/Gold)
- **Success**: `#4ade80` (Green)
- **Error**: `#f87171` (Red)
- **Background**: `#0f172a` (Dark Slate)
- **Panel BG**: `#1e293b` (Slate)

**Styling**:
- Rounded corners (8-12px radius)
- Neon-style accent colors with gradients
- Large bold KPI values
- Minimalistic borders
- Consistent spacing (2-3px margins)
- Modern font: Inter, -apple-system

---

## 📝 PostgreSQL Queries (Primeri)

### Obrađeni Artikli po Radniku (Dnevno)

```sql
SELECT 
  DATE(ta.completed_at) as day,
  u.full_name as worker,
  COUNT(DISTINCT ta.task_id) as completed_tasks,
  SUM(CASE 
    WHEN ta.task_type = 'SHIPPING' THEN (
      SELECT SUM(sol.picked_qty) 
      FROM shipping_order_lines sol 
      WHERE sol."orderId" = ta.task_id
    )
    WHEN ta.task_type = 'RECEIVING' THEN (
      SELECT SUM(ri.received_quantity) 
      FROM receiving_items ri 
      WHERE ri.receiving_document_id = ta.task_id
    )
    ELSE 0 
  END) as total_items
FROM task_assignees ta
JOIN users u ON u.id = ta.user_id
WHERE ta.status = 'DONE'
  AND ta.completed_at >= $__timeFrom()
  AND ta.completed_at < $__timeTo()
GROUP BY DATE(ta.completed_at), u.full_name
ORDER BY day DESC, total_items DESC;
```

### Prosečno Vreme po Dokumentu

```sql
SELECT 
  u.full_name as worker,
  AVG(EXTRACT(EPOCH FROM (ta.completed_at - ta.started_at))) as avg_duration_seconds
FROM task_assignees ta
JOIN users u ON u.id = ta.user_id
WHERE ta.status = 'DONE'
  AND ta.started_at IS NOT NULL
  AND ta.completed_at IS NOT NULL
  AND ta.completed_at >= $__timeFrom()
  AND ta.completed_at < $__timeTo()
GROUP BY u.full_name
ORDER BY avg_duration_seconds ASC;
```

### Stopa Grešaka (Error Rate)

```sql
SELECT 
  u.full_name as worker,
  COUNT(*) FILTER (WHERE im.reason LIKE 'PICK-OVER%') as over_picks,
  COUNT(*) FILTER (WHERE im.reason LIKE 'PICK-UNDER%') as under_picks,
  COUNT(*) FILTER (WHERE im.reason LIKE '%ADJUST%') as adjustments,
  COUNT(*) as total_movements
FROM inventory_movements im
JOIN users u ON u.id = im.created_by
WHERE im.created_at >= $__timeFrom()
  AND im.created_at < $__timeTo()
GROUP BY u.full_name
ORDER BY (over_picks + under_picks + adjustments) DESC;
```

### Dnevni Obim Prijema

```sql
SELECT 
  DATE(created_at) as day,
  COUNT(*) as document_count,
  SUM((SELECT COUNT(*) FROM receiving_items ri WHERE ri.receiving_document_id = rd.id)) as total_items
FROM receiving_documents rd
WHERE created_at >= $__timeFrom()
  AND created_at < $__timeTo()
GROUP BY DATE(created_at)
ORDER BY day DESC;
```

### Aktivne Otpreme po Prodavnici

```sql
SELECT 
  COALESCE(store_name, 'Nepoznato') as store,
  COUNT(*) as active_orders,
  SUM((SELECT SUM(sol.requested_qty) FROM shipping_order_lines sol WHERE sol."orderId" = so.id)) as total_items
FROM shipping_orders so
WHERE status IN ('CREATED', 'ASSIGNED', 'PICKING', 'STAGED')
GROUP BY store_name
ORDER BY active_orders DESC;
```

---

## 🔧 Prilagođavanje

### Promena Vremenske Zone

U Grafana UI → Configuration → Settings → Default Timezone: `Europe/Podgorica`

### Dodavanje Korisničkih Promenljivih

Dashboard-i podržavaju varijable:
- `$worker` - Filter po radniku
- `$store` - Filter po prodavnici
- `$shift` - Filter po smeni (PRVA/DRUGA)
- `$team` - Filter po timu

### Threshold Alarmi

Za kreiranje alarma (npr. "Otprema duža od 30 minuta"):
1. U panel settings → Alert
2. Definisati uslov: `avg() > 1800` (sekundi)
3. Notification channel: Email/Slack

---

## 📊 Data Retention

Preporučene PostgreSQL maintenance strategije:

```sql
-- Cleanup starih task_assignees (stariji od 6 meseci)
DELETE FROM task_assignees 
WHERE completed_at < NOW() - INTERVAL '6 months';

-- Archive inventory_movements (stariji od 1 godine)
CREATE TABLE inventory_movements_archive AS 
SELECT * FROM inventory_movements 
WHERE created_at < NOW() - INTERVAL '1 year';

DELETE FROM inventory_movements 
WHERE created_at < NOW() - INTERVAL '1 year';
```

---

## 🐛 Troubleshooting

### Dashboard ne učitava podatke

```bash
# Proveri Grafana logs
docker logs alta-wms-grafana

# Proveri DB konekciju
docker exec alta-wms-grafana grafana-cli admin reset-admin-password admin

# Test PostgreSQL connection
docker exec alta-wms-db-prod psql -U wms_user -d wms -c "SELECT COUNT(*) FROM task_assignees;"
```

### Performance Issues

```sql
-- Add indexes for faster queries
CREATE INDEX idx_task_assignees_completed ON task_assignees(completed_at) WHERE status = 'DONE';
CREATE INDEX idx_shipping_orders_created ON shipping_orders(created_at);
CREATE INDEX idx_receiving_docs_created ON receiving_documents(created_at);
CREATE INDEX idx_inventory_movements_created ON inventory_movements(created_at);
```

---

## 📞 Podrška

Za dodatna pitanja ili prilagođavanja dashboard-a, kontaktirajte tim za razvoj.

**Autor**: GitHub Copilot (Claude Sonnet 4.5)  
**Verzija**: 1.0.0  
**Datum**: 26 Novembar 2025
