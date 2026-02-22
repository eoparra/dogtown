import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { config, isProduction } from './config.js';
import authRoutes from './routes/auth.js';
import dogsRoutes from './routes/dogs.js';
import bookingsRoutes from './routes/bookings.js';
import adminRoutes from './routes/admin.js';

export const prisma = new PrismaClient();

const app = express();
const PORT = config.PORT || 3001;
const startTime = Date.now();

// CORS configuration - strict allowlist in production
const allowedOrigins = config.CORS_ORIGIN
  ? config.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean)
  : (isProduction ? [] : ['http://localhost:5173']);

if (isProduction && allowedOrigins.length === 0) {
  throw new Error('CORS_ORIGIN must be configured in production');
}

// Middleware
app.use(helmet({
  contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, false);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    if (!isProduction) {
      // Allow preview deploys only outside production
      const isDogTownVercelPreview = /^https:\/\/dogtown(-[a-z0-9]+)?\.vercel\.app$/.test(origin);
      if (isDogTownVercelPreview) {
        callback(null, true);
        return;
      }
    }

    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Global rate limiter
app.use(rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
}));

// CSRF protection: require X-Requested-With header on state-changing requests
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const xRequestedWith = req.headers['x-requested-with'];
    if (xRequestedWith !== 'XMLHttpRequest') {
      return res.status(403).json({ error: 'Missing required CSRF header' });
    }
  }
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dogs', dogsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000), // seconds
    database: {
      status: 'unknown',
      responseTime: 0
    }
  };

  try {
    // Check database connectivity
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    healthCheck.database.status = 'connected';
    healthCheck.database.responseTime = Date.now() - dbStart;
  } catch (error) {
    healthCheck.status = 'degraded';
    healthCheck.database.status = 'disconnected';
    console.error('Database health check failed:', error);
  }

  const statusCode = healthCheck.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log('Server closed.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
