# AGENTS.md — Exam Practice App

> **This file is auto-loaded at every session start via the SessionStart hook.**
> Trust it as the authoritative reference — do NOT re-scan the codebase to rediscover what is documented here. Only read individual files when you need to make a specific edit or the user asks about something not covered below.

---

## Project Overview

AI-powered exam preparation platform targeting UPPSC / Health Education Officer competitive exams.
Offline-first monorepo with three independent apps + Python question-generation tooling.

```
exam-app/
├── backend/          Laravel 11 REST API
├── ui/               React 18 admin dashboard
├── mobile/           React Native 0.75 student app
├── *.py              Question generation scripts
├── *_GUIDE.md        Question generation docs
├── plan.md           Full system design
├── README.md         Project README
└── Makefile          Docker shortcuts (wraps backend/docker-compose.yml)
```

---

## Conventions (apply to ALL new work)

- **UUID primary keys** on every new table/model/migration — never `$table->id()` or `foreignId()`.
- Existing migrations `database/migrations/2026_01_01_*` use auto-increment — they predate this rule; do not change them.
- Admin API routes are gated by `role:admin` middleware.
- AI API keys are **never** stored server-side — device Keychain only.
- Conflict resolution: **last-write-wins on `updated_at`** for user data; server always wins for reference data.
- Windows host — use PowerShell for shell commands.

---

## Backend (`backend/`)

**Stack**: Laravel 11, PHP 8.2, MySQL 8, Sanctum auth

### Run Commands (from repo root)

```bash
make start                # Docker: build + run api (:8000) + mysql
make install              # composer install in container
make migrate-fresh-seed   # fresh DB + seed all reference data + admin user
make test                 # php artisan test (SQLite :memory:)
make pint                 # Laravel Pint formatter
make logs                 # tail API container logs
```

Local (no Docker):
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve          # → http://localhost:8000
```

Seeded credentials: `admin@example.com` / `password`

---

### API Routes (`routes/api.php`)

**Public (no auth)**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register (name, email, mobile, password) |
| POST | `/api/auth/login` | Login → Sanctum token |
| POST | `/api/auth/forgot-password` | Email reset token |
| POST | `/api/auth/reset-password` | Reset with token + new password |

**Authenticated** (`auth:sanctum` + `device.tracker` + `api.logger`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/logout` | Invalidate token |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/refresh-token` | Refresh Sanctum token |
| GET | `/api/subjects` | All subjects |
| GET | `/api/courses` | All courses with linked subject IDs |
| GET | `/api/subjects/{id}/courses` | Courses for a subject |
| POST | `/api/sync` | Device batch push |
| GET | `/api/sync/pull?since={ts}` | Server delta since timestamp |
| GET | `/api/restore` | Full account dataset (fresh device) |
| GET | `/api/analytics/summary` | Dashboard totals |
| GET | `/api/analytics/subjects` | Per-subject accuracy |

**Admin** (`role:admin` middleware)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users` | Paginated user list with session/set counts |
| GET | `/api/admin/api-usage` | Token usage by provider |
| GET | `/api/admin/activity-logs` | User activity log pagination |
| GET | `/api/admin/device-locations` | GPS locations with user join |
| GET/POST/PUT/DELETE | `/api/admin/subjects{/id}` | Subject CRUD |
| GET/POST/PUT/DELETE | `/api/admin/courses{/id}` | Course CRUD |
| POST | `/api/admin/courses/{id}/subjects` | Sync M2M course↔subject |
| GET/POST/DELETE | `/api/admin/question-sets{/id}` | Question set CRUD |
| GET/POST | `/api/admin/question-sets/{id}/questions` | Questions for a set |
| PUT/DELETE | `/api/questions/{id}` | Edit / delete question |

Request headers: `Authorization: Bearer <token>` + `X-Device-Id: <uuid>`

---

### Models (all use `HasUuids` trait — UUID PKs)

| Model | File | Key Columns |
|-------|------|-------------|
| User | `app/Models/User.php` | `id, name, email, mobile, password, role(student\|admin), device_id, last_sync_at` |
| Subject | `app/Models/Subject.php` | `id, name` |
| Course | `app/Models/Course.php` | `id, name, exam_type` |
| QuestionSet | `app/Models/QuestionSet.php` | `id, user_id, subject_id, course_id, difficulty(Easy\|Medium\|Hard), ai_provider, prompt_used, total_questions, generated_at` |
| Question | `app/Models/Question.php` | `id, set_id, text, explanation` |
| Option | `app/Models/Option.php` | `id, question_id, text, is_correct(bool)` |
| Session | `app/Models/Session.php` | `id, user_id, set_id, mode(timed\|untimed), feedback_mode(immediate\|end), total_questions, duration_seconds, score, status(active\|completed\|abandoned), started_at, completed_at` |
| Attempt | `app/Models/Attempt.php` | `id, session_id, question_id, selected_option_id, is_correct, time_taken_seconds, answered_at` |
| Analytics | `app/Models/Analytics.php` | `id, user_id, subject_id, course_id, difficulty, total_attempted, total_correct, accuracy_percent, avg_time_per_question` |
| AppUsage | `app/Models/AppUsage.php` | `id, user_id, device_id, date, seconds_active` — unique per (user_id, device_id, date) |
| DeviceLocation | `app/Models/DeviceLocation.php` | `id, user_id, device_id, latitude, longitude, accuracy, altitude, speed, heading, location_source(gps\|network\|fused), battery_level, recorded_at` |

**Pivot**: `course_subject (course_id, subject_id)` — composite PK, no model

---

### Migrations

| File | Tables Created |
|------|---------------|
| `2026_01_01_000001` | `users, password_reset_tokens, sessions (framework), subjects, courses, course_subject` |
| `2026_01_01_000002` | `question_sets, questions, options, sessions (exam), attempts, analytics, app_usage` |
| `2026_01_01_000003` | `sync_logs, api_usage_logs, user_activity_logs` |
| `2026_01_02_000001` | Add `mobile` column to `users` |
| `2026_01_03_000001` | `topics` |
| `2026_05_30_000001` | `device_locations` |

> Note: all `2026_01_01_*` use auto-increment IDs (legacy). All newer migrations use UUIDs.

---

### Services

**`app/Services/SyncService.php`**
- `push(User $user, array $payload): array`
  - Accepts batch of: `question_sets, questions, options, sessions, attempts, analytics, app_usage, locations`
  - Processes parent-first (sets→questions→options, sessions→attempts)
  - Upserts using last-write-wins on `updated_at`
  - Resolves foreign keys within-batch via local→server map
  - Returns `{ mappings: { table: [{local_id, server_id}] }, records_synced }`
  - Logs to `sync_logs`
- `pull(User $user, ?string $since): array`
  - Reference data (subjects/courses/pivots) always returned (server-authoritative)
  - User data filtered by `updated_at > $since`
  - Includes user's own question_sets + shared "system@exam-app.test" bank
  - Returns flat: `subjects, courses, course_subjects, question_sets, questions, options, sessions, attempts, analytics, app_usage, locations`

**`app/Services/RestoreService.php`**
- `fullDataset(User $user): array`
  - Powers `GET /api/restore` — complete flattened account dataset
  - Device bulk-inserts with `server_id` populated, `is_dirty=0`

**`app/Services/AnalyticsService.php`**
- `summary(User $user): array` — `tests_taken, questions_attempted, correct, wrong, accuracy, time_on_app_seconds, time_on_app_today_seconds, streak`
- `perSubject(User $user): array` — per-subject accuracy via 4-table join

---

### Controllers

| Controller | File | Handles |
|------------|------|---------|
| AuthController | `app/Http/Controllers/AuthController.php` | register, login, logout, me, refreshToken |
| SyncController | `app/Http/Controllers/SyncController.php` | push(), pull() |
| RestoreController | `app/Http/Controllers/RestoreController.php` | index() |
| AnalyticsController | `app/Http/Controllers/AnalyticsController.php` | summary(), subjects() |
| ReferenceController | `app/Http/Controllers/ReferenceController.php` | subjects(), courses(), coursesForSubject() |
| AdminController | `app/Http/Controllers/Admin/AdminController.php` | users(), apiUsage(), activityLogs(), deviceLocations() |
| Admin/SubjectController | `app/Http/Controllers/Admin/SubjectController.php` | CRUD |
| Admin/CourseController | `app/Http/Controllers/Admin/CourseController.php` | CRUD + syncSubjects() |
| Admin/QuestionSetController | `app/Http/Controllers/Admin/QuestionSetController.php` | CRUD |
| Admin/QuestionController | `app/Http/Controllers/Admin/QuestionController.php` | per-set CRUD |

---

### Middleware

| Key | Class | Purpose |
|-----|-------|---------|
| `role:admin` | `EnsureUserIsAdmin` | Guards all `/admin/*` routes |
| `device.tracker` | `DeviceTracker` | Records device_id on user |
| `api.logger` | `ApiUsageLogger` | Logs AI token usage to `api_usage_logs` |

---

### Scheduled Tasks (`routes/console.php`)

- **SyncReminder** — nudges users who haven't synced in 24 h
- **StaleSessionCleanup** — marks sessions >7 days old as `abandoned`

---

### Seeders

| Seeder | Purpose |
|--------|---------|
| `AdminUserSeeder` | Creates `admin@example.com` / `password` |
| `SubjectSeeder` | Seeds reference subjects |
| `DemoStudentSeeder` | Demo student account |
| `HealthEducationOfficerQuestionsSeeder` | 500 basic MCQs from `questions_data.json` |
| `HealthEducationOfficerUPPSCLevelSeeder` | 500 UPPSC-level MCQs |
| `HealthEducationOfficerHardLevelSeeder` | Hard-level questions |
| `RealUPPSCQuestionsSeeder` | Extracted from official PDFs |
| `SocialScienceQuestionsSeeder` | Social Science subject |
| `DatabaseSeeder` | Master runner |

---

### Tests

- `tests/Feature/SyncFlowTest.php` — **authoritative wire-contract spec**
  - Full flow: register → push → pull → restore → analytics → admin gate
  - Mobile client must satisfy this contract; backend must not break it

---

## Admin UI (`ui/`)

**Stack**: React 18.3, TypeScript, Vite, TailwindCSS 3, React Query 5, React Router 6, Axios

### Commands

```bash
cd ui
npm install
npm run dev        # Vite dev server → http://localhost:5173
npm run build      # tsc --noEmit && vite build
npm run typecheck  # tsc --noEmit only
```

### Routes & Pages

| Route | Component | Purpose |
|-------|-----------|---------|
| `/login` | `LoginPage` | Email/password → Sanctum token |
| `/` | `DashboardPage` | Admin overview, user/API stats |
| `/subjects` | `SubjectsPage` | Subject CRUD |
| `/courses` | `CoursesPage` | Course CRUD + M2M subject linking |
| `/generate` | `GenerateQuestionsPage` | AI question generation form |
| `/questions` | `QuestionsPage` | Browse/edit question bank |
| `/users` | `UsersPage` | Paginated user list |
| `/api-usage` | `ApiUsagePage` | Token usage by provider/user |
| `/activity` | `ActivityLogsPage` | User activity history |
| `/device-locations` | `DeviceLocationsPage` | GPS data map/table |

All routes (except `/login`) wrapped in `ProtectedRoute` — redirects to `/login` if unauthenticated.

### Key Components

- **Layout** — nav header + sidebar
- **PageHeader** — breadcrumbs + title + action buttons
- **UI library**: `Button, Input, Badge, Spinner, Modal, ConfirmDialog, MultiSelect, Table, Select`

### API Client

Axios instance in `src/api/` — sets `Authorization: Bearer <token>` header automatically.

---

## Mobile (`mobile/`)

**Stack**: React Native 0.75.4, TypeScript, Zustand 4.5, React Query 5, OPSQLite, React Navigation 6, React Native Paper 5, Sentry 6, Notifee 9, Background Geolocation 4, Gifted Charts 1.4

API base URL: `http://10.0.2.2:8000/api` (Android emulator → host machine)

### Commands

```bash
cd mobile
npm install
npm start           # Metro bundler
npm run android     # Run on Android emulator
npm run ios         # Run on iOS simulator
npm run tsc         # TypeScript typecheck
npm run lint        # ESLint
```

---

### Screen Inventory (14 screens)

**Auth Stack**
- `LoginScreen` — email/password login
- `RegisterScreen` — registration form

**Home Tab**
- `DashboardScreen` — tests taken, questions attempted, accuracy, time on app, streak

**Practice Tab (Stack)**
- `SubjectSelectScreen` — subject grid (cached from server)
- `CourseSelectScreen` — courses for subject + "All Courses" skip
- `ConfigScreen` — questions count, difficulty, feedback mode, timed/untimed, new vs reuse set
- `ExamPlayerScreen` — core exam engine: question display, answer collection, timer, progress bar, immediate feedback (if mode=immediate)
- `ResultsScreen` — score circle, stats, per-question breakdown, CTAs (Retake / New / Dashboard)

**History Tab (Stack)**
- `HistoryListScreen` — completed sessions; filter by subject/date/score
- `SessionReviewScreen` — full question-by-question review with chosen/correct/explanations
- `QuestionSetLibraryScreen` — browse stored sets by subject+difficulty; launch as mock or revision

**Profile Tab (Stack)**
- `AnalyticsScreen` — accuracy, per-subject breakdown, streak, weakest topics
- `SettingsScreen` — AI provider, API key (→ Keychain), questions per session, difficulty, feedback/test mode, sync interval
- `TestPreferencesScreen` — custom timer, auto-sync toggle

---

### Navigation Structure

```
Root Stack
├── AuthStack (unauthenticated)
│   ├── LoginScreen
│   └── RegisterScreen
└── MainTabs (authenticated) — bottom-tab navigator
    ├── Home
    │   └── DashboardScreen
    ├── Practice (native-stack)
    │   ├── SubjectSelectScreen
    │   ├── CourseSelectScreen
    │   ├── ConfigScreen
    │   ├── ExamPlayerScreen
    │   └── ResultsScreen
    ├── History (native-stack)
    │   ├── HistoryListScreen
    │   ├── SessionReviewScreen
    │   └── QuestionSetLibraryScreen
    └── Profile (native-stack)
        ├── AnalyticsScreen
        └── SettingsScreen
            ├── AIConfig (nested)
            └── TestPreferences (nested)
```

---

### Zustand Stores

**`examStore`**
```ts
{ sessionId, questions, currentIndex, answers: Record<qId, optionId>,
  timeRemaining, feedbackMode, status, startedAt }
// Methods: saveAnswer(), nextQuestion(), submitSession(), pauseSession(), resume()
```

**`authStore`** — persisted to Keychain
```ts
{ user, token, isLoading }
// Methods: register(), login(), logout(), refreshToken()
```

**`settingsStore`** — persisted to AsyncStorage
```ts
{ aiProvider, apiKey, questionsPerSession, defaultDifficulty,
  feedbackMode, testMode, defaultTimer, autoSync, syncInterval }
```

---

### SQLite Schema (local device DB)

Every synced table has: `server_id` (null until first sync), `is_dirty` (1=needs push), `updated_at`, `synced_at`.

**Reference tables (server-authoritative, never dirty)**
```sql
subjects        (id, server_id, name, synced_at, updated_at)
courses         (id, server_id, name, exam_type, synced_at, updated_at)
course_subjects (course_id, subject_id)  -- PK composite
```

**Question bank**
```sql
question_sets (id, server_id, subject_id NOT NULL, course_id, difficulty,
               total_questions, generated_at, is_dirty, updated_at, synced_at)
questions     (id, server_id, set_id, text, explanation, is_dirty, updated_at, synced_at)
options       (id, server_id, question_id, text, is_correct, synced_at)
```

**Test data**
```sql
sessions (id, server_id, set_id, mode, feedback_mode, total_questions,
          duration_seconds, status, score, started_at, completed_at,
          resume_payload JSON, is_dirty, updated_at, synced_at)
attempts (id, server_id, session_id, question_id, selected_option_id,
          is_correct, time_taken_seconds, answered_at, is_dirty, synced_at)
```

**Analytics & usage**
```sql
analytics  (id, server_id, subject_id, course_id, difficulty,
            total_attempted, total_correct, accuracy_percent,
            avg_time_per_question, is_dirty, updated_at, synced_at)
app_usage  (id, server_id, date, seconds_active, is_dirty, updated_at, synced_at)
```

**Sync queue**
```sql
sync_queue (id, entity_type, entity_id, action CHECK('create','update'),
            payload JSON, created_at, synced_at, failed_attempts)
```

---

### Custom Hooks

| Hook | Purpose |
|------|---------|
| `useAutoSync` | Syncs every 30 min (configurable) + on app foreground |
| `useAppUsageTracker` | AppState listener → accumulates seconds → `app_usage` with `is_dirty=1` |
| `useNetworkStatus` | NetInfo → online/offline detection |
| `useLocationTracking` | Background geolocation → `device_locations` via sync push |

---

### Mobile Services

**AI Generation** (strategy pattern)
- `GeminiService` — Gemini API (`gemini-pro`)
- `ChatGPTService` — OpenAI API (`gpt-4o`)
- `AIService` — unified interface; switches on `settingsStore.aiProvider`
- `promptBuilder(subject, course, difficulty, count)` — builds structured prompt
- `responseParser(raw)` — parses JSON, validates with Zod schema

**SyncService**
- `push()`: read `is_dirty=1` → `POST /api/sync` → update `server_id`, clear `is_dirty`
- `pull()`: `GET /api/sync/pull?since={last_synced_at}` → upsert SQLite (last-write-wins)

**RestoreService**
- `restore()`: `GET /api/restore` → bulk-insert all tables, `server_id` populated, `is_dirty=0`

**AnalyticsService** (fully offline)
- Computes all metrics from local SQLite
- Dashboard: tests, attempted, correct, wrong, accuracy, time on app, streak
- Per-subject breakdown

---

## Question Generation Scripts (Root)

Python utilities to pre-generate MCQ banks; outputs consumed by Laravel seeders.

| Script | Output JSON | Content |
|--------|-------------|---------|
| `generate_questions.py` | `questions_data.json` | 500 basic MCQs, 9 topics (Hindi) |
| `generate_uppsc_level_questions.py` | `questions_data_uppsc_level.json` | 500 UPPSC-style MCQs |
| `generate_hard_level_questions.py` | — | 40+ hard questions per topic |
| `generate_unique_questions.py` | — | Unique variations |
| `extract_questions_from_pdf.py` | — | Extracts from official UPPSC PDFs via `pdfplumber` |

Topics: History (56), Geography (56), Constitution (55), Society (56), Current Affairs (55), Agriculture (55), Science (56), Mathematics (55), Community Health (56)

```bash
python generate_questions.py
# Then import:
php artisan db:seed --class=HealthEducationOfficerQuestionsSeeder
```

---

## Sync Architecture (Deep Reference)

### Offline-First Design

Every user data row on mobile has:
- `server_id` — null until first successful sync
- `is_dirty = 1` — set whenever row is created/modified locally
- `updated_at` — timestamp used for conflict resolution
- `synced_at` — timestamp of last successful push

### Push Flow

1. Read all rows with `is_dirty = 1` from all 8 tables
2. Batch into payload: `{ question_sets: [...], questions: [...], ... }`
3. `POST /api/sync` with payload
4. Server upserts (last-write-wins on `updated_at`), returns `{ mappings: { table: [{local_id, server_id}] } }`
5. Device: update `server_id` from mappings, set `is_dirty = 0`, update `synced_at`

### Pull Flow

1. `GET /api/sync/pull?since={last_pull_timestamp}`
2. Server returns reference data (always) + user data where `updated_at > since`
3. Device upserts each row: if local `updated_at` > server `updated_at` → keep local; else → overwrite

### Restore Flow (fresh device)

1. `GET /api/restore`
2. Server returns entire account dataset (all tables, all rows)
3. Device bulk-inserts with `is_dirty = 0` (nothing needs pushing)

### Multi-Device Conflict

- Reference data (subjects, courses): server always wins — device never marks dirty
- User data: last-write-wins on `updated_at`
- `device_id` tracked on user record + `app_usage` for per-device time aggregation

---

## Environment Notes

- **Host OS**: Windows, shell is PowerShell
- **Docker**: root `Makefile` wraps `docker compose -f backend/docker-compose.yml`
- **Android emulator → host**: `http://10.0.2.2:8000/api`
- **AGENTS.md loading**: auto-loaded via `.Codex/settings.local.json` `SessionStart` hook — no need to re-scan files at session start
