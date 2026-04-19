# Spend Tracker — SPEC

## 1. Goal
Personal spend tracker with multi-user workspace sharing and cross-user loan ledger. Hosted free on GitHub Pages, backed by Firebase (Firestore + Auth).

## 2. Stack

| Layer | Choice |
|---|---|
| Framework | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Routing | React Router (HashRouter — GH Pages compatible) |
| Cloud DB | Firebase Firestore |
| Auth | Firebase Auth — Google Sign-In only |
| Offline cache | Firestore built-in IndexedDB persistence |
| Charts | Recharts |
| PDF | jsPDF + jspdf-autotable |
| PWA | vite-plugin-pwa (Workbox) |
| Deploy | GitHub Actions → `gh-pages` branch |
| Firebase project | `spend-tracker-7482` |

## 3. Core Concepts

### 3.1 User
- Identified by Firebase `uid` (Google account)
- Has `email`, `displayName`, `photoURL`
- Can belong to multiple workspaces
- Has `currentWorkspaceId` (active workspace selector)

### 3.2 Workspace
- Unit of shared data (household, personal, business)
- Has `ownerUid` and `members: [uid]` array
- All spend data lives under workspace
- On first login, auto-create personal workspace `"{name}'s Workspace"`
- Owner can invite other users by email; they accept → added to `members`

### 3.3 Contact
- Per-user list of people tracked for loans
- States: `pending_signup` (email not yet on app) | `invite_sent` | `connected`
- `connected` = mutual acceptance → bidirectional loan sync enabled

### 3.4 Shared Loan
- Lives at root `sharedLoans/{id}`, not inside workspace
- Links `giverUid` ↔ `receiverUid` (or `receiverEmail` if not yet signed up)
- Status: `unconfirmed` | `accepted` | `disputed` | `settled`
- Receiver must accept before it shows as confirmed in both dashboards
- Repayments also require confirmation by the other party

## 4. Features

### 4.1 Auth
- Landing page: "Sign in with Google" button
- First-time user: auto-create personal workspace + seed default categories
- Signed-in user lands on Dashboard of `currentWorkspaceId`

### 4.2 Dashboard
- Current month total spend
- Spend by category (pie/bar)
- Outstanding loans given (total)
- Outstanding loans taken (total)
- Recent 5 spends
- Pending confirmations banner (loans/repayments awaiting action)

### 4.3 Spends
- **Add Spend** form: amount, date (default today), category, payment source, notes, optional tags
- **List view** with filters:
  - Date range (presets: this month, last month, FY, custom)
  - Categories (multi-select)
  - Payment sources (multi-select)
  - Text search (notes)
- **Export**: PDF (formatted table with totals by category) + CSV
- Edit/delete own entries
- Workspace members see all entries, attributed by `createdBy`

### 4.4 Categories (per workspace)
- Fields: name, icon (emoji or lucide), color, active flag
- Default seeds on workspace create: Food, Transport, Groceries, Rent, Utilities, Shopping, Entertainment, Health, Education, Travel, Other
- CRUD; can't delete if referenced by spends (soft-delete: mark inactive)

### 4.5 Payment Sources (per workspace)
- Fields: name, type (`bank` | `credit_card` | `wallet` | `cash` | `upi`), last4 (optional), active flag
- Examples: "ICICI Bank", "HDFC CC 3456", "Amazon Pay", "Cash"
- CRUD with same soft-delete rule

### 4.6 Contacts
- Add contact by email
- System checks if email exists as registered user:
  - Yes → send invite → status `invite_sent`
  - No → status `pending_signup`, auto-match on future signup
- Mutual accept → status `connected`
- Remove contact (blocked if active loans)

### 4.7 Loans Given
- Create loan: contact, amount, date, payment source (money diya kahan se), notes
- If contact `connected` → shared doc visible to both, status `unconfirmed` until receiver accepts
- If not connected → local-only, synced later on connection
- Record repayment: amount, date, payment source received in, notes
- Settle button (when outstanding = 0)
- Per-contact summary view

### 4.8 Loans Taken
- Auto-populated when someone assigns a loan to the user
- User can accept/dispute
- User can record repayments (sent money back)
- Other party must confirm repayment

### 4.9 Workspace Settings
- Invite member (email)
- Remove member (owner only)
- Rename workspace
- Leave workspace (non-owners)
- Switch active workspace

### 4.10 Backup / Export
- **Export all data as JSON** (for archival)
- **Yearly PDF report**: all spends + category breakdown + loans summary

## 5. Data Model (Firestore)

```
users/{uid}
  email, displayName, photoURL, currentWorkspaceId, createdAt

users/{uid}/contacts/{contactId}
  email, displayName, contactUid (nullable), status, createdAt

workspaces/{wsId}
  name, ownerUid, members: [uid], createdAt, updatedAt

workspaces/{wsId}/invites/{inviteId}
  email, invitedBy, status: 'pending' | 'accepted' | 'declined', createdAt

workspaces/{wsId}/categories/{id}
  name, icon, color, active, createdAt

workspaces/{wsId}/paymentSources/{id}
  name, type, last4, active, createdAt

workspaces/{wsId}/spends/{id}
  date (Timestamp), amount (number), categoryId, paymentSourceId,
  notes, tags: [], createdBy (uid), createdAt, updatedAt

sharedLoans/{loanId}
  giverUid, giverEmail
  receiverUid (nullable), receiverEmail
  sourceWorkspaceId, sourcePaymentSourceId
  amount, date (Timestamp), notes
  status: 'unconfirmed' | 'accepted' | 'disputed' | 'settled'
  outstandingAmount (denormalized for fast dashboard)
  createdBy, createdAt, updatedAt

sharedLoans/{loanId}/repayments/{repId}
  amount, date, notes
  recordedBy (uid)
  receivedInWorkspaceId (nullable), receivedInPaymentSourceId (nullable)
  status: 'unconfirmed' | 'accepted' | 'disputed'
  createdAt
```

## 6. Firestore Security Rules (summary)

```
users/{uid}
  read/write: request.auth.uid == uid

users/{uid}/contacts/{id}
  read/write: request.auth.uid == uid

workspaces/{wsId}
  read: auth.uid in resource.data.members
  create: auth.uid == request.resource.data.ownerUid
  update: auth.uid == resource.data.ownerUid
         || (auth.uid in resource.data.members && only updates own member metadata)

workspaces/{wsId}/{sub}/{id}  // all sub-collections
  read/write: auth.uid in get(workspaces/{wsId}).members

sharedLoans/{loanId}
  read: auth.uid in [giverUid, receiverUid]
  create: auth.uid == request.resource.data.giverUid
  update: auth.uid in [resource.giverUid, resource.receiverUid]

sharedLoans/{loanId}/repayments/{id}
  same as parent
```

## 7. Routing (HashRouter)

```
/                       → redirects based on auth
/login
/dashboard
/spends
/spends/new
/spends/:id/edit
/loans-given
/loans-given/new
/loans-given/:id
/loans-taken
/loans-taken/:id
/contacts
/categories
/payment-sources
/settings/workspace
/settings/profile
/settings/backup
```

## 8. UX Principles
- Mobile-first (PWA installable)
- Instant feedback: optimistic writes via Firestore offline cache
- Confirmation flows for cross-user actions (loans, repayments)
- Pending items always surfaced on dashboard
- Currency fixed to INR (₹ symbol)
- Dates in `DD MMM YYYY` format, India timezone

## 9. Non-Goals (v1)
- Receipt photo uploads
- Multi-currency
- Recurring transactions / subscriptions
- Budget limits / alerts
- Bank account integration / auto-import
- Android/iOS native apps (PWA suffices)

## 10. Open Items
- Invite notification: in-app only v1 (email notification v2 via Firebase Extension)
- Offline loan creation for non-connected contacts: queue locally, sync on connect
