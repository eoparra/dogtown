# Architectural Patterns

This document outlines the key architectural patterns, design decisions, and conventions used across the DogTown codebase.

## Backend Patterns

### Service Layer Pattern

Business logic is extracted into dedicated service modules rather than living in route handlers:

- **Availability Service** (`backend/src/services/availability.ts`): Encapsulates capacity checking logic across date ranges
- **Pricing Service** (`backend/src/services/pricing.ts`): Handles dynamic pricing calculations with special period prioritization

Route handlers remain thin, focusing on request/response transformation and calling services.

### Middleware-Based Security

Authentication and authorization implemented as composable Express middleware:

- `requireAuth` middleware (`backend/src/middleware/auth.ts:7`): Validates JWT from cookies, extracts user to `req.user`
- `requireAdmin` middleware (`backend/src/middleware/auth.ts:30`): Extends `requireAuth` with role-based access control
- TypeScript augmentation of Express Request interface for type safety (`backend/src/middleware/auth.ts:3-6`)

Apply middleware per-route or per-router for granular access control.

### Request Validation with Zod

All user input validated using Zod schemas before processing:

- Define schema inline or import from shared module (see `backend/src/routes/auth.ts:8-27`)
- Use `schema.parse()` in try/catch for type-safe validation
- Return detailed validation errors as arrays to frontend
- Extracted types from schemas for TypeScript inference

Pattern used consistently across all POST/PUT endpoints.

### Database Access Pattern

Prisma ORM used for all database operations:

- Single PrismaClient instance exported from main server file (`backend/src/index.ts:7`)
- Imported as `prisma` in all route handlers
- Leverages type-safe query builder and auto-generated types
- Transaction support with `prisma.$transaction()` when needed

### Error Handling Convention

Consistent error handling across routes:

- Validation errors: 400 with detailed error arrays
- Authentication failures: 401 with message
- Authorization failures: 403 with message
- Not found: 404 with message
- Server errors: 500 with generic message (details logged to console)

See `backend/src/routes/auth.ts:47-51` for reference pattern.

## Frontend Patterns

### Context-Based State Management

Global authentication state managed via React Context API:

- `AuthProvider` wraps entire app (`frontend/src/hooks/useAuth.tsx:22`)
- Provides: `user`, `loading`, `login()`, `register()`, `logout()`
- Initializes on mount by fetching current user from `/api/auth/me`
- Stores user object in state, not tokens (cookies are httpOnly)

Use `useAuth()` hook in any component to access auth state.

### Protected Route Pattern

Route-level access control using wrapper components:

- `ProtectedRoute` (`frontend/src/App.tsx:15`): Redirects to login if not authenticated, optionally checks admin role
- `PublicRoute` (`frontend/src/App.tsx:32`): Redirects authenticated users away from login/register pages
- Prevents unauthorized access without conditional rendering in components

Apply as route element wrapper in router configuration.

### Centralized API Service

All HTTP requests channeled through centralized API client:

- Single `api.ts` module (`frontend/src/services/api.ts`)
- Namespaced methods: `api.auth.*`, `api.dogs.*`, `api.bookings.*`, `api.admin.*`
- Generic `request<T>()` wrapper handles credentials, parsing, errors
- TypeScript return types for all endpoints

Never use `fetch()` directly in components—always use API service.

### Component Composition

UI built from composable, reusable components:

- Low-level UI primitives in `frontend/src/components/ui/` (Button, Input, Card, etc.)
- Layout components for consistent navigation (ClientLayout, AdminLayout at `frontend/src/components/Layout.tsx`)
- Page components correspond 1:1 with routes
- Radix UI used for complex components (Dialog, Dropdown, Select)

Follow established component patterns when adding new UI.

### TypeScript Type Sharing

Single source of truth for entity types:

- All interfaces defined in `frontend/src/types/index.ts`
- Match Prisma schema entities exactly
- Used throughout components, services, and state
- API service methods return typed responses

Keep types synchronized when modifying database schema.

## Cross-Cutting Patterns

### Authentication Flow

JWT-based authentication with httpOnly cookies:

- Tokens issued on login/register (`backend/src/routes/auth.ts:62`)
- Stored in httpOnly cookies with 7-day expiration
- sameSite: 'lax' policy for CSRF protection
- Frontend reads user from `/api/auth/me`, not from token
- Logout clears cookie server-side

Never store tokens in localStorage or expose them to JavaScript.

### Date Normalization

Consistent date handling across client and server:

- Server normalizes all dates to 00:00:00 UTC (`backend/src/services/availability.ts:16`)
- Range queries use Prisma `gte`/`lt` operators for inclusive/exclusive bounds
- ISO string format for API transport
- Frontend uses `date-fns` for manipulation and `react-day-picker` for UI

Always normalize before database operations to prevent timezone bugs.

### Dynamic Pricing Logic

Special period-based pricing with priority system:

1. Find all SpecialPeriods overlapping booking dates (`backend/src/services/pricing.ts:8`)
2. Assign each date the highest priority period: VACATION > HOLIDAY > LONG_WEEKEND > REGULAR
3. Look up rate for that period type from HotelRate table
4. Sum across all nights (hotel) or days (daycare)

Regular periods created implicitly for dates without special periods.

### Availability Checking

Capacity-based availability with conflict prevention:

1. Check per-date capacity limits (`backend/src/services/availability.ts:31`)
2. Count existing confirmed bookings overlapping each date
3. Reject if capacity exceeded on any date
4. Prevent dog-level conflicts (no overlapping bookings for same dog at `backend/src/routes/bookings.ts:46`)

Called both in availability preview and booking creation.

### Database Seeding Pattern

Idempotent seed script for repeatable setup:

- Uses upsert operations to avoid duplicates (`backend/prisma/seed.ts:8,18,25`)
- Creates admin user with known credentials
- Sets up default rates and capacity
- Adds sample special periods
- Can be run multiple times safely

Run `npm run db:seed` after schema changes to refresh test data.

## Conventions

### Naming Conventions

- **Routes**: Plural resource names (`/api/dogs`, `/api/bookings`)
- **Components**: PascalCase with descriptive suffixes (LoginPage, DogsPage, DashboardPage)
- **Files**: Match component/function name exactly
- **Database fields**: camelCase matching Prisma conventions
- **API responses**: JSON with camelCase keys

### File Organization

- Group by feature/domain, not by technical role
- Backend routes in separate files per resource
- Frontend pages mirror route structure
- Shared utilities in `utils/` directories
- UI components separate from page components

### Code Style

Enforced by linters—no manual guidelines needed. Run linters before committing.

## Scalability Considerations

### Current Architecture Limitations

- **SQLite**: Development database, should migrate to PostgreSQL for production
- **No caching**: All requests hit database directly
- **No background jobs**: All processing synchronous in request handlers
- **No real-time updates**: Clients must poll for changes

### Future Enhancement Patterns

When scaling becomes necessary:

- Add Redis for session storage and caching
- Implement WebSocket for real-time booking updates
- Extract email/notifications to background job queue
- Add database read replicas for query scaling
- Implement rate limiting middleware
- Add comprehensive logging (Winston/Pino)
- Set up monitoring and health checks

These patterns are battle-tested for similar full-stack applications and should inform future development decisions.
