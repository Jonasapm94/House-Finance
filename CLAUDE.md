# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Privacy-first personal finance dashboard for tracking household income/expenses. Full-stack TypeScript app with a Fastify API backend, React frontend, and PostgreSQL database. Runs entirely locally via Docker.

## Commands

### Backend (run from `backend/`)

```bash
npm run dev              # Dev server with hot reload (tsx watch, port 4000)
npm run build            # TypeScript compile to dist/
npm run lint             # ESLint
npm run format:check     # Prettier check
npm test                 # Vitest (single run)
npm run test:coverage    # Vitest with coverage
npm run migrate          # Run Knex migrations
npm run migrate:rollback # Rollback last migration batch
npm run seed             # Seed database
```

### Frontend (run from `frontend/`)

```bash
npm run dev              # Vite dev server (port 3000, proxies /api to backend)
npm run build            # TypeScript check + Vite production build
npm run lint             # ESLint
npm run format:check     # Prettier check
npm test                 # Vitest (single run)
npm run test:coverage    # Vitest with coverage
```

### Docker

```bash
docker-compose up        # Start all services (db, backend, frontend)
```

### Running a single test

```bash
cd backend && npx vitest run src/__tests__/ofxParser.test.ts
cd frontend && npx vitest run src/__tests__/Dashboard.test.tsx
```

## Architecture

### Backend (`backend/src/`)

Layered architecture: **Routes → Services → Models → Database**

- **server.ts** — Entry point, starts Fastify on port 4000
- **app.ts** — Fastify app setup, registers plugins and routes
- **routes/** — API route handlers organized by feature (upload, categories, transactions, rules, dashboard)
- **services/** — Business logic: `ImportService` (file import + dedup), `CategorizationService` (rule-based auto-categorization)
- **models/** — Objection.js models extending `BaseModel` (Transaction, Category, CategorizationRule, Account, ImportLog)
- **parsers/** — OFX parser (SGML→XML→transactions) and CSV parser (Papa Parse, flexible column mapping with presets)
- **validators/** — Zod schemas for request validation
- **plugins/** — Fastify plugins (database connection via Knex)
- **migrations/** — Knex migrations (PostgreSQL)

### Frontend (`frontend/src/`)

- **App.tsx** — React Router with 5 pages wrapped in a shared Layout
- **pages/** — Dashboard, Transactions, Categories, Rules, Upload
- **services/api.ts** — Typed API client built on Axios (`apiClient.ts` base instance)
- **types/** — TypeScript interfaces for data models
- **components/** — Shared UI (Layout with sidebar, ErrorBoundary)

### Key Patterns

- **Deduplication**: Transactions use `external_id` (OFX FITID or CSV-generated hash) to prevent duplicate imports
- **Auto-categorization**: Priority-ordered rules with match types: substring, regex, exact. Applied during import and via `POST /api/rules/apply`
- **Category deletion**: Foreign key ON DELETE SET NULL — deleting a category sets `transactions.category_id = NULL`
- **Enums**: `transaction_type` (income/expense), `transaction_source` (ofx/csv/manual) defined in migrations

### Database

PostgreSQL 16 with Knex query builder + Objection.js ORM. Config in `backend/src/knexfile.ts` (supports dev/test/production environments via `DATABASE_URL` / `TEST_DATABASE_URL`).

Tables: categories, accounts, transactions, categorization_rules, import_logs.

### API Base Path

All API routes are under `/api/*`. Frontend Vite dev server proxies `/api` requests to the backend.

## Code Style

- TypeScript strict mode in both backend and frontend
- Prettier: 90 char width, single quotes, trailing commas, semicolons
- ESLint: unused vars prefixed with `_` are allowed
- Backend compiles to CommonJS (ES2022 target); frontend uses ESNext modules
