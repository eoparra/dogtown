---
name: local-dev
description: Start the full DogTown local development environment (PostgreSQL, backend, frontend)
disable-model-invocation: true
allowed-tools: Bash(docker *), Bash(cd *), Bash(npm *), Bash(npx *)
---

Start the full local development environment for DogTown. Run these 3 steps:

## Step 1: Start PostgreSQL via Docker Compose

```bash
cd /Users/omar/claude/dogtown && docker compose up -d
```

Wait for the database to be healthy before proceeding.

## Step 2: Backend — migrate, seed, and start dev server

```bash
cd /Users/omar/claude/dogtown/backend && npx prisma migrate dev --name auto && npm run db:seed && npm run dev
```

Run the migration, seed the database, then start the backend dev server on port 3001. Run `npm run dev` in the background so it stays running.

## Step 3: Frontend — start dev server

```bash
cd /Users/omar/claude/dogtown/frontend && npm run dev
```

Start the frontend dev server on port 5173. Run in the background so it stays running.

## After starting

Confirm both servers are running and report:
- Backend: http://localhost:3001 (health check: http://localhost:3001/api/health)
- Frontend: http://localhost:5173
- Admin login: admin@dogtown.com / Admin123
