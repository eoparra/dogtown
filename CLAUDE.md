# DogTown - Dog Hotel & Daycare Management System

## What This Is

A full-stack TypeScript web application for managing a dog hotel and daycare business. Two interfaces:

- **Client App**: Dog owners register, manage dog profiles, book hotel/daycare services, track bookings
- **Admin Backoffice**: Manage users, view all bookings, configure pricing rates, set capacity limits, define special periods

Core business features include dynamic pricing by period (regular/holiday/vacation), capacity management per date, vaccination tracking, and dual booking types (overnight hotel vs daily daycare).

## Tech Stack

**Backend**: Node.js + Express + TypeScript + Prisma ORM + PostgreSQL + JWT auth + Zod validation + Helmet + Rate Limiting

**Frontend**: React + TypeScript + Vite + Tailwind CSS + Radix UI + React Router

**Key Libraries**: bcryptjs (passwords), date-fns (dates), react-day-picker (calendar), jsonwebtoken (auth)

## Project Structure

```
dogtown/
├── backend/                          # Express API server
│   ├── src/
│   │   ├── index.ts                  # Server entry, middleware setup
│   │   ├── routes/                   # API endpoints by resource
│   │   │   ├── auth.ts               # Login, register, logout, /me
│   │   │   ├── dogs.ts               # Dog CRUD with ownership checks
│   │   │   ├── bookings.ts           # Booking creation, availability
│   │   │   └── admin.ts              # Admin-only endpoints (rates, capacity, users)
│   │   ├── middleware/
│   │   │   └── auth.ts               # JWT validation, role checks
│   │   ├── services/                 # Business logic layer
│   │   │   ├── availability.ts       # Capacity checking across date ranges
│   │   │   └── pricing.ts            # Dynamic pricing by special periods
│   │   └── utils/
│   │       └── jwt.ts                # Token sign/verify helpers
│   └── prisma/
│       ├── schema.prisma             # Database schema (8 models)
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

After seeding, admin login:
- Email: `admin@dogtown.com`
- Password: `Admin123`

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
- Database: SQLite for dev (easily upgradeable to PostgreSQL for production)
- Prisma Client regenerates after schema changes—run `npm run db:generate`

## Additional Documentation

When working on specific aspects, consult these guides in `.claude/docs/`:

- **[architectural_patterns.md](.claude/docs/architectural_patterns.md)**: Core design patterns (service layer, middleware-based security, context state management, protected routing, centralized API client, date handling, pricing logic, availability checking, seeding pattern)

These documents provide deeper context on conventions and patterns observed across the codebase.
