# Exam Practice App

AI-powered exam preparation platform for competitive exams (UPPSC / Health Education Officer). Offline-first mobile app with AI question generation, multi-device sync, and an admin dashboard.

## Architecture Overview

```
exam-app/
├── backend/          Laravel 11 API — auth, sync, analytics, admin
├── ui/               React 18 admin dashboard
├── mobile/           React Native 0.75 student app (offline-first)
├── *.py              Question generation scripts
├── *_GUIDE.md        Question generation documentation
├── plan.md           Full system design document
└── Makefile          Docker shortcuts for backend
```

---

## Quick Start

### Prerequisites

- Docker + Docker Compose (recommended for backend)
- PHP 8.2 + Composer (local backend alternative)
- Node.js 20+ + npm
- Android Studio / Xcode (mobile)

### 1. Backend

```bash
# Docker (recommended — runs API on :8000 + MySQL)
make start
make migrate-fresh-seed   # seed subjects, admin user, sample questions

# Local alternative
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve          # → http://localhost:8000
```

Seeded admin credentials: `admin@example.com` / `password`

### 2. Admin UI

```bash
cd ui
npm install
npm run dev               # → http://localhost:5173
```

### 3. Mobile App

```bash
cd mobile
npm install
npm start                 # Metro bundler

# In another terminal:
npm run android           # Android emulator (points to 10.0.2.2:8000)
npm run ios               # iOS simulator
```

---

## Backend (`backend/`)

**Stack**: Laravel 11, PHP 8.2, MySQL 8, Sanctum auth

### API Overview

All requests require `Authorization: Bearer <token>` and `X-Device-Id: <uuid>` headers (except auth endpoints).

| Group | Endpoints |
|-------|-----------|
| **Auth** | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/refresh-token`, `POST /auth/forgot-password`, `POST /auth/reset-password` |
| **Reference** | `GET /subjects`, `GET /courses`, `GET /subjects/{id}/courses` |
| **Sync** | `POST /sync` (push), `GET /sync/pull?since={ts}` (delta pull) |
| **Restore** | `GET /restore` — full dataset for new device |
| **Analytics** | `GET /analytics/summary`, `GET /analytics/subjects` |
| **Admin** | `/admin/users`, `/admin/subjects`, `/admin/courses`, `/admin/question-sets`, `/admin/questions`, `/admin/api-usage`, `/admin/activity-logs`, `/admin/device-locations` |

### Key Services

**SyncService** — Offline sync engine
- `push(User, payload)`: upserts device rows using last-write-wins on `updated_at`; returns `{mappings: {table: [{local_id, server_id}]}, records_synced}`
- `pull(User, since)`: returns server deltas since timestamp; reference data always server-authoritative

**RestoreService** — `fullDataset(User)`: complete flattened dataset for fresh-device login

**AnalyticsService**
- `summary(User)`: tests taken, attempted, correct, accuracy, time on app, day streak
- `perSubject(User)`: per-subject accuracy breakdown

### Database Models (all UUID PKs)

| Model | Key Columns |
|-------|-------------|
| User | `id, name, email, mobile, password, role(student\|admin), device_id, last_sync_at` |
| Subject | `id, name` |
| Course | `id, name, exam_type` |
| QuestionSet | `id, user_id, subject_id, course_id, difficulty(Easy\|Medium\|Hard), ai_provider, total_questions, generated_at` |
| Question | `id, set_id, text, explanation` |
| Option | `id, question_id, text, is_correct` |
| Session | `id, user_id, set_id, mode(timed\|untimed), feedback_mode(immediate\|end), total_questions, duration_seconds, score, status(active\|completed\|abandoned), started_at, completed_at` |
| Attempt | `id, session_id, question_id, selected_option_id, is_correct, time_taken_seconds, answered_at` |
| Analytics | `id, user_id, subject_id, course_id, difficulty, total_attempted, total_correct, accuracy_percent, avg_time_per_question` |
| AppUsage | `id, user_id, device_id, date, seconds_active` (unique per user/device/day) |
| DeviceLocation | `id, user_id, device_id, latitude, longitude, accuracy, altitude, speed, heading, location_source, battery_level, recorded_at` |

### Commands

```bash
make start                # Docker: build + run
make install              # composer install in container
make migrate-fresh-seed   # fresh DB + seed
make test                 # php artisan test (SQLite :memory:)
make pint                 # format with Laravel Pint
make logs                 # tail API logs
```

---

## Admin UI (`ui/`)

**Stack**: React 18, TypeScript, Vite, TailwindCSS, React Query, React Router 6, Axios

### Pages

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Dashboard | Admin overview, stats |
| `/subjects` | Subjects | CRUD for exam subjects |
| `/courses` | Courses | CRUD + subject linking |
| `/generate` | Generate Questions | AI question generation form |
| `/questions` | Questions | Browse/edit question bank |
| `/users` | Users | User list with device/sync info |
| `/api-usage` | API Usage | Token usage by provider/user |
| `/activity` | Activity Logs | User activity history |
| `/device-locations` | Device Locations | GPS data map/table |
| `/login` | Login | Admin login |

### Commands

```bash
npm run dev        # Vite dev server → :5173
npm run build      # tsc + vite build
npm run typecheck  # tsc --noEmit
```

---

## Mobile (`mobile/`)

**Stack**: React Native 0.75, TypeScript, Zustand, React Query, OPSQLite, React Navigation, React Native Paper, Sentry, Notifee

### Navigation Structure

```
Root Stack
├── AuthStack (unauthenticated)
│   ├── LoginScreen
│   └── RegisterScreen
└── MainTabs (authenticated)
    ├── Home → DashboardScreen
    ├── Practice (Stack)
    │   ├── SubjectSelectScreen
    │   ├── CourseSelectScreen
    │   ├── ConfigScreen          (questions, difficulty, mode)
    │   ├── ExamPlayerScreen      (core exam engine)
    │   └── ResultsScreen
    ├── History (Stack)
    │   ├── HistoryListScreen
    │   ├── SessionReviewScreen
    │   └── QuestionSetLibraryScreen
    └── Profile (Stack)
        ├── AnalyticsScreen
        └── SettingsScreen
            ├── AIConfig
            └── TestPreferences
```

### Zustand Stores

| Store | State |
|-------|-------|
| `examStore` | `sessionId, questions, currentIndex, answers, timeRemaining, feedbackMode, status` |
| `authStore` | `user, token, isLoading` — persisted to Keychain |
| `settingsStore` | `aiProvider, apiKey, questionsPerSession, defaultDifficulty, feedbackMode, testMode, autoSync` — persisted to AsyncStorage |

### Offline SQLite Schema

Every synced table has: `server_id` (nullable until synced), `is_dirty` (1 = needs push), `synced_at`, `updated_at`.

**Reference** (server-authoritative): `subjects`, `courses`, `course_subjects`

**User Data**: `question_sets`, `questions`, `options`, `sessions`, `attempts`, `analytics`, `app_usage`

**Sync Queue**: `sync_queue (id, entity_type, entity_id, action, payload, failed_attempts)`

### Sync Flow

1. **Push**: read `is_dirty=1` rows → `POST /sync` → receive `{mappings}` → update `server_id`, clear `is_dirty`
2. **Pull**: `GET /sync/pull?since={last_sync}` → upsert into SQLite (last-write-wins on `updated_at`)
3. **Restore**: on fresh login → `GET /restore` → bulk insert entire account dataset

### AI Question Generation

- Provider: **Gemini** (gemini-pro) or **ChatGPT** (gpt-4o) — configurable per device
- API keys stored in device Keychain only (never synced to server)
- Flow: `promptBuilder` → AI API → `responseParser` (Zod-validated JSON) → save to SQLite → sync to server

### Background Services

- **useAutoSync**: syncs every 30 min (configurable) or on app foreground
- **useAppUsageTracker**: tracks foreground seconds → `app_usage` table
- **useLocationTracking**: background geolocation → `device_locations` via sync
- **StaleSessionCleanup** (server-side cron): marks sessions >7 days old as `abandoned`
- **SyncReminder** (server-side cron): nudges users who haven't synced in 24h

### Commands

```bash
npm start          # Metro bundler
npm run android    # Run on Android emulator
npm run ios        # Run on iOS simulator
npm run tsc        # TypeScript typecheck
npm run lint       # ESLint
```

---

## Question Generation Scripts (Root)

Pre-generate MCQ banks for seeding. Output JSON consumed by Laravel seeders.

| Script | Output | Description |
|--------|--------|-------------|
| `generate_questions.py` | `questions_data.json` | 500 basic-level MCQs across 9 topics |
| `generate_uppsc_level_questions.py` | `questions_data_uppsc_level.json` | 500 UPPSC-style difficult questions |
| `generate_hard_level_questions.py` | — | 40+ hard questions per topic |
| `generate_unique_questions.py` | — | Unique question variations |
| `extract_questions_from_pdf.py` | — | Extract from official UPPSC PDF papers (uses `pdfplumber`) |

**Usage**:
```bash
python generate_questions.py
# Then seed into DB:
php artisan db:seed --class=HealthEducationOfficerQuestionsSeeder
php artisan db:seed --class=HealthEducationOfficerUPPSCLevelSeeder
```

**Topics covered**: History, Geography, Constitution, Society, Current Affairs, Agriculture, Science, Mathematics, Community Health

---

## Testing

```bash
# Backend integration tests (SQLite :memory:)
make test
# or: cd backend && php artisan test

# Key test: tests/Feature/SyncFlowTest.php
# Wire-contract spec: register → push → pull → restore → analytics → admin gate
```

The sync flow test is the authoritative contract that mobile and backend must satisfy together.

---

## Conventions

- **UUID primary keys** on all new backend tables — never `$table->id()` or `foreignId()` for new work
- Existing migrations (`2026_01_01_*`) use auto-increment — predates the rule; don't change them
- Admin routes gated by `role:admin` middleware
- AI API keys never leave the device (Keychain only)
- Conflict resolution: last-write-wins on `updated_at` for user data; server always wins for reference data
