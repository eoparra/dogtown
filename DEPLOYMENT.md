# DogTown Deployment Guide

## PostgreSQL Migration & Production Deployment

This guide covers migrating from SQLite to PostgreSQL and deploying DogTown to production.

---

## Table of Contents

1. [Local Development with PostgreSQL](#local-development-with-postgresql)
2. [Database Migration Process](#database-migration-process)
3. [Environment Variables](#environment-variables)
4. [Production Deployment](#production-deployment)
5. [Platform-Specific Guides](#platform-specific-guides)

---

## Local Development with PostgreSQL

### Option 1: Using Docker (Recommended)

1. **Start PostgreSQL with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

2. **Create `.env` file in backend**:
   ```bash
   cd backend
   cp .env.example .env
   ```

3. **Run migrations**:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

### Option 2: Local PostgreSQL Installation

1. **Install PostgreSQL** (Mac/Linux/Windows):
   ```bash
   # macOS (using Homebrew)
   brew install postgresql@15
   brew services start postgresql@15

   # Ubuntu/Debian
   sudo apt-get install postgresql postgresql-contrib

   # Windows: Download from postgresql.org
   ```

2. **Create database and user**:
   ```bash
   psql postgres
   ```
   ```sql
   CREATE DATABASE dogtown_dev;
   CREATE USER dogtown WITH PASSWORD 'password';
   GRANT ALL PRIVILEGES ON DATABASE dogtown_dev TO dogtown;
   \q
   ```

3. **Configure environment**:
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your PostgreSQL credentials
   ```

4. **Run migrations**:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

---

## Database Migration Process

### From SQLite to PostgreSQL

**IMPORTANT**: This migration creates a fresh PostgreSQL database. SQLite data is NOT automatically transferred.

### Step 1: Create Initial Migration

```bash
cd backend
npm run db:migrate
```

When prompted, name the migration: `init_postgresql`

This generates migration files in `backend/prisma/migrations/`

### Step 2: Apply Migration

```bash
npm run db:migrate:deploy
```

### Step 3: Seed Database

```bash
npm run db:seed
```

This creates:
- Admin user (admin@dogtown.com / admin123)
- Default pricing rates
- Capacity settings
- Sample special periods
- Test users with dogs

---

## Environment Variables

### Backend (.env)

Create `backend/.env` with:

```env
# Database
DATABASE_URL="postgresql://dogtown:password@localhost:5432/dogtown_dev"

# JWT Secret (CHANGE IN PRODUCTION!)
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"

# Server
PORT=3001
NODE_ENV=development

# CORS (frontend URL)
CORS_ORIGIN="http://localhost:5173"
```

**Production Requirements**:
- **DATABASE_URL**: Use production PostgreSQL URL (with SSL: `?sslmode=require`)
- **JWT_SECRET**: Generate secure random string (min 32 characters)
- **CORS_ORIGIN**: Set to your frontend domain
- **NODE_ENV**: Set to `production`

### Frontend (.env)

Create `frontend/.env` with:

```env
# API URL
VITE_API_URL=http://localhost:3001
```

**Production**: Set `VITE_API_URL` to your deployed backend URL

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] PostgreSQL database provisioned
- [ ] Environment variables configured
- [ ] JWT_SECRET is secure random string
- [ ] CORS_ORIGIN set to frontend domain
- [ ] DATABASE_URL includes `?sslmode=require`
- [ ] Node.js version matches (v18+)

### General Deployment Steps

1. **Install dependencies**:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Generate Prisma Client**:
   ```bash
   cd backend
   npm run db:generate
   ```

3. **Run migrations**:
   ```bash
   npm run db:migrate:deploy
   ```

4. **Seed database** (first deployment only):
   ```bash
   npm run db:seed
   ```

5. **Build backend**:
   ```bash
   npm run build
   ```

6. **Build frontend**:
   ```bash
   cd ../frontend
   npm run build
   ```

7. **Start server**:
   ```bash
   cd ../backend
   npm start
   ```

---

## Platform-Specific Guides

### Railway

**Best for**: Simplest deployment, automatic CI/CD

1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Create new project**:
   ```bash
   railway init
   ```

3. **Add PostgreSQL**:
   ```bash
   railway add -d postgres
   ```

4. **Deploy backend**:
   ```bash
   cd backend
   railway up
   ```

5. **Set environment variables**:
   ```bash
   railway variables set JWT_SECRET=your-secret-key
   railway variables set CORS_ORIGIN=https://your-frontend.vercel.app
   ```

6. **Deploy frontend to Vercel**:
   ```bash
   cd ../frontend
   vercel --prod
   ```
   Set environment variable: `VITE_API_URL=https://your-backend.railway.app`

---

### Render

**Best for**: Free tier with managed PostgreSQL

#### Backend Deployment

1. **Create PostgreSQL database** on Render dashboard
2. **Create Web Service** (backend):
   - **Build Command**: `npm install && npm run db:generate && npm run build`
   - **Start Command**: `npm run db:migrate:deploy && npm run db:seed && npm start`
   - **Environment Variables**:
     - `DATABASE_URL`: (auto-populated from PostgreSQL)
     - `JWT_SECRET`: your-secret-key
     - `CORS_ORIGIN`: https://your-frontend.onrender.com
     - `NODE_ENV`: production

#### Frontend Deployment

1. **Create Static Site** (frontend):
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
   - **Environment Variables**:
     - `VITE_API_URL`: https://your-backend.onrender.com

---

### Vercel + Render

**Best for**: Optimal frontend performance + reliable backend

1. **Deploy backend to Render** (see above)
2. **Deploy frontend to Vercel**:
   ```bash
   cd frontend
   vercel --prod
   ```
   - Set environment: `VITE_API_URL=https://your-backend.onrender.com`

---

### DigitalOcean App Platform

1. **Create App** from GitHub repository
2. **Add PostgreSQL** managed database
3. **Configure backend component**:
   - **Build Command**: `cd backend && npm install && npm run db:generate && npm run build`
   - **Run Command**: `npm run db:migrate:deploy && npm start`
4. **Configure frontend component**:
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Output Directory**: `frontend/dist`
5. **Set environment variables** in dashboard

---

### Docker Deployment (VPS)

1. **Create Dockerfiles** (see Docker section below)
2. **Build and push images**:
   ```bash
   docker build -t dogtown-backend ./backend
   docker build -t dogtown-frontend ./frontend
   ```
3. **Deploy with docker-compose on VPS**

---

## Docker Configuration

### docker-compose.yml (root directory)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: dogtown
      POSTGRES_PASSWORD: password
      POSTGRES_DB: dogtown_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://dogtown:password@postgres:5432/dogtown_dev
      JWT_SECRET: development-secret-key
      NODE_ENV: development
      CORS_ORIGIN: http://localhost:5173
    depends_on:
      - postgres
    command: sh -c "npm run db:migrate:deploy && npm run db:seed && npm start"

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:3001

volumes:
  postgres_data:
```

---

## Database Management

### Create Migration

```bash
cd backend
npm run db:migrate
# Enter migration name when prompted
```

### Apply Migrations (Production)

```bash
npm run db:migrate:deploy
```

### Reset Database (Development Only!)

```bash
npm run db:migrate:reset
```

### View Database

```bash
npm run db:studio
```

Opens Prisma Studio at http://localhost:5555

---

## Troubleshooting

### Connection Issues

**Error**: `Can't reach database server`
- Check DATABASE_URL format
- Verify PostgreSQL is running
- Check firewall/security group settings
- Ensure SSL mode matches database requirement

### Migration Failures

**Error**: `Migration failed to apply`
- Check database user permissions
- Verify schema compatibility
- Review migration SQL in `prisma/migrations/`
- Try `db:migrate:reset` in development

### Seed Failures

**Error**: `Unique constraint violation`
- Database already seeded
- Drop and recreate database, or skip seeding

### CORS Errors

- Verify `CORS_ORIGIN` matches frontend URL exactly
- Include protocol (https://) and no trailing slash
- Check browser console for actual origin

---

## Security Checklist

- [ ] JWT_SECRET is cryptographically random (32+ chars)
- [ ] DATABASE_URL uses SSL in production (`?sslmode=require`)
- [ ] Environment variables not committed to git
- [ ] Admin password changed from default
- [ ] CORS_ORIGIN restricts to your domain only
- [ ] NODE_ENV=production in production
- [ ] Database backups configured
- [ ] Rate limiting configured (add in future)

---

## Monitoring & Maintenance

### Database Backups

Configure automatic backups on your platform:
- **Railway**: Automatic backups included
- **Render**: Backups on paid plans
- **DigitalOcean**: Enable automatic backups

### Logs

- **Railway**: `railway logs`
- **Render**: View in dashboard
- **Docker**: `docker-compose logs -f`

### Health Checks

The application includes a comprehensive health check endpoint at `/api/health` (implemented in `backend/src/index.ts:31`).

**Example response (healthy):**
```json
{
  "status": "ok",
  "timestamp": "2026-02-15T10:30:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "database": {
    "status": "connected",
    "responseTime": 5
  }
}
```

**Example response (degraded - DB issue):**
```json
{
  "status": "degraded",
  "timestamp": "2026-02-15T10:30:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "database": {
    "status": "disconnected",
    "responseTime": 0
  }
}
```

**Status codes:**
- `200 OK`: All systems operational
- `503 Service Unavailable`: Database connectivity issues

**Use for:**
- Uptime monitoring (UptimeRobot, Pingdom, etc.)
- Container orchestration health probes (Docker, Kubernetes)
- Load balancer health checks
- Application performance monitoring

---

## Next Steps

1. Choose deployment platform
2. Set up PostgreSQL database
3. Configure environment variables
4. Run migrations
5. Deploy backend and frontend
6. Test with admin credentials
7. Change default admin password
8. Configure custom domain (optional)
9. Set up monitoring and backups

---

## Support

For issues:
- Check logs on your platform
- Review environment variables
- Verify database connectivity
- Check CORS configuration
- Review Prisma migration status

Default admin credentials after seeding:
- Email: `admin@dogtown.com`
- Password: `admin123`

**IMPORTANT**: Change admin password immediately after first deployment!
