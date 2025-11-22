# 🚀 Alta WMS - Produkcijska Dokumentacija za Hetzner Ubuntu Server

## 📋 Sadržaj

1. [Pregled Arhitekture](#pregled-arhitekture)
2. [Sistemski Zahtevi](#sistemski-zahtevi)
3. [Priprema Servera](#priprema-servera)
4. [Instalacija i Konfiguracija](#instalacija-i-konfiguracija)
5. [Environment Varijable](#environment-varijable)
6. [Docker Compose Produkcija](#docker-compose-produkcija)
7. [Nginx Reverse Proxy](#nginx-reverse-proxy)
8. [SSL/HTTPS Setup](#sslhttps-setup)
9. [Baza Podataka](#baza-podataka)
10. [Backup Strategija](#backup-strategija)
11. [Monitoring i Logging](#monitoring-i-logging)
12. [Security Best Practices](#security-best-practices)
13. [Deployment Proces](#deployment-proces)
14. [Troubleshooting](#troubleshooting)
15. [Maintenance](#maintenance)

---

## 📊 Pregled Arhitekture

### Komponente Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    Nginx (Port 80/443)                  │
│              SSL Termination & Reverse Proxy            │
└─────────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
│  Admin Panel │ │  PWA App     │ │  TV Display  │
│  (Next.js)   │ │  (Next.js)   │ │  (Next.js)   │
│  Port 3003   │ │  Port 8080   │ │  Port 8090   │
└───────┬──────┘ └──────┬──────┘ └──────┬──────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
                 ┌───────▼───────┐
                 │  Backend API  │
                 │   (NestJS)    │
                 │   Port 8000   │
                 └───────┬───────┘
                         │
                 ┌───────▼───────┐
                 │  PostgreSQL   │
                 │   Port 5432   │
                 └───────────────┘
```

### Servisi

1. **PostgreSQL 16** - Baza podataka
2. **Backend (NestJS)** - REST API + WebSocket
3. **Frontend Admin** - Next.js admin panel
4. **Frontend PWA** - Next.js PWA aplikacija
5. **Frontend TV** - Next.js TV wallboard

---

## 💻 Sistemski Zahtevi

### Minimalni Zahtevi

- **CPU**: 2 cores
- **RAM**: 4GB
- **Disk**: 50GB SSD
- **OS**: Ubuntu 22.04 LTS ili noviji

### Preporučeni Zahtevi (Produkcija)

- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Disk**: 100GB+ SSD
- **OS**: Ubuntu 22.04 LTS
- **Network**: 1Gbps

### Hetzner Preporuke

- **CPX21**: 3 vCPU, 4GB RAM, 80GB SSD - za test/produkciju
- **CPX31**: 4 vCPU, 8GB RAM, 160GB SSD - za veće opterećenje
- **CPX41**: 8 vCPU, 16GB RAM, 240GB SSD - za visoku performansu

---

## 🔧 Priprema Servera

### 1. Osnovna Konfiguracija

```bash
# Update sistema
sudo apt update && sudo apt upgrade -y

# Instalacija osnovnih alata
sudo apt install -y curl wget git ufw fail2ban htop

# Kreiranje korisnika (opciono, ako ne koristiš root)
sudo adduser alta
sudo usermod -aG sudo alta
```

### 2. Firewall Konfiguracija

```bash
# Omogući firewall
sudo ufw enable

# Dozvoli SSH (VAŽNO - prvo ovo!)
sudo ufw allow 22/tcp

# Dozvoli HTTP i HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Proveri status
sudo ufw status
```

### 3. Instalacija Docker

```bash
# Ukloni stare verzije
sudo apt remove -y docker docker-engine docker.io containerd runc

# Instaliraj Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Dodaj korisnika u docker grupu
sudo usermod -aG docker $USER

# Instaliraj Docker Compose V2
sudo apt install -y docker-compose-plugin

# Proveri instalaciju
docker --version
docker compose version

# Restartuj sesiju ili izloguj se i uloguj ponovo
```

### 4. Instalacija Nginx

```bash
sudo apt install -y nginx

# Pokreni i omogući Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Proveri status
sudo systemctl status nginx
```

---

## 📦 Instalacija i Konfiguracija

### 1. Postavljanje Projekta

```bash
# Kreiraj direktorijum za aplikacije
sudo mkdir -p /opt/alta-wms
sudo chown $USER:$USER /opt/alta-wms
cd /opt/alta-wms

# Upload projekta preko SCP/SFTP ili kopiraj fajlove direktno
# Primer SCP:
# scp -r /path/to/alta-wms/* user@server:/opt/alta-wms/
```

### 2. Kreiranje Direktorijuma

```bash
# Kreiraj direktorijume za uploads i backups
mkdir -p uploads backups logs
chmod 755 uploads backups logs
```

### 3. Environment Varijable

Kreiraj `.env` fajl u root direktorijumu projekta:

```bash
nano .env
```

Kopiraj sadržaj iz `env.production.example` (kreiraćemo ga) i prilagodi vrednosti.

---

## 🔐 Environment Varijable

### Backend Environment Variables

```bash
# Database
DB_URL=postgresql://wms_user:STRONG_PASSWORD_HERE@db:5432/wms

# JWT Security
JWT_SECRET=GENERATE_STRONG_RANDOM_SECRET_HERE

# Server
PORT=8000
NODE_ENV=production

# Analytics (opciono)
ANALYTICS_API_KEY=your-analytics-key
ANALYTICS_PUSH_URL=https://api.powerbi.com/beta/...
ANALYTICS_PUSH_MAP='{"assignee_id":"AssigneeId","task_type":"TaskType",...}'

# TV Kiosk
TV_KIOSK_TOKEN=GENERATE_STRONG_RANDOM_TOKEN_HERE

# Performance
PERFORMANCE_REFRESH_INTERVAL=30
```

### Frontend Environment Variables

```bash
# Admin Frontend
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NODE_ENV=production

# PWA Frontend
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# TV Frontend
NEXT_PUBLIC_BACKEND_URL=https://api.yourdomain.com
NEXT_PUBLIC_TV_KIOSK_TOKEN=GENERATE_STRONG_RANDOM_TOKEN_HERE
```
> **Važno**: `NEXT_PUBLIC_TV_KIOSK_TOKEN` mora biti identičan `TV_KIOSK_TOKEN` iz backend okolinskih promenljivih kako bi svi frontendi (Admin, PWA i TV) mogli da otvore `/ws/performance`.

### Generisanje Sigurnih Tokena

```bash
# Generiši JWT_SECRET
openssl rand -base64 32

# Generiši TV_KIOSK_TOKEN
openssl rand -base64 32

# Generiši DB password
openssl rand -base64 24
```

---

## 🐳 Docker Compose Produkcija

Kreiraj `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  db:
    image: postgres:16
    container_name: alta-wms-db-prod
    environment:
      POSTGRES_USER: wms_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: wms
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    ports:
      - "127.0.0.1:5432:5432"  # Samo localhost
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U wms_user -d wms"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - alta-wms-network

  backend:
    build:
      context: .
      dockerfile: docker/Dockerfile.backend
    container_name: alta-wms-backend-prod
    environment:
      DB_URL: postgresql://wms_user:${DB_PASSWORD}@db:5432/wms
      JWT_SECRET: ${JWT_SECRET}
      PORT: 8000
      NODE_ENV: production
      ANALYTICS_API_KEY: ${ANALYTICS_API_KEY:-}
      ANALYTICS_PUSH_URL: ${ANALYTICS_PUSH_URL:-}
      ANALYTICS_PUSH_MAP: ${ANALYTICS_PUSH_MAP:-}
      TV_KIOSK_TOKEN: ${TV_KIOSK_TOKEN}
      PERFORMANCE_REFRESH_INTERVAL: ${PERFORMANCE_REFRESH_INTERVAL:-30}
    ports:
      - "127.0.0.1:8000:8000"  # Samo localhost
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    restart: unless-stopped
    networks:
      - alta-wms-network
    command: npm run start:prod

  frontend-admin:
    build:
      context: .
      dockerfile: docker/Dockerfile.frontend-admin
    container_name: alta-wms-frontend-admin-prod
    environment:
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
      NODE_ENV: production
    ports:
      - "127.0.0.1:3003:3000"
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - alta-wms-network

  frontend-pwa:
    build:
      context: .
      dockerfile: docker/Dockerfile.frontend-pwa
    container_name: alta-wms-frontend-pwa-prod
    environment:
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
      NODE_ENV: production
    ports:
      - "127.0.0.1:8080:3000"
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - alta-wms-network

  frontend-tv:
    build:
      context: ./frontend-tv
    container_name: alta-wms-frontend-tv-prod
    environment:
      NEXT_PUBLIC_BACKEND_URL: ${NEXT_PUBLIC_API_URL}
      NEXT_PUBLIC_TV_KIOSK_TOKEN: ${TV_KIOSK_TOKEN}
      PORT: 8090
      NODE_ENV: production
    ports:
      - "127.0.0.1:8090:8090"
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - alta-wms-network

volumes:
  postgres_data:
    name: alta_wms_pgdata_prod

networks:
  alta-wms-network:
    driver: bridge
```

### Pokretanje Produkcije

```bash
# Build i start
docker compose -f docker-compose.prod.yml up -d --build

# Proveri status
docker compose -f docker-compose.prod.yml ps

# Pregled logova
docker compose -f docker-compose.prod.yml logs -f
```

---

## 🌐 Nginx Reverse Proxy

### 1. Kreiranje Nginx Konfiguracije

```bash
sudo nano /etc/nginx/sites-available/alta-wms
```

### 2. Nginx Konfiguracija (HTTP - pre SSL)

```nginx
# HTTP - redirect na HTTPS
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect sve na HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Admin Panel
server {
    listen 443 ssl http2;
    server_name admin.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/admin.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.yourdomain.com/privkey.pem;

    # SSL optimizacije
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# PWA App
server {
    listen 443 ssl http2;
    server_name pwa.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/pwa.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pwa.yourdomain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# TV Wallboard
server {
    listen 443 ssl http2;
    server_name tv.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/tv.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tv.yourdomain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Backend API
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Upload size limit
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Serve uploads
    location /uploads {
        alias /opt/alta-wms/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 3. Aktivacija Konfiguracije

```bash
# Kreiraj symlink
sudo ln -s /etc/nginx/sites-available/alta-wms /etc/nginx/sites-enabled/

# Test konfiguraciju
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## 🔒 SSL/HTTPS Setup

### 1. Instalacija Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Generisanje SSL Certifikata

```bash
# Za svaki subdomain
sudo certbot --nginx -d admin.yourdomain.com
sudo certbot --nginx -d pwa.yourdomain.com
sudo certbot --nginx -d tv.yourdomain.com
sudo certbot --nginx -d api.yourdomain.com

# Automatsko obnavljanje
sudo certbot renew --dry-run
```

### 3. Auto-Renewal Cron Job

```bash
# Certbot automatski kreira cron job, ali proveri:
sudo systemctl status certbot.timer
```

---

## 🗄️ Baza Podataka

### 1. Migracije

```bash
# Pokreni migracije
docker compose -f docker-compose.prod.yml exec backend npm run typeorm migration:run

# Proveri status migracija
docker compose -f docker-compose.prod.yml exec backend npm run typeorm migration:show
```

### 2. Seed Podaci (samo prvi put)

```bash
# Seed se automatski pokreće pri startu backend-a
# Proveri logove
docker compose -f docker-compose.prod.yml logs backend | grep "DB OK"
```

### 3. Pristup Bazi Podataka

```bash
# Kroz Docker
docker compose -f docker-compose.prod.yml exec db psql -U wms_user -d wms

# Ili sa hosta (ako je port otvoren)
psql -h localhost -U wms_user -d wms
```

---

## 💾 Backup Strategija

### 1. Automatski Backup Skripta

Kreiraj `scripts/backup.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/opt/alta-wms/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Kreiraj backup direktorijum
mkdir -p $BACKUP_DIR

# Backup baze podataka
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U wms_user wms | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# Backup uploads
tar -czf $BACKUP_DIR/uploads_backup_$DATE.tar.gz uploads/

# Obriši stare backup-ove
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $DATE"
```

### 2. Cron Job za Backup

```bash
# Dodaj u crontab
crontab -e

# Dnevni backup u 2:00 AM
0 2 * * * /opt/alta-wms/scripts/backup.sh >> /opt/alta-wms/logs/backup.log 2>&1
```

### 3. Restore Backup-a

```bash
# Restore baze
gunzip < backups/db_backup_YYYYMMDD_HHMMSS.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U wms_user -d wms

# Restore uploads
tar -xzf backups/uploads_backup_YYYYMMDD_HHMMSS.tar.gz -C /
```

---

## 📊 Monitoring i Logging

### 1. Docker Logs

```bash
# Svi servisi
docker compose -f docker-compose.prod.yml logs -f

# Specifični servis
docker compose -f docker-compose.prod.yml logs -f backend

# Poslednjih 100 linija
docker compose -f docker-compose.prod.yml logs --tail=100 backend
```

### 2. Log Rotation

Kreiraj `/etc/logrotate.d/alta-wms`:

```
/opt/alta-wms/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 root root
    sharedscripts
}
```

### 3. Health Checks

```bash
# Backend health
curl http://localhost:8000/health

# Database connection
docker compose -f docker-compose.prod.yml exec db pg_isready -U wms_user
```

---

## 🔒 Security Best Practices

### 1. Firewall Hardening

```bash
# Dozvoli samo potrebne portove
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. Fail2Ban Setup

```bash
# Konfiguriši Fail2Ban za SSH
sudo nano /etc/fail2ban/jail.local
```

```ini
[sshd]
enabled = true
port = 22
maxretry = 3
bantime = 3600
```

```bash
sudo systemctl restart fail2ban
```

### 3. Docker Security

```bash
# Ne koristi root korisnika u kontejnerima
# Koristi non-root user gde je moguće

# Regularno update Docker images
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### 4. Environment Variables Security

```bash
# .env fajl treba da ima samo root pristup
chmod 600 .env
chown root:root .env
```

### 5. Database Security

```bash
# Koristi jak password
# Ne izlaži port 5432 javno
# Koristi SSL za konekcije (opciono)
```

---

## 🚀 Deployment Proces

### 1. Initial Deployment

```bash
# 1. Postavi projekat
cd /opt/alta-wms
# Upload projekta preko SCP/SFTP ili kopiraj fajlove direktno

# 2. Kreiraj .env fajl
cp .env.example .env
nano .env  # Popuni vrednosti

# 3. Build i start
docker compose -f docker-compose.prod.yml up -d --build

# 4. Pokreni migracije
docker compose -f docker-compose.prod.yml exec backend npm run typeorm migration:run

# 5. Proveri status
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs
```

### 2. Update Deployment

```bash
# 1. Pull najnovije izmene
git pull origin main

# 2. Rebuild i restart
docker compose -f docker-compose.prod.yml up -d --build

# 3. Pokreni migracije ako postoje
docker compose -f docker-compose.prod.yml exec backend npm run typeorm migration:run

# 4. Proveri logove
docker compose -f docker-compose.prod.yml logs -f
```

### 3. Rollback

```bash
# 1. Vrati se na prethodnu verziju
git checkout <previous-commit-hash>

# 2. Rebuild
docker compose -f docker-compose.prod.yml up -d --build

# 3. Restore backup ako je potrebno
./scripts/restore.sh backups/db_backup_YYYYMMDD_HHMMSS.sql.gz
```

---

## 🔍 Troubleshooting

### Problem: Servisi se ne pokreću

```bash
# Proveri logove
docker compose -f docker-compose.prod.yml logs

# Proveri status
docker compose -f docker-compose.prod.yml ps

# Proveri resurse
docker stats

# Restart servisa
docker compose -f docker-compose.prod.yml restart <service-name>
```

### Problem: Database Connection Error

```bash
# Proveri da li je DB pokrenut
docker compose -f docker-compose.prod.yml ps db

# Proveri logove DB-a
docker compose -f docker-compose.prod.yml logs db

# Test konekciju
docker compose -f docker-compose.prod.yml exec db pg_isready -U wms_user
```

### Problem: Nginx 502 Bad Gateway

```bash
# Proveri da li su servisi pokrenuti
docker compose -f docker-compose.prod.yml ps

# Proveri Nginx logove
sudo tail -f /var/log/nginx/error.log

# Test Nginx konfiguraciju
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Problem: SSL Certificate Issues

```bash
# Proveri certifikat
sudo certbot certificates

# Renew certifikat
sudo certbot renew

# Test auto-renewal
sudo certbot renew --dry-run
```

### Problem: Out of Disk Space

```bash
# Proveri disk usage
df -h

# Očisti Docker
docker system prune -a

# Očisti stare backup-ove
find backups/ -mtime +30 -delete
```

---

## 🛠️ Maintenance

### Redovni Zadaci

1. **Nedeljno:**
   - Proveri disk space
   - Proveri logove za greške
   - Review backup status

2. **Mesečno:**
   - Update sistema: `sudo apt update && sudo apt upgrade`
   - Update Docker images
   - Review security logs
   - Test backup restore

3. **Kvartalno:**
   - Security audit
   - Performance review
   - Capacity planning

### Update Proces

```bash
# 1. Backup
./scripts/backup.sh

# 2. Pull changes
git pull

# 3. Update dependencies (ako je potrebno)
docker compose -f docker-compose.prod.yml build --no-cache

# 4. Restart
docker compose -f docker-compose.prod.yml up -d

# 5. Verify
docker compose -f docker-compose.prod.yml ps
curl http://localhost:8000/health
```

---

## 📞 Support i Kontakt

Za dodatnu pomoć ili pitanja:
- Proveri logove: `docker compose logs`
- Proveri dokumentaciju projekta
- Kontaktiraj development tim

---

## ✅ Checklist Pre Deployment-a

- [ ] Server je pripremljen (Ubuntu 22.04+)
- [ ] Docker i Docker Compose su instalirani
- [ ] Nginx je instaliran i konfigurisan
- [ ] Firewall je konfigurisan
- [ ] DNS zapisi su postavljeni
- [ ] SSL certifikati su generisani
- [ ] Environment varijable su postavljene
- [ ] Database password je jak i siguran
- [ ] JWT_SECRET je generisan
- [ ] Backup skripta je postavljena
- [ ] Monitoring je konfigurisan
- [ ] Test deployment je prošao uspešno

---

**Napomena:** Ova dokumentacija je vodič za produkcijski deployment. Prilagodi vrednosti prema svojim potrebama i sigurnosnim zahtevima.

