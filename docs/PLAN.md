# Spend Tracker — Implementation PLAN

Linear phases. Each phase is independently testable and deployable.

## P0 — Repo & Firebase Setup (Day 1)

- [ ] GitHub repo `spend-tracker` under `rambharlia007` (public)
- [x] Firebase project `spend-tracker-7482` created
- [ ] Firebase Auth: enable Google provider
- [ ] Firestore: create database in `asia-south1`, production mode
- [ ] Copy `firebaseConfig` → paste into `.env.local` (and GitHub Actions secrets)
- [ ] Deploy Firestore rules + indexes via `firebase-tools` CLI from repo

## P1 — Scaffold (Day 1)

- [ ] `npm create vite@latest` → React + TS
- [ ] Install: `tailwindcss`, `@radix-ui/*`, shadcn CLI init
- [ ] Install: `firebase`, `react-router-dom`, `react-hook-form`, `zod`, `date-fns`, `recharts`, `jspdf`, `jspdf-autotable`, `lucide-react`
- [ ] Install: `vite-plugin-pwa`
- [ ] Folder structure:
  ```
  src/
    components/ui/        # shadcn primitives
    components/           # app components
    lib/firebase.ts       # init
    lib/firestore/        # typed collection helpers
    hooks/                # useAuth, useWorkspace, useSpends, etc.
    pages/                # route pages
    types/                # shared TS types
    utils/                # date, currency, pdf
    routes.tsx
    App.tsx
    main.tsx
  ```
- [ ] HashRouter setup with placeholder routes
- [ ] Base Tailwind theme, dark mode toggle
- [ ] `.env.local` + `.env.example` with `VITE_FIREBASE_*` vars
- [ ] Firebase init with offline persistence enabled

## P2 — Auth & Workspace Bootstrap (Day 2)

- [ ] `useAuth` hook — Google sign-in/out, auth state listener
- [ ] `/login` page
- [ ] Protected route wrapper → redirect to `/login` if unauthenticated
- [ ] On first login:
  - Create `users/{uid}` doc
  - Create default workspace `{name}'s Workspace`, ownerUid=uid, members=[uid]
  - Seed default categories (11 entries)
  - Set `currentWorkspaceId`
- [ ] `useWorkspace` hook — active workspace context, switcher
- [ ] Top nav: workspace name, user avatar, signout

## P3 — Categories & Payment Sources (Day 2)

- [ ] `/categories` page: list, add, edit, soft-delete
- [ ] `/payment-sources` page: same pattern
- [ ] Icon picker (emoji + lucide subset), color picker
- [ ] Form validation with zod
- [ ] Firestore helpers: `listCategories`, `createCategory`, etc.

## P4 — Spends CRUD (Day 3)

- [ ] `/spends/new` — add form (amount, date, category, source, notes, tags)
- [ ] `/spends` — list with:
  - Filters: date range, categories, sources, text
  - Sorting by date/amount
  - Monthly group headers with subtotals
- [ ] Edit & delete (own entries; workspace members see all)
- [ ] Firestore query with `where` + `orderBy` + compound index (document required indexes)

## P5 — Dashboard (Day 4)

- [ ] Current month total
- [ ] Category pie chart (Recharts)
- [ ] Recent 5 spends
- [ ] Placeholder cards for loans (wired in P7)
- [ ] Pending confirmations banner (wired in P7)

## P6 — Export (Day 4)

- [ ] PDF export: spends table with filters applied, grouped by category totals, header with date range + workspace name
- [ ] CSV export: raw rows
- [ ] Yearly PDF report: annual summary + monthly breakdown

## P7 — Contacts + Shared Loans (Day 5-6)

- [ ] `/contacts` page: add by email, list with status badges
- [ ] Email lookup: query `users` collection by email → if found, send invite doc
- [ ] Invite accept/decline flow
- [ ] `/loans-given` — list + add form (contact, amount, date, source, notes)
- [ ] Loan detail page: repayments list, outstanding, settle button
- [ ] `/loans-taken` — auto-populated, accept/dispute/repay
- [ ] Repayment create + confirm flow
- [ ] Outstanding denormalization on loan doc (Cloud Function? or client-side update in transaction) — **v1: client-side transaction**
- [ ] Dashboard cards: loans given/taken totals, pending confirmations

## P8 — Workspace Sharing (Day 7)

- [ ] `/settings/workspace` — members list, invite, remove, rename, leave
- [ ] Invite email lookup → create invite subdoc
- [ ] Invitee dashboard shows pending invites → accept adds to `members`

## P9 — PWA & Polish (Day 8)

- [ ] vite-plugin-pwa config: manifest, icons, theme color
- [ ] Service worker: cache shell + Firebase auto-cache via SDK
- [ ] Install prompt UI
- [ ] Loading skeletons, error boundaries
- [ ] Empty states with guidance
- [ ] Toast system for confirmations/errors

## P10 — Deploy (Day 8)

- [ ] GitHub Actions workflow: `.github/workflows/deploy.yml`
  - On push to `main`: install, build (env from secrets), deploy to `gh-pages` branch
- [ ] Vite `base: '/spend-tracker/'`
- [ ] Firebase Auth: add `rambharlia007.github.io` to authorized domains
- [ ] Test end-to-end on deployed URL
- [ ] Install as PWA on mobile, verify offline

## P11 — Optional v1.1

- [ ] Recurring spend templates
- [ ] Budget limits per category with alerts
- [ ] Receipt photo (Firebase Storage)
- [ ] Email notifications via Firebase Trigger Email extension

## Firestore Indexes Required

- `workspaces/{ws}/spends` — `(date desc, categoryId)`, `(date desc, paymentSourceId)`
- `sharedLoans` — `(giverUid, status, date desc)`, `(receiverUid, status, date desc)`
- `users` — `email` (single field, auto)

## Security Rules File

Shipped in repo at `firestore.rules`, deployed via `firebase deploy --only firestore:rules`.

## Success Criteria for v1

1. Two users sign in with different Google accounts, each sees only their own data.
2. User A invites User B to workspace → both see same spends.
3. User A creates loan to User B → B sees in Loans Taken, confirms.
4. B records repayment → A confirms → outstanding updates.
5. PDF export works with filters applied.
6. App installable as PWA on Android.
7. Offline: add spend while offline → syncs on reconnect.
8. All data isolated per security rules (verified with rules test).
