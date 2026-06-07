# AI-Powered Exam Practice App — Full Plan

## Context
A React Native application where students select a subject, course, and difficulty level, then receive AI-generated MCQ practice questions (via Gemini or ChatGPT). Questions are stored locally for offline use. A Laravel backend handles auth, central sync (every 30 min), multi-device support, and analytics. Architecture is offline-first and scalable.

---

# PART 1 — REACT NATIVE FRONTEND

---

## 1. Tech Stack

| Concern | Library |
|---|---|
| Framework | React Native CLI + TypeScript |
| Navigation | `@react-navigation/native`, `stack`, `bottom-tabs` |
| State Management | `zustand` — global session/app state |
| Server Data | `@tanstack/react-query` — API calls + caching |
| Local Database | `@op-engineering/op-sqlite` (SQLite) — primary offline store |
| Offline Sync Queue | Custom queue in SQLite + `NetInfo` |
| UI Components | `react-native-paper` |
| Icons | `react-native-vector-icons` |
| Forms | `react-hook-form` + `zod` |
| HTTP Client | `axios` |
| Secure Storage | `react-native-keychain` — auth tokens |
| Timer | `react-native-countdown-circle-timer` |
| Progress | `react-native-progress` |
| Charts | `react-native-gifted-charts` — dashboard accuracy/trend charts |
| Network Detection | `@react-native-community/netinfo` |
| Notifications | `@notifee/react-native` |
| Crash Reporting | `@sentry/react-native` |

---

## 2. Local Database Schema (SQLite)

> **Sync column convention — present on every syncable table:**
> - `server_id` — backend ID assigned after first sync (NULL = not yet on server)
> - `is_dirty` — 1 when row created/edited locally and pending upload, else 0
> - `updated_at` — local last-modified timestamp; used for last-write-wins conflict resolution
> - `synced_at` — timestamp of last successful sync
>
> **Difficulty** is constrained to `Easy | Medium | Hard` everywhere.
> **Questions depend primarily on `subject_id`**; `course_id` is optional context only.

```sql
-- Reference data (pulled/seeded from backend; read-only on device)
subjects        (id, server_id, name, synced_at, updated_at)
courses         (id, server_id, name, exam_type, synced_at, updated_at)

-- Course ↔ Subject : MANY-TO-MANY junction
course_subjects (course_id, subject_id)            -- PK (course_id, subject_id)

-- AI-generated question bank
-- subject_id = PRIMARY driver; course_id = OPTIONAL context (nullable)
question_sets   (id, server_id, subject_id NOT NULL, course_id NULL,
                 difficulty CHECK(Easy|Medium|Hard), total_questions,
                 generated_at, is_dirty, updated_at, synced_at)
questions       (id, server_id, set_id, text, explanation,
                 is_dirty, updated_at, synced_at)
options         (id, server_id, question_id, text, is_correct, synced_at)

-- Test sessions
sessions        (id, server_id, set_id, mode[timed|untimed],
                 feedback_mode[immediate|end], total_questions, duration_seconds,
                 status[active|completed|abandoned], score,
                 started_at, completed_at, resume_payload JSON,
                 is_dirty, updated_at, synced_at)

-- Attempt tracking
attempts        (id, server_id, session_id, question_id, selected_option_id,
                 is_correct, time_taken_seconds, answered_at, is_dirty, synced_at)

-- Analytics (single-user on device — no user_id needed locally)
analytics       (id, server_id, subject_id, course_id, difficulty,
                 total_attempted, total_correct, accuracy_percent,
                 avg_time_per_question, is_dirty, updated_at, synced_at)

-- App usage / time-on-app tracking (one row per active day)
app_usage       (id, server_id, date, seconds_active,
                 is_dirty, updated_at, synced_at)

-- Outbound sync queue
sync_queue      (id, entity_type, entity_id, action[create|update], payload JSON,
                 created_at, synced_at, failed_attempts)
```

---

## 3. App Screens & Navigation

```
Root Stack
├── AuthStack
│   ├── LoginScreen
│   └── RegisterScreen
└── MainTabs
    ├── HomeTab
    │   └── DashboardScreen
    ├── PracticeTab
    │   ├── SubjectSelectScreen
    │   ├── CourseSelectScreen
    │   ├── ConfigScreen          ← questions, mode, timer settings
    │   ├── ExamPlayerScreen      ← core exam engine
    │   └── ResultsScreen
    ├── HistoryTab
    │   ├── HistoryListScreen
    │   ├── SessionReviewScreen      ← review wrong answers
    │   └── QuestionSetLibraryScreen ← reuse stored sets for revision/mock
    └── ProfileTab
        ├── AnalyticsScreen
        └── SettingsScreen
            ├── AIConfigScreen      ← provider + API key setup
            └── TestPreferencesScreen
```

---

## 4. Feature Modules

---

### 4.0 Student Dashboard (Performance Overview)

The landing screen after login (`DashboardScreen`). Shows the student's overall performance, computed from local SQLite (`sessions`, `attempts`, `analytics`, `app_usage`) so it works fully offline.

**Metric cards displayed:**
| Metric | Source |
|---|---|
| **Tests taken** | count of `sessions` where `status = 'completed'` |
| **Questions attempted** | count of `attempts` rows |
| **Correct answers** | count of `attempts` where `is_correct = 1` |
| **Wrong answers** | count of `attempts` where `is_correct = 0` |
| **Overall accuracy %** | `correct / attempted * 100` |
| **Time spent on app** | `SUM(app_usage.seconds_active)` (today / this week / all-time) |
| **Current streak** | consecutive days with at least one completed session |

**UI layout:**
```
Dashboard
├── Greeting + avatar
├── Stat grid (2×3 cards): Tests · Attempted · Correct · Wrong · Accuracy · Time on App
├── Accuracy trend (line chart, last 7 sessions)
├── Per-subject mini bars (accuracy by subject)
└── CTA: "Start New Test"
```

**Time-on-app tracking (`useAppUsageTracker` hook):**
- Subscribes to React Native `AppState`
- Starts a timer when app enters **foreground** (`active`), stops on **background**/`inactive`
- On stop, adds elapsed seconds to today's `app_usage` row (`upsert` by `date`) and sets `is_dirty = 1`
- Flushed to backend by the normal SyncService cycle

**Files:**
- `src/screens/DashboardScreen.tsx`
- `src/components/StatCard.tsx`
- `src/components/AccuracyTrendChart.tsx` (uses `react-native-gifted-charts` or `victory-native`)
- `src/hooks/useAppUsageTracker.ts`
- `src/db/repositories/dashboardRepo.ts` — aggregate queries

---

### 4.1 Subject & Course Selection

**Flow:** Subject → (optional Course) → Config → Start

- Subjects and courses are **fetched from the backend** (`GET /api/subjects`, `GET /api/courses`) and cached in SQLite. On first launch the app seeds them; on every sync the reference data is refreshed.
- Because **Subject is the primary driver**, the student picks a **Subject first**. Course is an **optional** refinement (a subject may belong to many courses and vice-versa — Many-to-Many).
- `SubjectSelectScreen` — grid of subject cards (from local cache, refreshed from backend)
- `CourseSelectScreen` — lists courses linked to the chosen subject via `course_subjects`; includes a **"Skip / All Courses"** option since course is optional
- `ConfigScreen` — lets student configure:
  - Number of questions (5 / 10 / 20 / custom)
  - Difficulty (**Easy / Medium / Hard**)
  - Feedback mode: **Immediate** (show correct answer after each question) or **End of Test**
  - Test mode: **Timed** (custom minutes) or **Untimed**
  - Source: **Generate new** (AI) or **Reuse a stored set** (pick from existing question_sets for revision/mock)

---

### 4.2 AI Question Generation

**Providers supported:** Google Gemini (`gemini-pro`) or OpenAI ChatGPT (`gpt-4o`)
- Provider selectable in Settings; API key stored securely via `react-native-keychain`

**Prompt template** sent to AI (subject is primary; course is optional context only):
```
Generate {n} multiple-choice questions.
PRIMARY topic — Subject: {subject}   ← focus the questions here
Secondary context — Course/Exam Type: {course | "general"}  ← optional framing only
Difficulty: {difficulty}   (Easy | Medium | Hard)

For each question return JSON:
{
  "question": "...",
  "options": [
    { "text": "...", "is_correct": false },
    { "text": "...", "is_correct": true },
    ...
  ],
  "explanation": "..."
}
Return as a JSON array only. No extra text.
```

**Generation flow:**
1. Check internet via `NetInfo`
2. If online → call AI API → parse JSON response → validate schema with `zod`
3. Save `question_set` + `questions` + `options` to SQLite
4. Add to `sync_queue` for backend upload
5. If offline → skip generation, load from existing SQLite question bank

**Files:**
- `src/services/ai/GeminiService.ts`
- `src/services/ai/ChatGPTService.ts`
- `src/services/ai/AIService.ts` — unified interface, switches provider
- `src/services/ai/promptBuilder.ts`
- `src/services/ai/responseParser.ts`

---

### 4.3 Exam Engine

**Zustand store — `useExamStore`:**
```ts
{
  sessionId: string,
  questions: Question[],
  currentIndex: number,
  answers: Record<questionId, optionId>,
  timeRemaining: number | null,    // null = untimed
  feedbackMode: 'immediate' | 'end',
  status: 'idle' | 'running' | 'paused' | 'submitted',
  startedAt: string,
}
```

**Key behaviours:**
- `saveAnswer(questionId, optionId)` → write to Zustand + SQLite `attempts` table immediately
- Immediate mode: show correct/incorrect highlight + explanation after each selection
- End mode: lock answer, move on, reveal all at results screen
- Timer: `useExamTimer` hook with `setInterval`; auto-submits at 0
- `AppState` listener: pauses timer on background, resumes on foreground
- **Resume:** on app start, check SQLite for `status = 'active'` sessions → prompt "Resume test?"
- Progress: `answeredCount / totalQuestions` via `react-native-progress`

**Files:**
- `src/store/examStore.ts`
- `src/hooks/useExamTimer.ts`
- `src/screens/ExamPlayerScreen.tsx`
- `src/components/QuestionCard.tsx`
- `src/components/OptionItem.tsx` — shows neutral / correct / incorrect states
- `src/components/ExamProgressBar.tsx`

---

### 4.4 Submission & Results

**On submit:**
1. Mark `session.status = 'completed'`, save `completed_at`
2. Calculate: `score = correct / total * 100`
3. Update `analytics` table (cumulative accuracy, totals)
4. Push session + attempts to `sync_queue`
5. Navigate to `ResultsScreen`

**Results Screen UI:**
- Large score circle (pass/fail colour threshold configurable)
- Stats row: ✅ Correct | ❌ Incorrect | ⏭ Skipped | ⏱ Time taken
- Per-question breakdown (expandable): question text, chosen answer, correct answer, explanation
- CTAs: **Retake this set** | **New Test** | **Back to Dashboard**

**Files:**
- `src/screens/ResultsScreen.tsx`
- `src/components/ScoreCircle.tsx`
- `src/components/QuestionBreakdown.tsx`

---

### 4.5 History & Review

- `HistoryListScreen` — lists all completed sessions with date, subject, score, accuracy
- `SessionReviewScreen` — full question-by-question review of any past session
- Filter by: subject, date range, score range
- **Reuse / Revision:** `QuestionSetLibraryScreen` lists all stored `question_sets` grouped by subject → difficulty. Student can launch any stored set as a **new session** (mock test / revision) without re-calling the AI. Dedupe: before generating, check for an existing un-attempted set matching subject + difficulty and offer to reuse it.

---

### 4.6 Analytics Screen

Displays aggregated data from local `analytics` table:
- Overall accuracy % (all-time)
- Per-subject accuracy chart
- Streak (consecutive days practiced)
- Weakest topics (lowest accuracy by course)
- Total questions attempted / correct / incorrect

---

### 4.7 Offline Sync Service

- `SyncService.ts` — runs every 30 min via background task or on app foreground
- **Push:** reads rows where `is_dirty = 1` (and `sync_queue` entries), batches and `POST /api/sync`
- **Pull:** `GET /api/sync/pull?since={last_synced_at}` to fetch server-side changes (incl. refreshed subjects/courses/M2M for multi-device)
- **Conflict resolution — last-write-wins:** compare local `updated_at` vs server `updated_at`; the newer timestamp wins. Reference data (subjects/courses) is server-authoritative and always overwrites local.
- On success: clears `is_dirty`, sets `synced_at`, fills local `server_id` from response
- On failure: increments `failed_attempts`; retries up to 5 times then alerts user

**Device change / full restore:**
- On login, the app checks whether the local SQLite is empty (fresh install / new device)
- If empty → calls `GET /api/restore` which returns the **entire** account dataset: question_sets, questions, options, sessions, attempts, analytics, and app_usage
- The response is bulk-inserted into SQLite (with `server_id` populated, `is_dirty = 0`) so the new device is a faithful clone — all history, performance metrics, and time-on-app are preserved
- A "Restoring your data…" progress screen is shown during hydration
- Files: `src/services/RestoreService.ts`, `src/hooks/useFirstLaunchRestore.ts`

---

## 5. Settings

| Setting | Options |
|---|---|
| AI Provider | Gemini / ChatGPT |
| API Key | Secure input → stored in Keychain |
| Questions per session | 5 / 10 / 20 / Custom |
| Default difficulty | Easy / Medium / Hard |
| Feedback mode | Immediate / End of Test |
| Test mode | Timed / Untimed |
| Default timer | 10 / 20 / 30 / Custom minutes |
| Auto-sync | On/Off |
| Sync interval | 30 min (default) |

---

## 6. Project Folder Structure

```
src/
├── api/              — axios instance, endpoint functions
├── components/       — reusable UI components
├── db/               — SQLite setup, migrations, repository functions
│   ├── schema.ts
│   ├── migrations/
│   └── repositories/ — subjectRepo, questionRepo, sessionRepo, analyticsRepo
├── hooks/            — useExamTimer, useNetworkStatus, useSync
├── navigation/       — stack and tab navigators
├── screens/          — one folder per screen
├── services/
│   ├── ai/           — GeminiService, ChatGPTService, AIService
│   └── SyncService.ts
├── store/            — Zustand stores (examStore, authStore, settingsStore)
├── types/            — shared TypeScript interfaces
└── utils/            — score calculator, date helpers, validators
```

---

---

# PART 2 — LARAVEL BACKEND

---

## 7. Tech Stack

| Concern | Tool |
|---|---|
| Framework | Laravel 11 |
| Auth | Laravel Sanctum (API tokens) |
| Database | MySQL 8 |
| Queue | Laravel Queues (Redis or DB driver) |
| Scheduler | Laravel Task Scheduler (`artisan schedule:run`) |
| API Logging | Custom middleware + `api_logs` table |
| Dev Tooling | Laravel Telescope |

---

## 8. Database Tables

> All user-data tables carry `updated_at` for **last-write-wins** sync. `users.role` gates the admin panel.

```sql
users                 (id, name, email, password, role[student|admin],
                       device_id, last_sync_at, created_at, updated_at)
password_reset_tokens (email, token, created_at)              -- forgot/reset flow

subjects              (id, name, created_at, updated_at)
courses               (id, name, exam_type, created_at, updated_at)
-- Course ↔ Subject : MANY-TO-MANY pivot
course_subject        (course_id, subject_id)                 -- PK (course_id, subject_id)

-- subject_id PRIMARY; course_id OPTIONAL (nullable)
question_sets         (id, user_id, subject_id, course_id NULL, difficulty[Easy|Medium|Hard],
                       ai_provider, prompt_used, generated_at, created_at, updated_at)
questions             (id, set_id, text, explanation, created_at, updated_at)
options               (id, question_id, text, is_correct)

sessions              (id, user_id, set_id, mode, feedback_mode, total_questions,
                       duration_seconds, score, status, started_at, completed_at, updated_at)
attempts              (id, session_id, question_id, selected_option_id,
                       is_correct, time_taken_seconds, answered_at, updated_at)

analytics             (id, user_id, subject_id, course_id, difficulty,
                       total_attempted, total_correct, accuracy_percent,
                       avg_time_per_question, updated_at)

-- Time-on-app per user per day (aggregated from all devices)
app_usage             (id, user_id, device_id, date, seconds_active, updated_at)

sync_logs             (id, user_id, device_id, synced_at, records_synced, status)
api_usage_logs        (id, user_id, provider, prompt_tokens, completion_tokens,
                       questions_generated, created_at)
user_activity_logs    (id, user_id, action, metadata JSON, created_at)
```

---

## 9. API Endpoints

### Auth
```
POST   /api/auth/register
POST   /api/auth/login          → returns Sanctum token
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/refresh-token
POST   /api/auth/forgot-password → emails reset token
POST   /api/auth/reset-password  → token + new password
```

### Reference Data (fetched by app on launch + each sync)
```
GET    /api/subjects             → all subjects
GET    /api/courses              → all courses (with linked subject ids)
GET    /api/subjects/{id}/courses → courses linked to a subject (via pivot)
```

### Sync (core endpoint)
```
POST   /api/sync                 → receives batch payload from device
GET    /api/sync/pull            → returns server changes since last sync timestamp
GET    /api/restore              → returns FULL account dataset (new-device restore)
```

**Sync payload structure:**
```json
{
  "device_id": "uuid",
  "last_synced_at": "2026-05-28T10:00:00Z",
  "question_sets": [...],
  "sessions": [...],
  "attempts": [...],
  "analytics": [...],
  "app_usage": [...]
}
```

### Analytics / Dashboard
```
GET    /api/analytics/summary    → dashboard totals: tests_taken, questions_attempted,
                                    correct, wrong, accuracy, time_on_app, streak
GET    /api/analytics/subjects   → per-subject breakdown
```

### Admin / Internal  *(protected by `role:admin` middleware)*
```
GET    /api/admin/users
GET    /api/admin/api-usage      → token usage per user/provider
GET    /api/admin/activity-logs

# Subject management (CRUD)
GET    /api/admin/subjects
POST   /api/admin/subjects
PUT    /api/admin/subjects/{id}
DELETE /api/admin/subjects/{id}

# Course management (CRUD) + Many-to-Many subject linking
GET    /api/admin/courses
POST   /api/admin/courses
PUT    /api/admin/courses/{id}
DELETE /api/admin/courses/{id}
POST   /api/admin/courses/{id}/subjects   → sync/attach subject_ids to a course (pivot)
```

---

## 10. Laravel Modules

### AuthService
- Register, login, logout with Sanctum
- Forgot/reset password via `password_reset_tokens` + Laravel notification email
- Track `device_id` per token for multi-device sync
- Invalidate tokens on logout per device
- `role` column (`student | admin`) enforced by a `role:admin` middleware on admin routes

### Admin Module (`Admin/SubjectController`, `Admin/CourseController`)
> Admin is a **backend-side role** (web panel / API), not part of the student RN app. Admins add subjects, courses, and their M2M links; students consume them via the Reference Data endpoints.
- Full CRUD for subjects and courses
- Manage Many-to-Many links via the `course_subject` pivot (`$course->subjects()->sync($ids)`)
- Guarded by `auth:sanctum` + `role:admin`

### SyncService (`app/Services/SyncService.php`)
- Accepts full batch payload from device (incl. `app_usage`)
- Upserts records using `updateOrCreate` keyed on device-local IDs
- **Conflict resolution — last-write-wins** using `updated_at` comparison per row
- `app_usage`: same-day rows from multiple devices are summed per user
- Returns delta of server-side changes since `last_synced_at` (incl. subjects/courses/pivot for multi-device)
- Logs each sync to `sync_logs`

### RestoreService (`app/Services/RestoreService.php`)
- Powers `GET /api/restore` for new-device login
- Returns the **complete** dataset for the authenticated user: question_sets → questions → options, sessions → attempts, analytics, app_usage
- Paginated/streamed for large accounts to avoid memory spikes

### AnalyticsService (`app/Services/AnalyticsService.php`)
- Recalculates `analytics` table on every sync
- Computes accuracy, streaks, weak topics

### ApiUsageLogger (Middleware)
- Logs every AI question generation request: provider, tokens used, questions generated

### Scheduled Tasks (`app/Console/Kernel.php`)
- `SyncReminder` notification — nudge users who haven't synced in 24h
- `StaleSessionCleanup` — mark sessions older than 7 days with `status=abandoned`

---

## 11. Laravel Project Structure

```
app/
├── Http/
│   ├── Controllers/
│   │   ├── Auth/           — register, login, logout, forgot/reset password
│   │   ├── SyncController  — POST /sync, GET /sync/pull
│   │   ├── RestoreController — GET /restore (full new-device restore)
│   │   ├── AnalyticsController — dashboard summary + per-subject
│   │   └── Admin/          — Users, SubjectController, CourseController, api-usage, logs
│   └── Middleware/
│       ├── EnsureUserIsAdmin.php   — role:admin gate
│       ├── ApiUsageLogger.php
│       └── DeviceTracker.php
├── Models/                 — User, Subject, Course (M2M belongsToMany), QuestionSet,
│                             Question, Option, Session, Attempt, Analytics
├── Services/
│   ├── SyncService.php
│   ├── RestoreService.php
│   └── AnalyticsService.php
└── Console/
    └── Commands/           — SyncReminder, StaleSessionCleanup

routes/
└── api.php

database/
├── migrations/
└── seeders/
    ├── SubjectSeeder.php
    └── AdminUserSeeder.php
```

---

---

# PART 3 — ARCHITECTURE OVERVIEW

```
┌──────────────────────────────────────────────┐
│            React Native App                  │
│                                              │
│  SubjectSelect → Config → ExamPlayer         │
│       ↓ (online)           ↓ (offline)       │
│  AI Service            SQLite Local DB       │
│  (Gemini/GPT)          ├─ question_sets      │
│       ↓                ├─ sessions           │
│  Parse + Validate      ├─ attempts           │
│       ↓                └─ analytics          │
│  Save to SQLite                              │
│       ↓                                      │
│  SyncQueue ──── every 30 min ────────────►  │
└──────────────────────────────────────────────┘
                                    │
                        POST /api/sync
                                    │
                  ┌─────────────────▼────────────┐
                  │       Laravel Backend         │
                  │                              │
                  │  SyncService (upsert)        │
                  │  AnalyticsService (calc)     │
                  │  ApiUsageLogger              │
                  │  MySQL DB                    │
                  │  Multi-device delta pull     │
                  └──────────────────────────────┘
```

---

# PART 4 — VERIFICATION PLAN

### Frontend
- `npx react-native run-android`
- Select subject → course → config → generate questions (online) → complete test → view results
- Turn off network → reopen app → verify questions load from SQLite → complete test offline
- Close app mid-test → reopen → verify resume prompt appears
- Check analytics screen updates after test completion

### Backend
- `php artisan serve` + `php artisan migrate --seed`
- `POST /api/auth/login` → get token
- `POST /api/sync` with sample payload → verify upsert + sync_log entry
- `GET /api/sync/pull?since=<timestamp>` → verify delta response
- `GET /api/analytics/summary` → verify computed stats

### Dashboard & Time Tracking
- Complete 2–3 tests → open Dashboard → verify Tests taken / Attempted / Correct / Wrong / Accuracy match
- Background and foreground the app a few times → verify "Time on app" increments and persists to `app_usage`
- Confirm dashboard renders fully offline (airplane mode)

### End-to-End / Device Change
- Login on Device A → generate questions → complete tests → sync
- Login on Device B (fresh install) with same account → `GET /api/restore` fires → verify ALL data restored: question sets, history, scores, analytics, and time-on-app
- Login on Device B → trigger sync → verify new sessions also appear on Device A
