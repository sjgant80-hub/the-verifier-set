import { test } from 'node:test';
import assert from 'node:assert/strict';
import L from '../src/logic.mjs';
import F from '../src/formula.mjs';
import X from '../vendor/crystal/vendor/climb/src/exact.mjs';

const Q = { names: { p: 'the unit price', c: 'the order size', d: 'the delivery charge' }, given: { p: '26', c: ['10', '14'], d: '45' } };
const HOSTILE = [null, undefined, 7, 7n, true, 'x', {}, [], () => 1, { names: 5 }, { get names() { throw new Error('no'); } }, new Proxy({}, { get() { throw new Error('no'); } })];
const v = (reply, q = Q) => L.judge(reply, q).value, why = (reply, q = Q) => L.judge(reply, q).why;
const box = (g) => Object.fromEntries(Object.entries(g).map(([k, [lo, hi]]) => [k, { lo: X.num(lo), hi: X.num(hi) }]));
const range = (t, g) => { const r = L.range(F.read(t, Object.keys(g)).tree, box(g)); return r === null ? null : [X.show(r.lo), X.show(r.hi)]; };

test('the verdict: yes when the claim holds for every value given, no when for none, it depends when for some', () => {
  // the order with delivery is 305 at the least (10 crates) and 409 at the most (14)
  assert.deepEqual(L.judge('p × c + d ≥ 300', Q), { value: 'yes', why: 'bonded', claim: 'p × c + d ≥ 300', least: '305', greatest: '409' });
  const table = [['≥ 305', 'yes'], ['≥ 306', 'it depends'], ['≥ 409', 'it depends'], ['≥ 410', 'no'], ['> 304', 'yes'], ['> 305', 'it depends'], ['> 408', 'it depends'], ['> 409', 'no'],
    ['≤ 409', 'yes'], ['≤ 408', 'it depends'], ['≤ 305', 'it depends'], ['≤ 304', 'no'], ['< 410', 'yes'], ['< 409', 'it depends'], ['< 306', 'it depends'], ['< 305', 'no'], ['>= 305', 'yes'], ['<= 304', 'no'], ['≥ 1,000', 'no'], ['≥ 304.5', 'yes'], ['≥ 305.5', 'it depends']];
  for (const [right, want] of table) assert.equal(v(`p × c + d ${right}`), want, right);
  // the same claim, its two sides the other way round
  for (const [right, want] of table) { const [sign, n] = right.split(' '), turn = { '≥': '≤', '>': '<', '≤': '≥', '<': '>', '>=': '<=', '<=': '>=' }[sign]; assert.equal(v(`${n} ${turn} p × c + d`), want, `${n} ${turn} …`); }
  assert.equal(L.judge('300 ≤ p × c + d', Q).claim, 'p × c + d ≥ 300'); assert.equal(L.judge('410 > p × c + d', Q).claim, 'p × c + d < 410');
  // a quantity that takes away: the least is reached when it is greatest
  const neg = { names: { p: 1, e: 1 }, given: { p: ['100', '120'], e: ['20', '50'] } };
  for (const [claim, want, lo, hi] of [['p - e ≥ 50', 'yes', '50', '100'], ['p - e ≥ 51', 'it depends', '50', '100'], ['p - e > 100', 'no', '50', '100'], ['p ÷ e ≥ 2', 'yes', '2', '6'], ['p ÷ e < 6', 'it depends', '2', '6'], ['e ÷ p ≤ 0.5', 'yes', '1/6', '0.5'], ['p × e ≥ 2000', 'yes', '2000', '6000']]) assert.deepEqual([v(claim, neg), L.judge(claim, neg).least, L.judge(claim, neg).greatest], [want, lo, hi], claim);
  assert.deepEqual(L.VERDICTS, ['yes', 'no', 'it depends']);
});

test('the range of a formula when each quantity lies between two figures: exact, reached at a corner', () => {
  assert.deepEqual(range('p × c + d', { p: ['26', '26'], c: ['10', '14'], d: ['45', '45'] }), ['305', '409']); assert.deepEqual(range('p - e', { p: ['100', '120'], e: ['20', '50'] }), ['50', '100']);
  assert.deepEqual(range('p × e', { p: ['-2', '3'], e: ['-5', '4'] }), ['-15', '12']); assert.deepEqual(range('p × e', { p: ['-3', '-2'], e: ['4', '5'] }), ['-15', '-8']); assert.deepEqual(range('p × e', { p: ['-3', '-2'], e: ['-5', '-4'] }), ['8', '15']);
  assert.deepEqual(range('p ÷ e', { p: ['6', '12'], e: ['2', '3'] }), ['2', '6']); assert.deepEqual(range('p ÷ e', { p: ['-6', '12'], e: ['-3', '-2'] }), ['-6', '3']); assert.deepEqual(range('7', { p: ['1', '2'] }), ['7', '7']);
  assert.equal(range('p ÷ e', { p: ['1', '2'], e: ['-1', '1'] }), null); assert.equal(range('p ÷ e', { p: ['1', '2'], e: ['0', '1'] }), null); assert.equal(range('p ÷ e', { p: ['1', '2'], e: ['-1', '0'] }), null); assert.deepEqual(range('p ÷ e', { p: ['1', '2'], e: ['0.5', '1'] }), ['1', '4']);
  assert.equal(L.range(F.read('p + q', ['p', 'q']).tree, box({ p: ['1', '2'] })), null, 'a quantity with no range');
  // on formulas made at random where each letter is used once: the range is exactly the least and greatest over every corner
  let s = 11; const r = (n) => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 8) % n; };
  const make = (letters) => { if (letters.length === 1) return r(3) === 0 ? `(${letters[0]} + ${1 + r(9)})` : letters[0]; const cut = 1 + r(letters.length - 1); return `(${make(letters.slice(0, cut))} ${'+-×÷'[r(4)]} ${make(letters.slice(cut))})`; };
  let decided = 0;
  for (let round = 0; round < 600; round++) {
    const letters = ['p', 'c', 'd', 'e'].slice(0, 1 + r(4)), g = Object.fromEntries(letters.map((n) => { const a = r(30) - 10, b = a + r(12); return [n, [String(a), String(b)]]; })), t = make(letters), tr = F.read(t, letters).tree, got = L.range(tr, box(g));
    const corners = []; for (let k = 0; k < 2 ** letters.length; k++) corners.push(F.run(tr, Object.fromEntries(letters.map((n, i) => [n, X.num(g[n][(k >> i) & 1])]))));
    if (got === null) { assert.ok(corners.some((x) => x === null) || /÷/.test(t), t); continue; }
    if (corners.some((x) => x === null)) continue;
    const lt = (a, b) => a.n * b.d < b.n * a.d, lo = corners.reduce((m, x) => (lt(x, m) ? x : m)), hi = corners.reduce((m, x) => (lt(m, x) ? x : m));
    assert.ok(X.same(got.lo, lo) && X.same(got.hi, hi), `${t} ${JSON.stringify(g)}`); decided++;
  }
  assert.ok(decided > 350, String(decided));
});

test('what is refused: not one comparison, a letter not given, a letter used twice, a division by what could be nought', () => {
  for (const [reply, w] of [['p × c + d = 300', 'not one comparison'], ['p × c + d', 'not one comparison'], ['p × c + d ≥ 300 ≥ 2', 'not one comparison'], ['p ≥ c', 'not one comparison'], ['300 ≥ 200', 'the claim names none of the quantities'], ['26 × 10 + 45 ≥ 300', 'the claim names none of the quantities'], ['p × c + d ≥ -5', 'not one comparison'], ['p × c + d ≥ x', 'not one comparison'], ['p × c + d ≥ 3e2', 'not one comparison'], ['', 'not one comparison'], ['none', 'not one comparison'], ['yes', 'not one comparison'],
    ['p × c + d ≥ 300 pounds', 'not one comparison'], ['p × c + d > = 300', 'not one comparison'], ['p × c + d => 300', 'not a formula'], ['pc + d ≥ 300', 'not a formula'], ['p × c + d + ≥ 300', 'not a formula'], ['p × c + x ≥ 300', 'a letter the question does not give'], ['p × c + c ≥ 300', 'a letter used twice'], ['c - c ≥ 0', 'a letter used twice'],
    ['p ÷ (c - 12) ≥ 1', 'a division by what could be nought'], ['p ÷ (c - 10) ≥ 1', 'a division by what could be nought'], ['p ÷ (c - 14) ≥ 1', 'a division by what could be nought']]) assert.equal(why(reply), w, reply);
  assert.equal(v('p ÷ (c - 9) ≥ 1'), 'yes'); assert.equal(v('p ÷ (15 - c) ≥ 5.2'), 'yes'); assert.equal(v('p ÷ (15 - c) ≥ 26'), 'it depends'); assert.equal(v('c ≥ 9'), 'yes'); assert.equal(v('p × c + d ≥ 300.'), 'yes', 'one full stop at the end is let go'); assert.equal(v(' p×c+d>=300 '), 'yes');
  // the length limit, exactly
  const claimOf = (k, figure) => `p × c + d${' + 0'.repeat(k)} ≥ ${figure}`; assert.equal(L.LIMIT, 140);
  assert.equal(claimOf(31, '3000').length, 140); assert.equal(why(claimOf(31, '3000')), 'bonded'); assert.equal(claimOf(31, '30000').length, 141); assert.equal(why(claimOf(31, '30000')), 'too long'); assert.equal(why(`${claimOf(31, '3000')}.`), 'bonded', 'the full stop is let go before the length is counted');
  // a value too large to hold, at one end of a range or at both, cannot be worked out, and is refused the same way
  const big = '1' + '0'.repeat(31);
  for (const g of [{ p: ['1', big], c: big }, { p: [big, big], c: big }, { p: ['-' + big, '1'], c: big }]) { const r = L.judge('p × c ≥ 1', { names: { p: 1, c: 1 }, given: g }); assert.deepEqual([r.value, r.why], [null, 'a division by what could be nought'], JSON.stringify(g)); }
  assert.equal(L.judge('p × c ≥ 1', { names: { p: 1, c: 1 }, given: { p: ['1', big], c: '1' } }).value, 'yes', 'large, and held');
  // a sum that passes the limit at its greatest end only: the product reaches exactly the limit, one more is past it
  const e30 = '1' + '0'.repeat(30), sum = { names: { p: 1, c: 1, d: 1 }, given: { p: e30, c: ['1', e30], d: '1' } };
  assert.deepEqual([L.judge('p × c + d ≥ 1', sum).value, L.judge('p × c + d ≥ 1', sum).why], [null, 'a division by what could be nought']); assert.equal(L.judge('p × c ≥ 1', sum).value, 'yes', 'the product alone is held');
  assert.equal(L.judge('d - p × c ≤ 1', sum).value, 'yes', 'taking away: the least end is at the limit, below nought, and held');
  for (const g of [{ p: ['x', '1'] }, { p: [null, '1'] }]) assert.equal(L.given({ names: { p: 1 }, given: g }), null, JSON.stringify(g));
  // whatever it is handed, it rules and does not throw
  for (const a of HOSTILE) for (const b of HOSTILE) assert.doesNotThrow(() => L.judge(a, b)); for (const bad of HOSTILE) assert.equal(L.judge('p ≥ 1', bad).why, 'not a question');
});

test('what is given: a figure or a range of two, every letter given, the least first', () => {
  assert.deepEqual(L.given(Q), { p: { lo: X.num('26'), hi: X.num('26') }, c: { lo: X.num('10'), hi: X.num('14') }, d: { lo: X.num('45'), hi: X.num('45') } });
  assert.deepEqual(L.given({ names: { p: 1 }, given: { p: ['1,250.50', '2,000'] } }), { p: { lo: X.num('1250.5'), hi: X.num('2000') } }); assert.deepEqual(L.given({ names: { p: 1 }, given: { p: ['3', '3'] } }), { p: { lo: X.num('3'), hi: X.num('3') } });
  for (const g of [{}, { p: ['5', '3'] }, { p: 'x' }, { p: ['1'] }, { p: ['1', '2', '3'] }, { p: [1, 2] }, { p: 5 }, null, 'p', { p: ['1', 'x'] }]) assert.equal(L.given({ names: { p: 1 }, given: g }), null, JSON.stringify(g));
  assert.equal(L.given({ names: { p: 1, c: 1 }, given: { p: '1' } }), null, 'a letter not given'); assert.deepEqual(Object.keys(L.given({ names: { p: 1 }, given: { p: '1', q: '2' } })), ['p'], 'only the question\'s own letters are kept');
  for (const bad of HOSTILE) assert.equal(L.given(bad), null);
  assert.equal(L.decide('p × c + d ≥ 300', Q), 'yes'); assert.equal(L.decide('nonsense', Q), null);
});

test('the parts: reading a comparison, counting the letters, the verdict from a range', () => {
  const c = L.comparison('p × c + d ≥ 300', ['p', 'c', 'd']); assert.deepEqual([F.shown(c.tree), c.rel, X.show(c.figure)], ['p × c + d', '>=', '300']);
  assert.deepEqual(L.comparison('300 > p', ['p']).rel, '<'); assert.equal(X.show(L.comparison('300 > 4', ['p']).figure), '4', 'a number is a formula too: it is the judge that asks for a quantity'); assert.deepEqual(L.comparison('p > q', ['p']).why, 'not one comparison');
  assert.deepEqual(L.RELATIONS, { '≥': '>=', '>=': '>=', '>': '>', '≤': '<=', '<=': '<=', '<': '<' }); assert.deepEqual(L.SIGN, { '>=': '≥', '>': '>', '<=': '≤', '<': '<' }); assert.deepEqual(L.TURN, { '>=': '<=', '>': '<', '<=': '>=', '<': '>' });
  assert.deepEqual(L.uses(F.read('p × c + p ÷ (d - p)', ['p', 'c', 'd']).tree), { p: 3, c: 1, d: 1 }); assert.deepEqual(L.uses(F.read('7', []).tree), {});
  const R = (lo, hi) => ({ lo: X.num(lo), hi: X.num(hi) });
  for (const [rel, n, lo, hi, want] of [['>=', '5', '5', '9', 'yes'], ['>=', '5', '4', '9', 'it depends'], ['>=', '5', '1', '4', 'no'], ['>', '5', '5', '9', 'it depends'], ['>', '5', '6', '9', 'yes'], ['>', '5', '1', '5', 'no'], ['<=', '5', '1', '5', 'yes'], ['<=', '5', '1', '6', 'it depends'], ['<=', '5', '6', '9', 'no'], ['<', '5', '1', '5', 'it depends'], ['<', '5', '1', '4', 'yes'], ['<', '5', '5', '9', 'no'], ['>=', '5', '5', '5', 'yes'], ['>', '5', '5', '5', 'no']]) assert.equal(L.verdict(rel, X.num(n), R(lo, hi)), want, `${lo}..${hi} ${rel} ${n}`);
});
