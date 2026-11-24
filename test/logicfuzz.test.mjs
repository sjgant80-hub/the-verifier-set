import { test } from 'node:test';
import assert from 'node:assert/strict';
import LF from '../src/logicfuzz.mjs';
import L from '../src/logic.mjs';
import { sha256 } from '../vendor/crystal/vendor/climb/src/sha256.mjs';
import { readdirSync, readFileSync } from 'node:fs';

const HOSTILE = [null, undefined, 7, 7n, true, 'x', {}, [], () => 1, { names: 5 }, { get names() { throw new Error('no'); } }, new Proxy({}, { get() { throw new Error('no'); } })];
const Q = (given, claim) => ({ names: Object.fromEntries(Object.keys(given).map((n) => [n, n])), given, claim });
const fixed = (k) => () => k, q1 = LF.HARD[0];

test('the solver, attacked: on every claim made for every question, it and the second procedure give one verdict, or both refuse', () => {
  const r = LF.fuzz(LF.HARD, { seed: 5, random: 300 });
  assert.equal(r.places, 315); assert.deepEqual(r.budget, { claims: 24 }); assert.deepEqual(LF.BUDGET, r.budget);
  assert.deepEqual([r.split, r.threw, r.clean], [0, 0, true], JSON.stringify(r.found)); assert.deepEqual(r.found, []); assert.equal(r.agreed, r.tried); assert.equal(r.tried, r.rows.reduce((a, x) => a + x.tried, 0));
  assert.equal(r.refused + r.verdicts.yes + r.verdicts.no + r.verdicts['it depends'], r.tried); for (const v of ['yes', 'no', 'it depends']) assert.ok(r.verdicts[v] > 400, `${v} ${r.verdicts[v]}`);
  assert.deepEqual(r.rows.map((x) => x.name), ['the question\'s own claim', ...Object.keys(LF.FORGERIES)]); assert.equal(r.rows[0].tried, 315); for (const row of r.rows) { assert.ok(row.tried >= 300, `${row.name} ${row.tried}`); assert.equal(row.split, 0); }
  assert.deepEqual(r.rows.filter((x) => x.label === 'refuse').map((x) => x.name), Object.keys(LF.FORGERIES).slice(6));
  assert.ok(r.refused >= r.rows.filter((x) => x.label === 'refuse').reduce((a, x) => a + x.tried, 0), 'every claim that must be refused was refused by both, and some others were too');
  assert.equal(r.sample.length, 16); for (const s of r.sample) assert.deepEqual(Object.keys(s), ['way', 'reply', 'verdict']); assert.equal(r.sample[0].reply, q1.claim);
});

test('the hard questions: each verdict as worked out by hand', () => {
  assert.equal(LF.HARD.length, 15);
  const want = ['yes', 'it depends', 'yes', 'yes', 'yes', 'no', 'yes', 'yes', 'it depends', 'yes', 'yes', 'yes', 'it depends', 'yes', 'yes'];
  for (const [i, q] of LF.HARD.entries()) { assert.equal(L.judge(q.claim, q).value, want[i], `${q.claim} ${JSON.stringify(q.given)}`); assert.equal(LF.plainly(q.claim, q), want[i], q.claim); }
  // by hand: 26 × 10 + 45 = 305 is the least, so "at least 305" holds and "more than 305" does not always; 0.1 + 0.2 is exactly 0.3, which is not more than 0.3
  assert.deepEqual([L.judge(LF.HARD[0].claim, LF.HARD[0]).least, L.judge(LF.HARD[0].claim, LF.HARD[0]).greatest], ['305', '409']); assert.deepEqual([L.judge(LF.HARD[5].claim, LF.HARD[5]).least, L.judge(LF.HARD[5].claim, LF.HARD[5]).greatest], ['0.3', '0.3']);
  assert.deepEqual([L.judge(LF.HARD[12].claim, LF.HARD[12]).least, L.judge(LF.HARD[12].claim, LF.HARD[12]).greatest], ['-15', '12']); assert.deepEqual([L.judge(LF.HARD[9].claim, LF.HARD[9]).least, L.judge(LF.HARD[9].claim, LF.HARD[9]).greatest], ['43/3', '203/11']);
});

test('the second procedure: its own reading of claims and of what is given, its corners, its verdict', () => {
  const S = LF.SECOND_PROCEDURE;
  assert.deepEqual(S.claim('p × c + d ≥ 300'), { formula: 'p × c + d', rel: 'ge', figure: [300n, 1n] }); assert.deepEqual(S.claim('300 ≥ p'), { formula: 'p', rel: 'le', figure: [300n, 1n] }); assert.deepEqual(S.claim(' p>=1,250.5. '), { formula: 'p', rel: 'ge', figure: [2501n, 2n] });
  for (const t of ['p ≥ 1 ≥ 0', 'p', 'p = 5', 'p ≥ -1', 'p ≥ .5', 'p ≥ 1,2', 'p ≥ x', '1 ≥ 2 ≥ 3', '', 'p ≠ 3']) assert.equal(S.claim(t), null, t); assert.deepEqual(S.claim('1 ≥ 2'), { formula: '1', rel: 'ge', figure: [2n, 1n] });
  assert.deepEqual(S.ranges(Q({ p: ['-2', '3'], e: '0.5' })), { p: [[-2n, 1n], [3n, 1n]], e: [[1n, 2n], [1n, 2n]] }); assert.deepEqual(S.ranges(Q({ p: ['+2', '.5'] })), null, 'the least first'); assert.deepEqual(S.ranges(Q({ p: ['.5', '+2'] })), { p: [[1n, 2n], [2n, 1n]] });
  for (const g of [{ p: ['3', '2'] }, { p: 'x' }, { p: [1, 2] }, { p: ['1'] }, {}]) assert.equal(S.ranges({ names: { p: 1 }, given: g }), null, JSON.stringify(g));
  for (const bad of HOSTILE) { assert.equal(S.ranges(bad), null); assert.equal(LF.plainly('p ≥ 1', bad), null); assert.equal(LF.plainly(bad, q1), null); }
  assert.deepEqual([S.decide('ge', [5n, 1n], [5n, 1n], [9n, 1n]), S.decide('gt', [5n, 1n], [5n, 1n], [9n, 1n]), S.decide('le', [5n, 1n], [5n, 1n], [9n, 1n]), S.decide('lt', [5n, 1n], [1n, 1n], [4n, 1n]), S.decide('ge', [10n, 1n], [5n, 1n], [9n, 1n])], ['yes', 'it depends', 'it depends', 'yes', 'no']);
  // the solver and the second procedure on every claim made from these parts at random: one verdict, or both refuse
  let s = 31; const r = (n) => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 8) % n; };
  const parts = ['p', 'e', 'p', 'e', '1', '2', '0.5', ' + ', ' - ', ' × ', ' ÷ ', '(', ')', ' ≥ ', ' > ', ' ≤ ', ' < ', '3', '10', ',', '.', ' ', '>=', '= '];
  let decided = 0, refused = 0;
  for (let k = 0; k < 30000; k++) {
    const q = Q({ p: [String(r(12) - 4), String(r(12) + 8)], e: r(2) === 0 ? String(r(9)) : [String(r(6) - 3), String(r(6) + 3)] }, 'p ≥ 0'), side = () => (r(3) === 0 ? ['1', '2', '0.5', '3'][r(4)] : ['p', 'e'][r(2)]), claim = r(3) === 0 ? Array.from({ length: 2 + r(8) }, () => parts[r(parts.length)]).join('') : `${side()}${[' + ', ' - ', ' × ', ' ÷ '][r(4)]}${r(2) === 0 ? side() : `(${side()}${[' + ', ' - ', ' × ', ' ÷ '][r(4)]}${side()})`} ${['≥', '>', '≤', '<'][r(4)]} ${r(20)}`;
    const a = L.judge(claim, q).value, b = LF.plainly(claim, q); assert.equal(a, b, `${claim} ${JSON.stringify(q.given)}`); if (a === null) refused++; else decided++;
  }
  assert.ok(decided > 4000 && refused > 8000, `${decided} ${refused}`);
  assert.equal(LF.plainly(`p${' + 0'.repeat(33)} ≥ 1`, Q({ p: '2' })), 'yes'); assert.equal(`p${' + 0'.repeat(33)} ≥ 1`.length, 137); assert.equal(LF.plainly(`p${' + 0'.repeat(34)} ≥ 1`, Q({ p: '2' })), null); assert.equal(LF.plainly(`p${' + 0'.repeat(33)} ≥ 100`, Q({ p: '2' })), 'no'); assert.equal(`p${' + 0'.repeat(33)} ≥ 100`.length, 139);
});

test('each way of making a claim is what its name says', () => {
  const made = (k, q = q1) => Object.fromEntries(Object.entries(LF.FORGERIES).map(([name, [, make]]) => [name, make(fixed(k), q)]));
  assert.deepEqual(made(0), {
    'the figure on the edge of the range': 'p × c + d ≥ 305', 'the figure just inside or outside the edge': 'p × c + d ≥ 306', 'the figure written first': '305 ≤ p × c + d', 'the relation turned': 'p × c + d ≥ 305', 'a figure far outside the range': 'p × c + d ≥ 0',
    'a claim made at random on the same quantities': '((p + 1) + ((c + 1) + (d + 1))) ≥ 0', 'a letter used twice': 'p + p ≥ 0', 'no quantity at all': '1 + 1 ≥ 0', 'a division by what could be nought': '1 ÷ (c - 10) ≥ 0', 'two comparisons, or none': 'p × c + d ≥ 1 ≥ 0', 'a letter the question does not give': 'p × c + d + w ≥ 1', 'words, or too long': 'Yes: p × c + d ≥ 1',
  });
  // the quantities of a claim made at random are put in an order turned round by one draw, the same in every engine (a
  // sort with a random comparator is not: Node 22 and Node 25 made different attacks from the same seed)
  const atRandom = LF.FORGERIES['a claim made at random on the same quantities'][1];
  assert.deepEqual([0, 1, 2, 4, 5].map((k) => atRandom(fixed(k), q1)), ['((p + 1) + ((c + 1) + (d + 1))) ≥ 0', '((c - d) - p) > 1', '(d × (p × c)) ≤ 2', '(c + (d + p)) ≥ 4', '((d × p) × c) > 5']);
  const seq = (seed) => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) >>> 8; }, R9 = seq(9);
  assert.equal(sha256(JSON.stringify(Array.from({ length: 200 }, () => atRandom(R9, q1)))), '862036cf37ca4a9b38182db3c76d692c0a1a83337a461a5b07ab91caa6371dd0');
  // the class, swept: no kernel sorts with a comparator that ignores what it compares
  for (const f of readdirSync(new URL('../src/', import.meta.url)).filter((n) => n.endsWith('.mjs'))) assert.ok(!/\.sort\(\s*\(\s*\)\s*=>/.test(readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')), `src/${f}: a sort whose order is the engine's own`);
  const m1 = made(1); assert.deepEqual([m1['the figure on the edge of the range'], m1['the figure just inside or outside the edge'], m1['the relation turned'], m1['a figure far outside the range'], m1['two comparisons, or none'], m1['words, or too long']], ['p × c + d > 409', 'p × c + d > 408.5', 'p × c + d > 305', 'p × c + d ≤ 1,000,000', 'p × c + d', 'p × c + d ≥ 1 pounds']);
  assert.equal(LF.FORGERIES['a division by what could be nought'][1](fixed(0), Q({ p: '3' }, 'p ≥ 1')), null, 'nothing has a range'); assert.equal(LF.FORGERIES['the figure on the edge of the range'][1](fixed(0), Q({ p: ['-3', '-2'] }, 'p ≥ 0')), null, 'an edge below nought cannot be written as a figure');
  for (const [name, [label]] of Object.entries(LF.FORGERIES)) for (const k of [0, 1, 2, 3]) { const reply = LF.FORGERIES[name][1](fixed(k), q1); if (reply !== null && label === 'refuse') { assert.equal(L.judge(reply, q1).value, null, `${name}: ${reply}`); assert.equal(LF.plainly(reply, q1), null, name); } }
  // a question made at random: one to four quantities, a claim on all of them, ranges that may cross nought
  let s = 9; const R = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s >>> 8; }, qs = Array.from({ length: 400 }, () => LF.random(R));
  assert.ok(qs.some((q) => Object.keys(q.given).length === 4) && qs.some((q) => Object.keys(q.given).length === 1) && qs.some((q) => Object.values(q.given).some((g) => Array.isArray(g) && g[0].startsWith('-'))) && qs.some((q) => Object.values(q.given).some((g) => typeof g === 'string')));
  for (const q of qs) { assert.ok(Object.keys(q.given).every((n) => q.claim.includes(n))); assert.equal(L.judge(q.claim, q).value, LF.plainly(q.claim, q)); }
});

test('the same seed makes the same attack again, to the last claim', () => {
  const a = LF.fuzz(LF.HARD, { seed: 7, random: 20 }), b = LF.fuzz(LF.HARD, { seed: 7, random: 20 }), c = LF.fuzz(LF.HARD, { seed: 8, random: 20 });
  assert.deepEqual(a, b); assert.notDeepEqual(a.rows.map((x) => x.tried), c.rows.map((x) => x.tried).map((x) => x + 1)); assert.equal(c.clean, true);
  const seen = [], spy = (reply, q) => { seen.push(`${JSON.stringify(q.given)}|${reply}`); return L.judge(reply, q).value; };
  const r = LF.fuzz(LF.HARD, { seed: 20261212, random: 30, judge: spy }); assert.equal(seen.length, r.tried); assert.equal(r.clean, true); assert.equal(sha256(JSON.stringify(seen)).length, 64);
  assert.deepEqual(LF.fuzz(null, null).places, 0); assert.equal(LF.fuzz(null, null).clean, false, 'with nothing attacked, nothing is called clean'); assert.deepEqual(LF.fuzz([null, 7, {}, Q({ p: 'x' }, 'p ≥ 1'), Q({ p: '1' }, 'nonsense')], { seed: 1 }).places, 0);
  assert.deepEqual(LF.fuzz(LF.HARD.slice(0, 1), { budget: { claims: -1 } }).budget, LF.BUDGET); assert.equal(LF.fuzz([], { seed: -1 }).seed, 4294967295); assert.equal(LF.fuzz(LF.HARD.slice(0, 2), { budget: { claims: 0 } }).tried, 2, 'the question\'s own claim, and nothing more');
  assert.equal(LF.fuzz([], { seed: 1, random: 5 }).places, 5); assert.equal(LF.fuzz([], { seed: 1, random: 2.5 }).places, 0); assert.equal(LF.fuzz([], { seed: 1, random: -3 }).places, 0);
});

test('the hard questions are these, to the letter; a question made at random is this one; the edges of the second procedure', () => {
  assert.deepEqual(LF.HARD.map((q) => q.claim), ['p × c + d ≥ 305', 'p × c + d > 305', 'p - e ≥ 50', 'p - e < 0', 'p ÷ e ≤ 6', 'p + e > 0.3', 'p ÷ e ≥ 1', 'f × t + s - l ≥ 1122', '600 ≤ r × n + k', 'r + k ÷ n < 18.5', 'p ≤ 1,250.5', 'e ÷ (p + 1) ≥ 0.6', 'p × e ≥ 0', 'p × e < 0', 'p ÷ e < 0']);
  assert.deepEqual(LF.HARD.slice(12).map((q) => q.given), [{ p: ['-2', '3'], e: ['-5', '4'] }, { p: ['-3', '-2'], e: ['4', '5'] }, { p: ['6', '12'], e: ['-3', '-2'] }]);
  let s = 9; const R = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s >>> 8; };
  assert.deepEqual([LF.random(R), LF.random(R)].map((q) => [q.given, q.claim]), [[{ p: ['20', '26'], c: ['36', '49'], d: '-5' }, '((p × c) ÷ d) ≥ 20'], [{ p: ['1', '17'], c: '-4', d: ['9', '13'] }, '(p + ((c + 3) + d)) > 159']]);
  const S = LF.SECOND_PROCEDURE, Q2 = (g) => ({ names: Object.fromEntries(Object.keys(g).map((n) => [n, n])), given: g });
  for (const g of [{ p: ['x', '1'] }, { p: ['1', 'x'] }, { p: [null, '1'] }, { p: ['1', null] }, { p: ['1', '2'], c: 'x' }]) assert.equal(S.ranges(Q2(g)), null, JSON.stringify(g));
  assert.deepEqual(S.ranges({ names: { p: 1 }, given: 'p' }), null); assert.deepEqual(S.ranges({ names: { p: 1 }, given: null }), null); assert.deepEqual(S.ranges(Q2({ p: ['2', '2'] })), { p: [[2n, 1n], [2n, 1n]] });
  // the length limit, exactly at its edge, a full stop let go first
  const q = Q2({ p: '2' }), claim = (n) => `p${' + 0'.repeat(n)} ≥ 1`; assert.equal(claim(33).length, 137); assert.equal(`${claim(33)}000`.length, 140);
  assert.equal(LF.plainly(`${claim(33)}000`, q), 'no'); assert.equal(LF.plainly(`${claim(33)}0000`, q), null); assert.equal(LF.plainly(`${claim(33)}000.`, q), 'no'); assert.equal(L.judge(`${claim(33)}0000`, q).why, 'too long');
  // a divisor that is nought at a corner, or crosses it, is refused; one wholly below nought is not
  for (const [g, c, want] of [[{ p: ['0', '2'] }, '1 ÷ p ≥ 0', null], [{ p: ['-2', '0'] }, '1 ÷ p ≥ 0', null], [{ p: ['-2', '2'] }, '1 ÷ p ≥ 0', null], [{ p: ['-2', '-1'] }, '1 ÷ p < 0', 'yes'], [{ p: ['1', '2'] }, '1 ÷ p ≥ 0.5', 'yes'], [{ p: ['0', '0'] }, '1 ÷ p ≥ 0', null]]) { assert.equal(LF.plainly(c, Q2(g)), want, `${c} ${JSON.stringify(g)}`); assert.equal(L.judge(c, { ...Q2(g) }).value, want, c); }
  // a claim's one sign, two-letter or one, either way round; anything else is no comparison
  assert.deepEqual(S.claim('p<=3'), { formula: 'p', rel: 'le', figure: [3n, 1n] }); assert.deepEqual(S.claim('3>=p'), { formula: 'p', rel: 'le', figure: [3n, 1n] }); assert.deepEqual(S.claim('p<3'), { formula: 'p', rel: 'lt', figure: [3n, 1n] }); assert.deepEqual(S.claim('3 > p'), { formula: 'p', rel: 'lt', figure: [3n, 1n] });
  for (const t of ['p >=< 3', 'p>=>3', 'p =< 3', '< 3', 'p <', 'p ≥≤ 3']) assert.equal(S.claim(t) !== null && SECONDOK(S.claim(t)), false, t);
});
// a claim the second procedure read into a formula it can run (used to show some readings fail later, not here)
function SECONDOK(c) { return /^[a-z0-9 ×÷+\-().]+$/.test(c.formula) && c.formula.trim() !== ''; }

test('each planted solver does its one wrong thing and nothing else: it refuses what the solver refuses, and decides plain claims as the solver does', () => {
  // plain claims: whole figures, nothing taken away, nothing across nought, well clear of the edges, settled yes or no
  const P = LF.PLANTED, H = LF.HARD, q = H[0], plain = [[H[0], 'p × c + d ≥ 300'], [H[0], 'p × c + d ≤ 500'], [H[0], 'p × c ≥ 500'], [H[4], 'p ÷ e ≥ 1'], [H[7], 'f × t + s ≥ 1000'], [H[9], 'r + k ÷ n ≥ 14'], [H[9], 'r × n < 600']];
  for (const [qq, claim] of plain) assert.notEqual(L.judge(claim, qq).value, 'it depends', claim);
  const own = { 'decides a claim that uses a letter twice': 'c - c ≥ 0', 'divides by a range that holds nought': '1 ÷ (c - 12) ≥ 0' };
  for (const name of Object.keys(P)) {
    if (name === 'refuses everything') continue;
    for (const [qq, claim] of plain) assert.equal(P[name](claim, qq), L.judge(claim, qq).value, `${name}: ${claim}`);
    for (const claim of ['yes', 'nonsense', 'p ≥', '≥ 3', ...Object.entries(own).filter(([k]) => k !== name).map(([, c]) => c)]) assert.equal(P[name](claim, q), null, `${name} refuses ${claim}`);
  }
  for (const [name, claim] of Object.entries(own)) { assert.equal(P[name](claim, q), 'it depends'); assert.equal(L.judge(claim, q).value, null); }
  assert.doesNotThrow(() => P['throws on a claim it cannot read']('yes', q)); assert.throws(() => P['throws on a claim it cannot read']('p ≠ 1', q));
  // the floating-point solver gets a sum of decimals wrong that exact arithmetic gets right, and agrees elsewhere
  assert.equal(P['works in floating point']('p + e > 0.3', H[5]), 'yes'); assert.equal(L.judge('p + e > 0.3', H[5]).value, 'no'); assert.equal(P['works in floating point']('p + e ≥ 0.3', H[5]), L.judge('p + e ≥ 0.3', H[5]).value);
  // teeth counts what it finds: a sound solver put in as a planted one is not caught
  const t = LF.teeth([], { seed: 3, planted: { sound: (c, qq) => L.judge(c, qq).value, wrong: () => 'yes' } }); assert.deepEqual([t.planted, t.caught, t.rows.map((r) => r.caught)], [2, 1, [false, true]]); assert.equal(t.rows[0].way, null); assert.equal(t.rows[0].reply, null);
  // the findings are kept to twelve, however many there are
  const thrown = LF.fuzz(LF.HARD, { seed: 1, judge: () => { throw new Error('x'); } }); assert.equal(thrown.found.length, 12); assert.ok(thrown.threw > 12); assert.ok(thrown.found.every((f) => f.solver === 'threw'));
  // a solver that answers nothing (undefined) is counted as refusing
  assert.equal(LF.fuzz(LF.HARD.slice(0, 1), { seed: 1, judge: () => undefined, budget: { claims: 0 } }).split, 1, 'the question\'s own claim is decided, and nothing is no verdict');
});

test('the harness has teeth: every solver with a leak planted in it is caught', () => {
  const t = LF.teeth([], { seed: 7, random: 60 });
  assert.equal(t.planted, 12); assert.equal(t.caught, 12, JSON.stringify(t.rows.filter((x) => !x.caught))); assert.deepEqual(t.rows.map((x) => x.name), Object.keys(LF.PLANTED));
  for (const row of t.rows) { assert.equal(typeof row.way, 'string'); assert.equal(typeof row.reply, 'string'); }
  // each leak is the leak its name says: one claim the planted solver gets wrong, or decides when it must refuse
  const P = LF.PLANTED, H = LF.HARD, cases = {
    'treats more than as at least': [H[1], 'p × c + d > 305'], 'takes each quantity at its least for the least value': [H[2], 'p - e ≥ 51'], 'looks only at the middle': [H[1], 'p × c + d > 305'], 'decides a claim that uses a letter twice': [H[0], 'c - c ≥ 0'],
    'divides by a range that holds nought': [H[0], '1 ÷ (c - 12) ≥ 0'], 'works in floating point': [H[5], 'p + e > 0.3'], 'reads a claim written figure first the wrong way round': [H[0], '305 ≤ p × c + d'], 'never says it depends': [H[1], 'p × c + d > 305'],
    'takes the claim out of words': [H[0], 'Yes: p × c + d ≥ 305'], 'lets a letter the question does not give stand for nought': [H[0], 'p × c + d + w ≥ 305'],
  };
  for (const [name, [q, claim]] of Object.entries(cases)) assert.notEqual(P[name](claim, q), L.judge(claim, q).value, `${name}: ${claim}`);
  assert.equal(P['refuses everything']('p ≥ 1', Q({ p: '2' })), null); assert.throws(() => P['throws on a claim it cannot read']('p ≠ 1', Q({ p: '2' }))); assert.doesNotThrow(() => P['throws on a claim it cannot read']('p ≥ 1', Q({ p: '2' })));
  // apart from its leak, each gives the solver's verdict on a plain claim, and none throws on what it is handed
  for (const name of Object.keys(P)) if (name !== 'refuses everything') assert.equal(P[name]('p × c + d ≥ 300', H[0]), 'yes', name);
  for (const name of Object.keys(P)) for (const bad of HOSTILE) if (name !== 'throws on a claim it cannot read') assert.doesNotThrow(() => P[name](bad, bad), name);
  // a solver that throws is counted; a solver that says yes to everything is caught; the sound solver, put through as one, is clean
  const thrown = LF.fuzz(LF.HARD.slice(0, 2), { seed: 1, judge: () => { throw new Error('x'); } }); assert.deepEqual([thrown.threw, thrown.split, thrown.clean], [thrown.tried, thrown.tried, false]);
  const yes = LF.fuzz(LF.HARD, { seed: 1, judge: () => 'yes' }); assert.ok(yes.split > 0 && !yes.clean); assert.equal(LF.fuzz(LF.HARD, { seed: 1, judge: (c, q) => L.judge(c, q).value }).clean, true);
  assert.equal(LF.teeth(null, null).planted, 12, 'the hard questions alone are attacked when nothing else is given'); assert.equal(LF.teeth(null, null).caught, 12);
});
