# Exam Practice App — Mobile (React Native CLI)

AI-powered, offline-first exam practice app. See `../plan.md` for the full design.

## Status
This is the **source scaffold** (Phase 1). The native `android/` and `ios/`
folders are not included — generate them once, then drop this `src/` + root
files in, OR initialize a fresh app and copy these over.

## Getting started

```bash
# 1. (one-time) generate native projects with the matching RN version
npx @react-native-community/cli@latest init ExamPracticeApp --version 0.75.4
# then copy src/, App.tsx, index.js, *.config.js, tsconfig.json into it

# 2. install JS dependencies
npm install

# 3. install the babel module-resolver used by the "@/" path alias
npm install -D babel-plugin-module-resolver

# 4. run
npm run android   # or: npm run ios
```

## Configuration
- Set the backend URL in `src/api/client.ts` (`API_BASE_URL`).
- Add Gemini / ChatGPT API keys in-app: **Profile → AI Configuration**
  (keys are stored in the device secure keystore, never synced).

## Architecture (offline-first)
- **SQLite** (`src/db`) is the source of truth on-device. Every row carries
  `server_id / is_dirty / updated_at / synced_at` sync columns.
- **SyncService** pushes dirty rows and pulls server deltas every 30 min.
- **RestoreService** does a full account restore on a fresh device at login.
- **AIService** generates MCQs via Gemini or ChatGPT and stores them locally.

## Key folders
```
src/
├── api/          axios client + auth endpoints
├── db/           schema, database, repositories
├── services/     ai/, SyncService, RestoreService
├── store/        zustand: auth, exam, settings
├── hooks/        useAppUsageTracker, useAutoSync
├── navigation/   root + practice navigators
├── screens/      dashboard, auth, practice, history, settings
└── components/   StatCard, AccuracyTrendChart
```
