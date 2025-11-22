# 🚀 Alta WMS - Quick Start Guide za Produkciju

## Brzi Start (5 minuta)

### 1. Priprema Servera

```bash
# Update sistema
sudo apt update && sudo apt upgrade -y

# Instaliraj Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Instaliraj Docker Compose
sudo apt install -y docker-compose-plugin

# Instaliraj Nginx
sudo apt install -y nginx

# Firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. Kloniranje Projekta

```bash
cd /opt
sudo mkdir -p alta-wms
sudo chown $USER:$USER alta-wms
cd alta-wms
# Upload projekta preko SCP/SFTP ili kopiraj fajlove direktno
# Primer SCP:
# scp -r /path/to/alta-wms/* user@server:/opt/alta-wms/
```

### 3. Konfiguracija

```bash
# Kreiraj .env fajl
cp env.production.example .env
nano .env

# Generiši sigurne token-e
openssl rand -base64 32  # Za JWT_SECRET
openssl rand -base64 32  # Za TV_KIOSK_TOKEN
openssl rand -base64 24  # Za DB_PASSWORD
```

U `.env` fajlu vrednost `NEXT_PUBLIC_TV_KIOSK_TOKEN` mora biti ista kao `TV_KIOSK_TOKEN` – tako svi frontendi (web admin, PWA i TV) mogu da se povežu na `/ws/performance`.

### 4. Pokretanje

```bash
# Build i start
docker compose -f docker-compose.prod.yml up -d --build

# Proveri status
docker compose -f docker-compose.prod.yml ps

# Pregled logova
docker compose -f docker-compose.prod.yml logs -f
```

### 5. Nginx Setup

```bash
# Kopiraj Nginx konfiguraciju iz DEPLOYMENT.md
sudo nano /etc/nginx/sites-available/alta-wms

# Aktiviraj
sudo ln -s /etc/nginx/sites-available/alta-wms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. SSL Certifikati

```bash
# Instaliraj Certbot
sudo apt install -y certbot python3-certbot-nginx

# Generiši certifikate
sudo certbot --nginx -d admin.yourdomain.com
sudo certbot --nginx -d pwa.yourdomain.com
sudo certbot --nginx -d tv.yourdomain.com
sudo certbot --nginx -d api.yourdomain.com
```

## ✅ Provera

```bash
# Health check
curl http://localhost:8000/health

# Proveri servise
docker compose -f docker-compose.prod.yml ps

# Proveri logove
docker compose -f docker-compose.prod.yml logs backend
```

## 📝 Važne Napomene

1. **Prvo postavi DNS zapise** pre SSL certifikata
2. **Generiši jak password** za bazu podataka
3. **Postavi backup skriptu** u crontab
4. **Proveri firewall** da su samo potrebni portovi otvoreni

## 🔗 Dodatna Dokumentacija

Za detaljnu dokumentaciju, pogledaj `DEPLOYMENT.md`.

