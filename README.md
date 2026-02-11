# PackPro Slip

PackPro Slip is a Next.js + Prisma application for creating packing slips, generating printable documents/PDFs, and managing item/customer masters.  
It can run as:

- Web app (browser + local/hosted Next server)
- Desktop app (Electron wrapper with offline SQLite in user data)

## Contents

- Overview
- Tech Stack
- Architecture
- Data Model
- Data Flow Diagrams
- API Surface
- Project Structure
- Setup and Run
- Desktop Packaging
- Configuration
- Troubleshooting

## Overview

Core capabilities:

- Customer master management (active/inactive + import from CSV/XLSX)
- Item master management (active/inactive + import from CSV/XLSX)
- Packing slip create/edit/search with line items and box numbers
- Revision history snapshots per slip version
- Printable packing slips and shipping labels
- PDF export for packing slips using Playwright
- Admin settings for branding, login credentials, theme, timeout, numbering format
- Cleanup actions for slips/items/customers (with safety checks)

## Tech Stack

- Frontend/UI: Next.js 13 (App Router), React 18
- API: Next.js Route Handlers (`src/app/api/**`)
- ORM: Prisma 5
- Database: SQLite
- PDF rendering: Playwright (Chromium)
- Desktop runtime: Electron + electron-builder

## Architecture

```mermaid
flowchart LR
  U[User] -->|Browser| N[Next.js App Router UI]
  U -->|Desktop Window| E[Electron Shell]
  E --> N

  N --> A[Route Handlers /api/*]
  A --> P[Prisma Client]
  P --> S[(SQLite Database)]

  A --> X[XLSX Parser]
  A --> C[Playwright Chromium]
  C --> V[Print Route HTML]
```

Runtime notes:

- Web mode uses `.env` `DATABASE_URL` (default `file:./prisma/dev.db`).
- Desktop packaged mode starts an internal Next server and points Prisma to a per-user DB under Electron `userData`.
- Desktop preload exposes `window.packpro` bridge for `quit` and native print.

## Data Model

Prisma schema: `prisma/schema.prisma`

```mermaid
erDiagram
  Vendor ||--o{ PackingSlip : "has many"
  PackingSlip ||--o{ PackingSlipLine : "has many"
  Item ||--o{ PackingSlipLine : "used in"
  PackingSlip ||--o{ PackingSlipRevision : "versioned by"

  Item {
    int id PK
    string name
    string sku UK
    string unit
    string notes
    bool isActive
    datetime createdAt
  }

  Vendor {
    int id PK
    string name
    string gstNumber
    string address
    string contactName
    string contactPhone
    string email
    bool isActive
    datetime createdAt
  }

  PackingSlip {
    int id PK
    string slipNo UK
    string customerName
    string shipTo
    string poNumber UK
    string boxNumber
    string trackingNumber
    datetime slipDate
    datetime createdAt
    int vendorId FK
  }

  PackingSlipLine {
    int id PK
    int slipId FK
    int itemId FK
    float qty
    string boxName
    string boxNumber
  }

  PackingSlipRevision {
    int id PK
    int slipId FK
    int version
    string snapshot
    datetime createdAt
  }
```

## Data Flow Diagrams

### 1) Login + Session Guard

```mermaid
sequenceDiagram
  participant UI as Login Page
  participant API as /api/auth/login
  participant DB as CompanySettings
  participant SG as AuthGuard
  participant SI as /api/session-info

  UI->>API: POST username/password
  API->>DB: read loginUsername/loginPassword
  DB-->>API: credentials (or empty)
  API-->>UI: success/failure
  UI->>UI: store auth/session/activity in localStorage
  SG->>SI: GET bootId + inactivityTimeoutMinutes
  SI-->>SG: session metadata
  SG->>UI: enforce timeout + server reboot check
```

### 2) Create Packing Slip

```mermaid
sequenceDiagram
  participant UI as New Slip Page
  participant API as /api/packing-slips POST
  participant DB as SQLite via Prisma

  UI->>API: customer + shipTo + billNo + lines
  API->>DB: validate duplicate billNo
  API->>DB: create slip with temp slipNo
  API->>DB: update slipNo using format + slip id
  API->>DB: create line rows
  API->>DB: create revision snapshot v1
  DB-->>API: created full slip
  API-->>UI: 201 created
```

### 3) Edit Packing Slip + Versioning

```mermaid
sequenceDiagram
  participant UI as Edit Slip Page
  participant API as /api/packing-slips/:id PATCH
  participant DB as SQLite via Prisma

  UI->>API: updated header + lines
  API->>DB: validate billNo uniqueness
  API->>DB: update slip fields
  API->>DB: replace lines (deleteMany + createMany)
  API->>DB: append revision snapshot (version +1)
  API-->>UI: updated full slip
```

### 4) PDF Generation

```mermaid
sequenceDiagram
  participant UI as Print View
  participant API as /api/packing-slips/:id/pdf
  participant PW as Playwright Chromium
  participant PR as /print/packing-slip/:id

  UI->>API: GET pdf
  API->>PW: launch headless browser
  API->>PR: render print route URL
  PW-->>API: A4 PDF buffer
  API-->>UI: application/pdf download
```

### 5) Master Import (Items/Customers)

```mermaid
flowchart TD
  F[CSV/XLSX upload] --> R[readImportedRows]
  R --> N[Normalize headers + values]
  N --> M{Match existing?}
  M -->|Yes| U[Update record + mark active]
  M -->|No| C[Create new record]
  U --> O[Import summary: created/updated/skipped/failed]
  C --> O
```

## API Surface

### Auth and session

- `POST /api/auth/login` - validate credentials from settings (fallback `admin/admin` if unset)
- `GET /api/session-info` - server boot ID + inactivity timeout

### Settings and admin

- `GET /api/settings` - fetch company/app settings
- `POST /api/settings` - save settings (theme, branding, login, timeout, numbering format)
- `POST /api/admin/cleanup` - cleanup slips/items/customers/labels (labels are non-persistent)

### Customers (vendors in schema)

- `GET /api/vendors`
- `POST /api/vendors`
- `PATCH /api/vendors/:id` (active flag)
- `DELETE /api/vendors/:id`
- `POST /api/vendors/import` (CSV/XLSX import)

### Items

- `GET /api/items`
- `POST /api/items`
- `PATCH /api/items/:id`
- `DELETE /api/items/:id`
- `POST /api/items/import` (CSV/XLSX import)

### Packing slips and documents

- `GET /api/packing-slips`
- `POST /api/packing-slips`
- `GET /api/packing-slips/:id`
- `PATCH /api/packing-slips/:id`
- `GET /api/packing-slips/next-number`
- `GET /api/packing-slips/revisions`
- `GET /api/packing-slips/:id/pdf`

## Project Structure

```text
src/
  app/
    api/                      # Route handlers (server APIs)
    packing-slip/             # Create/edit flows
    print/                    # Print-optimized slip page
    shipping-labels/          # Label generator pages
    vendors/                  # Customer master UI
    items/                    # Item master UI
    admin/                    # Settings and cleanup UI
    history/                  # Recent slips, versions, reports
  components/                 # Auth guard, nav, print controls, desktop controls
  lib/
    prisma.ts                 # Prisma bootstrap + DATABASE_URL normalization
    import-sheet.ts           # CSV/XLSX parser helpers
    validators.ts             # Email/phone/GST normalization + validation
desktop/
  main.js                     # Electron main process + embedded Next server
  preload.js                  # Safe window bridge
  scripts/prepare-desktop.js  # Build prep (template DB + prisma runtime copy)
prisma/
  schema.prisma               # Data model
```

## Setup and Run

### Prerequisites

- Node.js 18+
- npm
- `sqlite3` CLI (required for `npm run desktop:prepare`)
- Playwright Chromium (required for PDF endpoint)

### Install

```bash
npm install
```

### Environment

`.env` default:

```bash
DATABASE_URL="file:./prisma/dev.db"
```

If you are setting up from scratch and DB/tables do not exist:

```bash
npx prisma generate
npx prisma db push
```

### Run web app

```bash
npm run dev
```

Open `http://localhost:3000`.

### Enable PDF generation

```bash
npx playwright install chromium
```

## Desktop Packaging

### Run desktop in development

```bash
npm run desktop:dev
```

### Build installers

```bash
npm run desktop:dist
```

Platform-specific:

```bash
npm run desktop:mac
npm run desktop:win
npm run desktop:win:portable
```

Important:

- `desktop:prepare` expects `prisma/dev.db` to exist.
- Packaged app creates/uses DB at:
  `~/Library/Application Support/<App>/db/packpro-slip.db` (macOS style path under Electron `userData`)
- Logs are written to `<userData>/logs/main.log`.

## Configuration

Admin page (`/admin`) controls:

- Company identity: name, address, GST, phone, email, logo
- Slip numbering format:
  - Supports `{SEQ}` token, example `PS-{SEQ}`
  - If token missing, trailing numeric part is replaced, or sequence is appended
- Theme: `sunset`, `ocean`, `forest`, `midnight`
- Session inactivity timeout (minutes)
- Login username/password used by `/api/auth/login`

## Troubleshooting

- PDF download fails with Chromium error:
  - Run `npx playwright install chromium`
- Desktop build fails on missing DB template:
  - Create schema first via app run or `npx prisma db push`
  - Then run `npm run desktop:prepare`
- Login fails after server restart:
  - `AuthGuard` compares boot IDs and forces re-login by design
- Cannot delete customer/item:
  - Records used in packing slips are protected by FK constraints; set inactive instead

## Scripts

- `npm run dev` - Next development server
- `npm run build` - Next production build
- `npm run start` - Next production server
- `npm run prisma` - Prisma CLI passthrough
- `npm run desktop:dev` - Next dev + Electron
- `npm run desktop:prepare` - Prepare desktop assets/template DB
- `npm run desktop:dist` - Build macOS + Windows installers
