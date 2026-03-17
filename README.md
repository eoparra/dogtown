# DogTown - Dog Hotel & Daycare MVP

A full-stack web application for managing a dog hotel and daycare service. Built with Express.js, Prisma, React, and TypeScript.

## Features

### Client App
- User registration and authentication
- Dog profile management (add, edit, delete dogs)
- Vaccination information tracking
- Hotel booking (overnight stays)
- Daycare booking (daily care)
- Real-time availability checking
- Dynamic pricing based on special periods
- Booking history and cancellation

### Admin Backoffice
- Dashboard with quick stats
- User management
- All dogs overview and editing
- Booking management (view, cancel, delete)
- Rate configuration (hotel rates by period type, daycare fixed rate)
- Capacity settings (hotel and daycare limits)
- Special period management (holidays, long weekends, vacation seasons)

## Tech Stack

- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL (SQLite for quick local dev)
- **Frontend**: React, Vite, TypeScript, Tailwind CSS
- **Auth**: JWT with httpOnly cookies

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL 14+ (or Docker for local development)

### Installation

1. Clone the repository and navigate to the project:
   ```bash
   cd dogtown
   ```

2. **Set up PostgreSQL** (choose one option):

   **Option A: Using Docker (Recommended)**
   ```bash
   docker-compose up -d
   ```

   **Option B: Local PostgreSQL**
   - Install PostgreSQL and create database (see [DEPLOYMENT.md](./DEPLOYMENT.md))

3. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```

4. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env if needed (Docker setup works with defaults)
   ```

5. Set up the database:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

6. Install frontend dependencies (in a new terminal):
   ```bash
   cd frontend
   npm install
   ```

### Running the Application

1. Start the backend server:
   ```bash
   cd backend
   npm run dev
   ```
   The API will be available at `http://localhost:3001`

2. Start the frontend (in a new terminal):
   ```bash
   cd frontend
   npm run dev
   ```
   The app will be available at `http://localhost:5173`

### Admin Bootstrap Credentials

- In development, `npm run db:seed` prints one-time generated admin credentials.
- In production, you must provide `ADMIN_EMAIL` and `ADMIN_PASSWORD` (strong password) before running the seed.
- If you need to rotate away from `admin@dogtown.com`, run: `npm run admin:bootstrap -- --email=ops-admin@yourdomain.com --delete-default-admin`
## Project Structure

```
dogtown/
├── backend/
│   ├── src/
│   │   ├── routes/          # API routes (auth, dogs, bookings, admin)
│   │   ├── services/        # Business logic (availability, pricing)
│   │   ├── middleware/      # Auth middleware
│   │   └── utils/           # JWT utilities
│   └── prisma/
│       ├── schema.prisma    # Database schema
│       └── seed.ts          # Seed data script
├── frontend/
│   └── src/
│       ├── components/      # Reusable UI components
│       ├── pages/
│       │   ├── client/      # Client-facing pages
│       │   └── admin/       # Admin backoffice pages
│       ├── hooks/           # React hooks (auth)
│       ├── services/        # API client
│       ├── types/           # TypeScript types
│       └── utils/           # Utility functions
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Dogs (Client)
- `GET /api/dogs` - List user's dogs
- `POST /api/dogs` - Create dog
- `GET /api/dogs/:id` - Get dog details
- `PUT /api/dogs/:id` - Update dog
- `DELETE /api/dogs/:id` - Delete dog

### Bookings (Client)
- `GET /api/bookings` - List user's bookings
- `POST /api/bookings/check-availability` - Check availability
- `POST /api/bookings/calculate-price` - Calculate price
- `POST /api/bookings` - Create booking
- `PATCH /api/bookings/:id/cancel` - Cancel booking

### Admin
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/users` - List all users
- `GET /api/admin/users/:id/dogs` - Get user's dogs
- `GET/PUT/DELETE /api/admin/dogs/:id` - Manage dogs
- `GET/PUT/DELETE /api/admin/bookings` - Manage bookings
- `GET/PUT /api/admin/rates` - Manage rates
- `GET/PUT /api/admin/capacity` - Manage capacity
- `CRUD /api/admin/special-periods` - Manage special periods

## Business Logic

### Availability Checking
- Hotel: Checks capacity for each night in the booking period
- Daycare: Checks capacity for each day
- A dog cannot have overlapping bookings (hotel + daycare at the same time)

### Pricing
- **Hotel**: Dynamic pricing based on special periods
  - Regular rate (default)
  - Holiday rate
  - Long weekend rate
  - Vacation rate
- **Daycare**: Fixed rate year-round

### Booking Validation
- Dog must have vaccination information
- Dates must be valid (check-in before check-out, not in the past)
- Capacity must be available
- No overlapping bookings for the same dog

## Production Deployment

The app is deployed on **Railway** with managed PostgreSQL. Set the following environment variables in Railway:

- `DATABASE_URL` — Railway provides this automatically when you add a PostgreSQL plugin
- `JWT_SECRET` — generate with `openssl rand -base64 32`
- `NODE_ENV=production`
- `CORS_ORIGIN` — your Railway frontend URL (e.g. `https://dogtown.up.railway.app`)

## License

MIT
