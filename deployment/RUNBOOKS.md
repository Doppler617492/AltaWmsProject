# Alta WMS – Runbooks

## 1. Backend ne radi (500, 502, 503)

1. Uloguj se na server:

   ```bash
   ssh root@46.224.54.239
   cd /opt/alta-wms
   ```

2. Proveri stanje kontejnera:

   ```bash
   docker compose -f deployment/docker-compose.prod.yml ps
   ```

3. Ako je backend down:

   ```bash
   docker compose -f deployment/docker-compose.prod.yml logs backend --tail=200
   docker compose -f deployment/docker-compose.prod.yml restart backend
   ```

4. Najčešći problemi:
   - pogrešan `DB_HOST` / `DB_PASS` u `.env.production`
   - migracije nisu primenjene

## 2. Nginx / SSL problem

1. Provera:

   ```bash
   systemctl status nginx
   nginx -t
   systemctl reload nginx
   ```

2. Ako je certifikat istekao:

   ```bash
   certbot renew
   systemctl reload nginx
   ```

## 3. Baza je pala (restore)

1. Nađi poslednji dump u `/mnt/storagebox/backups/db/`
2. Pokreni restore:

   ```bash
   cd /opt/alta-wms
   deployment/scripts/restore.sh --db /mnt/storagebox/backups/db/NAJNOVIJI.sql
   docker compose -f deployment/docker-compose.prod.yml restart backend
   ```

## 4. PWA ne radi, admin radi

1. Proveri PWA kontejner:

   ```bash
   docker compose -f deployment/docker-compose.prod.yml ps pwa
   docker compose -f deployment/docker-compose.prod.yml logs pwa --tail=200
   ```

2. Ako je build pogrešan:
   ```bash
   deployment/scripts/deploy.sh --build
   ```

## 5. TV / wallboard ne prikazuje podatke

1. Proveri TV kontejner:

   ```bash
   docker compose -f deployment/docker-compose.prod.yml ps tv
   docker compose -f deployment/docker-compose.prod.yml logs tv --tail=200
   ```

2. Proveri backend endpoint za TV:
   ```bash
   curl -f http://localhost:8000/health
   ```

3. Ako samo TV aplikacija je problem:
   ```bash
   docker compose -f deployment/docker-compose.prod.yml restart tv
   ```

## 6. Da li Cursor može da radi deploy?

- Cursor ne hostuje aplikaciju – ona radi na tvom Hetzner serveru.
- Cursor ti pomaže da menjaš kod, pokreneš lokalni Docker i gurneš promene na GitHub.
- Deploy ide preko:
  - GitHub Actions (`.github/workflows/prod.yml`)
  - ili ručno:

    ```bash
    ssh root@46.224.54.239
    cd /opt/alta-wms
    deployment/scripts/deploy.sh --build
    ```

