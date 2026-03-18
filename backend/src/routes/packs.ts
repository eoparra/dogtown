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

const packSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullish(),
  packType: z.enum(['DAYCARE_DAYS', 'HOTEL_NIGHTS']),
  unitsIncluded: z.number().int().min(1),
  priceSmall: z.number().min(0),
  priceMedium: z.number().min(0),
  priceLarge: z.number().min(0),
});

// GET /api/admin/packs
router.get('/packs', async (_req, res) => {
  try {
    const packs = await prisma.servicePack.findMany({
      orderBy: { createdAt: 'asc' },
    });
    res.json({ packs });
  } catch {
    res.status(500).json({ error: 'Failed to fetch packs' });
  }
});

// POST /api/admin/packs
router.post('/packs', async (req, res) => {
  const parsed = packSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: sanitizeZodError(parsed.error) });
  }
  try {
    const { name, description, packType, unitsIncluded, priceSmall, priceMedium, priceLarge } = parsed.data;
    const pack = await prisma.servicePack.create({
      data: { name, description: description ?? null, packType, unitsIncluded, priceSmall, priceMedium, priceLarge },
    });
    res.status(201).json({ pack });
  } catch {
    res.status(500).json({ error: 'Failed to create pack' });
  }
});

// PUT /api/admin/packs/:id
router.put('/packs/:id', async (req, res) => {
  const idResult = uuidParam.safeParse(req.params.id);
  if (!idResult.success) {
    return res.status(400).json({ error: 'Invalid pack ID' });
  }
  const parsed = packSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: sanitizeZodError(parsed.error) });
  }
  try {
    const { name, description, packType, unitsIncluded, priceSmall, priceMedium, priceLarge } = parsed.data;
    const pack = await prisma.servicePack.update({
      where: { id: idResult.data },
      data: { name, description: description ?? null, packType, unitsIncluded, priceSmall, priceMedium, priceLarge },
    });
    res.json({ pack });
  } catch (err: unknown) {
    const prismaErr = err as { code?: string };
    if (prismaErr.code === 'P2025') {
      return res.status(404).json({ error: 'Pack not found' });
    }
    res.status(500).json({ error: 'Failed to update pack' });
  }
});

// DELETE /api/admin/packs/:id
router.delete('/packs/:id', async (req, res) => {
  const idResult = uuidParam.safeParse(req.params.id);
  if (!idResult.success) {
    return res.status(400).json({ error: 'Invalid pack ID' });
  }
  try {
    await prisma.servicePack.delete({ where: { id: idResult.data } });
    res.json({ success: true });
  } catch (err: unknown) {
    const prismaErr = err as { code?: string };
    if (prismaErr.code === 'P2025') {
      return res.status(404).json({ error: 'Pack not found' });
    }
    res.status(500).json({ error: 'Failed to delete pack' });
  }
});

export default router;
