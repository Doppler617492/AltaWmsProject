# Alta WMS - Warehouse Management System

## Pokretanje sistema

```bash
docker compose up --build
```

## Prvi koraci nakon pokretanja

**VAŽNO:** Ako vidite "401 Unauthorized" ili "Status: 401" u network tab-u:

1. Otvorite Developer Console (F12)
2. Pokrenite ovu komandu:
   ```javascript
   localStorage.clear();
   ```
3. Osvježite stranicu (F5)
4. Ulogujte se ponovo sa kredencijalima:
   - Username: `magacioner`
   - Password: `admin`

**Razlog:** Browser čuva stari token `dev-token-123` koji nije validan. Sistem traži JWT token koji dobijate nakon logina.

## Default kredencijali

### Korisnici sa pristupom warehouse mapi:
- **admin** / admin (System Admin)
- **menadzer** / admin (Menadžer Skladišta)
- **sef** / admin (Šef Skladišta)
- **magacioner** / admin (Magacioner)

### Korisnici bez pristupa warehouse mapi:
- **komercijalista** / admin (Komercijalista)

## URL-ovi
- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:8000
- **PostgreSQL:** localhost:5432

## Struktura projekta
```
/wms
├── frontend/          # Next.js PWA aplikacija
│   ├── components/    # React komponente
│   ├── lib/          # API client i utilities
│   └── pages/        # Next.js stranice
├── backend/           # Nest.js API servis
│   ├── src/
│   │   ├── auth/     # Autentifikacija i autorizacija
│   │   ├── warehouse/ # Warehouse operacije
│   │   ├── entities/  # TypeORM entiteti
│   │   └── seeds/     # Seed podaci
│   └── docker/
├── docker/            # Docker konfiguracija
│   ├── Dockerfile.frontend
│   ├── Dockerfile.backend
│   └── docker-compose.yml
└── README.md
```

## Implementirane funkcionalnosti

### ✅ Faza 0 - Osnovna platforma
- Frontend PWA aplikacija
- Backend API sa Nest.js
- PostgreSQL baza podataka
- Docker Compose orkestracija
- Login ekran sa JWT autentifikacijom
- Health endpoint
- AI agent skeleton

### ✅ Faza 1 - ERP podaci / Master data
- Artikli (katalozi, šifre, opis)
- Dobavljači
- Zalihe po lokacijama / po zonama
- AI agent za pretragu artikala

### ✅ Faza 2 - Skladište / Warehouse operations
- Hierarhijska struktura skladišta (zone → prolazi → regali → lokacije)
- Interaktivna SVG mapa skladišta
- Role-based access control
- AI navigacija do lokacija
- Graceful error handling sa toast notifikacijama
- JWT token management

### ✅ Faza 3 - Prijem robe / Receiving workflow

#### Backend (Database + API)
- **Nove tabele:**
  - `receiving_documents`: id, document_number, supplier_id, status (draft/in_progress/completed/cancelled), assigned_to_user_id, notes
  - `receiving_items`: id, receiving_document_id, item_id, expected_quantity, received_quantity, quantity_uom, status (pending/scanned/placed/verified), location_id, pallet_id
  - `receiving_photos`: id, receiving_document_id, file_path, uploaded_by_user_id
- **Backend API endpointi:**
  - `POST /receiving/documents` - Kreiranje novog prijema (admin, menadzer, sef)
  - `GET /receiving/documents` - Lista svih prijema (filteri: status, magacioner)
  - `GET /receiving/documents/:id` - Detalji prijema sa artiklima
  - `POST /receiving/items` - Dodavanje artikla u prijem
  - `PATCH /receiving/items/:id` - Update količina (primljeno)
  - `PATCH /receiving/documents/:id/start` - Start prijema (draft → in_progress)
  - `PATCH /receiving/documents/:id/complete` - Završen prijem (in_progress → completed)
  - `DELETE /receiving/documents/:id` - Brisanje draft prijema
  - `GET /receiving/stats` - Statistika prijema
- **Pantheon Import:**
  - `POST /receiving/import` - Import Excel fajla iz Pantheona
  - Automatski čita broj dokumenta, dobavljača, artikle iz Excel-a
  - Automatski kreira artikle koji ne postoje u bazi
  - Default korisnik: Šef magacina (ID 4)
- **RBAC pravila:**
  - `admin/menadzer/sef`: Puni pristup (kreiranje, pregled svih, završavanje)
  - `magacioner`: Samo svojim dodeljenim prijemima (unos količina, završavanje)
  - `komercijalista`: Nema pristup (403)

#### Frontend (Admin Desktop UI)
- **Modul "PRIJEM":**
  - Tabela "Dokumenti prijema" sa filterima (Status, Dobavljač, Datum, Magacioner)
  - Kolone: Broj dokumenta, Dobavljač, Status (color-coded badge), Datum, Akcije
  - Dugmad: "+ Novi prijem", "Import" (žuta pozadina, crni font)
  - Detalji prijema modal:
    - Header sa brojem, dobavljačem, statusom
    - Tabela artikala: SKU, Naziv, Očekivano, Primljeno, Razlika, Status
    - Buttons: "Start prijem" (ako draft), "Zatvori prijem" (ako u toku)
  - "Obriši" button za draft prijeme
- **Modal "Novi prijem":**
  - Autocomplete polja za dobavljača (search po imenu)
  - Autocomplete polja za artikle (search po SKU ili Barcode)
  - Dinamičko dodavanje stavki ("+ Dodaj stavku")
  - Dugme "Sačuvaj" (žuta pozadina, crni font)
- **Modal "Import iz Pantheona":**
  - File upload za Excel (.xlsx, .xls)
  - Info: "Dobavljač se automatski prepoznaje iz Excela"
  - Info: "Korisnik je po default Šef magacina"
  - Napomena polje
  - Dugme "Import" (žuta pozadina, crni font)

#### Frontend (PWA Magacioner - Za buduće)
- Lista dodeljenih prijema
- Unos količina za svaki artikal
- Polje "Razlog razlike" ako različita količina
- Button "Prijem Završen"

#### AI Agent Enhancements
- Novi komande za receiving:
  - "Pronađi artikal sa nekompletnim prijemom"
  - "Koje lokacije su slobodne u zoni A?"
  - "Prikaži mi zadatke koji su u toku"
  - "Generiši putanju do lokacije za ovaj prijem"

#### Data Seeds
- Demo prijemi sa različitim statusima (draft, in_progress, completed)
- Demo receiving items sa različitim količinama
- Veza sa postojećim artiklima i dobavljačima

### ✅ Faza 3.0 - Osnov prijema robe (Foundation)
- Ručno kreiranje prijema (bez Pantheon integracije)
- 3 statusa: `draft` → `u_toku` (start) → `zavrseno` (complete)
- Unos stvarne primljene količine (može biti različita od očekivane)
- Razlog razlike ako različita količina
- Poravnjanje tabela i kolona
- Autocomplete search za dobavljače i artikle
- Automatski import iz Pantheon Excel-a sa kreiranjem novih artikala

## Tehnički detalji

### Backend stack
- **Framework:** Nest.js (Node.js)
- **Database:** PostgreSQL sa TypeORM
- **Authentication:** JWT (JSON Web Tokens)
- **File Upload:** Multer + xlsx parser
- **CORS:** Multi-origin support (localhost:3000, Zebra handheld:8080)

### Frontend stack
- **Framework:** Next.js (React)
- **PWA:** Service worker (disabled u development)
- **Styling:** Inline styles (invoice-inspired design)
- **State Management:** React Hooks (useState, useEffect, useRef)
- **API Client:** Shared API client sa auto-attach JWT token

### File upload i import
- Excel fajlovi se parsiraju na backend-u koristeći `xlsx` biblioteku
- Automatsko kreiranje novih artikala ako ne postoje (match po SKU)
- Automatsko prepoznavanje dobavljača iz Excel-a
- Default korisnik za import: Šef magacina (može dodeliti magacioneru)

### Security & RBAC
- Bearer token authentication za sve protected endpoints
- Role-based access control (Guards + Decorators)
- Graceful error handling (401 → logout, 403 → forbidden message)
- Toast notifikacije za user feedback

## Faze razvoja
- **Faza 0:** ✅ Osnovna platforma (frontend + backend + auth + AI skeleton)
- **Faza 1:** ✅ ERP podaci / Master data
- **Faza 2:** ✅ Skladište / Warehouse operations
- **Faza 3:** ✅ Prijem robe / Receiving (3.0 foundation + import)
- **Faza 4:** ⏳ Otprema / Shipping
- **Faza 5:** ⏳ Popis / Inventory counting
