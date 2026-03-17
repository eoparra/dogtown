import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db.js';
import { isProduction } from '../config.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

const uuidParam = z.string().uuid();

function sanitizeZodError(error: z.ZodError) {
  if (isProduction) {
    return 'Validation failed';
  }
  return error.errors;
}

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

router.use(adminLimiter);
router.use(requireAdmin);

const serviceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullish(),
  price: z.number().min(0),
});

// GET /api/admin/services
router.get('/services', async (_req, res) => {
  try {
    const services = await prisma.service.findMany({
      orderBy: { createdAt: 'asc' },
    });
    res.json({ services });
  } catch {
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// POST /api/admin/services
router.post('/services', async (req, res) => {
  const parsed = serviceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: sanitizeZodError(parsed.error) });
  }
  try {
    const service = await prisma.service.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        price: parsed.data.price,
      },
    });
    res.status(201).json({ service });
  } catch {
    res.status(500).json({ error: 'Failed to create service' });
  }
});

// PUT /api/admin/services/:id
router.put('/services/:id', async (req, res) => {
  const idResult = uuidParam.safeParse(req.params.id);
  if (!idResult.success) {
    return res.status(400).json({ error: 'Invalid service ID' });
  }
  const parsed = serviceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: sanitizeZodError(parsed.error) });
  }
  try {
    const service = await prisma.service.update({
      where: { id: idResult.data },
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        price: parsed.data.price,
      },
    });
    res.json({ service });
  } catch (err: unknown) {
    const prismaErr = err as { code?: string };
    if (prismaErr.code === 'P2025') {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.status(500).json({ error: 'Failed to update service' });
  }
});

// DELETE /api/admin/services/:id
router.delete('/services/:id', async (req, res) => {
  const idResult = uuidParam.safeParse(req.params.id);
  if (!idResult.success) {
    return res.status(400).json({ error: 'Invalid service ID' });
  }
  try {
    await prisma.service.delete({ where: { id: idResult.data } });
    res.json({ success: true });
  } catch (err: unknown) {
    const prismaErr = err as { code?: string };
    if (prismaErr.code === 'P2025') {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

export default router;
