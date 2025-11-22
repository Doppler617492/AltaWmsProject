# Alta WMS – Arhitektura sistema

## 1. Pregled

Alta WMS se sastoji od više servisa:

- **backend** (NestJS, port 8000)
- **admin UI** (Next.js, port 3003 u produkciji, lokalno 3000)
- **PWA (magacioner)** (Next.js, port 8080)
- **TV / wallboard** (Next.js, port 8090)
- **PostgreSQL** (baza podataka)
- **Nginx** kao reverse proxy i SSL terminacija
- **Monitoring stack** (Prometheus, Node Exporter, cAdvisor, Grafana, Sentry)

Svi servisi se u produkciji pale preko:

- `deployment/docker-compose.prod.yml` (aplikacija)
- `deployment/monitoring/docker-compose.monitoring.yml` (monitoring)

Kod se drži u `/opt/alta-wms` na serveru.

## 2. Domene

Produkcijski domeni:

- Backend API: `https://core.cungu.com`
- Admin UI: `https://wms.cungu.com`
- PWA (magacioner): `https://pwa.cungu.com`
- TV / wallboard: `https://tv.cungu.com`

Sve to ide kroz Nginx konfiguraciju u:

- `deployment/nginx/alta-wms.conf`

## 3. Servisi i portovi

- `backend` – unutar Docker mreže: `backend:8000`
- `admin` – `admin:3000`
- `pwa` – `pwa:3000`
- `tv` – `tv:3000`
- `db` – `postgres:5432`
- `nginx` – host portovi 80/443

## 4. Glavni moduli u backend-u

- `auth` – login, JWT, RBAC
- `receiving` – prijem robe
- `inventory` / `stock` – stanje zaliha i kretanja
- `warehouse` / `warehouse-map` – lokacije, mapa skladišta
- `cycle-count` – popis
- `workforce` – radna snaga, smene, zadaci
- `labels` – generisanje etiketa / bar kodova
- `monitoring` – health check endpointi

## 5. Frontend aplikacije

### Admin UI

- React/Next.js aplikacija podignuta na `wms.cungu.com`
- Glavni tabovi:
  - Prijem
  - Zalihe
  - Popis
  - Radna snaga
  - Mapa skladišta
  - Korisnici
  - Konfiguracije / etikete

### PWA (magacioner)

- Next.js aplikacija optimizovana za Zebra uređaje
- Glavne funkcije:
  - Moji prijemi
  - Popis
  - Put-away taskovi
  - Povraćaj

### TV / Wallboard

- Next.js aplikacija na `tv.cungu.com`
- Ne zahteva login (ili koristi read-only token)
- Prikazuje:
  - broj aktivnih prijema / otprema
  - performanse po magacioneru
  - timske skorove

