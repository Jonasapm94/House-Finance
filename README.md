# House Finance

A privacy-first personal finance dashboard for tracking household income and expenses. Runs entirely locally via Docker — no cloud services, no third-party data sharing.

## Tech Stack

| Layer      | Technology                                      |
|------------|------------------------------------------------|
| Frontend   | React 19, TypeScript, Vite 6, Recharts         |
| Backend    | Fastify 5, TypeScript, Objection.js ORM        |
| Database   | PostgreSQL 16                                   |
| Testing    | Vitest                                          |
| Infra      | Docker Compose                                  |
| CI         | GitHub Actions (lint, format, tests)            |

## Features

- **File Import** — Upload OFX (bank statements) and CSV files with flexible column mapping and presets (e.g. Nubank)
- **Deduplication** — Transactions are deduplicated by `external_id` (OFX FITID or CSV-generated hash) to prevent double-imports
- **Auto-Categorization** — Priority-ordered rules with substring, exact, and regex match types. Rules can be re-applied to uncategorized transactions in bulk
- **Dashboard** — Summary cards (income, expenses, net balance), monthly trend bar chart, and expense breakdown pie chart with configurable time periods
- **Transaction Management** — Full CRUD with filtering by date range, category, type, and search text. Paginated listing
- **Category Management** — Color-coded categories with protected "Uncategorized" default
- **Manual Entry** — Create transactions directly without file import

## Quick Start

### Prerequisites

- Docker and Docker Compose

### 1. Clone and configure

```bash
git clone <repo-url> && cd house_finance
cp .env.example .env   # defaults work out of the box
```

### 2. Start all services

```bash
docker compose up
```

This starts PostgreSQL, the backend (port 4000), and the frontend (port 3000).

### 3. Run migrations and seed

```bash
docker compose exec backend npm run migrate
docker compose exec backend npm run seed
```

### 4. Open the app

Navigate to [http://localhost:3000](http://localhost:3000).

## Local Development (without Docker)

### Prerequisites

- Node.js 20+
- PostgreSQL 16

### Database setup

Create the database and set `DATABASE_URL` in your environment:

```bash
export DATABASE_URL=postgresql://finance_user:finance_pass@localhost:5432/house_finance
```

### Backend

```bash
cd backend
npm install
npm run migrate
npm run seed
npm run dev          # starts on port 4000
```

### Frontend

```bash
cd frontend
npm install
npm run dev          # starts on port 3000, proxies /api to backend
```

### Running tests

```bash
# Backend tests (unit tests - no DB required)
cd backend && npm test

# Backend integration tests (requires test database)
cd backend
npm run test:create-db   # Create test DB (one-time)
npm run test:migrate    # Run migrations on test DB
npm test                # Run all tests

# Run a single test file
npx vitest run src/__tests__/parsers/ofxParser.test.ts

# Reset test database
npm run test:reset
```

```bash
# Frontend tests
cd frontend && npm test
```

## Architecture

```
┌──────────────┐     /api/*      ┌──────────────────────────────────────┐
│   React SPA  │ ──────────────► │  Fastify Backend                     │
│   (Vite)     │   proxy/axios   │                                      │
│   port 3000  │                 │  Routes → Services → Models → DB     │
└──────────────┘                 │  port 4000                           │
                                 └──────────────┬───────────────────────┘
                                                │
                                                ▼
                                       ┌────────────────┐
                                       │  PostgreSQL 16  │
                                       │  port 5432      │
                                       └────────────────┘
```

### Backend layout (`backend/src/`)

| Directory      | Purpose                                                    |
|----------------|------------------------------------------------------------|
| `routes/`      | API handlers: upload, categories, transactions, rules, dashboard |
| `services/`    | Business logic: `ImportService` (file import + dedup), `CategorizationService` (rule matching) |
| `models/`      | Objection.js models: Transaction, Category, CategorizationRule, Account, ImportLog |
| `parsers/`     | OFX (SGML→XML→transactions) and CSV (Papa Parse, flexible mapping) |
| `validators/`  | Zod schemas for request validation                         |
| `migrations/`  | Knex migrations (5 tables)                                 |
| `plugins/`     | Fastify plugins (database connection)                      |

### Frontend layout (`frontend/src/`)

| Directory      | Purpose                                                    |
|----------------|------------------------------------------------------------|
| `pages/`       | Dashboard, Transactions, Categories, Rules, Upload         |
| `services/`    | Typed API client (Axios)                                   |
| `components/`  | Layout (sidebar nav), ErrorBoundary                        |
| `types/`       | TypeScript interfaces for all data models                  |

### API Endpoints

| Method | Endpoint                      | Description                                |
|--------|-------------------------------|--------------------------------------------|
| GET    | `/api/health`                 | Health check                               |
| POST   | `/api/upload`                 | Import OFX/CSV file                        |
| GET    | `/api/categories`             | List categories                            |
| POST   | `/api/categories`             | Create category                            |
| PUT    | `/api/categories/:id`         | Update category                            |
| DELETE | `/api/categories/:id`         | Delete category (sets transactions to NULL)|
| GET    | `/api/transactions`           | List transactions (paginated, filterable)  |
| POST   | `/api/transactions`           | Create manual transaction                  |
| PUT    | `/api/transactions/:id`       | Update transaction                         |
| DELETE | `/api/transactions/:id`       | Delete transaction                         |
| GET    | `/api/rules`                  | List categorization rules                  |
| POST   | `/api/rules`                  | Create rule                                |
| PUT    | `/api/rules/:id`              | Update rule                                |
| DELETE | `/api/rules/:id`              | Delete rule                                |
| POST   | `/api/rules/apply`            | Re-apply all rules to uncategorized txns   |
| GET    | `/api/dashboard/summary`      | Income/expenses/net for date range         |
| GET    | `/api/dashboard/monthly-trend`| Monthly income vs expenses chart data      |
| GET    | `/api/dashboard/category-breakdown` | Expenses grouped by category          |

### Database Schema

5 tables: `categories`, `accounts`, `transactions`, `categorization_rules`, `import_logs`

Enums: `transaction_type` (income/expense), `transaction_source` (ofx/csv/manual), `rule_match_type` (substring/regex/exact)

## Known Issues

### Missing Functionality

1. **No Accounts API** — The `Account` model and `accounts` table exist but there are no CRUD endpoints. Accounts can't be created or managed through the UI. Transactions reference `account_id` but it's always NULL for imported data.

### Code Quality

2. **No integration tests** — Test coverage is limited to parsers and categorization logic (backend) and component rendering (frontend). No tests for API routes or database interactions.

3. **Docker runs dev mode only** — Both Dockerfiles use `npm run dev`. No production build or serve configuration.

4. **No authentication** — The app has no auth layer. Designed for local use only — should not be exposed to the internet without adding authentication.

## Environment Variables

| Variable            | Default                                                        | Description            |
|---------------------|----------------------------------------------------------------|------------------------|
| `POSTGRES_USER`     | `finance_user`                                                 | Database user          |
| `POSTGRES_PASSWORD` | `finance_pass`                                                 | Database password      |
| `POSTGRES_DB`       | `house_finance`                                                | Database name          |
| `DATABASE_URL`      | `postgresql://finance_user:finance_pass@db:5432/house_finance` | Backend DB connection  |
| `BACKEND_PORT`      | `4000`                                                         | Backend server port    |
| `FRONTEND_PORT`     | `3000`                                                         | Frontend dev port      |
| `VITE_API_URL`      | `http://localhost:4000/api`                                    | Frontend API base URL  |

## License

Private — not licensed for redistribution.
