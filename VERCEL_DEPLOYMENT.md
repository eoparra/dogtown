# Vercel Frontend + Separate Backend Deployment Guide

## Current Issue

Your frontend is deployed to Vercel (`dogtown-lime.vercel.app`), but the backend is not deployed anywhere, causing 404 errors.

---

## Solution: Deploy Backend Separately

### Step 1: Deploy Backend (Choose One Platform)

#### **Option A: Deploy to Render.com (Recommended - Free Tier)**

1. **Create account** at [render.com](https://render.com)

2. **Create New Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     ```
     Name: dogtown-backend
     Environment: Node
     Build Command: cd backend && npm install && npx prisma generate && npm run build
     Start Command: cd backend && npm start
     ```

3. **Add Environment Variables** in Render dashboard:
   ```
   DATABASE_URL=<your-postgres-connection-string>
   JWT_SECRET=<generate-random-secret>
   NODE_ENV=production
   PORT=3001
   CORS_ORIGIN=https://dogtown-lime.vercel.app
   ```

4. **Create PostgreSQL Database** (Render):
   - Click "New +" → "PostgreSQL"
   - Copy the Internal Database URL
   - Use it as `DATABASE_URL` in your web service

5. **Deploy** - Render will automatically build and deploy

6. **Run migrations** via Render Shell:
   ```bash
   cd backend
   npx prisma migrate deploy
   npm run db:seed
   ```

7. **Copy your backend URL**: `https://dogtown-backend.onrender.com`

---

#### **Option B: Deploy to Railway.app**

1. **Create account** at [railway.app](https://railway.app)

2. **Create New Project**:
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository

3. **Add PostgreSQL**:
   - Click "New" → "Database" → "PostgreSQL"
   - Railway will automatically set `DATABASE_URL`

4. **Configure Backend Service**:
   - Root Directory: `backend`
   - Build Command: `npm install && npx prisma generate && npm run build`
   - Start Command: `npm start`

5. **Add Environment Variables**:
   ```
   JWT_SECRET=<generate-random-secret>
   NODE_ENV=production
   CORS_ORIGIN=https://dogtown-lime.vercel.app
   ```

6. **Generate Domain** in Railway dashboard

7. **Run migrations**:
   ```bash
   npx prisma migrate deploy
   npm run db:seed
   ```

---

### Step 2: Update Vercel Frontend Configuration

1. **Go to Vercel Dashboard** → Your Project → Settings → Environment Variables

2. **Add Environment Variable**:
   ```
   Name: VITE_API_URL
   Value: https://dogtown-backend.onrender.com
   ```
   (Use your actual backend URL from Step 1)

3. **Redeploy Frontend**:
   - Go to Deployments tab
   - Click "..." → "Redeploy"
   - Or push a new commit to trigger deployment

---

### Step 3: Update Backend CORS

Ensure your backend allows requests from your Vercel domain. This should already be set via the `CORS_ORIGIN` environment variable.

---

## Verify Deployment

1. **Test Backend Health**:
   ```bash
   curl https://dogtown-backend.onrender.com/api/health
   ```

2. **Test Frontend Login**:
   - Visit `https://dogtown-lime.vercel.app`
   - Try logging in with:
     - Email: `admin@dogtown.com`
     - Password: `admin123`

---

## Environment Variables Reference

### Backend (.env on Render/Railway)
```bash
DATABASE_URL=postgresql://user:password@host:5432/database
JWT_SECRET=your-super-secret-jwt-key-change-this
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://dogtown-lime.vercel.app
```

### Frontend (Vercel Environment Variables)
```bash
VITE_API_URL=https://dogtown-backend.onrender.com
```

---

## Troubleshooting

### "Access Denied" / CORS Error
- Check `CORS_ORIGIN` in backend environment variables
- Make sure it matches your Vercel domain exactly

### "Database Connection Failed"
- Verify `DATABASE_URL` is correct
- Check database is running
- Ensure migrations are deployed: `npx prisma migrate deploy`

### "404 Not Found" on API Calls
- Verify `VITE_API_URL` is set in Vercel
- Redeploy frontend after setting environment variable
- Check backend is accessible: `curl <backend-url>/api/health`

### "No Admin User"
- Run seed command on backend: `npm run db:seed`
- Or create admin manually via Prisma Studio

---

## Quick Commands

### Render Shell (Run Migrations)
```bash
cd backend
npx prisma migrate deploy
npm run db:seed
```

### Railway CLI (Run Migrations)
```bash
railway run npx prisma migrate deploy
railway run npm run db:seed
```

### Generate Secure JWT Secret
```bash
openssl rand -base64 32
```

---

## Cost Considerations

- **Render Free Tier**: 750 hours/month, spins down after 15min inactivity
- **Railway Free Tier**: $5 credit/month (usually enough for hobby projects)
- **Vercel Free Tier**: Perfect for frontend hosting

---

## Next Steps

1. ✅ Fix applied to frontend (respects `VITE_API_URL`)
2. 🔲 Deploy backend to Render/Railway
3. 🔲 Set `VITE_API_URL` in Vercel
4. 🔲 Redeploy frontend
5. 🔲 Test login functionality
6. 🔲 Change default admin password!

