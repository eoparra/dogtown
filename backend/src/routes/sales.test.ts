import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { app, testPrisma, createAdminUser, makeAuthCookies } from '../test-helpers/index.js';

const request = supertest(app);

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Track IDs created per-test so cleanup is scoped (avoids interfering with
// other test files that run concurrently against the same DB).
const tracked = {
  inventoryIds: [] as string[],
  serviceIds: [] as string[],
  clientIds: [] as string[],
};

function clear() {
  tracked.inventoryIds = [];
  tracked.serviceIds = [];
  tracked.clientIds = [];
}

// Unique SKU per call so concurrent tests never collide on the unique constraint.
let _sku = 0;
function nextSku() {
  return `SALES-TEST-${Date.now()}-${++_sku}`;
}

async function makeProduct(overrides: Record<string, unknown> = {}) {
  const item = await testPrisma.inventoryItem.create({
    data: {
      sku: nextSku(),
      name: 'Dog Food',
      category: 'PET_FOOD',
      unitOfMeasure: 'units',
      costPrice: 5,
      sellingPrice: 45,
      currentStock: 20,
      lowStockThreshold: 5,
      ...overrides,
    },
  });
  tracked.inventoryIds.push(item.id);
  return item;
}

async function makeService(name = 'Bath', pricingType: 'FIXED' | 'BY_SIZE' = 'FIXED') {
  const data =
    pricingType === 'FIXED'
      ? { name, pricingType, price: 20 }
      : { name, pricingType, priceSmall: 15, priceMedium: 20, priceLarge: 25 };
  const service = await testPrisma.service.create({ data });
  tracked.serviceIds.push(service.id);
  return service;
}

async function makeClient(name = 'Test Client', phone = '1234567890') {
  const user = await testPrisma.user.create({
    data: {
      email: `sales-test-${Date.now()}-${Math.random()}@test.com`,
      passwordHash: 'x',
      name,
      phone,
      role: 'CLIENT',
    },
  });
  tracked.clientIds.push(user.id);
  return user;
}

async function makeDog(userId: string, size: 'SMALL' | 'MEDIUM' | 'LARGE' = 'MEDIUM') {
  return testPrisma.dog.create({
    data: { userId, name: 'Buddy', breed: 'Labrador', age: 3, weight: 25, size },
  });
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('sales routes', () => {
  let cookieHeader: string;
  let csrfToken: string;

  before(async () => {
    const admin = await createAdminUser();
    ({ cookieHeader, csrfToken } = makeAuthCookies(admin.id));
  });

  afterEach(async () => {
    // Delete sales (cascades to SaleLineItem)
    await testPrisma.sale.deleteMany({});

    // Delete inventory items we created (and their movements)
    if (tracked.inventoryIds.length) {
      await testPrisma.stockMovement.deleteMany({ where: { itemId: { in: tracked.inventoryIds } } });
      await testPrisma.inventoryItem.deleteMany({ where: { id: { in: tracked.inventoryIds } } });
    }

    // Delete services we created
    if (tracked.serviceIds.length) {
      await testPrisma.service.deleteMany({ where: { id: { in: tracked.serviceIds } } });
    }

    // Delete clients (and their dogs) we created
    if (tracked.clientIds.length) {
      await testPrisma.dog.deleteMany({ where: { userId: { in: tracked.clientIds } } });
      await testPrisma.user.deleteMany({ where: { id: { in: tracked.clientIds } } });
    }

    clear();
  });

  after(async () => {
    await testPrisma.$disconnect();
  });

  // ── Auth ────────────────────────────────────────────────────────────────────

  it('unauthenticated request returns 401', async () => {
    const res = await request.get('/api/admin/sales');
    assert.equal(res.status, 401);
  });

  // ── Catalog search ──────────────────────────────────────────────────────────

  describe('GET /api/admin/catalog/search', () => {
    it('returns matching products and services', async () => {
      await makeProduct({ name: 'Catalog Food Item' });
      await makeService('Catalog Bath Service');

      const res = await request
        .get('/api/admin/catalog/search?q=Catalog')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.items));
      assert.ok(res.body.items.length >= 2);

      const types = res.body.items.map((i: { sourceType: string }) => i.sourceType);
      assert.ok(types.includes('PRODUCT'));
      assert.ok(types.includes('SERVICE'));
    });

    it('resolves BY_SIZE service price for SMALL', async () => {
      await makeService('SizeBath', 'BY_SIZE');

      const res = await request
        .get('/api/admin/catalog/search?q=SizeBath&size=SMALL')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      const item = res.body.items.find((i: { name: string }) => i.name === 'SizeBath');
      assert.ok(item, 'SizeBath not found in results');
      assert.equal(item.price, 15);
    });

    it('resolves BY_SIZE service price for LARGE', async () => {
      await makeService('BigBath', 'BY_SIZE');

      const res = await request
        .get('/api/admin/catalog/search?q=BigBath&size=LARGE')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      const item = res.body.items.find((i: { name: string }) => i.name === 'BigBath');
      assert.ok(item);
      assert.equal(item.price, 25);
    });

    it('returns null price for BY_SIZE service when no size provided', async () => {
      await makeService('NullBath', 'BY_SIZE');

      const res = await request
        .get('/api/admin/catalog/search?q=NullBath')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      const item = res.body.items.find((i: { name: string }) => i.name === 'NullBath');
      assert.ok(item);
      assert.equal(item.price, null);
    });

    it('returns priceSmall/priceMedium/priceLarge for BY_SIZE service in catalog', async () => {
      await makeService('SizePriceCheck', 'BY_SIZE');

      const res = await request
        .get('/api/admin/catalog/search?q=SizePriceCheck')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      const item = res.body.items.find((i: { name: string }) => i.name === 'SizePriceCheck');
      assert.ok(item);
      assert.equal(item.priceSmall, 15);
      assert.equal(item.priceMedium, 20);
      assert.equal(item.priceLarge, 25);
    });

    it('returns empty array when no matches', async () => {
      const res = await request
        .get('/api/admin/catalog/search?q=zzz-no-match-xyz')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      assert.deepEqual(res.body.items, []);
    });
  });

  // ── Client search ───────────────────────────────────────────────────────────

  describe('GET /api/admin/clients/search', () => {
    it('returns matching clients with their dogs', async () => {
      const client = await makeClient('UniqueClientName');
      await makeDog(client.id);

      const res = await request
        .get('/api/admin/clients/search?q=UniqueClientName')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      assert.equal(res.body.users.length, 1);
      assert.equal(res.body.users[0].name, 'UniqueClientName');
      assert.equal(res.body.users[0].dogs.length, 1);
    });

    it('returns empty array for query shorter than 2 characters', async () => {
      const res = await request
        .get('/api/admin/clients/search?q=J')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      assert.deepEqual(res.body.users, []);
    });

    it('does not include admin users in results', async () => {
      const res = await request
        .get('/api/admin/clients/search?q=Test Admin')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      assert.deepEqual(res.body.users, []);
    });
  });

  // ── POST /api/admin/sales ───────────────────────────────────────────────────

  describe('POST /api/admin/sales', () => {
    it('creates a sale with a product, deducts stock, and creates a movement', async () => {
      const product = await makeProduct({ sellingPrice: 45, currentStock: 10 });

      const res = await request
        .post('/api/admin/sales')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken)
        .send({
          clientName: 'John Smith',
          clientPhone: '1234567890',
          paymentMethod: 'CASH',
          lineItems: [
            {
              sourceType: 'PRODUCT',
              sourceId: product.id,
              itemName: 'Dog Food',
              unitPrice: 45,
              quantity: 2,
            },
          ],
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.sale.clientName, 'John Smith');
      assert.equal(res.body.sale.total, 90);
      assert.equal(res.body.sale.paymentMethod, 'CASH');
      assert.equal(res.body.sale.lineItems.length, 1);

      // Stock should be decremented
      const updated = await testPrisma.inventoryItem.findUnique({ where: { id: product.id } });
      assert.equal(updated!.currentStock, 8);

      // Stock movement created
      const movements = await testPrisma.stockMovement.findMany({ where: { itemId: product.id } });
      assert.equal(movements.length, 1);
      assert.equal(movements[0].type, 'DEDUCT');
      assert.equal(movements[0].quantity, 2);
    });

    it('creates a sale with a service — no stock deduction', async () => {
      const service = await makeService('Vaccine', 'FIXED');

      const res = await request
        .post('/api/admin/sales')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken)
        .send({
          clientName: 'Maria Garcia',
          paymentMethod: 'CARD',
          lineItems: [
            {
              sourceType: 'SERVICE',
              sourceId: service.id,
              itemName: 'Vaccine',
              unitPrice: 20,
              quantity: 1,
            },
          ],
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.sale.total, 20);
      assert.equal(res.body.sale.paymentMethod, 'CARD');

      // No stock movements for services
      const movements = await testPrisma.stockMovement.findMany({});
      assert.equal(movements.length, 0);
    });

    it('links sale to existing client when clientId is provided', async () => {
      const client = await makeClient('Jane Doe');
      const service = await makeService();

      const res = await request
        .post('/api/admin/sales')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken)
        .send({
          clientId: client.id,
          clientName: client.name,
          paymentMethod: 'CASH',
          lineItems: [
            {
              sourceType: 'SERVICE',
              sourceId: service.id,
              itemName: 'Bath',
              unitPrice: 20,
              quantity: 1,
            },
          ],
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.sale.clientId, client.id);
    });

    it('assigns dog to line item', async () => {
      const client = await makeClient();
      const dog = await makeDog(client.id, 'SMALL');
      const service = await makeService('BathBySize', 'BY_SIZE');

      const res = await request
        .post('/api/admin/sales')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken)
        .send({
          clientId: client.id,
          clientName: client.name,
          paymentMethod: 'CASH',
          lineItems: [
            {
              sourceType: 'SERVICE',
              sourceId: service.id,
              itemName: 'BathBySize',
              unitPrice: 15,
              quantity: 1,
              dogId: dog.id,
              dogName: dog.name,
            },
          ],
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.sale.lineItems[0].dogId, dog.id);
      assert.equal(res.body.sale.lineItems[0].dogName, 'Buddy');
    });

    it('calculates total correctly across multiple line items', async () => {
      const service = await makeService();
      const product = await makeProduct({ sellingPrice: 30, currentStock: 10 });

      const res = await request
        .post('/api/admin/sales')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken)
        .send({
          clientName: 'Multi-item Client',
          paymentMethod: 'TRANSFER',
          lineItems: [
            {
              sourceType: 'SERVICE',
              sourceId: service.id,
              itemName: 'Bath',
              unitPrice: 20,
              quantity: 3, // 3 × $20 = $60
            },
            {
              sourceType: 'PRODUCT',
              sourceId: product.id,
              itemName: 'Food',
              unitPrice: 30,
              quantity: 2, // 2 × $30 = $60
            },
          ],
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.sale.total, 120);
    });

    it('returns 422 when product stock is insufficient — and does not create the sale', async () => {
      const product = await makeProduct({ currentStock: 1 });

      const res = await request
        .post('/api/admin/sales')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken)
        .send({
          clientName: 'Test',
          paymentMethod: 'CASH',
          lineItems: [
            {
              sourceType: 'PRODUCT',
              sourceId: product.id,
              itemName: 'Item',
              unitPrice: 10,
              quantity: 5,
            },
          ],
        });

      assert.equal(res.status, 422);
      assert.match(res.body.error, /insufficient stock/i);

      // Stock must not have changed
      const unchanged = await testPrisma.inventoryItem.findUnique({ where: { id: product.id } });
      assert.equal(unchanged!.currentStock, 1);

      // No sale created
      const sales = await testPrisma.sale.findMany({});
      assert.equal(sales.length, 0);
    });

    it('returns 400 when lineItems is empty', async () => {
      const res = await request
        .post('/api/admin/sales')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken)
        .send({ clientName: 'Test', paymentMethod: 'CASH', lineItems: [] });

      assert.equal(res.status, 400);
    });

    it('returns 400 when clientName is missing', async () => {
      const service = await makeService();

      const res = await request
        .post('/api/admin/sales')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken)
        .send({
          paymentMethod: 'CASH',
          lineItems: [
            {
              sourceType: 'SERVICE',
              sourceId: service.id,
              itemName: 'Bath',
              unitPrice: 20,
              quantity: 1,
            },
          ],
        });

      assert.equal(res.status, 400);
    });

    it('returns 400 for invalid paymentMethod', async () => {
      const service = await makeService();

      const res = await request
        .post('/api/admin/sales')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken)
        .send({
          clientName: 'Test',
          paymentMethod: 'BITCOIN',
          lineItems: [
            {
              sourceType: 'SERVICE',
              sourceId: service.id,
              itemName: 'Bath',
              unitPrice: 20,
              quantity: 1,
            },
          ],
        });

      assert.equal(res.status, 400);
    });
  });

  // ── GET /api/admin/sales ────────────────────────────────────────────────────

  describe('GET /api/admin/sales', () => {
    it('returns sales ordered newest first', async () => {
      const service = await makeService('ListSvc');

      await testPrisma.sale.create({
        data: {
          clientName: 'Client A',
          paymentMethod: 'CASH',
          total: 10,
          lineItems: {
            create: [
              {
                sourceType: 'SERVICE',
                sourceId: service.id,
                itemName: 'ListSvc',
                unitPrice: 10,
                quantity: 1,
              },
            ],
          },
        },
      });

      await testPrisma.sale.create({
        data: {
          clientName: 'Client B',
          paymentMethod: 'CARD',
          total: 20,
          lineItems: {
            create: [
              {
                sourceType: 'SERVICE',
                sourceId: service.id,
                itemName: 'ListSvc',
                unitPrice: 20,
                quantity: 1,
              },
            ],
          },
        },
      });

      const res = await request
        .get('/api/admin/sales')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.sales));
      assert.equal(res.body.sales.length, 2);

      // Newest first
      const names = res.body.sales.map((s: { clientName: string }) => s.clientName);
      assert.ok(names.indexOf('Client B') <= names.indexOf('Client A'));
    });
  });

  // ── GET /api/admin/sales/:id ────────────────────────────────────────────────

  describe('GET /api/admin/sales/:id', () => {
    it('returns a sale with line items', async () => {
      const service = await makeService('DetailSvc');
      const sale = await testPrisma.sale.create({
        data: {
          clientName: 'Jane',
          paymentMethod: 'TRANSFER',
          total: 30,
          lineItems: {
            create: [
              {
                sourceType: 'SERVICE',
                sourceId: service.id,
                itemName: 'DetailSvc',
                unitPrice: 30,
                quantity: 1,
              },
            ],
          },
        },
      });

      const res = await request
        .get(`/api/admin/sales/${sale.id}`)
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      assert.equal(res.body.sale.id, sale.id);
      assert.equal(res.body.sale.clientName, 'Jane');
      assert.equal(res.body.sale.lineItems.length, 1);
    });

    it('returns 404 for non-existent sale', async () => {
      const res = await request
        .get('/api/admin/sales/00000000-0000-0000-0000-000000000000')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 404);
    });

    it('returns 400 for invalid UUID', async () => {
      const res = await request
        .get('/api/admin/sales/not-a-uuid')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 400);
    });
  });
});
