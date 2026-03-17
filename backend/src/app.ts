import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { prisma } from './db.js';
import { isProduction, config } from './config.js';
import authRoutes from './routes/auth.js';
import dogsRoutes from './routes/dogs.js';
import bookingsRoutes from './routes/bookings.js';
import adminRoutes from './routes/admin.js';
import inventoryRoutes from './routes/inventory.js';
import { requireCsrf } from './middleware/csrf.js';

const app = express();
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

// CSRF protection (double-submit cookie): require matching header + cookie on state-changing requests
app.use(requireCsrf);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dogs', dogsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', inventoryRoutes);

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

export async function enforceProductionSecurityGuards() {
  if (!isProduction) return;

  const allowDefaultAdmin = process.env.ALLOW_DEFAULT_ADMIN === 'true';
  if (allowDefaultAdmin) return;

  const defaultAdmin = await prisma.user.findUnique({
    where: { email: 'admin@dogtown.com' },
    select: { id: true }
  });

  if (defaultAdmin) {
    throw new Error('Security guard: default bootstrap admin (admin@dogtown.com) detected in production. Rotate to a non-default admin account or set ALLOW_DEFAULT_ADMIN=true only for controlled migrations.');
  }
}

export { app };
