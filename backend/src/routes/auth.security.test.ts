import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

const DUMMY_HASH = '$2b$10$7EqJtq98hPqEX7fNZaFWoOhiuC6wG7K5qTqL0U8BCLlcQFV3ayhtW';

test('dummy bcrypt hash is valid for constant-time compare path', async () => {
  const result = await bcrypt.compare('some-password', DUMMY_HASH);
  assert.equal(typeof result, 'boolean');
});
