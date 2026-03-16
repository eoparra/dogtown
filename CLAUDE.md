# DogTown - Dog Hotel & Daycare Management System

## What This Is

A full-stack TypeScript web application for managing a dog hotel and daycare business. Two interfaces:

- **Client App**: Dog owners register, manage dog profiles, book hotel/daycare services, track bookings
- **Admin Backoffice**: Manage users, view all bookings, configure pricing rates, set capacity limits, define special periods

Core business features include dynamic pricing by period (regular/holiday/vacation), capacity management per date, vaccination tracking, and dual booking types (overnight hotel vs daily daycare).

## Tech Stack

**Backend**: Node.js + Express + TypeScript + Prisma ORM + PostgreSQL + JWT auth + Zod validation

**Frontend**: React + TypeScript + Vite + Tailwind CSS + Radix UI + React Router

**Key Libraries**: bcryptjs (passwords), date-fns (dates), react-day-picker (calendar), jsonwebtoken (auth)

## Project Structure

```
dogtown/
├── backend/                          # Express API server
│   ├── src/
│   │   ├── index.ts                  # Server entry point — calls app.listen() only
│   │   ├── app.ts                    # Express app setup (middleware, routes, health check)
│   │   ├── db.ts                     # Prisma client singleton
│   │   ├── routes/                   # API endpoints by resource
│   │   │   ├── auth.ts               # Login, register, logout, /me
│   │   │   ├── dogs.ts               # Dog CRUD with ownership checks
│   │   │   ├── bookings.ts           # Booking creation, availability
│   │   │   ├── admin.ts              # Admin-only endpoints (rates, capacity, users)
│   │   │   └── inventory.ts          # Admin inventory management
│   │   ├── middleware/
│   │   │   └── auth.ts               # JWT validation, role checks
│   │   ├── services/                 # Business logic layer
│   │   │   ├── availability.ts       # Capacity checking across date ranges
│   │   │   └── pricing.ts            # Dynamic pricing by special periods
│   │   ├── test-helpers/
│   │   │   └── index.ts              # Shared test utilities (testPrisma, fixtures, auth helpers)
│   │   └── utils/
│   │       └── jwt.ts                # Token sign/verify helpers
│   └── prisma/
│       ├── schema.prisma             # Database schema (10 models)
│       └── seed.ts                   # Initial data seeding
│
└── frontend/                         # React SPA
    ├── src/
    │   ├── main.tsx                  # React entry point
    │   ├── App.tsx                   # Router with protected routes
    │   ├── components/
    │   │   ├── Layout.tsx            # ClientLayout, AdminLayout
    │   │   └── ui/                   # Reusable UI components (shadcn-style)
    │   ├── pages/
    │   │   ├── client/               # Client-facing pages (dashboard, dogs, bookings)
    │   │   └── admin/                # Admin pages (users, rates, capacity, periods)
    │   ├── services/
    │   │   └── api.ts                # Centralized API client
    │   ├── hooks/
    │   │   └── useAuth.tsx           # Auth context provider
    │   └── types/
    │       └── index.ts              # TypeScript interfaces for all entities
    └── vite.config.ts                # Dev server with API proxy
```

### Directory Purposes

- **backend/src/routes/**: Each file handles one resource domain; use Zod for validation
- **backend/src/services/**: Extract complex business logic here (not in routes)
- **backend/src/middleware/**: Reusable request interceptors (auth checks)
- **backend/prisma/**: Database schema and migrations; source of truth for data model
- **frontend/src/pages/**: One component per route; organized by user role
- **frontend/src/components/ui/**: Low-level reusable UI primitives
- **frontend/src/services/**: API client layer; never use fetch() directly in components
- **frontend/src/hooks/**: Custom React hooks; useAuth provides global auth state
- **frontend/src/types/**: TypeScript definitions matching Prisma schema

## Essential Commands

**Backend**: `cd backend && npm install && npm run db:push && npm run db:seed && npm run dev` (port 3001)
**Frontend**: `cd frontend && npm install && npm run dev` (port 5173)

**Database**: `npm run db:generate` (after schema changes), `npm run db:migrate`, `npm run db:studio`, `npm run db:seed`
**Production**: Backend `npm run build && npm start`, Frontend `npm run build && npm run preview`

## Default Credentials

After seeding, the admin password is **randomly generated** and printed once to the terminal:

```
  Admin credentials (save these, shown only once):
  Email:    admin@dogtown.com
  Password: <random>
```

To reset: `cd backend && npx prisma db push --force-reset && npm run db:seed`

## Key Files Reference

### Authentication Flow
- Backend JWT middleware: `backend/src/middleware/auth.ts:7` (requireAuth), `:30` (requireAdmin)
- Frontend auth context: `frontend/src/hooks/useAuth.tsx:22` (AuthProvider)
- Protected routes: `frontend/src/App.tsx:15` (ProtectedRoute wrapper)

### Business Logic
- Availability checking: `backend/src/services/availability.ts:31` (checkAvailability)
- Dynamic pricing: `backend/src/services/pricing.ts:8` (calculateBookingPrice)
- Date normalization: `backend/src/services/availability.ts:16` (normalizeToUTCMidnight)

### API Integration
- Centralized API client: `frontend/src/services/api.ts:12` (request wrapper)
- API endpoint namespaces: `:29` (auth), `:40` (dogs), `:66` (bookings), `:96` (admin)

### Database
- Schema definition: `backend/prisma/schema.prisma:1`
- Seed script: `backend/prisma/seed.ts:1`

### Validation Examples
- Registration schema: `backend/src/routes/auth.ts:8`
- Dog creation schema: `backend/src/routes/dogs.ts:6`
- Booking creation schema: `backend/src/routes/bookings.ts:13`

## Development Notes

- Backend runs on port **3001**, frontend on **5173**
- Frontend proxies `/api` requests to backend (see `frontend/vite.config.ts:8`)
- All dates normalized to UTC midnight server-side to prevent timezone issues
- JWT tokens stored in httpOnly cookies (7-day expiration)
- Database: PostgreSQL (Docker container `dogtown-postgres`, user `dogtown`, dev DB `dogtown_dev`)
- Prisma Client regenerates after schema changes—run `npm run db:generate`

## Testing

### Backend Tests

**Framework**: Node.js built-in `node:test` + `supertest` for HTTP integration tests

**Test database**: A separate `dogtown_test` PostgreSQL database (same Docker container). Must be set up once before running tests:

```bash
# One-time setup: create the test database in Docker
docker exec dogtown-postgres psql -U dogtown -d dogtown_dev -c "CREATE DATABASE dogtown_test;"

# Push schema to test DB
cd backend && npm run db:test:setup
```

**Running tests**:
```bash
cd backend && npm test
```

Tests load `backend/.env.test` automatically via `dotenv-cli`. This file points `DATABASE_URL` to `dogtown_test` and sets a test `JWT_SECRET`. It is gitignored.

**Test files**: Co-located with source files as `*.test.ts` (e.g. `src/routes/inventory.test.ts`)

**Test helpers** (`backend/src/test-helpers/index.ts`):
- `testPrisma` — Prisma client for seeding/cleanup in tests
- `createAdminUser()` — upserts a test admin user
- `makeAuthCookies(userId)` — generates a valid JWT + CSRF token pair for authenticated requests
- `cleanupInventory()` — deletes all stock movements then inventory items (respects FK order)
- `inventoryItemFixture(overrides?)` — returns a valid item payload with a unique SKU

**Patterns**:
- CSRF: state-changing requests need `.set('Cookie', cookieHeader)` and `.set('x-csrf-token', csrfToken)`
- When ordering by `createdAt` matters, create DB records sequentially (not with `createMany`) — PostgreSQL uses transaction start time for `now()`, giving batch inserts identical timestamps
- Use `t.before()` / `t.afterEach()` / `t.after()` hooks within nested `t.test()` blocks

### Frontend Tests

**Framework**: Vitest + React Testing Library + jsdom

**Running tests**:
```bash
cd frontend && npm test          # watch mode
cd frontend && npm run test:run  # single run (CI)
cd frontend && npm run test:ui   # visual UI
```

**Test files**: Co-located with source files as `*.test.tsx` (e.g. `src/pages/admin/InventoryPage.test.tsx`)

**Test helpers** (`frontend/src/test-helpers/`):
- `setup.ts` — imported by Vitest automatically; extends `@testing-library/jest-dom` matchers, stubs `window.matchMedia` and `ResizeObserver` (not in jsdom)
- `render.tsx` — exports `renderWithRouter()` (wraps in `MemoryRouter`) for components that use routing hooks; re-exports all of `@testing-library/react`

**API mocking**: `vi.mock('@/services/api', () => ({ admin: { ... } }))` at the top of the test file. All API calls flow through `src/services/api.ts`, so mocking this one module covers the entire page.

**Patterns**:
- Use `userEvent.setup()` inside each test (or `beforeEach`) for pointer/keyboard interactions
- `screen.findBy*` (async) after render for content that appears after API calls resolve
- `screen.getByText(/regex/)` for text split across elements (e.g. `SKU: FOOD-001`)
- For multiple elements with the same text, use `getAllByText()` or query a parent with `within()`
- `ConfirmDialog` (Radix `Dialog`) renders to `document.body` via Portal — use `screen.findByRole('dialog')` (not `alertdialog`); `screen` queries the full document so portal content is found automatically
- The stock movement overlay is a plain `div` (not a portal) — query it directly with `screen`

## Custom Skills

The following custom skills are available in `.claude/skills/`:

- **feature-branch-workflow** (`/feature-branch-workflow`): Manages the git feature branch workflow — creating branches, committing, and opening PRs following project conventions.

## Additional Documentation

When working on specific aspects, consult these guides in `.claude/docs/`:

- **[architectural_patterns.md](.claude/docs/architectural_patterns.md)**: Core design patterns (service layer, middleware-based security, context state management, protected routing, centralized API client, date handling, pricing logic, availability checking, seeding pattern)

These documents provide deeper context on conventions and patterns observed across the codebase.
