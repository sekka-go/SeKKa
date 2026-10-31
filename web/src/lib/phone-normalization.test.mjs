import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEgyptianPhone } from './sekka-api.ts';

test('normalizes Egyptian mobile numbers', () => {
  assert.equal(normalizeEgyptianPhone('01012345678'), '+201012345678');
  assert.equal(normalizeEgyptianPhone('+201012345678'), '+201012345678');
  assert.equal(normalizeEgyptianPhone('201012345678'), '+201012345678');
  assert.equal(normalizeEgyptianPhone('00201012345678'), '+201012345678');
});

test('rejects invalid Egyptian mobile numbers', () => {
  assert.equal(normalizeEgyptianPhone('0101234567'), '0101234567');
  assert.equal(normalizeEgyptianPhone('21012345678'), '21012345678');
  assert.equal(normalizeEgyptianPhone('999012345678'), '999012345678');
  assert.equal(normalizeEgyptianPhone('001234567890'), '001234567890');
});
