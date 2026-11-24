import { test } from 'node:test';
import assert from 'node:assert/strict';
import S from '../src/strength.mjs';

const HOSTILE = [null, undefined, 7, 'x', {}, [], () => 1, { type: 5 }, { type: 'computed', on: 'x' }, { get type() { throw new Error('no'); } }, new Proxy({}, { get() { throw new Error('no'); } })];
const strengths = (facets) => S.label(facets).map((l) => l.strength);

test('the four kinds of bond, what each proves, and the order from weakest to strongest', () => {
  assert.deepEqual(Object.keys(S.TYPES), ['computed', 'logical', 'executed', 'cited']);
  assert.deepEqual(Object.values(S.TYPES).map((t) => t.strength), ['proven', 'proven within its encoding', 'proven against its tests', 'grounded']);
  assert.deepEqual(S.ORDER, ['unknown', 'grounded', 'proven against its tests', 'proven within its encoding', 'proven']);
  assert.deepEqual(S.ORDER.map(S.rank), [0, 1, 2, 3, 4]); for (const bad of ['', 'PROVEN', 'true', null, undefined, 7, {}]) assert.equal(S.rank(bad), 0, String(bad));
  // only exact arithmetic is called proven with nothing added, and a citation is never called proven at all
  assert.deepEqual(Object.entries(S.TYPES).filter(([, t]) => t.strength === 'proven').map(([k]) => k), ['computed']); assert.ok(!S.TYPES.cited.strength.includes('proven'));
  for (const t of Object.values(S.TYPES)) { assert.ok(S.ORDER.includes(t.strength)); assert.ok(t.says.length > 10 && t.check.length > 3); }
});

test('weakest: the weakest of the strengths given; nothing to stand on is unknown', () => {
  assert.equal(S.weakest(['proven', 'grounded', 'proven']), 'grounded'); assert.equal(S.weakest(['proven']), 'proven'); assert.equal(S.weakest(['proven', 'proven within its encoding']), 'proven within its encoding');
  assert.equal(S.weakest(['proven against its tests', 'proven within its encoding']), 'proven against its tests'); assert.equal(S.weakest(['grounded', 'proven against its tests']), 'grounded');
  assert.equal(S.weakest(['proven', 'nonsense']), 'unknown'); assert.equal(S.weakest(['proven', null]), 'unknown'); assert.equal(S.weakest([]), 'unknown');
  for (const bad of [null, undefined, 7, 'proven', 'abc', {}, { length: 3 }]) assert.equal(S.weakest(bad), 'unknown', String(bad));
  for (const a of S.ORDER) for (const b of S.ORDER) { assert.equal(S.weakest([a, b]), S.weakest([b, a])); assert.equal(S.weakest([a, b]), S.rank(a) <= S.rank(b) ? a : b); assert.equal(S.weakest([a, a]), a); }
});

test('THE LAW: a facet is only as strong as the weakest bond it stands on, all the way down', () => {
  // a figure cited from a contract, a sum worked out from it, a sum that never touched it, and a sum of both
  const L = S.label([{ type: 'cited', on: [] }, { type: 'computed', on: [0] }, { type: 'computed', on: [] }, { type: 'computed', on: [1, 2] }, { type: 'computed', on: [3] }]);
  assert.deepEqual(L.map((l) => l.strength), ['grounded', 'grounded', 'proven', 'grounded', 'grounded']);
  assert.deepEqual(L.map((l) => l.own), ['grounded', 'proven', 'proven', 'proven', 'proven'], 'what its own bond proves is kept beside what it stands on');
  assert.deepEqual(L.map((l) => l.roots), [['cited'], ['cited', 'computed'], ['computed'], ['cited', 'computed'], ['cited', 'computed']]);
  assert.deepEqual(L[1], { type: 'computed', own: 'proven', strength: 'grounded', roots: ['cited', 'computed'] });
  // every kind, alone and stacked: the weakest beneath decides
  assert.deepEqual(strengths([{ type: 'computed' }, { type: 'logical' }, { type: 'executed' }, { type: 'cited' }]), ['proven', 'proven within its encoding', 'proven against its tests', 'grounded']);
  assert.deepEqual(strengths([{ type: 'logical' }, { type: 'computed', on: [0] }, { type: 'executed', on: [1] }, { type: 'computed', on: [2] }, { type: 'cited', on: [3] }, { type: 'computed', on: [4] }]),
    ['proven within its encoding', 'proven within its encoding', 'proven against its tests', 'proven against its tests', 'grounded', 'grounded']);
  assert.deepEqual(S.label([{ type: 'logical' }, { type: 'executed' }, { type: 'cited' }, { type: 'computed', on: [0, 1, 2] }])[3].roots, ['cited', 'executed', 'logical', 'computed'], 'what it stands on, weakest first');
  // a stronger bond on top never lifts what is beneath, and the order facets are listed in changes nothing
  assert.deepEqual(strengths([{ type: 'computed', on: [1] }, { type: 'cited', on: [] }]), ['grounded', 'grounded']); assert.deepEqual(strengths([{ type: 'computed', on: [2, 1, 1, 2] }, { type: 'computed' }, { type: 'cited' }]), ['grounded', 'proven', 'grounded']);
});

test('the law on lattices made at random: never stronger than its own bond, never stronger than anything beneath it, and never proven over a citation', () => {
  let s = 7;
  const r = (n) => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 8) % n; };
  const kinds = ['computed', 'computed', 'computed', 'logical', 'executed', 'cited', 'nonsense'];
  for (let round = 0; round < 300; round++) {
    const n = 1 + r(14), facets = Array.from({ length: n }, (_, i) => ({ type: kinds[r(kinds.length)], on: Array.from({ length: r(4) }, () => r(i + 1) - 1).filter((j) => j >= 0 && j < i) }));
    const L = S.label(facets);
    // everything beneath a facet, found the long way
    const under = (i, seen = new Set()) => { for (const j of facets[i].on) if (!seen.has(j)) { seen.add(j); under(j, seen); } return seen; };
    for (const [i, l] of L.entries()) {
      const all = [i, ...under(i)], low = Math.min(...all.map((j) => S.rank(S.TYPES[facets[j].type] ? S.TYPES[facets[j].type].strength : 'unknown')));
      assert.equal(S.rank(l.strength), low, `round ${round} facet ${i}`);
      assert.ok(S.rank(l.strength) <= S.rank(l.own)); for (const j of facets[i].on) assert.ok(S.rank(l.strength) <= S.rank(L[j].strength));
      if (all.some((j) => facets[j].type === 'cited')) assert.ok(S.rank(l.strength) <= 1, 'a citation beneath it: grounded at best');
      if (l.strength === 'proven') assert.ok(all.every((j) => facets[j].type === 'computed'));
      assert.deepEqual([...l.roots].sort(), [...new Set(all.map((j) => (S.TYPES[facets[j].type] ? facets[j].type : 'unknown')))].sort());
    }
    // one more thing to stand on never makes a facet stronger
    const k = r(n), more = facets.map((f, i) => (i === n - 1 && k < n - 1 ? { ...f, on: [...f.on, k] } : f)), M = S.label(more);
    assert.ok(S.rank(M[n - 1].strength) <= S.rank(L[n - 1].strength));
    assert.equal(Object.values(S.tally(L)).reduce((a, b) => a + b, 0), n);
  }
});

test('what cannot be named is unknown, never proven: a kind that is not one of the four, a facet that is not there, a facet that stands on itself', () => {
  assert.deepEqual(strengths([{ type: 'guessed' }, { type: 'computed', on: [0] }]), ['unknown', 'unknown']); assert.deepEqual(S.label([{ type: 'guessed' }])[0], { type: 'guessed', own: 'unknown', strength: 'unknown', roots: ['unknown'] });
  for (const type of ['toString', 'constructor', '__proto__', 'hasOwnProperty', '', 'Computed', 'proven']) assert.equal(strengths([{ type }])[0], 'unknown', type);
  assert.deepEqual(strengths([{ type: 'computed', on: [5] }]), ['unknown']); assert.deepEqual(strengths([{ type: 'computed', on: [-1] }]), ['unknown']); assert.deepEqual(strengths([{ type: 'computed', on: [0.5] }]), ['unknown']); assert.deepEqual(strengths([{ type: 'computed', on: ['0'] }]), ['unknown']);
  // a footing named by anything but a whole number is no footing, even where a facet of that name would be proven
  assert.deepEqual(strengths([{ type: 'computed', on: ['1'] }, { type: 'computed' }]), ['unknown', 'proven']); assert.deepEqual(strengths([{ type: 'computed' }, { type: 'computed', on: ['0'] }, { type: 'computed', on: [[0]] }, { type: 'computed', on: [true] }, { type: 'computed', on: [null] }]), ['proven', 'unknown', 'unknown', 'unknown', 'unknown']);
  assert.deepEqual(S.label([{ type: 'computed', on: [1] }])[0], { type: 'computed', own: 'proven', strength: 'unknown', roots: ['unknown', 'computed'] }, 'a facet past the end of the list');
  assert.deepEqual(strengths([{ type: 'computed', on: [0] }]), ['unknown'], 'it stands on itself'); assert.deepEqual(strengths([{ type: 'computed', on: [1] }, { type: 'computed', on: [0] }, { type: 'computed', on: [] }, { type: 'computed', on: [2] }]), ['unknown', 'unknown', 'proven', 'proven'], 'two that stand on each other');
  assert.deepEqual(strengths([{ type: 'computed', on: [1] }, { type: 'computed', on: [2] }, { type: 'computed', on: [0] }, { type: 'computed', on: [1] }]), ['unknown', 'unknown', 'unknown', 'unknown']);
  for (const bad of HOSTILE) { assert.doesNotThrow(() => S.label(bad)); assert.doesNotThrow(() => S.label([bad, { type: 'computed', on: [0] }])); assert.doesNotThrow(() => S.tally(bad)); assert.doesNotThrow(() => S.say(bad)); }
  assert.deepEqual(S.label(null), []); assert.deepEqual(S.label('abc'), []); for (const bad of HOSTILE) assert.equal(S.label([bad])[0].strength, 'unknown');
  assert.deepEqual(S.label([{ type: 5 }])[0], { type: null, own: 'unknown', strength: 'unknown', roots: ['unknown'] });
  // a long chain does not break it
  const chain = Array.from({ length: 3000 }, (_, i) => ({ type: i === 0 ? 'cited' : 'computed', on: i === 0 ? [] : [i - 1] })); assert.equal(S.label(chain)[2999].strength, 'grounded');
});

test('grounded and proven are never one count and never one sentence', () => {
  const L = S.label([{ type: 'cited' }, { type: 'computed', on: [0] }, { type: 'computed' }, { type: 'executed' }, { type: 'logical' }, { type: 'odd' }]);
  assert.deepEqual(S.tally(L), { unknown: 1, grounded: 2, 'proven against its tests': 1, 'proven within its encoding': 1, proven: 1 }); assert.deepEqual(Object.keys(S.tally([])), S.ORDER); assert.deepEqual(Object.values(S.tally(null)), [0, 0, 0, 0, 0]);
  assert.deepEqual(L.map(S.say), [
    'Grounded, not proven: it is, or it stands on, a step that was found word for word in a source. It can be no truer than that.',
    'Grounded, not proven: it is, or it stands on, a step that was found word for word in a source. It can be no truer than that.',
    'Proven: exact arithmetic all the way down.',
    'Proven against its tests, not proven: it is, or it stands on, a step that passed every test it was given. It can be no truer than that.',
    'Proven within its encoding, not proven: it is, or it stands on, a step that follows from its premises as they were encoded. It can be no truer than that.',
    'Unknown: it stands on something this build cannot name, so it is not counted as checked.',
  ]);
  const said = new Set(L.map(S.say)); assert.equal(said.size, 5); for (const line of said) if (!line.startsWith('Proven:')) assert.ok(!/^Proven[:.]/.test(line));
  for (const bad of [{ strength: 'grounded', roots: [] }, { strength: 'grounded' }, { strength: 'proven within its encoding', roots: ['computed'] }, { strength: 'x', roots: ['cited'] }, {}]) assert.equal(S.say(bad), 'Unknown: it stands on something this build cannot name, so it is not counted as checked.');
});
