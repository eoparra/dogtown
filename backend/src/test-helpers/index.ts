import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { signToken } from '../utils/jwt.js';
import { app } from '../app.js';

// A dedicated Prisma client for seeding and cleanup in tests.
// Reads DATABASE_URL from the environment (set to dogtown_test by dotenv -e .env.test).
export const testPrisma = new PrismaClient();

export { app };

// ----- User / auth helpers -----

export async function createAdminUser() {
  const hash = await bcrypt.hash('TestAdmin1!', 10);
  return testPrisma.user.upsert({
    where: { email: 'test-admin@dogtown.com' },
    update: {},
    create: {
      email: 'test-admin@dogtown.com',
      passwordHash: hash,
      name: 'Test Admin',
      role: 'ADMIN',
      tokenVersion: 0,
    },
  });
}

const CSRF_TOKEN = 'test-csrf-token-fixed';

export function makeAuthCookies(userId: string) {
  const jwtToken = signToken({ userId, role: 'ADMIN', tokenVersion: 0 });
  return {
    // Sent as the Cookie header value in supertest requests
    cookieHeader: `token=${jwtToken}; csrf_token=${CSRF_TOKEN}`,
    csrfToken: CSRF_TOKEN,
  };
}

// ----- Cleanup helpers -----

export async function cleanupInventory() {
  // StockMovement references InventoryItem via FK — delete movements first
  await testPrisma.stockMovement.deleteMany({});
  await testPrisma.inventoryItem.deleteMany({});
}

// ----- Fixtures -----

let skuCounter = 0;

export function inventoryItemFixture(overrides: Record<string, unknown> = {}) {
  skuCounter += 1;
  return {
    sku: `TEST-SKU-${skuCounter}`,
    name: 'Test Item',
    category: 'PET_FOOD',
    unitOfMeasure: 'units',
    costPrice: 5.0,
    sellingPrice: 9.99,
    currentStock: 20,
    lowStockThreshold: 5,
    ...overrides,
  };
}
