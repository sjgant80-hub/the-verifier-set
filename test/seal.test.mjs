import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const at = (p) => new URL(`../${p}`, import.meta.url);
const rd = (p) => JSON.parse(readFileSync(at(p), 'utf8'));
const under = (dir) => readdirSync(at(`${dir}/`)).filter((f) => f.endsWith('.mjs')).map((f) => `${dir}/${f}`);

test('what it stands on is The Crystal as its seal froze it, and DocDec\'s gate at a fixed commit: every vendored file has its recorded hash', () => {
  const p = rd('vendor/PROVENANCE.json');
  assert.equal(p.crystal.repo, 'sjgant80-hub/the-crystal'); assert.match(p.crystal.commit, /^[0-9a-f]{40}$/); assert.match(p.crystal.sealSha256, /^[0-9a-f]{64}$/); assert.equal(p.docdec.repo, 'sjgant80-hub/docdecdemo'); assert.match(p.docdec.commit, /^[0-9a-f]{40}$/);
  const have = [...under('vendor/crystal/src'), ...under('vendor/crystal/vendor/climb/src'), ...under('vendor/crystal/vendor/climb/vendor')].map((f) => f.replace('vendor/crystal/', '')).sort();
  assert.deepEqual(p.crystal.files.map((f) => f.path).sort(), have, 'every file in vendor/crystal is recorded, and nothing else is'); assert.ok(p.crystal.files.length >= 18);
  for (const f of p.crystal.files) assert.equal(sha(readFileSync(at(`vendor/crystal/${f.path}`))), f.sha256, f.path);
  assert.deepEqual(p.docdec.files.map((f) => f.path), ['src/gate.mjs']); for (const f of p.docdec.files) assert.equal(sha(readFileSync(at(`vendor/docdec/${f.path}`))), f.sha256, f.path);
  // nothing this build adds bonds through DocDec's gate: only the harness reads it
  for (const f of under('src')) if (f !== 'src/citefuzz.mjs') assert.ok(!/^import [^;]*docdec/m.test(readFileSync(at(f), 'utf8')), `${f} imports DocDec's gate`);
  assert.ok(readFileSync(at('src/citefuzz.mjs'), 'utf8').includes("from '../vendor/docdec/src/gate.mjs';"), 'the harness reads it, as a reader to catch');
});

test('the sealed problems are new: none of them is a dev problem', async () => {
  const T = (await import('../src/tasks.mjs')).default, s = rd('data/settings.json');
  const sealed = T.set(s.sets.sealed.seed, s.sets.sealed.sheets), dev = T.set(s.sets.dev.seed, s.sets.dev.sheets);
  assert.equal(sealed.length, 144); assert.equal(dev.length, 60); assert.notEqual(s.sets.sealed.seed, s.sets.dev.seed); assert.equal(s.sets.sample.seed, s.sets.dev.seed);
  const seen = new Set(dev.map((t) => `${t.statement}|${t.doc ? t.doc.text : ''}`));
  assert.deepEqual(sealed.filter((t) => seen.has(`${t.statement}|${t.doc ? t.doc.text : ''}`)).map((t) => t.id), []);
  const docs = new Set(dev.filter((t) => t.doc).map((t) => t.doc.text)); assert.deepEqual(sealed.filter((t) => t.doc && docs.has(t.doc.text)).map((t) => t.id), [], 'and no sealed document is a dev document');
  assert.ok(sealed.every(T.sound)); for (const tier of T.TIERS) assert.equal(sealed.filter((t) => t.tier === tier).length, 12 * T.SHEET.filter((x) => x === tier).length, tier);
  assert.deepEqual([s.citeTokens, s.ruleTokens, s.claimTokens, s.maxTicks, s.maxTokens], [40, 40, 48, 256, 24]); assert.deepEqual(s.fuzz, { seed: 20261212, sums: { forged: 48, honest: 12, noise: 48 }, cites: { forged: 54, honest: 12, noise: 36, barred: 40 }, rules: { forged: 42, honest: 12, noise: 24 }, claims: { claims: 24 } });
  const F = (await import('../vendor/crystal/src/fuzz.mjs')).default, CF = (await import('../src/citefuzz.mjs')).default, FF = (await import('../src/formulafuzz.mjs')).default, LF = (await import('../src/logicfuzz.mjs')).default, W = (await import('../src/weave.mjs')).default;
  assert.deepEqual(s.fuzz.sums, F.BUDGET); assert.deepEqual(s.fuzz.cites, CF.BUDGET); assert.deepEqual(s.fuzz.rules, FF.BUDGET); assert.deepEqual(s.fuzz.claims, LF.BUDGET); for (const k of ['citeTokens', 'ruleTokens', 'claimTokens', 'maxTicks', 'maxTokens']) assert.equal(s[k], W.SETTINGS[k], k);
});

test('once the seal is made, every sealed file still has the bytes it froze, and a sealed run was made under it', () => {
  if (!existsSync(at('SEAL.json'))) { assert.equal(rd('data/published.json').sealed, null, 'a sealed run cannot be published before the seal exists'); return; }
  const seal = rd('SEAL.json');
  assert.equal(seal.v, 'the-verifier-set-seal/1');
  for (const [f, h] of Object.entries(seal.files)) { assert.equal(sha(readFileSync(at(f))), h, `${f} changed after the seal`); assert.ok(!readFileSync(at(f)).includes(13), `${f} holds a carriage return`); }
  const p = rd('vendor/PROVENANCE.json'), vendored = [...p.crystal.files.map((f) => `vendor/crystal/${f.path}`), ...p.docdec.files.map((f) => `vendor/docdec/${f.path}`)];
  assert.deepEqual(Object.keys(seal.files).sort(), [...under('src'), ...vendored, 'data/settings.json', 'data/seed.json', 'CLAIMS.md'].sort());
  const pub = rd('data/published.json');
  if (pub.sealed) { const r = rd(pub.sealed); assert.deepEqual([r.set, r.complete, r.sealSha256], ['sealed', true, sha(readFileSync(at('SEAL.json')))]); }
  if (pub.dev) { const r = rd(pub.dev); assert.deepEqual([r.set, r.complete], ['dev', true]); }
});
