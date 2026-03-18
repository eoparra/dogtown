import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db.js';
import { isProduction } from '../config.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

const uuidParam = z.string().uuid();

function sanitizeZodError(error: z.ZodError) {
  if (isProduction) return 'Validation failed';
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

const VALID_SIZES = ['SMALL', 'MEDIUM', 'LARGE'] as const;
type DogSize = (typeof VALID_SIZES)[number];

// GET /api/admin/catalog/search?q=&size=
router.get('/catalog/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const sizeParam = typeof req.query.size === 'string' ? req.query.size : undefined;
  const size: DogSize | undefined =
    sizeParam && VALID_SIZES.includes(sizeParam as DogSize)
      ? (sizeParam as DogSize)
      : undefined;

  try {
    const [products, services] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: {
          deletedAt: null,
          ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
        },
        select: {
          id: true,
          name: true,
          description: true,
          sellingPrice: true,
          currentStock: true,
          unitOfMeasure: true,
        },
        orderBy: { name: 'asc' },
        take: 20,
      }),
      prisma.service.findMany({
        where: q ? { name: { contains: q, mode: 'insensitive' } } : {},
        orderBy: { name: 'asc' },
        take: 20,
      }),
    ]);

    const productItems = products.map((p) => ({
      id: p.id,
      sourceType: 'PRODUCT' as const,
      name: p.name,
      description: p.description,
      price: p.sellingPrice,
      pricingType: 'FIXED' as const,
      currentStock: p.currentStock,
      unitOfMeasure: p.unitOfMeasure,
    }));

    const serviceItems = services.map((s) => {
      let price: number | null = null;
      if (s.pricingType === 'FIXED') {
        price = s.price;
      } else if (size === 'SMALL') {
        price = s.priceSmall;
      } else if (size === 'MEDIUM') {
        price = s.priceMedium;
      } else if (size === 'LARGE') {
        price = s.priceLarge;
      }
      return {
        id: s.id,
        sourceType: 'SERVICE' as const,
        name: s.name,
        description: s.description,
        price,
        pricingType: s.pricingType as 'FIXED' | 'BY_SIZE',
        priceSmall: s.priceSmall,
        priceMedium: s.priceMedium,
        priceLarge: s.priceLarge,
      };
    });

    res.json({ items: [...productItems, ...serviceItems] });
  } catch {
    res.status(500).json({ error: 'Failed to search catalog' });
  }
});

// GET /api/admin/clients/search?q=
router.get('/clients/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q || q.length < 2) {
    return res.json({ users: [] });
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        role: { not: 'ADMIN' },
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        dogs: {
          select: { id: true, name: true, size: true },
          orderBy: { name: 'asc' },
        },
      },
      take: 10,
      orderBy: { name: 'asc' },
    });

    res.json({ users });
  } catch {
    res.status(500).json({ error: 'Failed to search clients' });
  }
});

const lineItemSchema = z.object({
  sourceType: z.enum(['PRODUCT', 'SERVICE']),
  sourceId: z.string().uuid(),
  itemName: z.string().min(1).max(200),
  unitPrice: z.number().min(0),
  quantity: z.number().int().min(1).max(999),
  dogId: z.string().uuid().optional().nullable(),
  dogName: z.string().max(100).optional().nullable(),
});

const saleSchema = z.object({
  clientId: z.string().uuid().optional().nullable(),
  clientName: z.string().min(1).max(200),
  clientPhone: z.string().max(30).optional().nullable(),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER']),
  notes: z.string().max(500).optional().nullable(),
  lineItems: z.array(lineItemSchema).min(1).max(50),
});

// POST /api/admin/sales
router.post('/sales', async (req, res) => {
  const parsed = saleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: sanitizeZodError(parsed.error) });
  }

  const { clientId, clientName, clientPhone, paymentMethod, notes, lineItems } = parsed.data;
  const performedById = req.user!.userId;
  const total = lineItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  type SaleError = {
    code: 'ITEM_NOT_FOUND' | 'INSUFFICIENT_STOCK';
    itemName: string;
    available?: number;
  };

  try {
    const sale = await prisma
      .$transaction(async (tx) => {
        // Atomically deduct stock for each PRODUCT line item
        for (const item of lineItems.filter((i) => i.sourceType === 'PRODUCT')) {
          const { count } = await tx.inventoryItem.updateMany({
            where: {
              id: item.sourceId,
              deletedAt: null,
              currentStock: { gte: item.quantity },
            },
            data: { currentStock: { decrement: item.quantity } },
          });

          if (count === 0) {
            const existing = await tx.inventoryItem.findUnique({
              where: { id: item.sourceId, deletedAt: null },
              select: { currentStock: true },
            });
            if (!existing) {
              throw Object.assign(new Error('ITEM_NOT_FOUND'), {
                code: 'ITEM_NOT_FOUND',
                itemName: item.itemName,
              } satisfies SaleError);
            }
            throw Object.assign(new Error('INSUFFICIENT_STOCK'), {
              code: 'INSUFFICIENT_STOCK',
              itemName: item.itemName,
              available: existing.currentStock,
            } satisfies SaleError);
          }

          await tx.stockMovement.create({
            data: {
              itemId: item.sourceId,
              type: 'DEDUCT',
              quantity: item.quantity,
              note: `Sale - ${clientName}`,
              performedById,
            },
          });
        }

        return tx.sale.create({
          data: {
            clientId: clientId ?? null,
            clientName,
            clientPhone: clientPhone ?? null,
            paymentMethod,
            notes: notes ?? null,
            total,
            lineItems: {
              create: lineItems.map((item) => ({
                sourceType: item.sourceType,
                sourceId: item.sourceId,
                itemName: item.itemName,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                dogId: item.dogId ?? null,
                dogName: item.dogName ?? null,
              })),
            },
          },
          include: { lineItems: true },
        });
      })
      .catch((err: SaleError & Error) => {
        if (err.code === 'ITEM_NOT_FOUND') {
          throw { status: 404, error: `Product "${err.itemName}" not found` };
        }
        if (err.code === 'INSUFFICIENT_STOCK') {
          throw {
            status: 422,
            error: `Insufficient stock for "${err.itemName}". Available: ${err.available}`,
          };
        }
        throw err;
      });

    res.status(201).json({ sale });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) {
      const { status, error } = err as { status: number; error: string };
      return res.status(status).json({ error });
    }
    res.status(500).json({ error: 'Failed to create sale' });
  }
});

// GET /api/admin/sales
router.get('/sales', async (_req, res) => {
  try {
    const sales = await prisma.sale.findMany({
      include: {
        lineItems: true,
        client: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ sales });
  } catch {
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// GET /api/admin/sales/:id
router.get('/sales/:id', async (req, res) => {
  const idResult = uuidParam.safeParse(req.params.id);
  if (!idResult.success) return res.status(400).json({ error: 'Invalid sale ID' });

  try {
    const sale = await prisma.sale.findUnique({
      where: { id: idResult.data },
      include: {
        lineItems: true,
        client: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    res.json({ sale });
  } catch {
    res.status(500).json({ error: 'Failed to fetch sale' });
  }
});

export default router;
