# Alta WMS Production Deployment

## 1. Server Preparation

- Install Docker (>=24) and Docker Compose (2+) on Ubuntu 22.04+. Use the official guide: `curl -fsSL https://get.docker.com | sh`.
- Add the deployment user to the `docker` group and enable Docker at boot: `sudo systemctl enable --now docker`.
- Hardening:
  - Configure UFW to allow 22/80/443 only: `ufw allow 22/tcp && ufw allow 80,443/tcp && ufw enable`.
  - Install `fail2ban` to protect SSH (default jail enabled).
  - Disable root login via SSH if possible and rely on key authentication.
- Ensure `/opt/alta-wms` and `/mnt/storagebox/backups` directories exist: `mkdir -p /opt/alta-wms /mnt/storagebox/backups`.

## 2. DNS Setup

- Point the following A records to `46.224.54.239`:
  - `api.cungu.com`
  - `admin.cungu.com`
  - `pwa.cungu.com`
  - `tv.cungu.com`
- Use short TTL (e.g., 300) for blue/green swaps.
- Verify propagation via `dig api.cungu.com`.

## 3. Copying the Project

- Postavi projekat u `/opt/alta-wms`:
  ```bash
  # Upload projekta preko SCP/SFTP ili kopiraj fajlove direktno
  cd /opt/alta-wms
  ```
- Keep `/opt/alta-wms/blue`, `/opt/alta-wms/green`, and `/opt/alta-wms/live` directories for blue/green workflows. The `live` directory should be a symlink pointing at either `/opt/alta-wms/blue` or `/opt/alta-wms/green`.

## 4. Generating `.env.production`

- Copy the template and fill sensitive values:
  ```bash
  cp deployment/env.production.example /opt/alta-wms/env.production
  ```
- Replace placeholders:
  - Generate a random `JWT_SECRET` (64 hex characters).
  - Generate a secure `DB_PASS`.
  - Ensure `DB_HOST=db` and Redis/PG credentials match the Compose definitions.
  - Set proper URLs, CORS origins, and SSL certificate paths if needed.

## 5. Blue/Green Deployment Workflow (Faza 8.2)

- Directory structure inside `/opt/alta-wms`:
  ```
  /opt/alta-wms/
    ├── blue/
    ├── green/
    └── live -> blue/  # symlink to current active candidate
  ```
- To deploy a new version:
  1. Build the candidate stack inside the inactive directory (e.g., `green` if `live` → `blue`).
  2. Update `live` symlink: `ln -sfn /opt/alta-wms/green /opt/alta-wms/live`.
  3. Run `docker compose -f deployment/docker-compose.prod.yml up -d --build` from `/opt/alta-wms/live`.
  4. Health-check backend via `/health`.
  5. Remove the old containers by pruning unused images and volumes as needed.

## 6. SSL Setup via Certbot

- Install Certbot: `apt install certbot`.
- Generate certificates for each domain:
  ```bash
  certbot certonly --standalone -d api.cungu.com -d admin.cungu.com -d pwa.cungu.com -d tv.cungu.com
  ```
- Certificates will land in `/etc/letsencrypt/live/<domain>/`.
- Update Nginx config or symlinks to point to the new `.crt` and `.key` files.
- Reload the `nginx` container: `docker compose -f deployment/docker-compose.prod.yml restart nginx`.

## 7. Monitoring Stack (Faza 8.3)

- The monitoring bundle lives under `deployment/monitoring/`:
  - `docker-compose.monitoring.yml` orchestrates Prometheus, Node Exporter, cAdvisor, Grafana, Redis, Postgres, and a placeholder Sentry service.
  - `prometheus.yml` scrapes Prometheus itself, Node Exporter, cAdvisor, and the Sentry web UI.
  - `grafana.ini` configures Grafana admin credentials and disables analytics.
- Start monitoring with: `docker compose -f deployment/monitoring/docker-compose.monitoring.yml up -d`.
- The Sentry DSN placeholder (`https://examplePublicKey@o0.ingest.sentry.io/0`) can be used by both NestJS and JavaScript SDKs (set `SENTRY_DSN` in each service’s env).
- Expose Grafana on port `3000` and Prometheus on `9090` (adjust firewall accordingly).

## 8. Backup Strategy

- Manual backup scripts:
  - `deployment/scripts/db-backup.sh` dumps the PostgreSQL database into `/mnt/storagebox/backups/db-<date>.sql`.
  - `deployment/scripts/backup.sh` archives `/opt/alta-wms/uploads` and reuses the DB dump script.
- Run these before sensitive migrations or releases.
- Backups are append-only and do not delete existing files.

## 9. Restore Strategy

- Restore uploads: `deployment/scripts/restore.sh /mnt/storagebox/backups/uploads-<timestamp>.tar.gz`.
- Restore database manually with `psql` if needed (use the SQL dump produced by `db-backup.sh`).
- Always re-check ownership/permissions after restore (`chown -R alta:alta /opt/alta-wms/uploads`).

## 10. GitHub Workflow & CI/CD

- Pushes to `main` trigger `.github/workflows/prod.yml`:
  - Run lint suites for backend, admin UI, PWA (via `npm run lint`).
  - Login to GHCR and build/push Docker images for backend, admin, PWA, and TV.
  - SSH into the server to execute `deployment/scripts/deploy.sh --build`.

## 11. Zero-Downtime Rollout Summary

1. Ensure `/opt/alta-wms/live` symlink points to the current candidate (`blue` or `green`).
2. Build the opposite candidate, update the symlink, and run `docker compose -f deployment/docker-compose.prod.yml up -d --build`.
3. Hit `/health` to confirm readiness.
4. Once healthy, cleanup the older candidate (stop/ prune old containers).



