#!/bin/bash
set -euo pipefail

# Only run in Claude Code on the web
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo "🐕 Setting up DogTown development environment..."

# Navigate to project root
cd "$CLAUDE_PROJECT_DIR"

# Backend setup
echo "📦 Installing backend dependencies..."
cd backend
npm install --prefer-offline --no-audit

echo "🗄️  Setting up database..."
npm run db:generate
npm run db:push
npm run db:seed

# Frontend setup
echo "⚛️  Installing frontend dependencies..."
cd ../frontend
npm install --prefer-offline --no-audit

# Return to project root
cd "$CLAUDE_PROJECT_DIR"

echo "✅ DogTown environment ready!"
echo "   - Backend: http://localhost:3001"
echo "   - Frontend: http://localhost:5173"
echo "   - Admin login: admin@dogtown.com / admin123"
