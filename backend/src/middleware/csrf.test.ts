import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response, NextFunction } from 'express';
import { requireCsrf } from './csrf.js';

function runMiddleware(reqPartial: Partial<Request>) {
  const req = reqPartial as Request;
  let statusCode = 200;
  let body: unknown;
  let nextCalled = false;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  } as unknown as Response;

  const next: NextFunction = () => {
    nextCalled = true;
  };

  requireCsrf(req, res, next);

  return { statusCode, body, nextCalled };
}

test('allows GET without CSRF token', () => {
  const result = runMiddleware({ method: 'GET', cookies: {}, headers: {} });
  assert.equal(result.nextCalled, true);
  assert.equal(result.statusCode, 200);
});

test('blocks POST without matching CSRF cookie/header', () => {
  const result = runMiddleware({ method: 'POST', cookies: {}, headers: {} });
  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 403);
  assert.deepEqual(result.body, { error: 'Invalid CSRF token' });
});

test('allows POST with matching CSRF cookie/header', () => {
  const token = 'abc123';
  const result = runMiddleware({
    method: 'POST',
    cookies: { csrf_token: token },
    headers: { 'x-csrf-token': token },
  });

  assert.equal(result.nextCalled, true);
  assert.equal(result.statusCode, 200);
});
