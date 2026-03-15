import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../index.js';
import { config } from '../config.js';
import { signToken, revokeToken } from '../utils/jwt.js';
import { getAuthCookieOptions, clearAuthCookie } from '../utils/cookies.js';
import { issueCsrfToken, clearCsrfToken } from '../utils/csrf.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const isProduction = config.NODE_ENV === 'production';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' }
});

// Dummy hash for timing attack prevention — always run bcrypt even when user not found
const DUMMY_HASH = '$2b$10$7EqJtq98hPqEX7fNZaFWoOhiuC6wG7K5qTqL0U8BCLlcQFV3ayhtW';

const passwordSchema = z.string().min(12)
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[0-9]/, 'Must contain a number');

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: passwordSchema,
  name: z.string().min(1).max(100),
  phone: z.string().max(20).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: passwordSchema
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().max(20).optional().nullable()
});

function sanitizeZodError(error: z.ZodError) {
  if (isProduction) {
    return 'Validation failed';
  }
  return error.errors;
}


// Issue CSRF token (required before state-changing requests)
router.get('/csrf', (_req, res) => {
  const csrfToken = issueCsrfToken(res);
  res.json({ csrfToken });
});

// Register
router.post('/register', authLimiter, async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existing) {
      return res.status(400).json({ error: 'Registration failed. Please try again.' });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        phone: data.phone
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        userType: true,
        createdAt: true,
        tokenVersion: true
      }
    });

    const token = signToken({ userId: user.id, role: user.role as 'CLIENT' | 'ADMIN', tokenVersion: user.tokenVersion });

    res.cookie('token', token, getAuthCookieOptions());
    const csrfToken = issueCsrfToken(res);

    res.status(201).json({ user, csrfToken });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: sanitizeZodError(error) });
    }
    console.error(error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email }
    });

    // Timing attack prevention: always run bcrypt compare
    if (!user) {
      await bcrypt.compare(data.password, DUMMY_HASH);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken({ userId: user.id, role: user.role as 'CLIENT' | 'ADMIN', tokenVersion: user.tokenVersion });

    res.cookie('token', token, getAuthCookieOptions());
    const csrfToken = issueCsrfToken(res);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        userType: user.userType,
        createdAt: user.createdAt
      },
      csrfToken
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: sanitizeZodError(error) });
    }
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout with token revocation
router.post('/logout', async (req, res) => {
  const token = req.cookies.token;
  if (token) {
    await revokeToken(token);
  }

  clearAuthCookie(res);
  clearCsrfToken(res);
  res.json({ success: true });
});

// Get current user
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        userType: true,
        createdAt: true,
        tokenVersion: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Change password
router.put('/password', requireAuth, async (req, res) => {
  try {
    const data = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 10);
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 }
      },
      select: { tokenVersion: true }
    });

    // Revoke current token and issue a new one
    const oldToken = req.cookies.token;
    if (oldToken) {
      await revokeToken(oldToken);
    }

    const newToken = signToken({
      userId: user.id,
      role: user.role as 'CLIENT' | 'ADMIN',
      tokenVersion: updatedUser.tokenVersion
    });
    res.cookie('token', newToken, getAuthCookieOptions());
    const csrfToken = issueCsrfToken(res);

    res.json({ success: true, csrfToken });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: sanitizeZodError(error) });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Update profile (name, phone)
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const data = updateProfileSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        name: data.name,
        phone: data.phone ?? null
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        userType: true,
        createdAt: true,
        tokenVersion: true
      }
    });

    res.json({ user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: sanitizeZodError(error) });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
