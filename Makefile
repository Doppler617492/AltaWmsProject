PROJECT?=altawms

.PHONY: up build backend admin pwa reset users-demo shifts-demo logs db-backup db-restore demo stock-demo popis-demo backend-rebuild map-reseed start-admin perf-demo perf-demo-variants skart-demo

up:
	docker compose up -d

build:
	docker compose build

backend:
	docker compose up -d backend

admin:
	docker compose up -d frontend-admin

pwa:
	docker compose up -d frontend-pwa

reset:
	bash scripts/reset.sh

users-demo:
	bash scripts/users-demo.sh

shifts-demo:
	bash scripts/seed-shifts.sh

logs:
	docker compose ps && docker logs --tail=200 alta-wms-backend

db-backup:
	bash scripts/db-backup.sh backups

db-restore:
	bash scripts/db-restore.sh $(FILE)

# Full demo reset (wipes DB), rebuilds, starts, seeds users + shifts
demo:
	$(MAKE) reset
	$(MAKE) users-demo
	$(MAKE) shifts-demo

stock-demo:
	bash scripts/seed-stock-demo.sh

popis-demo:
	bash scripts/popis-demo.sh

# Convenience: rebuild backend (cache-bust), restart container
backend-rebuild:
	docker compose build --no-cache backend && docker compose up -d backend

# Reseed DB and layout (drops data!)
map-reseed:
	$(MAKE) reset

# Start only admin UI
start-admin:
	docker compose up -d frontend-admin
perf-demo:
	@echo "Seeding minimal performance demo data..."
	@cat scripts/perf-demo.sql | docker compose exec -T db psql -U wms_user -d wms -v ON_ERROR_STOP=1
	@echo "Done."

# Fine‑tune demo percentages: tv_demo ≈60%, tv_demo2 ≈10%, tv_demo3 =100%
perf-demo-variants:
	@echo "Adjusting demo percentages (tv_demo ~60%, tv_demo2 ~10%, tv_demo3 100%)..."
	@cat scripts/perf-demo-variants.sql | docker compose exec -T db psql -U wms_user -d wms -v ON_ERROR_STOP=1
	@echo "Done."

skart-demo:
	@echo "Seeding SKART demo dokument..."
	@cat scripts/skart-demo.sql | docker compose exec -T db psql -U wms_user -d wms -v ON_ERROR_STOP=1
	@echo "SKART demo podaci spremni."
