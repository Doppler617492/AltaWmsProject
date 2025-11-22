# 📚 Alta WMS - Produkcijska Dokumentacija - Pregled

## 📖 Dokumentacija

Ova dokumentacija je podeljena u nekoliko fajlova:

1. **DEPLOYMENT.md** - Kompletna produkcijska dokumentacija
   - Detaljna analiza arhitekture
   - Korak-po-korak instrukcije
   - Konfiguracija svih komponenti
   - Security best practices
   - Troubleshooting guide

2. **QUICK_START.md** - Brzi start vodič
   - Minimalne instrukcije za brzi deployment
   - Osnovne komande
   - Provera funkcionalnosti

3. **env.production.example** - Template za environment varijable
   - Sve potrebne varijable
   - Instrukcije za generisanje tokena
   - Napomene o sigurnosti

4. **docker-compose.prod.yml** - Produkcijski Docker Compose
   - Optimizovana konfiguracija
   - Security best practices
   - Health checks

5. **nginx/alta-wms.conf** - Nginx konfiguracija
   - Reverse proxy setup
   - SSL konfiguracija
   - Security headers

6. **scripts/** - Deployment skripte
   - `backup.sh` - Automatski backup
   - `deploy.sh` - Deployment skripta
   - `restore.sh` - Restore backup-a

## 🚀 Brzi Start

```bash
# 1. Pročitaj QUICK_START.md
cat QUICK_START.md

# 2. Prati instrukcije iz DEPLOYMENT.md
cat DEPLOYMENT.md

# 3. Koristi skripte za deployment
./scripts/deploy.sh --build --migrate
```

## 📋 Checklist

Pre nego što kreneš sa deployment-om:

- [ ] Pročitao si DEPLOYMENT.md
- [ ] Server je pripremljen (Ubuntu 22.04+)
- [ ] Docker i Docker Compose su instalirani
- [ ] DNS zapisi su postavljeni
- [ ] Environment varijable su konfigurisane
- [ ] Backup strategija je postavljena
- [ ] SSL certifikati su generisani
- [ ] Firewall je konfigurisan

## 🔗 Korisni Linkovi

- [Hetzner Cloud](https://www.hetzner.com/cloud)
- [Docker Documentation](https://docs.docker.com/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/)

## ⚠️ Važne Napomene

1. **Sigurnost**: Uvek koristi jak password za bazu podataka i JWT_SECRET
2. **Backup**: Postavi automatski backup pre nego što kreneš u produkciju
3. **Monitoring**: Prati logove i resurse servera
4. **Update**: Redovno update-uj sistem i Docker images
5. **SSL**: Uvek koristi HTTPS u produkciji

## 📞 Podrška

Za dodatnu pomoć:
- Proveri logove: `docker compose logs`
- Proveri DEPLOYMENT.md za troubleshooting
- Kontaktiraj development tim

---

**Napomena**: Ova dokumentacija je vodič. Prilagodi vrednosti prema svojim potrebama.

