# QRS — Qualifying Run Sequence

A web app that recreates and extends the NHRA Qualifying Run Sequence
spreadsheet: manage events and entries, generate qualifying run sequences
(Q1–Q5 lane pairings) for all 14 classes, capture run results, and produce
printable run sheets — with data scraped directly from NHRA sources.

## Tech stack

- **React + Vite + TypeScript** — interactive, data-heavy UI; Vite hashes asset
  filenames so there's no manual cache-busting.
- **Tailwind CSS** (v4, via `@tailwindcss/vite`).
- **Firebase** — Auth (Google + email/password), Firestore (data), Hosting
  (deploy), and Cloud Functions (server-side scraping).
- **Secret Manager** — holds the credentialed Get Results portal login.

## Data sources

- **Season points** — public HTML at `nhra.com/standings/...` (per-class tabs).
  Seeds the Q1 order. Scraped by `scrapePoints`.
- **Run results** — `getresults.nhradata.com` (login required). The portal
  offers a CSV export of every run (RT/ET/MPH/lane per class & session).
  Scraped by `scrapeResults` (reads creds from Secret Manager).

The Excel workbook (`QRS_2025.xlsx`) is the **behavioral spec** for how
sequences are generated; an optional Compulink xlsx import provides the
pre-event roster before any cars have run.

## Prerequisites

- Node 20+ and npm.
- A Firebase project on the **Blaze (pay-as-you-go) plan** (required for Cloud
  Functions + outbound network). You can reuse an existing project.
- Firebase CLI: `npm install -g firebase-tools`.

## Setup

1. Install deps:

   ```bash
   npm install
   ```

2. Create the web app config. Copy `.env.example` to `.env` and fill in the
   values from Firebase console → Project settings → Your apps:

   ```bash
   cp .env.example .env
   ```

3. Point the project: replace `REPLACE_WITH_FIREBASE_PROJECT_ID` in
   `.firebaserc`.

4. Set the bootstrap admin email in **both** places (they must match):
   - `SUPERADMIN_EMAILS` in `src/lib/constants.ts`
   - `superAdminEmails()` in `firestore.rules`

5. In the Firebase console, enable **Authentication** providers: Google and
   Email/Password.

## Run locally

```bash
npm run dev          # Vite dev server at http://localhost:5173
npm run typecheck    # TypeScript project check
npm run build        # production build to dist/
```

## Deploy

```bash
firebase login
npm run build
firebase deploy --only hosting,firestore:rules
# Functions (after the scraping phase):
# firebase deploy --only functions
```

> Editing `firestore.rules` / `storage.rules` locally does not apply them until
> you deploy (`--only firestore:rules` / `--only storage`) or paste them in the
> console.

## Account approval model

Signing in creates `users/{uid}` with `status: 'pending'`. A superadmin flips it
to `approved`. Until then, users land on the **Awaiting approval** screen.
Superadmins (by email) are always treated as approved.

## Project layout

```
src/
  lib/         firebase init, auth context, shared constants
  components/   ProtectedRoute, header, shared UI
  routes/       SignIn, Pending, Dashboard, Editor
functions/      Cloud Functions (scrapePoints, scrapeResults) — skeleton
firestore.rules / storage.rules / firebase.json
```
