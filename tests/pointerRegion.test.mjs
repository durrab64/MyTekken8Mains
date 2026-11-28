import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NEUTRAL_FORMATION_POINTER,
  normalizePointerToRegion,
  resolveFormationPointer,
} from '../src/graphics/pointerRegion.ts';

const rect = { left: 100, top: 50, width: 400, height: 200 };

test('normalizes the region center to 0.5 / 0.5', () => {
  assert.deepEqual(normalizePointerToRegion(300, 150, rect), { x: 0.5, y: 0.5 });
});

test('maps the region corners with a y-up WebGL origin', () => {
  assert.deepEqual(normalizePointerToRegion(100, 50, rect), { x: 0, y: 1 }); // top-left
  assert.deepEqual(normalizePointerToRegion(500, 50, rect), { x: 1, y: 1 }); // top-right
  assert.deepEqual(normalizePointerToRegion(100, 250, rect), { x: 0, y: 0 }); // bottom-left
  assert.deepEqual(normalizePointerToRegion(500, 250, rect), { x: 1, y: 0 }); // bottom-right
});

test('treats the region edges as inside the interaction boundary', () => {
  assert.deepEqual(normalizePointerToRegion(100, 150, rect), { x: 0, y: 0.5 });
  assert.deepEqual(normalizePointerToRegion(500, 150, rect), { x: 1, y: 0.5 });
  assert.deepEqual(normalizePointerToRegion(300, 50, rect), { x: 0.5, y: 1 });
  assert.deepEqual(normalizePointerToRegion(300, 250, rect), { x: 0.5, y: 0 });
});

test('rejects points outside every edge', () => {
  assert.equal(normalizePointerToRegion(99, 150, rect), null);
  assert.equal(normalizePointerToRegion(501, 150, rect), null);
  assert.equal(normalizePointerToRegion(300, 49, rect), null);
  assert.equal(normalizePointerToRegion(300, 251, rect), null);
});

test('rejects missing, collapsed, and non-finite inputs', () => {
  assert.equal(normalizePointerToRegion(300, 150, null), null);
  assert.equal(normalizePointerToRegion(300, 150, { ...rect, width: 0 }), null);
  assert.equal(normalizePointerToRegion(300, 150, { ...rect, height: -1 }), null);
  assert.equal(normalizePointerToRegion(Number.NaN, 150, rect), null);
  assert.equal(normalizePointerToRegion(300, Number.POSITIVE_INFINITY, rect), null);
});

test('resolves outside points to the neutral sentry', () => {
  assert.deepEqual(resolveFormationPointer(0, 0, rect), { ...NEUTRAL_FORMATION_POINTER });
  assert.deepEqual(resolveFormationPointer(300, 150, null), { ...NEUTRAL_FORMATION_POINTER });
});

test('rapid boundary crossings never retain a previous region position', () => {
  const first = resolveFormationPointer(300, 150, rect); // inside, center
  const outside = resolveFormationPointer(700, 150, rect); // right of region
  const movedRect = { left: 700, top: 50, width: 400, height: 200 };
  const second = resolveFormationPointer(700, 150, movedRect); // inside new region, left edge

  assert.deepEqual(first, { x: 0.5, y: 0.5 });
  assert.deepEqual(outside, { ...NEUTRAL_FORMATION_POINTER });
  assert.deepEqual(second, { x: 0, y: 0.5 });
});

test('the neutral sentry is outside the normalized field', () => {
  assert.ok(NEUTRAL_FORMATION_POINTER.x > 1);
  assert.ok(NEUTRAL_FORMATION_POINTER.y > 1);
});
