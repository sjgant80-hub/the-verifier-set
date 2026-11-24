// gem.js — the glass. Draws a lattice (src/lattice.mjs) as a crystal on WebGL2: one octahedron for every cell, on
// the lattice place the cell took, all cut the same way, so that faces across the whole stone catch the light
// together. It draws what it is given and decides nothing: a facet cannot light without a bond in the record, and a
// shatter is a dissolve in the record.
//   seed 0 · bond 1 · home 2 · dissolve 3 · dark 4 · cite 5 (a figure quoted from a document) · rule 6 (a formula
//   that passed its tests) · claim 7 (a claim the solver decided)
// PROVENANCE IS IN THE MATERIAL. A proven facet is bright, solid and hard-edged. A grounded facet (a cited figure,
// and everything that stands on one) is soft: dimmer, warm in hue, its edges unlit. A facet proven against its tests
// takes an orchid hue and half its edge; one proven within its encoding takes a leaf-green hue and most of its edge.
// The lattice says which a cell is (cell.material: 0 proven, 1 grounded, 2 tests, 3 encoding); the glass only draws
// it. The material is carried with the kind, as ten more for each step.
// Budget: the model shares this GPU. Facets are instanced (one draw call), the bloom is done at a quarter of the
// size, the pixel ratio is capped, and while the model is writing the glass redraws only when something changed.
const KIND = { seed: 0, bond: 1, home: 2, dissolve: 3, dark: 4, cite: 5, rule: 6, claim: 7 };
const MAX = 8192, SHARDS = 9, UNIT = 0.5;

const VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor;
layout(location=2) in vec3 iPos; layout(location=3) in float iSize;
layout(location=5) in float iKind; layout(location=6) in float iBirth; layout(location=8) in float iPulse; layout(location=9) in float iDepth;
uniform mat4 uVP; uniform float uTime;
out vec3 vN; out vec3 vW; out vec3 vL; out float vKind; out float vAge; out float vPulse; out float vDepth; out float vSoft;
void main() {
  float age = uTime - iBirth, soft = floor((iKind + 0.5) / 10.0), kind = iKind - 10.0 * soft;
  // not there until its moment; then it grows in, a little past its size and back
  float g = clamp(age / 1.4, 0.0, 1.0), grow = age < 0.0 ? 0.0 : g * (1.0 + 0.30 * sin(g * 3.14159));
  // a dissolved cell forms and then is gone: what stays is a small dark stump
  if (kind > 2.5 && kind < 3.5) grow *= mix(1.0, 0.30, clamp((age - 0.6) / 0.8, 0.0, 1.0));
  vec3 p = iPos + aPos * iSize * grow;
  vN = aNor; vW = p; vL = aPos; vKind = kind; vSoft = soft; vAge = age; vPulse = uTime - iPulse; vDepth = iDepth;
  gl_Position = uVP * vec4(p, 1.0);
}`;
const FS = `#version 300 es
precision highp float;
in vec3 vN; in vec3 vW; in vec3 vL; in float vKind; in float vAge; in float vPulse; in float vDepth; in float vSoft;
uniform vec3 uEye;
out vec4 o;
// the water the crystal stands in: near black, with four soft lights for the stone to catch
vec3 env(vec3 d) {
  vec3 c = mix(vec3(0.002, 0.008, 0.016), vec3(0.010, 0.040, 0.062), d.y * 0.5 + 0.5);
  c += vec3(0.37, 0.95, 0.89) * pow(max(dot(d, normalize(vec3(0.5, 0.8, 0.3))), 0.0), 26.0) * 2.4;
  c += vec3(0.29, 0.71, 1.00) * pow(max(dot(d, normalize(vec3(-0.7, 0.2, 0.6))), 0.0), 12.0) * 1.1;
  c += vec3(0.65, 0.59, 1.00) * pow(max(dot(d, normalize(vec3(0.1, -0.6, -0.8))), 0.0), 9.0) * 0.9;
  c += vec3(1.00, 0.75, 0.47) * pow(max(dot(d, normalize(vec3(-0.3, 0.9, -0.3))), 0.0), 80.0) * 3.0;
  return c;
}
void main() {
  vec3 N = normalize(vN), V = normalize(uEye - vW);
  if (dot(N, V) < 0.0) N = -N;
  float nv = max(dot(N, V), 0.0), F = 0.06 + 0.94 * pow(1.0 - nv, 5.0);
  vec3 refl = env(reflect(-V, N));
  // light through the stone, bent a little differently for each colour: the fire
  vec3 thru = vec3(env(refract(-V, N, 0.735)).r, env(refract(-V, N, 0.700)).g, env(refract(-V, N, 0.665)).b);
  // the colour of a bond moves from the seed's green-blue to violet as depth grows: the fourth axis, drawn twice
  vec3 deep = mix(vec3(0.42, 1.00, 0.92), vec3(0.60, 0.62, 1.00), clamp(vDepth / 9.0, 0.0, 1.0));
  vec3 tint = vKind < 0.5 ? vec3(0.70, 0.82, 0.86) : vKind < 1.5 ? deep : vKind < 2.5 ? vec3(1.00, 0.88, 0.62) : vKind < 3.5 ? vec3(0.60, 0.10, 0.14) : vKind < 4.5 ? vec3(0.05, 0.07, 0.09) : vKind < 5.5 ? vec3(1.00, 0.62, 0.30) : vKind < 6.5 ? vec3(0.83, 0.55, 1.00) : vec3(0.61, 0.89, 0.48);
  float lit = vKind < 0.5 ? 0.70 : vKind < 1.5 ? 1.0 : vKind < 2.5 ? 1.7 : vKind < 3.5 ? 0.22 : vKind < 4.5 ? 0.0 : vKind < 5.5 ? 0.9 : 1.0;
  // grounded, not proven: the facet takes the warm hue of the cited ground it stands on, holds less light, and
  // loses its bright edge. Proven against its tests: orchid, a little dimmer, half its edge. Proven within its
  // encoding: leaf green, a little dimmer, most of its edge. Proven facets are left exactly as they were.
  float grounded = step(0.5, vSoft) * step(vSoft, 1.5), tested = step(1.5, vSoft) * step(vSoft, 2.5), encoded = step(2.5, vSoft);
  float hard = 1.0 - grounded - 0.5 * tested - 0.3 * encoded;
  if (vKind < 4.5) { tint = mix(tint, vec3(1.00, 0.66, 0.36), 0.58 * grounded); tint = mix(tint, vec3(0.83, 0.55, 1.00), 0.55 * tested); tint = mix(tint, vec3(0.61, 0.89, 0.48), 0.55 * encoded); lit *= 1.0 - 0.50 * grounded - 0.22 * tested - 0.15 * encoded; }
  // the edges of a cut stone are where it is brightest
  float edge = smoothstep(0.90, 1.0, max(max(abs(vL.x) + abs(vL.y), abs(vL.y) + abs(vL.z)), abs(vL.x) + abs(vL.z)));
  // the flash as it sets, and again each time something already set is used
  float flash = (vAge >= 0.0 ? exp(-vAge * 1.5) : 0.0) * (vKind < 3.5 || vKind > 4.5 ? 1.0 : 0.0) + (vPulse >= 0.0 ? exp(-vPulse * 1.8) * 0.9 : 0.0);
  // a face is dark and clear until a light lines up through it; then it fires
  vec3 body = thru * thru * tint * 5.0 * lit + thru * tint * 0.55 * lit + tint * 0.012 * lit;
  vec3 col = mix(body, refl * (0.25 + 0.75 * step(0.01, lit)) * (0.35 + 0.65 * hard), F) + tint * (edge * 0.16 * lit * hard + flash * (1.2 + 1.2 * hard));
  // a dark cell is glass with no light in it: only its edge shows
  if (vKind > 3.5 && vKind < 4.5) col = refl * F * 0.45 + vec3(0.010, 0.016, 0.022) * edge;
  o = vec4(col, 1.0);
}`;
const LINE_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in float aBirth;
uniform mat4 uVP; uniform float uTime; out float vA;
void main() { float age = uTime - aBirth; vA = age < 0.0 ? 0.0 : 0.03 + exp(-age * 0.7); gl_Position = uVP * vec4(aPos, 1.0); }`;
const LINE_FS = `#version 300 es
precision highp float; in float vA; out vec4 o; void main() { o = vec4(vec3(0.37, 0.95, 0.89) * vA * 0.55, 1.0); }`;
const SHARD_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=2) in vec3 iPos; layout(location=3) in vec3 iDir; layout(location=6) in float iBirth; layout(location=7) in float iSeed;
uniform mat4 uVP; uniform float uTime; out float vA;
void main() {
  float t = uTime - iBirth - 0.6, live = step(0.0, t) * step(t, 3.2);
  vec3 p = iPos + iDir * (0.50 * t) - vec3(0.0, 0.06, 0.0) * t * t;
  float s = 0.11 * (1.0 - t / 3.2) * live, a = iSeed * 40.0 + t * 4.0;
  mat3 r = mat3(cos(a), sin(a), 0.0, -sin(a), cos(a), 0.0, 0.0, 0.0, 1.0);
  vA = live * (1.0 - t / 3.2);
  gl_Position = uVP * vec4(p + r * aPos * s, 1.0);
}`;
const SHARD_FS = `#version 300 es
precision highp float; in float vA; out vec4 o; void main() { o = vec4(vec3(1.0, 0.39, 0.44) * vA * 1.4, 1.0); }`;
const QUAD_VS = `#version 300 es
layout(location=0) in vec2 aPos; out vec2 vUv; void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
const BRIGHT_FS = `#version 300 es
precision highp float; in vec2 vUv; uniform sampler2D uTex; out vec4 o;
void main() { vec3 c = texture(uTex, vUv).rgb; float l = max(c.r, max(c.g, c.b)); o = vec4(min(c, vec3(6.0)) * smoothstep(0.9, 2.2, l), 1.0); }`;
const BLUR_FS = `#version 300 es
precision highp float; in vec2 vUv; uniform sampler2D uTex; uniform vec2 uDir; out vec4 o;
void main() {
  vec3 c = texture(uTex, vUv).rgb * 0.227;
  c += (texture(uTex, vUv + uDir * 1.385).rgb + texture(uTex, vUv - uDir * 1.385).rgb) * 0.316;
  c += (texture(uTex, vUv + uDir * 3.231).rgb + texture(uTex, vUv - uDir * 3.231).rgb) * 0.070;
  o = vec4(c, 1.0);
}`;
const COMP_FS = `#version 300 es
precision highp float; in vec2 vUv; uniform sampler2D uScene; uniform sampler2D uBloom; uniform float uGlow; out vec4 o;
void main() {
  vec3 c = texture(uScene, vUv).rgb + texture(uBloom, vUv).rgb * uGlow;
  vec2 q = vUv - 0.5;
  // the ground: #02070c (as light, before the screen's curve), a breath lighter behind the stone
  vec3 ground = vec3(0.00061, 0.00212, 0.00368) * (1.0 + 1.6 * exp(-dot(q, q) * 5.0));
  c = ground + c;
  c = c / (1.0 + c * 0.55);
  c *= 1.0 - 0.35 * dot(q, q);
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  o = vec4(pow(c, vec3(1.0 / 2.2)) + (n - 0.5) / 255.0, 1.0);
}`;

// the stone: an octahedron, the shape a diamond grows in, with eight flat faces. Returns positions and face normals.
export function stone() {
  const pos = [], nor = [], q = 1 / Math.sqrt(3);
  for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
    // each face joins the three points on its side; wound so that it faces outwards
    const a = [sx, 0, 0], b = [0, sy, 0], c = [0, 0, sz], face = sx * sy * sz > 0 ? [a, b, c] : [a, c, b];
    for (const p of face) { pos.push(...p); nor.push(sx * q, sy * q, sz * q); }
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), count: pos.length / 3 };
}
// camera(yaw, pitch, dist, aspect) → { vp, eye }: a view of the centre from a distance, as a column-major matrix
export function camera(yaw, pitch, dist, aspect) {
  const eye = [dist * Math.cos(pitch) * Math.sin(yaw), dist * Math.sin(pitch), dist * Math.cos(pitch) * Math.cos(yaw)];
  const f = [-eye[0] / dist, -eye[1] / dist, -eye[2] / dist], s0 = [-f[2], 0, f[0]], sl = Math.hypot(s0[0], s0[2]) || 1, s = [s0[0] / sl, 0, s0[2] / sl];
  const u = [s[1] * f[2] - s[2] * f[1], s[2] * f[0] - s[0] * f[2], s[0] * f[1] - s[1] * f[0]];
  const view = [s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0, -(s[0] * eye[0] + s[1] * eye[1] + s[2] * eye[2]), -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]), f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2], 1];
  const t = 1 / Math.tan((38 * Math.PI) / 360), near = 0.1, far = 400;
  const proj = [t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0];
  const vp = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) vp[c * 4 + r] = proj[r] * view[c * 4] + proj[4 + r] * view[c * 4 + 1] + proj[8 + r] * view[c * 4 + 2] + proj[12 + r] * view[c * 4 + 3];
  return { vp, eye };
}
// sizeOf(kind) → how far a cell's octahedron reaches from its place. A bond fills its place edge to edge with its
// neighbours; a crown stands a little proud; a seed, a dissolve and a dark cell are a little smaller.
export const sizeOf = (kind) => UNIT * (kind === 'home' ? 1.12 : kind === 'bond' ? 0.97 : kind === 'cite' || kind === 'rule' || kind === 'claim' ? 0.92 : kind === 'seed' ? 0.86 : 0.80);
// materialOf(cell) → the material a cell is drawn in: 0 proven, 1 grounded, 2 proven against its tests, 3 proven within
// its encoding (a cell that says only soft is grounded)
export const materialOf = (cell) => (Number.isInteger(cell.material) && cell.material >= 0 && cell.material <= 3 ? cell.material : cell.soft === true ? 1 : 0);
// placeOf(cell) → where a cell stands in the scene
export const placeOf = (cell) => [cell.pos[0] * UNIT, cell.pos[1] * UNIT, cell.pos[2] * UNIT];

export function createGem(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const float = !!gl.getExtension('EXT_color_buffer_float');
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s)); return s; };
  const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('program: ' + gl.getProgramInfoLog(p)); return p; };
  const P = { gem: prog(VS, FS), line: prog(LINE_VS, LINE_FS), shard: prog(SHARD_VS, SHARD_FS), bright: prog(QUAD_VS, BRIGHT_FS), blur: prog(QUAD_VS, BLUR_FS), comp: prog(QUAD_VS, COMP_FS) };
  const U = (p, n) => gl.getUniformLocation(p, n);
  const buf = (data, usage) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, usage || gl.STATIC_DRAW); return b; };
  const cut = stone();
  // facets
  const vaoGem = gl.createVertexArray(); gl.bindVertexArray(vaoGem);
  buf(cut.pos); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  buf(cut.nor); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
  const STRIDE = 8, PULSE = 6, inst = new Float32Array(MAX * STRIDE), instBuf = buf(inst, gl.DYNAMIC_DRAW);
  [[2, 3, 0], [3, 1, 3], [5, 1, 4], [6, 1, 5], [8, 1, 6], [9, 1, 7]].forEach(([loc, n, off]) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, STRIDE * 4, off * 4); gl.vertexAttribDivisor(loc, 1); });
  // links
  const vaoLine = gl.createVertexArray(); gl.bindVertexArray(vaoLine);
  const lines = new Float32Array(MAX * 2 * 4), lineBuf = buf(lines, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 12);
  // shards
  const vaoShard = gl.createVertexArray(); gl.bindVertexArray(vaoShard);
  buf(new Float32Array([0, 0, 1, 0.9, 0, -0.4, -0.5, 0.8, -0.4, 0, 0, 1, -0.5, 0.8, -0.4, -0.5, -0.8, -0.4, 0, 0, 1, -0.5, -0.8, -0.4, 0.9, 0, -0.4, 0.9, 0, -0.4, -0.5, -0.8, -0.4, -0.5, 0.8, -0.4]));
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  const SS = 8, shards = new Float32Array(2048 * SS), shardBuf = buf(shards, gl.DYNAMIC_DRAW);
  [[2, 3, 0], [3, 3, 3], [6, 1, 6], [7, 1, 7]].forEach(([loc, n, off]) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, SS * 4, off * 4); gl.vertexAttribDivisor(loc, 1); });
  // the screen
  const vaoQuad = gl.createVertexArray(); gl.bindVertexArray(vaoQuad);
  buf(new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const S = { cells: [], n: 0, nLines: 0, nShards: 0, pulses: [], time: 0, span: 0, depth: 0, yaw: 0.6, pitch: 0.42, dist: 6, wantDist: 6, busy: false, dirty: true, drag: null, spin: true, frames: 0, w: 0, h: 0, fbo: null, last: 0 };
  const target = (w, h, depth) => {
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, float ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    let rb = null;
    if (depth) { rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb); }
    return { fb, tex, rb, w, h };
  };
  const drop = (t) => { if (!t) return; gl.deleteFramebuffer(t.fb); gl.deleteTexture(t.tex); if (t.rb) gl.deleteRenderbuffer(t.rb); };
  function resize() {
    const ratio = Math.min(globalThis.devicePixelRatio || 1, S.busy ? 1 : 1.5), w = Math.max(2, Math.floor(canvas.clientWidth * ratio)), h = Math.max(2, Math.floor(canvas.clientHeight * ratio));
    if (w === S.w && h === S.h) return;
    S.w = w; S.h = h; canvas.width = w; canvas.height = h;
    if (S.fbo) Object.values(S.fbo).forEach(drop);
    const q = (n) => Math.max(2, Math.floor(n / 4));
    S.fbo = { scene: target(w, h, true), a: target(q(w), q(h), false), b: target(q(w), q(h), false) };
    S.dirty = true;
  }
  // setLattice(L) → the cells, links and shards the lattice holds, loaded for drawing
  function setLattice(L) {
    const all = L && L.cells ? L.cells : [], at = new Map(), cells = [];
    // a cell with no place is not drawn; links and pulses follow the cells that are
    all.forEach((c, i) => { if (c.site >= 0 && cells.length < MAX) { at.set(i, cells.length); cells.push(c); } });
    S.cells = cells; S.n = cells.length; S.span = L ? L.span : 0; S.depth = L ? L.depth : 0;
    S.pulses = (L && L.pulses ? L.pulses : []).filter((p) => at.has(p.cell)).map((p) => ({ cell: at.get(p.cell), at: p.at }));
    let ns = 0, far = 1;
    cells.forEach((c, i) => {
      const p = placeOf(c), seed = ((i * 0.61803398875) % 1 + (c.chamber || 0) * 0.083) % 1, out = Math.hypot(p[0], p[1], p[2]) || 1;
      far = Math.max(far, out);
      inst.set([p[0], p[1], p[2], sizeOf(c.kind), (KIND[c.kind] ?? 4) + 10 * materialOf(c), c.at, -1e6, c.depth || 0], i * STRIDE);
      // a dissolve throws its pieces outwards, away from the centre
      if (c.kind === 'dissolve' && ns + SHARDS <= 2048) for (let k = 0; k < SHARDS; k++) {
        const a = k * 2.399963 + seed * 6.28, z = 1 - (2 * (k + 0.5)) / SHARDS, r = Math.sqrt(Math.max(0, 1 - z * z));
        shards.set([p[0], p[1], p[2], r * Math.cos(a) + (p[0] / out) * 0.7, z + (p[1] / out) * 0.7, r * Math.sin(a) + (p[2] / out) * 0.7, c.at, (seed + k * 0.37) % 1], ns * SS); ns++;
      }
    });
    S.nShards = ns;
    const links = (L && L.links ? L.links : []).filter((l) => at.has(l.from) && at.has(l.to)).slice(0, MAX);
    links.forEach((l, i) => { const a = placeOf(cells[at.get(l.from)]), b = placeOf(cells[at.get(l.to)]); lines.set([a[0], a[1], a[2], l.at, b[0], b[1], b[2], l.at], i * 8); });
    S.nLines = links.length;
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst.subarray(0, Math.max(STRIDE, S.n * STRIDE)));
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, lines.subarray(0, Math.max(8, S.nLines * 8)));
    gl.bindBuffer(gl.ARRAY_BUFFER, shardBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, shards.subarray(0, Math.max(SS, ns * SS)));
    S.wantDist = Math.max(4.2, far * 2.5 + 1.6);
    // the first crystal is shown from where it fits; after that the view follows its growth gently
    if (!S.seen) { S.dist = S.wantDist; S.seen = true; }
    S.dirty = true;
  }
  // setTime(t) → the moment shown. Cells that set after it are not drawn; pulses up to it are lit.
  function setTime(t) {
    S.time = t;
    // the latest use of each cell at or before this moment
    const latest = new Map(); for (const p of S.pulses) if (p.at <= t) latest.set(p.cell, Math.max(latest.get(p.cell) ?? -1e6, p.at));
    for (let i = 0; i < S.n; i++) inst[i * STRIDE + PULSE] = latest.get(i) ?? -1e6;
    if (S.n) { gl.bindBuffer(gl.ARRAY_BUFFER, instBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst.subarray(0, S.n * STRIDE)); }
    S.dirty = true;
  }
  const quad = (p, fbo, w, h) => { gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, w, h); gl.useProgram(p); gl.bindVertexArray(vaoQuad); };
  function draw() {
    resize();
    const cam = camera(S.yaw, S.pitch, S.dist, S.w / S.h), F = S.fbo;
    gl.bindFramebuffer(gl.FRAMEBUFFER, F.scene.fb); gl.viewport(0, 0, S.w, S.h);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    if (S.n) {
      gl.useProgram(P.gem); gl.uniformMatrix4fv(U(P.gem, 'uVP'), false, cam.vp); gl.uniform1f(U(P.gem, 'uTime'), S.time); gl.uniform3fv(U(P.gem, 'uEye'), cam.eye);
      gl.bindVertexArray(vaoGem); gl.drawArraysInstanced(gl.TRIANGLES, 0, cut.count, S.n);
    }
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
    if (S.nLines) { gl.useProgram(P.line); gl.uniformMatrix4fv(U(P.line, 'uVP'), false, cam.vp); gl.uniform1f(U(P.line, 'uTime'), S.time); gl.bindVertexArray(vaoLine); gl.drawArrays(gl.LINES, 0, S.nLines * 2); }
    if (S.nShards) { gl.useProgram(P.shard); gl.uniformMatrix4fv(U(P.shard, 'uVP'), false, cam.vp); gl.uniform1f(U(P.shard, 'uTime'), S.time); gl.bindVertexArray(vaoShard); gl.drawArraysInstanced(gl.TRIANGLES, 0, 12, S.nShards); }
    gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    // the light that spills: bright parts, a quarter of the size, blurred across and down
    quad(P.bright, F.a.fb, F.a.w, F.a.h); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, F.scene.tex); gl.uniform1i(U(P.bright, 'uTex'), 0); gl.drawArrays(gl.TRIANGLES, 0, 6);
    for (let k = 0; k < 2; k++) {
      quad(P.blur, F.b.fb, F.b.w, F.b.h); gl.bindTexture(gl.TEXTURE_2D, F.a.tex); gl.uniform1i(U(P.blur, 'uTex'), 0); gl.uniform2f(U(P.blur, 'uDir'), (1 + k) / F.a.w, 0); gl.drawArrays(gl.TRIANGLES, 0, 6);
      quad(P.blur, F.a.fb, F.a.w, F.a.h); gl.bindTexture(gl.TEXTURE_2D, F.b.tex); gl.uniform2f(U(P.blur, 'uDir'), 0, (1 + k) / F.a.h); gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    quad(P.comp, null, S.w, S.h); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, F.scene.tex); gl.uniform1i(U(P.comp, 'uScene'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, F.a.tex); gl.uniform1i(U(P.comp, 'uBloom'), 1); gl.uniform1f(U(P.comp, 'uGlow'), 0.55); gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.activeTexture(gl.TEXTURE0); gl.bindVertexArray(null);
    S.frames++; S.dirty = false;
  }
  function frame(now) {
    S.raf = requestAnimationFrame(frame);
    const gap = S.busy ? 1000 / 12 : 1000 / 30;
    if (now - S.last < gap) return;
    const dt = Math.min(0.1, (now - S.last) / 1000); S.last = now;
    if (Math.abs(S.wantDist - S.dist) > 0.01) { S.dist += (S.wantDist - S.dist) * Math.min(1, dt * 2.5); S.dirty = true; }
    // it turns slowly by itself, except while the model has the GPU or a hand is on it
    if (S.spin && !S.busy && !S.drag) { S.yaw += dt * 0.07; S.dirty = true; }
    if (S.dirty) draw();
  }
  // a hand on the glass: drag to turn, wheel to come closer
  const down = (e) => { S.drag = { x: e.clientX, y: e.clientY, yaw: S.yaw, pitch: S.pitch }; if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId); };
  const move = (e) => { if (!S.drag) return; S.yaw = S.drag.yaw - (e.clientX - S.drag.x) * 0.006; S.pitch = Math.max(-1.3, Math.min(1.3, S.drag.pitch + (e.clientY - S.drag.y) * 0.005)); S.dirty = true; };
  const up = () => { S.drag = null; };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); S.wantDist = Math.max(2.5, Math.min(120, S.wantDist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
  // pick(x, y) → the cell under a point of the canvas (CSS pixels), among those already set at this moment, or null:
  // the nearest to the eye of those the point falls on
  function pick(x, y) {
    const m = camera(S.yaw, S.pitch, S.dist, S.w / S.h).vp;
    let best = null, bestZ = Infinity;
    S.cells.forEach((c, i) => {
      if (c.at > S.time) return;
      const p = placeOf(c), w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
      if (w <= 0 || w >= bestZ) return;
      const sx = ((m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w * 0.5 + 0.5) * canvas.clientWidth, sy = (1 - ((m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w * 0.5 + 0.5)) * canvas.clientHeight;
      // how big a cell looks from here, in CSS pixels
      const reach = Math.max(10, (sizeOf(c.kind) * 0.8 * canvas.clientHeight) / (2 * Math.tan((38 * Math.PI) / 360) * w));
      if ((sx - x) ** 2 + (sy - y) ** 2 <= reach * reach) { best = i; bestZ = w; }
    });
    return best === null ? null : { index: best, cell: S.cells[best] };
  }
  // probe() → what is on the glass right now, read back from the GPU: for checking that it draws
  function probe() {
    draw();
    const px = new Uint8Array(S.w * S.h * 4); gl.readPixels(0, 0, S.w, S.h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let lit = 0, sum = 0, max = 0;
    for (let i = 0; i < px.length; i += 4) { const l = Math.max(px[i], px[i + 1], px[i + 2]); sum += l; if (l > 60) lit++; if (l > max) max = l; }
    return { w: S.w, h: S.h, cells: S.n, links: S.nLines, shards: S.nShards, lit: lit / (S.w * S.h), mean: sum / (S.w * S.h), max, corner: [px[0], px[1], px[2]], float, frames: S.frames, error: gl.getError() };
  }
  resize(); S.dist = S.wantDist;
  S.raf = requestAnimationFrame(frame);
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => { S.dirty = true; }).observe(canvas);
  return { setLattice, setTime, pick, probe, draw, state: S, setBusy(b) { S.busy = !!b; S.dirty = true; }, setSpin(b) { S.spin = !!b; }, stop() { cancelAnimationFrame(S.raf); } };
}
