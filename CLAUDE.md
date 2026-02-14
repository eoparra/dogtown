# DogTown - Dog Hotel & Daycare MVP

Full-stack web application for managing a dog hotel and daycare service. Provides client-facing booking/dog management and an admin backoffice for business operations.

## Tech Stack

- **Backend:** Node.js 18+ / Express.js / TypeScript 5.3
- **Frontend:** React 18 / Vite 5 / TypeScript 5.3 / Tailwind CSS 3.4
- **Database:** SQLite via Prisma 5.10 ORM
- **Auth:** JWT (jsonwebtoken) stored in httpOnly cookies, bcryptjs for password hashing
- **Validation:** Zod (runtime) + TypeScript (compile-time)
- **UI Components:** Radix UI primitives, lucide-react icons, class-variance-authority

## Project Structure

```
backend/
  src/
    index.ts              # Express app entry point (port 3001)
    routes/               # API route handlers (auth, dogs, bookings, admin)
    services/             # Business logic (availability, pricing)
    middleware/auth.ts     # requireAuth, requireAdmin middleware
    utils/jwt.ts          # Token signing/verification
  prisma/
    schema.prisma         # Database schema (8 models)
    seed.ts               # Seed data (admin@dogtown.com / admin123)
    dev.db                # SQLite database file

frontend/
  src/
    App.tsx               # Router configuration + ProtectedRoute wrapper
    main.tsx              # React entry point
    components/
      Layout.tsx          # ClientLayout and AdminLayout
      ui/                 # Reusable primitives (Button, Card, Badge, Input, Select, Dialog)
    pages/
      client/             # Login, Register, Dashboard, Dogs, Bookings, NewBooking
      admin/              # Dashboard, Users, Dogs, Bookings, Rates, Capacity, Periods
    hooks/useAuth.tsx     # AuthContext provider + useAuth hook
    services/api.ts       # Typed API client with generic request<T> wrapper
    types/index.ts        # Shared TypeScript interfaces (User, Dog, Booking, rates, etc.)
    utils/cn.ts           # Tailwind class merging utility (clsx + tailwind-merge)
```

## Build & Run Commands

### Backend (`cd backend`)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server with auto-reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production server |
| `npm run db:push` | Sync Prisma schema to database |
| `npm run db:migrate` | Create and run database migrations |
| `npm run db:seed` | Seed database with initial data |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:studio` | Open Prisma Studio GUI |

### Frontend (`cd frontend`)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server (port 5173, proxies `/api` to backend) |
| `npm run build` | TypeScript check + Vite production build |
| `npm run preview` | Preview production build locally |

### First-time Setup

```sh
cd backend && npm install && npm run db:push && npm run db:seed
cd ../frontend && npm install
# Then run `npm run dev` in both backend/ and frontend/ directories
```

## Environment Variables

| Variable | Default | Used In |
|----------|---------|---------|
| `PORT` | `3001` | `backend/src/index.ts:13` |
| `NODE_ENV` | — | Cookie secure flag in auth routes |
| `JWT_SECRET` | `'dogtown-secret-key-change-in-production'` | `backend/src/utils/jwt.ts:3` |
| `DATABASE_URL` | `file:./dev.db` | `backend/prisma/schema.prisma:7` |

## API Routes Overview

- `POST /api/auth/register|login|logout`, `GET /api/auth/me` — authentication
- `GET|POST /api/dogs`, `GET|PUT|DELETE /api/dogs/:id` — dog CRUD (requires auth)
- `GET|POST /api/bookings`, `PATCH /api/bookings/:id/cancel` — booking CRUD (requires auth)
- `POST /api/bookings/check-availability|calculate-price` — booking utilities
- `/api/admin/*` — admin-only endpoints for users, dogs, bookings, rates, capacity, special periods
- `GET /api/health` — health check

## Database Models

Defined in `backend/prisma/schema.prisma`: User (CLIENT/ADMIN roles), Dog, Booking (HOTEL/DAYCARE types with statuses), HotelRate (per period type), DaycareRate, SpecialPeriod, Capacity.

## Key Business Logic

- **Pricing:** Dynamic hotel rates by period type (REGULAR/HOLIDAY/LONG_WEEKEND/VACATION) in `backend/src/services/pricing.ts`. Daycare uses fixed daily rate.
- **Availability:** Capacity checking and dog conflict detection in `backend/src/services/availability.ts`.
- **Booking validation:** Requires vaccination info, valid date ranges, available capacity, no overlapping bookings for same dog — see `backend/src/routes/bookings.ts:98-168`.

## Frontend Path Alias

`@/*` resolves to `frontend/src/*` — configured in `frontend/vite.config.ts:8-10` and `frontend/tsconfig.json:19-21`.

## No Test Suite

This is an MVP with no tests yet. The service layer separation supports adding tests with minimal refactoring.

## Additional Documentation

Check these files for deeper context when working on specific areas:

- [Architectural Patterns](.claude/docs/architectural_patterns.md) — dependency management, auth flow, error handling, data access, state management, API conventions, and type patterns used across the codebase
