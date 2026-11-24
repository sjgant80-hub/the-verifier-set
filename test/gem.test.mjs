import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stone, camera, sizeOf, placeOf, materialOf } from '../page/gem.js';
import { MATERIAL } from '../src/facets.mjs';

test('each strength is its own material, as the lattice numbers it; a rule and a claim are drawn the size of a cited figure', () => {
  for (const [strength, m] of Object.entries(MATERIAL)) assert.equal(materialOf({ material: m, soft: strength === 'grounded' }), m, strength);
  assert.deepEqual([materialOf({ soft: true }), materialOf({ soft: false }), materialOf({}), materialOf({ material: 4 }), materialOf({ material: -1, soft: true }), materialOf({ material: 1.5 }), materialOf({ material: '2' })], [1, 0, 0, 0, 1, 0, 0]);
  assert.equal(sizeOf('rule'), sizeOf('cite')); assert.equal(sizeOf('claim'), sizeOf('cite')); assert.ok(sizeOf('cite') < sizeOf('bond') && sizeOf('cite') > sizeOf('seed'));
});

const proj = (m, v) => { const w = m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15]; return [(m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12]) / w, (m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13]) / w, w]; };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('the stone is an octahedron: eight flat faces, every one facing outwards, every corner one unit out', () => {
  const s = stone();
  assert.equal(s.count, 24); assert.equal(s.pos.length, 72); assert.equal(s.nor.length, 72);
  const faces = new Set();
  for (let i = 0; i < s.count; i += 3) {
    const p = [0, 1, 2].map((k) => [s.pos[(i + k) * 3], s.pos[(i + k) * 3 + 1], s.pos[(i + k) * 3 + 2]]), n = [s.nor[i * 3], s.nor[i * 3 + 1], s.nor[i * 3 + 2]];
    for (const v of p) assert.ok(near(Math.abs(v[0]) + Math.abs(v[1]) + Math.abs(v[2]), 1), 'a corner is one unit out along an axis');
    for (let k = 1; k < 3; k++) assert.deepEqual([s.nor[(i + k) * 3], s.nor[(i + k) * 3 + 1], s.nor[(i + k) * 3 + 2]], n, 'one normal for the whole face');
    assert.ok(near(Math.hypot(...n), 1));
    // the winding and the normal agree, and both point away from the centre
    const u = p[1].map((x, k) => x - p[0][k]), v = p[2].map((x, k) => x - p[0][k]), c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    assert.ok(c[0] * n[0] + c[1] * n[1] + c[2] * n[2] > 0); assert.ok(p[0][0] * n[0] + p[0][1] * n[1] + p[0][2] * n[2] > 0);
    faces.add(n.map((x) => Math.sign(x)).join(','));
  }
  assert.equal(faces.size, 8);
});

test('the camera looks at the centre: the centre is the middle of the picture, right is right and up is up', () => {
  for (const [yaw, pitch, dist, aspect] of [[0, 0, 10, 1.5], [1.1, 0.4, 7, 1], [-2.3, -0.9, 30, 0.6], [3.9, 1.2, 4, 2]]) {
    const { vp, eye } = camera(yaw, pitch, dist, aspect), c = proj(vp, [0, 0, 0]);
    assert.ok(near(Math.hypot(...eye), dist)); assert.ok(near(c[0], 0) && near(c[1], 0) && near(c[2], dist));
    // a point towards the camera's right-hand side lands right of the middle, a point above lands above
    const f = eye.map((x) => -x / dist), right = [-f[2], 0, f[0]], rl = Math.hypot(...right), r = right.map((x) => x / rl), up = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    assert.ok(proj(vp, r)[0] > 0.01 && near(proj(vp, r)[1], 0)); assert.ok(proj(vp, up)[1] > 0.01 && near(proj(vp, up)[0], 0));
    assert.ok(proj(vp, eye.map((x) => x * 0.5))[2] < dist, 'nearer the eye is nearer');
    // a wider picture shows more to the sides and the same up and down
    assert.ok(near(proj(camera(yaw, pitch, dist, aspect * 2).vp, r)[0] * 2, proj(vp, r)[0])); assert.ok(near(proj(camera(yaw, pitch, dist, aspect * 2).vp, up)[1], proj(vp, up)[1]));
  }
  assert.deepEqual(camera(0, 0, 10, 1).eye, [0, 0, 10]);
});

test('a bond fills its place, a crown stands proud, and a cell stands on its lattice place', () => {
  assert.ok(sizeOf('home') > sizeOf('bond') && sizeOf('bond') > sizeOf('seed') && sizeOf('seed') > sizeOf('dark')); assert.equal(sizeOf('dissolve'), sizeOf('dark')); assert.equal(sizeOf('anything else'), sizeOf('dark'));
  // neighbouring places are (1, 1, 0) apart; two bonds on them reach just short of each other along that line
  const a = placeOf({ pos: [0, 0, 0] }), b = placeOf({ pos: [1, 1, 0] }), gap = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  assert.ok(near(gap, Math.SQRT1_2)); assert.ok(2 * sizeOf('bond') / Math.SQRT2 <= gap && 2 * sizeOf('bond') / Math.SQRT2 > gap * 0.9);
  assert.deepEqual(placeOf({ pos: [2, 0, -2] }), [1, 0, -1]);
});
