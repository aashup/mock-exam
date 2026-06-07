# Exam Practice App — Backend (Laravel 11)

API for the AI-powered exam practice app: auth, reference data (subjects/courses
with a Many-to-Many pivot), offline sync, full device-restore, and analytics.
See `../plan.md` for the full design.

## Status
This is the **application source** (Part 2). The Composer `vendor/` directory and
the rest of the Laravel skeleton (`storage/`, framework config defaults) are not
included — run `composer install` to pull Laravel 11 + Sanctum, which provides the
framework files. The app-specific code (models, controllers, services, migrations,
routes) is all here.

## Setup
```bash
# 1. install PHP dependencies (Laravel 11 + Sanctum + Telescope)
composer install

# 2. environment
cp .env.example .env
php artisan key:generate

# 3. configure MySQL credentials in .env (DB_DATABASE=exam_app, etc.)
#    create the database first:  CREATE DATABASE exam_app;

# 4. run migrations + seed reference data and the admin user
php artisan migrate --seed

# 5. serve
php artisan serve            # http://localhost:8000
```

## Docker (optional)
From the repo root (`Makefile` targets wrap `docker compose -f backend/docker-compose.yml`):
```bash
cp backend/.env.example backend/.env       # then set the Docker DB_* values (see .env Docker section)
make start                                  # build + run api (host :8000) + mysql:9.6
make install                                # composer install inside the container
make migrate-fresh-seed                     # migrate + seed
make test                                   # php artisan test
make logs                                   # tail api logs
make down                                   # stop + remove
```
The `api` container reads its DB connection from `.env` — set `DB_HOST=db` and
`DB_PASSWORD=secret` (matching `docker-compose.yml`) when running in Docker.

## Tests
```bash
php artisan test             # runs against sqlite :memory: (see phpunit.xml)
```
`tests/Feature/SyncFlowTest.php` drives the full wire contract end-to-end
(register → push flat payload → pull deltas → restore full dataset → analytics →
admin gate), so it doubles as the executable spec the mobile client codes against.

The mobile app points at `http://10.0.2.2:8000/api` (Android emulator → host).

## Seeded accounts / data
- **Admin:** `admin@example.com` / `password` (role = admin)
- Subjects: Mathematics, Physics, Chemistry, Biology, English, GK, CS, Reasoning
- Courses (with M2M subject links): JEE Main, NEET, UPSC Prelims, GATE CS

## Auth
Token-based via **Laravel Sanctum**. Send `Authorization: Bearer <token>` and
`X-Device-Id: <uuid>` on authenticated requests. Admin routes require `role = admin`.

## Key endpoints
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` · `/login` | account + token |
| POST | `/api/auth/forgot-password` · `/reset-password` | password reset |
| GET | `/api/subjects` · `/courses` · `/subjects/{id}/courses` | reference data |
| POST | `/api/sync` | push device batch, returns id mappings |
| GET | `/api/sync/pull?since=<iso>` | server delta |
| GET | `/api/restore` | full account dataset (new device) |
| GET | `/api/analytics/summary` · `/subjects` | dashboard stats |
| * | `/api/admin/subjects` · `/admin/courses` (+ `/{id}/subjects`) | admin CRUD + M2M |

## Architecture notes
- **Sync** (`app/Services/SyncService.php`): upserts device rows with **last-write-wins**
  on `updated_at`; reference data is server-authoritative. Returns device→server id
  mappings so the device fills its `server_id` columns. `app_usage` is keyed per
  user+device+day.
- **Restore** (`app/Services/RestoreService.php`): returns the complete nested dataset
  (sets→questions→options, sessions→attempts, analytics, app_usage) for a fresh device.
- **Analytics** (`app/Services/AnalyticsService.php`): dashboard totals + per-subject
  accuracy + consecutive-day streak.
- **Scheduled tasks** (`routes/console.php`): `sync:remind` (daily) and
  `sessions:cleanup-stale` (hourly). Run the scheduler with `php artisan schedule:work`.
- **Middleware**: `role:admin` gate, `device.tracker`, `api.logger`.

> AI API keys are **never** stored or synced server-side — they live only in the
> device secure keystore. The backend only records token-usage counts via
> `api_usage_logs` when generation results are synced.
