import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {
  app,
  testPrisma,
  createAdminUser,
  makeAuthCookies,
  cleanupInventory,
  inventoryItemFixture,
} from '../test-helpers/index.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function authedGet(path: string, cookieHeader: string) {
  return request(app).get(path).set('Cookie', cookieHeader);
}

function authedPost(path: string, cookieHeader: string, csrfToken: string, body: object) {
  return request(app)
    .post(path)
    .set('Cookie', cookieHeader)
    .set('x-csrf-token', csrfToken)
    .send(body);
}

function authedPut(path: string, cookieHeader: string, csrfToken: string, body: object) {
  return request(app)
    .put(path)
    .set('Cookie', cookieHeader)
    .set('x-csrf-token', csrfToken)
    .send(body);
}

function authedDelete(path: string, cookieHeader: string, csrfToken: string) {
  return request(app)
    .delete(path)
    .set('Cookie', cookieHeader)
    .set('x-csrf-token', csrfToken);
}

// ── suite ─────────────────────────────────────────────────────────────────────

test('inventory routes', async (t) => {
  let cookieHeader: string;
  let csrfToken: string;
  let adminId: string;

  t.before(async () => {
    const admin = await createAdminUser();
    adminId = admin.id;
    ({ cookieHeader, csrfToken } = makeAuthCookies(admin.id));
  });

  t.afterEach(async () => {
    await cleanupInventory();
  });

  t.after(async () => {
    await testPrisma.$disconnect();
  });

  // ── auth guard ──────────────────────────────────────────────────────────────

  await t.test('unauthenticated request returns 401', async () => {
    const res = await request(app).get('/api/admin/inventory');
    assert.equal(res.status, 401);
  });

  // ── GET /api/admin/inventory ────────────────────────────────────────────────

  await t.test('GET /api/admin/inventory', async (t) => {
    await t.test('returns all non-deleted items', async () => {
      await testPrisma.inventoryItem.createMany({
        data: [
          inventoryItemFixture({ name: 'Item A' }),
          inventoryItemFixture({ name: 'Item B' }),
        ],
      });
      // Soft-deleted item should not appear
      await testPrisma.inventoryItem.create({
        data: { ...inventoryItemFixture({ name: 'Deleted Item' }), deletedAt: new Date() },
      });

      const res = await authedGet('/api/admin/inventory', cookieHeader);
      assert.equal(res.status, 200);
      assert.equal(res.body.items.length, 2);
      assert.ok(res.body.items.every((i: { deletedAt: null }) => i.deletedAt === null));
    });

    await t.test('filters by valid category', async () => {
      await testPrisma.inventoryItem.createMany({
        data: [
          inventoryItemFixture({ name: 'Food', category: 'PET_FOOD' }),
          inventoryItemFixture({ name: 'Toy', category: 'PET_ACCESSORIES' }),
        ],
      });

      const res = await authedGet('/api/admin/inventory?category=PET_FOOD', cookieHeader);
      assert.equal(res.status, 200);
      assert.equal(res.body.items.length, 1);
      assert.equal(res.body.items[0].category, 'PET_FOOD');
    });

    await t.test('ignores invalid category filter and returns all items', async () => {
      await testPrisma.inventoryItem.createMany({
        data: [inventoryItemFixture(), inventoryItemFixture()],
      });

      const res = await authedGet('/api/admin/inventory?category=BOGUS', cookieHeader);
      assert.equal(res.status, 200);
      assert.equal(res.body.items.length, 2);
    });

    await t.test('filters by lowStock=true', async () => {
      await testPrisma.inventoryItem.createMany({
        data: [
          inventoryItemFixture({ currentStock: 3, lowStockThreshold: 5 }),  // low
          inventoryItemFixture({ currentStock: 5, lowStockThreshold: 5 }),  // at threshold — counts as low
          inventoryItemFixture({ currentStock: 20, lowStockThreshold: 5 }), // fine
        ],
      });

      const res = await authedGet('/api/admin/inventory?lowStock=true', cookieHeader);
      assert.equal(res.status, 200);
      assert.equal(res.body.items.length, 2);
    });
  });

  // ── GET /api/admin/inventory/low-stock-count ────────────────────────────────

  await t.test('GET /api/admin/inventory/low-stock-count', async (t) => {
    await t.test('returns correct count of low stock items', async () => {
      await testPrisma.inventoryItem.createMany({
        data: [
          inventoryItemFixture({ currentStock: 2, lowStockThreshold: 10 }),
          inventoryItemFixture({ currentStock: 10, lowStockThreshold: 10 }),
          inventoryItemFixture({ currentStock: 50, lowStockThreshold: 10 }),
        ],
      });

      const res = await authedGet('/api/admin/inventory/low-stock-count', cookieHeader);
      assert.equal(res.status, 200);
      assert.equal(res.body.count, 2);
    });

    await t.test('returns 0 when no items are low on stock', async () => {
      await testPrisma.inventoryItem.create({
        data: inventoryItemFixture({ currentStock: 100, lowStockThreshold: 5 }),
      });

      const res = await authedGet('/api/admin/inventory/low-stock-count', cookieHeader);
      assert.equal(res.status, 200);
      assert.equal(res.body.count, 0);
    });
  });

  // ── POST /api/admin/inventory ───────────────────────────────────────────────

  await t.test('POST /api/admin/inventory', async (t) => {
    await t.test('creates an item with valid data', async () => {
      const fixture = inventoryItemFixture({ name: 'New Item' });
      const res = await authedPost('/api/admin/inventory', cookieHeader, csrfToken, fixture);

      assert.equal(res.status, 201);
      assert.equal(res.body.item.name, 'New Item');
      assert.equal(res.body.item.sku, fixture.sku);
    });

    await t.test('returns 400 when required fields are missing', async () => {
      const res = await authedPost('/api/admin/inventory', cookieHeader, csrfToken, {
        name: 'Missing Fields',
      });
      assert.equal(res.status, 400);
    });

    await t.test('returns 409 on duplicate SKU', async () => {
      const fixture = inventoryItemFixture();
      await authedPost('/api/admin/inventory', cookieHeader, csrfToken, fixture);
      const res = await authedPost('/api/admin/inventory', cookieHeader, csrfToken, fixture);

      assert.equal(res.status, 409);
      assert.match(res.body.error, /SKU already exists/i);
    });
  });

  // ── PUT /api/admin/inventory/:id ────────────────────────────────────────────

  await t.test('PUT /api/admin/inventory/:id', async (t) => {
    await t.test('updates item fields', async () => {
      const item = await testPrisma.inventoryItem.create({
        data: inventoryItemFixture({ name: 'Original' }),
      });

      const res = await authedPut(
        `/api/admin/inventory/${item.id}`,
        cookieHeader,
        csrfToken,
        { name: 'Updated' },
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.item.name, 'Updated');
    });

    await t.test('returns 404 for non-existent UUID', async () => {
      const res = await authedPut(
        '/api/admin/inventory/00000000-0000-0000-0000-000000000000',
        cookieHeader,
        csrfToken,
        { name: 'X' },
      );
      assert.equal(res.status, 404);
    });

    await t.test('returns 404 for soft-deleted item', async () => {
      const item = await testPrisma.inventoryItem.create({
        data: { ...inventoryItemFixture(), deletedAt: new Date() },
      });

      const res = await authedPut(
        `/api/admin/inventory/${item.id}`,
        cookieHeader,
        csrfToken,
        { name: 'X' },
      );
      assert.equal(res.status, 404);
    });

    await t.test('returns 400 for non-UUID id', async () => {
      const res = await authedPut(
        '/api/admin/inventory/not-a-uuid',
        cookieHeader,
        csrfToken,
        { name: 'X' },
      );
      assert.equal(res.status, 400);
    });

    await t.test('returns 409 when updating to an existing SKU', async () => {
      const [a, b] = await Promise.all([
        testPrisma.inventoryItem.create({ data: inventoryItemFixture() }),
        testPrisma.inventoryItem.create({ data: inventoryItemFixture() }),
      ]);

      const res = await authedPut(
        `/api/admin/inventory/${b.id}`,
        cookieHeader,
        csrfToken,
        { sku: a.sku },
      );
      assert.equal(res.status, 409);
    });
  });

  // ── DELETE /api/admin/inventory/:id ────────────────────────────────────────

  await t.test('DELETE /api/admin/inventory/:id', async (t) => {
    await t.test('soft-deletes an item with no movements', async () => {
      const item = await testPrisma.inventoryItem.create({
        data: inventoryItemFixture(),
      });

      const res = await authedDelete(
        `/api/admin/inventory/${item.id}`,
        cookieHeader,
        csrfToken,
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      const deleted = await testPrisma.inventoryItem.findUnique({ where: { id: item.id } });
      assert.ok(deleted?.deletedAt !== null);
    });

    await t.test('returns 409 when item has stock movements', async () => {
      const item = await testPrisma.inventoryItem.create({
        data: inventoryItemFixture(),
      });
      await testPrisma.stockMovement.create({
        data: {
          itemId: item.id,
          type: 'RECEIVE',
          quantity: 10,
          performedById: adminId,
        },
      });

      const res = await authedDelete(
        `/api/admin/inventory/${item.id}`,
        cookieHeader,
        csrfToken,
      );
      assert.equal(res.status, 409);
      assert.match(res.body.error, /movement history/i);
    });

    await t.test('returns 404 for non-existent UUID', async () => {
      const res = await authedDelete(
        '/api/admin/inventory/00000000-0000-0000-0000-000000000000',
        cookieHeader,
        csrfToken,
      );
      assert.equal(res.status, 404);
    });
  });

  // ── POST /api/admin/inventory/:id/receive ───────────────────────────────────

  await t.test('POST /api/admin/inventory/:id/receive', async (t) => {
    await t.test('increments stock and creates a RECEIVE movement', async () => {
      const item = await testPrisma.inventoryItem.create({
        data: inventoryItemFixture({ currentStock: 10 }),
      });

      const res = await authedPost(
        `/api/admin/inventory/${item.id}/receive`,
        cookieHeader,
        csrfToken,
        { quantity: 5, note: 'Restock' },
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.item.currentStock, 15);
      assert.equal(res.body.movement.type, 'RECEIVE');
      assert.equal(res.body.movement.quantity, 5);
    });

    await t.test('returns 404 for non-existent item', async () => {
      const res = await authedPost(
        '/api/admin/inventory/00000000-0000-0000-0000-000000000000/receive',
        cookieHeader,
        csrfToken,
        { quantity: 1 },
      );
      assert.equal(res.status, 404);
    });

    await t.test('returns 400 for quantity 0', async () => {
      const item = await testPrisma.inventoryItem.create({
        data: inventoryItemFixture(),
      });
      const res = await authedPost(
        `/api/admin/inventory/${item.id}/receive`,
        cookieHeader,
        csrfToken,
        { quantity: 0 },
      );
      assert.equal(res.status, 400);
    });

    await t.test('returns 400 for non-UUID id', async () => {
      const res = await authedPost(
        '/api/admin/inventory/not-a-uuid/receive',
        cookieHeader,
        csrfToken,
        { quantity: 1 },
      );
      assert.equal(res.status, 400);
    });
  });

  // ── POST /api/admin/inventory/:id/deduct ────────────────────────────────────

  await t.test('POST /api/admin/inventory/:id/deduct', async (t) => {
    await t.test('decrements stock and creates a DEDUCT movement', async () => {
      const item = await testPrisma.inventoryItem.create({
        data: inventoryItemFixture({ currentStock: 20 }),
      });

      const res = await authedPost(
        `/api/admin/inventory/${item.id}/deduct`,
        cookieHeader,
        csrfToken,
        { quantity: 8 },
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.item.currentStock, 12);
      assert.equal(res.body.movement.type, 'DEDUCT');
    });

    await t.test('succeeds when quantity equals currentStock (stock goes to 0)', async () => {
      const item = await testPrisma.inventoryItem.create({
        data: inventoryItemFixture({ currentStock: 5 }),
      });

      const res = await authedPost(
        `/api/admin/inventory/${item.id}/deduct`,
        cookieHeader,
        csrfToken,
        { quantity: 5 },
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.item.currentStock, 0);
    });

    await t.test('returns 422 with available count when stock is insufficient', async () => {
      const item = await testPrisma.inventoryItem.create({
        data: inventoryItemFixture({ currentStock: 3 }),
      });

      const res = await authedPost(
        `/api/admin/inventory/${item.id}/deduct`,
        cookieHeader,
        csrfToken,
        { quantity: 10 },
      );
      assert.equal(res.status, 422);
      assert.match(res.body.error, /Available: 3/);
    });

    await t.test('returns 404 for non-existent item', async () => {
      const res = await authedPost(
        '/api/admin/inventory/00000000-0000-0000-0000-000000000000/deduct',
        cookieHeader,
        csrfToken,
        { quantity: 1 },
      );
      assert.equal(res.status, 404);
    });

    await t.test('returns 400 for quantity 0', async () => {
      const item = await testPrisma.inventoryItem.create({
        data: inventoryItemFixture({ currentStock: 10 }),
      });
      const res = await authedPost(
        `/api/admin/inventory/${item.id}/deduct`,
        cookieHeader,
        csrfToken,
        { quantity: 0 },
      );
      assert.equal(res.status, 400);
    });
  });

  // ── GET /api/admin/inventory/:id/movements ──────────────────────────────────

  await t.test('GET /api/admin/inventory/:id/movements', async (t) => {
    await t.test('returns movements ordered descending by createdAt', async () => {
      const item = await testPrisma.inventoryItem.create({
        data: inventoryItemFixture({ currentStock: 50 }),
      });
      // Create sequentially with a small delay so each gets a distinct createdAt timestamp.
      // Without the delay, both inserts can land in the same millisecond under fast sequential
      // execution, making the DESC sort non-deterministic.
      await testPrisma.stockMovement.create({
        data: { itemId: item.id, type: 'RECEIVE', quantity: 20, performedById: adminId },
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await testPrisma.stockMovement.create({
        data: { itemId: item.id, type: 'DEDUCT', quantity: 5, performedById: adminId },
      });

      const res = await authedGet(`/api/admin/inventory/${item.id}/movements`, cookieHeader);
      assert.equal(res.status, 200);
      assert.equal(res.body.movements.length, 2);
      // Most recent first (DEDUCT was created last)
      assert.equal(res.body.movements[0].type, 'DEDUCT');
    });

    await t.test('returns 404 for non-existent item', async () => {
      const res = await authedGet(
        '/api/admin/inventory/00000000-0000-0000-0000-000000000000/movements',
        cookieHeader,
      );
      assert.equal(res.status, 404);
    });

    await t.test('returns 400 for non-UUID id', async () => {
      const res = await authedGet('/api/admin/inventory/not-a-uuid/movements', cookieHeader);
      assert.equal(res.status, 400);
    });
  });
});
