import { describe, it, expect, vi, afterEach } from 'vitest';
import { admin } from '@/services/api';

// Tests for the shared request() error-handling logic in api.ts.
// Uses admin.getInventory() (a GET — no CSRF token required) to exercise
// the common error path without needing to stub CSRF setup.

describe('api request() error handling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('joins Zod array error messages into a readable string', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: [
          { message: 'Expected string, received null', code: 'invalid_type', path: ['description'] },
          { message: 'Required', code: 'invalid_type', path: ['name'] },
        ],
      }),
    }));

    await expect(admin.getInventory()).rejects.toThrow(
      'Expected string, received null, Required',
    );
  });

  it('passes a plain string error message through unchanged', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'An item with this SKU already exists' }),
    }));

    await expect(admin.getInventory()).rejects.toThrow('An item with this SKU already exists');
  });

  it('falls back to "Request failed" when the error body has no error field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }));

    await expect(admin.getInventory()).rejects.toThrow('Request failed');
  });

  it('falls back to "Request failed" when the response body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => { throw new SyntaxError('not json'); },
    }));

    await expect(admin.getInventory()).rejects.toThrow('Request failed');
  });
});
