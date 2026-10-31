import test from 'node:test';
import assert from 'node:assert/strict';
import { requestStatusLabel } from './request-status.ts';

test('requestStatusLabel maps new join request states', () => {
  assert.equal(requestStatusLabel('pending'), 'مستني رد الكابتن');
  assert.equal(requestStatusLabel('accepted'), 'مقبول');
  assert.equal(requestStatusLabel('rejected'), 'مرفوض');
  assert.equal(requestStatusLabel('cancelled'), 'ملغي');
  assert.equal(requestStatusLabel('expired'), 'منتهي');
  assert.equal(requestStatusLabel('open'), 'مفتوح');
  assert.equal(requestStatusLabel('matched'), 'تم العثور على مسار');
  assert.equal(requestStatusLabel(null), 'الحالة غير متاحة من الخادم');
});
