COMPOSE := docker compose -f backend/docker-compose.yml

.PHONY: start rebuild rebuild-api install migrate migrate-fresh migrate-fresh-seed seed test pint logs api-log stop down

# ─────────────────────────────────────────────
# Start — build images and bring all services up
# Live edits in ./backend take effect immediately (bind mount)
# ─────────────────────────────────────────────
start:
	$(COMPOSE) up -d

# ─────────────────────────────────────────────
# Rebuild — force-rebuild the api image and restart
# ─────────────────────────────────────────────
rebuild:
	$(COMPOSE) rm -sf exam-api
	$(COMPOSE) build --no-cache exam-api
	$(COMPOSE) up -d

rebuild-api:
	$(COMPOSE) rm -sf exam-api
	$(COMPOSE) build --no-cache exam-api
	$(COMPOSE) up -d exam-api

# ─────────────────────────────────────────────
# Dependencies
# ─────────────────────────────────────────────
install:
	$(COMPOSE) exec exam-api composer install --no-interaction

# ─────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────
migrate:
	$(COMPOSE) exec exam-api php artisan migrate

migrate-fresh:
	$(COMPOSE) exec exam-api php artisan migrate:fresh

migrate-fresh-seed:
	$(COMPOSE) exec exam-api php artisan migrate:fresh --seed

seed:
	$(COMPOSE) exec exam-api php artisan db:seed

# ─────────────────────────────────────────────
# Tests / Code Quality
# ─────────────────────────────────────────────
test:
	$(COMPOSE) exec -e DB_CONNECTION=sqlite -e DB_DATABASE=:memory: exam-api php artisan test

pint:
	$(COMPOSE) exec exam-api ./vendor/bin/pint

# ─────────────────────────────────────────────
# Logs
# ─────────────────────────────────────────────
logs:
	$(COMPOSE) logs -f exam-api

api-log:
	$(COMPOSE) logs -f exam-api

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────
stop:
	$(COMPOSE) stop

down:
	$(COMPOSE) down
