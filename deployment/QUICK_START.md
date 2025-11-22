- **Backend unreachable**: ensure `.env.production` has `BACKEND_URL`, check `docker compose ... logs backend`.
- **SSL errors**: verify cert/key under `/etc/nginx/ssl/` and restart `nginx`.
- **Deploy hangs**: run `docker compose -f deployment/docker-compose.prod.yml ps` and `docker compose ... logs backend`.
- **Artifacts missing**: `ls /mnt/storagebox/backups` to confirm latest backup files.
# Quick Start - Alta WMS Production

1. `cd /opt/alta-wms`
2. `cp deployment/env.production.example .env.production` (fill secrets and credentials).
3. `docker compose -f deployment/docker-compose.prod.yml pull`
4. `docker compose -f deployment/docker-compose.prod.yml up -d --build`
5. `docker compose -f deployment/docker-compose.prod.yml ps`
6. `docker compose -f deployment/docker-compose.prod.yml exec -T backend curl -f http://localhost:8000/health`
7. `curl -I https://api.cungu.com`
8. `docker compose -f deployment/docker-compose.monitoring.yml up -d`
9. `docker compose -f deployment/monitoring/docker-compose.monitoring.yml logs grafana`
10. `deployment/scripts/backup.sh`

## Quick Troubleshoot Tips

- **If the backend fails health checks**, inspect logs: `docker compose -f deployment/docker-compose.prod.yml logs backend`.
- **SSL certificate issues**: check `/etc/nginx/ssl/*.crt` and `.key`, then restart `nginx`.
- **Monitoring unavailable**: restart the stack: `docker compose -f deployment/monitoring/docker-compose.monitoring.yml up -d`.
- **Backend unreachable**: ensure `.env.production` has `BACKEND_URL`, check `docker compose ... logs backend`.
- **SSL errors**: verify cert/key under `/etc/nginx/ssl/` and restart `nginx`.
- **Deploy hangs**: run `docker compose -f deployment/docker-compose.prod.yml ps` and `docker compose ... logs backend`.
- **Artifacts missing**: `ls /mnt/storagebox/backups` to confirm latest backup files.

