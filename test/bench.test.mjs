// bench.test.mjs — the two comparisons the build's ways of asking rest on (data/bench.json, data/baseline.json) are
// records, not remarks: every reply in them is ruled on again here by the build's own code, from the documents and
// questions the records themselves keep, and must come out as it was recorded.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import C from '../src/cite.mjs';
import O from '../src/onetry.mjs';
import W from '../src/weave.mjs';

const at = (p) => new URL(`../${p}`, import.meta.url), pub = JSON.parse(readFileSync(at('data/published.json'), 'utf8')), dev = JSON.parse(readFileSync(at('data/settings.json'), 'utf8')).sets.dev;

test('the two ways of asking for a figure, compared: every reply ruled on again, the second way the build\'s own', { skip: !pub.bench && 'the comparison is not published yet' }, () => {
  assert.ok(existsSync(at(pub.bench)));
  const b = JSON.parse(readFileSync(at(pub.bench), 'utf8'));
  assert.equal(b.v, 'the-verifier-set-bench/2'); assert.deepEqual(b.ways.map((w) => w.name), ['offered', 'copy only']); assert.equal(b.seed, dev.seed, 'made on dev problems: nothing the claims are judged on'); assert.ok(b.sheets <= dev.sheets);
  assert.deepEqual(b.ways[0].rows.map((r) => [r.problem, r.cell]), b.ways[1].rows.map((r) => [r.problem, r.cell]), 'the same figures, asked both ways'); assert.ok(b.ways[0].rows.length >= 30);
  for (const w of b.ways) for (const r of w.rows) { const doc = { text: b.docs[r.problem] }, cell = { text: r.cell }; assert.equal(typeof doc.text, 'string'); assert.equal(C.judge(r.said, cell, doc).why, r.why, `${w.name} ${r.problem} ${r.cell}`); assert.equal(C.stated(cell, doc).figure !== null, r.there); }
  // one way offers the model a word for "it is not there"; the other is the way this build asks, to the letter
  assert.ok(/reply: none/.test(b.ways[0].system) && b.ways[0].shots.some(([, a]) => a === 'none')); assert.equal(b.ways[1].system, W.SYSTEM); assert.deepEqual(b.ways[1].shots, W.SHOTS);
  // nothing bonded, either way, where the document cannot give the figure; asked only to copy, the model bonded more
  for (const w of b.ways) assert.equal(w.rows.filter((r) => !r.there && r.why === 'bonded').length, 0);
  const bonded = (w) => w.rows.filter((r) => r.there && r.why === 'bonded').length; assert.ok(bonded(b.ways[1]) > bonded(b.ways[0]), `${bonded(b.ways[1])} against ${bonded(b.ways[0])}`);
});

test('the unchecked reply, asked two ways: every reply ruled on again, and the build keeps the way that got more right', { skip: !pub.baseline && 'the comparison is not published yet' }, () => {
  assert.ok(existsSync(at(pub.baseline)));
  const b = JSON.parse(readFileSync(at(pub.baseline), 'utf8'));
  assert.equal(b.v, 'the-verifier-set-baseline/2'); assert.deepEqual(b.ways.map((w) => w.name), ['may decline', 'not told it may decline']); assert.equal(b.seed, dev.seed); assert.equal(b.sheets, dev.sheets);
  for (const w of b.ways) {
    assert.equal(w.maxTokens, O.SETTINGS.maxTokens); assert.deepEqual(w.rows.map((r) => r.problem), Object.keys(b.asked));
    for (const r of w.rows) { const q = b.asked[r.problem], task = { check: { value: q.want }, expect: q.decline ? { key: 'x' } : null, decide: q.verdict ? {} : null }; assert.deepEqual(O.rule(r.said, task), { right: r.right, answered: r.answered, value: r.value }, `${w.name} ${r.problem}`); }
  }
  // the build's own system line is the first way; the second is the same line without the leave to decline
  assert.equal(b.ways[0].system, O.SYSTEM); assert.ok(O.SYSTEM.includes(' If the document does not state what is needed, reply: cannot tell')); assert.equal(b.ways[1].system, O.SYSTEM.replace(' If the document does not state what is needed, reply: cannot tell', ''));
  const right = (w) => w.rows.filter((r) => r.right).length; assert.ok(right(b.ways[0]) >= right(b.ways[1]), `the way kept got ${right(b.ways[0])}, the other ${right(b.ways[1])}: the lattice is set against the stronger`);
  // with room to finish, few replies ran to the limit
  assert.ok(b.ways[0].rows.filter((r) => r.finish === 'length').length * 10 <= b.ways[0].rows.length, 'at most one in ten ran to the limit');
});
