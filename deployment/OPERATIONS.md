# Alta WMS – Operations (Day 2)

Ovaj dokument opisuje svakodnevne operacije: kako održavati sistem u produkciji, ažurirati ga i raditi backup/restore.

## 1. Lokacije na serveru

- Kod: `/opt/alta-wms`
- Env fajl: `/opt/alta-wms/env.production`
- Docker prod compose: `/opt/alta-wms/deployment/docker-compose.prod.yml`
- Monitoring compose: `/opt/alta-wms/deployment/monitoring/docker-compose.monitoring.yml`
- Nginx config: `/etc/nginx/conf.d/alta-wms.conf`
- Backup direktorijum: `/mnt/storagebox/backups`

## 2. Pokretanje / restart aplikacije

```bash
# start / restart aplikacije
cd /opt/alta-wms
docker compose -f deployment/docker-compose.prod.yml up -d

# proveri stanje
docker compose -f deployment/docker-compose.prod.yml ps

# proveri logove backend-a
docker compose -f deployment/docker-compose.prod.yml logs backend --tail=200
```

## 3. Monitoring stack

```bash
cd /opt/alta-wms
docker compose -f deployment/monitoring/docker-compose.monitoring.yml up -d

# Grafana obično na portu 3000
docker compose -f deployment/monitoring/docker-compose.monitoring.yml logs grafana --tail=100
```

## 4. Deploy nove verzije (bez CI/CD)

Ako želiš ručno:

```bash
cd /opt/alta-wms
git pull origin main
deployment/scripts/deploy.sh --build
```

Ako koristiš CI/CD:

- Push na `main` granu pokreće GitHub Actions
- Workflow puni image-e u GHCR i preko SSH zove `deployment/scripts/deploy.sh --build`

## 5. Backup

- `deployment/scripts/db-backup.sh` pravi PostgreSQL dump u `/mnt/storagebox/backups/db-<datum>.sql`
- `deployment/scripts/backup.sh` arhivira `/opt/alta-wms/uploads` i poziva db-backup
- Arhive su timestampovane i nikada ne brišu postojeće fajlove

## 6. Restore

- Restore baze:
  ```bash
  cd /opt/alta-wms
  deployment/scripts/restore.sh --db /mnt/storagebox/backups/db/<dump>.sql
  ```
- Restore fajlova:
  ```bash
  deployment/scripts/restore.sh <uploads-archive.tar.gz>
  ```

## 7. Logovi

- Aplikacioni logovi: `docker compose -f deployment/docker-compose.prod.yml logs backend`
- Nginx logovi: `/var/log/nginx/access.log` i `/var/log/nginx/error.log`
- Logrotate (FAZA 8.5) rotira sve na 7 dana, čuva 30 arhiva, koristi gzip i automatski briše stare logove

## 8. SSL certifikati

- Certbot auto-renew (FAZA 8.6) pokreće:
  ```bash
  certbot renew --quiet
  systemctl reload nginx
  ```
- Ako je certifikat blizu isteka (<20 dana), alert se šalje Slack/Email
- Za ručnu proveru:
  ```bash
  sudo certbot renew --dry-run
  ```

## 9. Incidenti (kratko)

- Backend ne radi:
  ```bash
  cd /opt/alta-wms
  docker compose -f deployment/docker-compose.prod.yml logs backend --tail=200
  docker compose -f deployment/docker-compose.prod.yml restart backend
  ```

- Nginx / SSL problem:
  ```bash
  systemctl status nginx
  nginx -t && systemctl reload nginx
  ```

- Disk pun:
  ```bash
  df -h
  docker system df
  ```

Detaljni scenariji su u `RUNBOOKS.md`.

