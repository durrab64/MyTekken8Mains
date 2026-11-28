import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.location = new URL('http://localhost/');
const { particleVertexSource } = await import('../src/graphics/shaders.ts');

test('the Lars formation branch consumes the formation pointer uniform', () => {
  const larsStart = particleVertexSource.indexOf('if(uFormation==4)');
  const analyticStart = particleVertexSource.indexOf('if (uFormation < 4)');

  assert.ok(larsStart >= 0, 'Lars formation branch should exist');
  assert.ok(analyticStart > larsStart, 'Lars branch should precede the analytic formations');

  const larsBranch = particleVertexSource.slice(larsStart, analyticStart);
  assert.match(larsBranch, /uPointer/);
  assert.match(larsBranch, /pointerFall/);
});
