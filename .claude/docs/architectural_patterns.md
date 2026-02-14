# Architectural Patterns

Patterns and conventions observed across multiple files in the DogTown codebase.

## 1. Module-Level Singleton for Database Access

Prisma client is instantiated once in `backend/src/index.ts:10` and exported. All routes and services import this single instance:
- `backend/src/services/availability.ts:1`
- `backend/src/routes/auth.ts:4`
- `backend/src/routes/dogs.ts:4`
- `backend/src/routes/bookings.ts:4`
- `backend/src/routes/admin.ts:4`

No DI container — dependencies are visible through explicit named imports.

## 2. Layered Architecture: Routes → Services → ORM

Routes handle HTTP concerns (parsing, responses). Business logic lives in services. Data access uses Prisma directly.

- Routes import services: `backend/src/routes/bookings.ts:5-6` imports both `checkAvailability` and `calculatePrice`
- Services import Prisma: `backend/src/services/availability.ts:1`, `backend/src/services/pricing.ts:1`
- Routes also access Prisma for simple CRUD: `backend/src/routes/dogs.ts:20-23`

Convention: extract to a service when logic involves multiple queries or complex calculations. Simple CRUD stays in routes.

## 3. Zod Schema Validation at API Boundary

Every route that accepts user input defines a Zod schema and validates early in the handler:
- `backend/src/routes/auth.ts:10-20` — registerSchema and loginSchema
- `backend/src/routes/dogs.ts:8-15` — dogSchema
- `backend/src/routes/bookings.ts:10-27` — bookingSchema, availabilitySchema, priceCalcSchema
- `backend/src/routes/admin.ts:10-14` — specialPeriodSchema

Pattern: call `schema.parse(req.body)` at the top of the handler, catch `z.ZodError` to return 400.

## 4. Error Handling: Type-Specific Catch Blocks

Every route handler follows this pattern:
```
try {
  // validate with Zod → business logic → respond
} catch (error) {
  if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors })
  res.status(500).json({ error: 'Generic message' })
}
```

Seen in:
- `backend/src/routes/auth.ts:64-69`
- `backend/src/routes/dogs.ts:72-77`
- `backend/src/routes/bookings.ts:70-75`
- `backend/src/routes/admin.ts:40-45`

Business validation returns early with specific status codes (400, 404) before the try-catch.

## 5. JWT Auth via httpOnly Cookies + Middleware Chain

Token lifecycle:
- **Sign:** `backend/src/utils/jwt.ts:11-13` — payload is `{ userId, role }`, 7-day expiry
- **Set cookie:** `backend/src/routes/auth.ts:56-61` (login) and `auth.ts:93-98` (register) — httpOnly, secure in production, sameSite lax
- **Verify:** `backend/src/middleware/auth.ts:12-26` — `requireAuth` reads cookie, verifies, attaches `req.user`
- **Admin check:** `backend/src/middleware/auth.ts:28-46` — `requireAdmin` extends `requireAuth`, checks role

Route protection: `requireAuth` is applied per-route in dogs/bookings routers. `requireAdmin` is applied to the entire admin router at `backend/src/routes/admin.ts:9`.

## 6. Frontend Auth via Context API

- `frontend/src/hooks/useAuth.tsx:5-13` — AuthContext with `user`, `login`, `register`, `logout`
- `frontend/src/hooks/useAuth.tsx:15-46` — AuthProvider fetches `/api/auth/me` on mount to restore session
- `frontend/src/App.tsx:22-42` — `ProtectedRoute` component checks user/role, redirects to `/login`

All pages within protected routes access auth via `useAuth()` hook.

## 7. Frontend State: Local useState + useEffect Fetching

No global state management beyond auth. Each page manages its own data:
- `frontend/src/pages/client/DashboardPage.tsx:14-26` — fetches dogs and bookings on mount
- `frontend/src/pages/client/DogsPage.tsx` — local state for dog list, add/edit dialogs
- `frontend/src/pages/admin/RatesPage.tsx:14-30` — fetches rates, manages edit state locally

Pattern: `useState` for data + loading + error, `useEffect` with empty deps for initial fetch, callbacks for mutations that re-fetch after success.

## 8. API Client: Generic Typed Request Wrapper

`frontend/src/services/api.ts:5-21` — single `request<T>` function handles all HTTP calls:
- Accepts method, url, optional body
- Sets `Content-Type: application/json` and `credentials: 'include'`
- Parses error responses and throws `Error` with server message
- All endpoint functions specify return type: e.g., `request<{ user: User }>` at `api.ts:26`

This ensures type-safe API consumption and centralized error extraction.

## 9. Prisma Select for Response Shaping

Sensitive fields (passwordHash) are excluded from responses using explicit `select`:
- `backend/src/routes/auth.ts:44-51` — login response selects id, email, name, phone, role
- `backend/src/routes/auth.ts:130-137` — `/me` endpoint uses same select pattern
- `backend/src/routes/admin.ts:17-25` — admin user list includes `_count` for related records

Convention: always use `select` when returning user data; never return the full Prisma model.

## 10. REST Conventions + Action Endpoints

Standard CRUD follows REST verbs (see `backend/src/routes/dogs.ts`):
- `GET /` list, `GET /:id` detail, `POST /` create, `PUT /:id` update, `DELETE /:id` delete

Complex operations get custom action endpoints:
- `POST /api/bookings/check-availability` — `backend/src/routes/bookings.ts:53`
- `POST /api/bookings/calculate-price` — `backend/src/routes/bookings.ts:79`
- `PATCH /api/bookings/:id/cancel` — `backend/src/routes/bookings.ts:173`

Convention: use POST for queries with complex input, PATCH for partial state changes.

## 11. UI Component Composition with Variants

UI components use class-variance-authority for variant props:
- `frontend/src/components/ui/Button.tsx` — variant (default/destructive/outline/ghost) + size (sm/default/lg)
- `frontend/src/components/ui/Badge.tsx` — variant-based styling

All UI components accept `className` and merge it using `cn()` from `frontend/src/utils/cn.ts` (clsx + tailwind-merge). This allows per-instance Tailwind overrides.

Card uses subcomponent composition: `Card`, `CardHeader`, `CardTitle`, `CardContent` as separate exports from `frontend/src/components/ui/Card.tsx`.

## 12. Type Definitions: Interfaces + Literal Unions (No Enums)

Types use `interface` for object shapes and string literal unions for discriminants:
- `frontend/src/types/index.ts:27-28` — `'HOTEL' | 'DAYCARE'` for booking type
- `backend/src/routes/bookings.ts:11` — `z.enum(['HOTEL', 'DAYCARE'])` mirrors this
- `backend/src/services/pricing.ts:3-4` — type aliases for PeriodType and BookingType

Convention: no TypeScript `enum` keyword used anywhere. Zod `.enum()` provides runtime validation; TypeScript literal unions provide compile-time safety.
