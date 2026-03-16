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

const VALID_CATEGORIES = ['PET_ACCESSORIES', 'PET_FOOD', 'VETERINARY'] as const;

const itemSchema = z.object({
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullish(),
  category: z.enum(VALID_CATEGORIES),
  unitOfMeasure: z.string().min(1).max(50),
  costPrice: z.number().min(0),
  sellingPrice: z.number().min(0),
  currentStock: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0),
  expiryDate: z.string().datetime({ offset: true }).optional().nullable(),
});

const movementSchema = z.object({
  quantity: z.number().int().min(1),
  note: z.string().max(500).optional(),
});

// GET /api/admin/inventory/low-stock-count
router.get('/inventory/low-stock-count', async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      where: { deletedAt: null },
      select: { currentStock: true, lowStockThreshold: true },
    });
    const lowStockCount = items.filter((i) => i.currentStock <= i.lowStockThreshold).length;
    res.json({ count: lowStockCount });
  } catch {
    res.status(500).json({ error: 'Failed to fetch low stock count' });
  }
});

// GET /api/admin/inventory
router.get('/inventory', async (req, res) => {
  const { category, lowStock } = req.query;

  try {
    const items = await prisma.inventoryItem.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { movements: true } } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    let filtered = items;
    if (category && VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
      filtered = filtered.filter((i) => i.category === category);
    }
    if (lowStock === 'true') {
      filtered = filtered.filter((i) => i.currentStock <= i.lowStockThreshold);
    }

    res.json({ items: filtered });
  } catch {
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// GET /api/admin/inventory/:id/movements
router.get('/inventory/:id/movements', async (req, res) => {
  const idResult = uuidParam.safeParse(req.params.id);
  if (!idResult.success) {
    return res.status(400).json({ error: 'Invalid item ID' });
  }

  try {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: idResult.data, deletedAt: null },
    });
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const movements = await prisma.stockMovement.findMany({
      where: { itemId: idResult.data },
      include: { performedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ movements });
  } catch {
    res.status(500).json({ error: 'Failed to fetch movements' });
  }
});

// POST /api/admin/inventory
router.post('/inventory', async (req, res) => {
  const result = itemSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: sanitizeZodError(result.error) });
  }

  const { expiryDate, currentStock, ...rest } = result.data;

  try {
    const item = await prisma.inventoryItem.create({
      data: {
        ...rest,
        currentStock: currentStock ?? 0,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
      },
      include: { _count: { select: { movements: true } } },
    });
    res.status(201).json({ item });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      return res.status(409).json({ error: 'An item with this SKU already exists' });
    }
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// PUT /api/admin/inventory/:id
router.put('/inventory/:id', async (req, res) => {
  const idResult = uuidParam.safeParse(req.params.id);
  if (!idResult.success) {
    return res.status(400).json({ error: 'Invalid item ID' });
  }

  const result = itemSchema.partial().safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: sanitizeZodError(result.error) });
  }

  const { expiryDate, ...rest } = result.data;

  try {
    const item = await prisma.inventoryItem.update({
      where: { id: idResult.data, deletedAt: null },
      data: {
        ...rest,
        ...(expiryDate !== undefined
          ? { expiryDate: expiryDate ? new Date(expiryDate) : null }
          : {}),
      },
      include: { _count: { select: { movements: true } } },
    });
    res.json({ item });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'P2025'
    ) {
      return res.status(404).json({ error: 'Item not found' });
    }
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      return res.status(409).json({ error: 'An item with this SKU already exists' });
    }
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /api/admin/inventory/:id (soft delete, blocked if has movements)
router.delete('/inventory/:id', async (req, res) => {
  const idResult = uuidParam.safeParse(req.params.id);
  if (!idResult.success) {
    return res.status(400).json({ error: 'Invalid item ID' });
  }

  try {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: idResult.data, deletedAt: null },
      include: { _count: { select: { movements: true } } },
    });
    if (!item) return res.status(404).json({ error: 'Item not found' });

    if (item._count.movements > 0) {
      return res.status(409).json({
        error: 'Cannot delete item with stock movement history. Archive it by setting stock to 0 instead.',
      });
    }

    await prisma.inventoryItem.update({
      where: { id: idResult.data },
      data: { deletedAt: new Date() },
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// POST /api/admin/inventory/:id/receive
router.post('/inventory/:id/receive', async (req, res) => {
  const idResult = uuidParam.safeParse(req.params.id);
  if (!idResult.success) {
    return res.status(400).json({ error: 'Invalid item ID' });
  }

  const result = movementSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: sanitizeZodError(result.error) });
  }

  const { quantity, note } = result.data;
  const performedById = req.user!.userId;

  try {
    const existing = await prisma.inventoryItem.findUnique({
      where: { id: idResult.data, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Item not found' });

    const [movement, item] = await prisma.$transaction([
      prisma.stockMovement.create({
        data: {
          itemId: idResult.data,
          type: 'RECEIVE',
          quantity,
          note,
          performedById,
        },
        include: { performedBy: { select: { id: true, name: true } } },
      }),
      prisma.inventoryItem.update({
        where: { id: idResult.data, deletedAt: null },
        data: { currentStock: { increment: quantity } },
        include: { _count: { select: { movements: true } } },
      }),
    ]);

    res.json({ movement, item });
  } catch {
    res.status(500).json({ error: 'Failed to receive stock' });
  }
});

// POST /api/admin/inventory/:id/deduct
router.post('/inventory/:id/deduct', async (req, res) => {
  const idResult = uuidParam.safeParse(req.params.id);
  if (!idResult.success) {
    return res.status(400).json({ error: 'Invalid item ID' });
  }

  const result = movementSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: sanitizeZodError(result.error) });
  }

  const { quantity, note } = result.data;
  const performedById = req.user!.userId;

  try {
    type DeductError = { code: 'NOT_FOUND' | 'INSUFFICIENT_STOCK'; available?: number };

    const { movement, item } = await prisma.$transaction(async (tx) => {
      // Atomic conditional decrement: the WHERE currentStock >= quantity is evaluated
      // inside the UPDATE, so concurrent requests cannot both pass and over-deduct.
      const { count } = await tx.inventoryItem.updateMany({
        where: { id: idResult.data, deletedAt: null, currentStock: { gte: quantity } },
        data: { currentStock: { decrement: quantity } },
      });

      if (count === 0) {
        const existing = await tx.inventoryItem.findUnique({
          where: { id: idResult.data, deletedAt: null },
          select: { currentStock: true },
        });
        if (!existing) {
          throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' } satisfies DeductError);
        }
        throw Object.assign(new Error('INSUFFICIENT_STOCK'), {
          code: 'INSUFFICIENT_STOCK',
          available: existing.currentStock,
        } satisfies DeductError);
      }

      const movement = await tx.stockMovement.create({
        data: { itemId: idResult.data, type: 'DEDUCT', quantity, note, performedById },
        include: { performedBy: { select: { id: true, name: true } } },
      });

      const item = await tx.inventoryItem.findUnique({
        where: { id: idResult.data },
        include: { _count: { select: { movements: true } } },
      });

      return { movement, item };
    }).catch((err: DeductError & Error) => {
      if (err.code === 'NOT_FOUND') throw { status: 404, error: 'Item not found' };
      if (err.code === 'INSUFFICIENT_STOCK') {
        throw { status: 422, error: `Insufficient stock. Available: ${err.available}` };
      }
      throw err;
    });

    res.json({ movement, item });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) {
      const { status, error } = err as { status: number; error: string };
      return res.status(status).json({ error });
    }
    res.status(500).json({ error: 'Failed to deduct stock' });
  }
});

export default router;
