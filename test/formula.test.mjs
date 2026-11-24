import { test } from 'node:test';
import assert from 'node:assert/strict';
import F from '../src/formula.mjs';
import X from '../vendor/crystal/vendor/climb/src/exact.mjs';

const L3 = ['p', 'c', 'd'], R3 = { names: { p: 'the unit price', c: 'the order size', d: 'the delivery charge' }, reference: 'p × c + d', seed: 7 };
const HOSTILE = [null, undefined, 7, 7n, true, 'x', {}, [], () => 1, { names: 5 }, { names: null }, { get names() { throw new Error('no'); } }, new Proxy({}, { get() { throw new Error('no'); } })];
const tree = (t, letters = L3) => F.read(t, letters).tree, sh = (t, letters = L3) => F.shown(tree(t, letters));
const at = (t, inputs, letters = L3) => X.show(F.run(tree(t, letters), Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, X.num(v)]))));
const rule = (reference, seed = 3) => ({ names: Object.fromEntries([...new Set(reference.match(/[a-z]/g))].map((n) => [n, n])), reference, seed });
// the rules a problem may ask for, as tasks.mjs writes them
const RULES = ['p × c', 'p × c + d', 'p × c + d - e', 'p + d ÷ c', 'f × t', 'f × t + s', 'f × t + s - l', 'f + s ÷ t', 'r × n', 'r × n + k', 'r × n + k + b', 'r + k ÷ n'];

test('a formula is read one way: × and ÷ before + and -, each from left to right, brackets first', () => {
  assert.equal(at('p + c × d', { p: '2', c: '3', d: '4' }), '14'); assert.equal(at('(p + c) × d', { p: '2', c: '3', d: '4' }), '20'); assert.equal(at('p - c - d', { p: '20', c: '3', d: '4' }), '13'); assert.equal(at('p - (c - d)', { p: '20', c: '3', d: '4' }), '21');
  assert.equal(at('p ÷ c ÷ d', { p: '24', c: '3', d: '4' }), '2'); assert.equal(at('p ÷ (c ÷ d)', { p: '24', c: '3', d: '4' }), '32'); assert.equal(at('p × c ÷ d', { p: '2', c: '3', d: '4' }), '1.5'); assert.equal(at('p + c ÷ d', { p: '1', c: '1', d: '3' }), '4/3');
  assert.equal(at('2.5 × p + 0.5', { p: '2' }), '5.5'); assert.equal(at('p − c', { p: '2', c: '5' }), '-3'); assert.equal(at('p * c / d', { p: '2', c: '3', d: '4' }), '1.5'); assert.equal(at('((p))', { p: '9' }), '9'); assert.equal(at('007 × p', { p: '2' }), '14');
  // no value: a division by nought, an input that is not there
  assert.equal(F.run(tree('p ÷ (c - d)'), { p: X.num('1'), c: X.num('3'), d: X.num('3') }), null); assert.equal(F.run(tree('p + c'), { p: X.num('1') }), null); assert.equal(F.run(tree('p'), null), null);
  // refused: anything that is not one formula in the small language
  const why = (t, letters = L3) => F.read(t, letters).why;
  for (const t of ['P × c', 'p times c', 'pc', 'p c', '-p', 'p +', '+ p', '()', 'p ( c', '(p', 'p)', ')p(', '2p', 'p2', 'p\t× c', '1,000 × p', '2. × p', 'p × .5', 'p ×× c', 'p = 5', 'p × c\n+ d', '', ' ', 'none', 'p ^ 2', 'p²', 'p × c;', '１ + p']) assert.equal(why(t), 'not a formula', JSON.stringify(t));
  for (const t of ['p x c', 'q', 'p × c + e', 'p × 1e3']) assert.equal(why(t), 'a letter the rule does not have', t); assert.equal(why('p × 1e3', ['p', 'e']), 'not a formula', 'a number run on to a letter');
  for (const bad of HOSTILE) { assert.doesNotThrow(() => F.read(bad, L3)); assert.doesNotThrow(() => F.read('p', bad)); } assert.equal(F.read('p', null).why, 'a letter the rule does not have'); assert.deepEqual(F.read('2', null).tree, { num: X.num('2') });
  // a letter stands for a quantity only when the rule gives it, and is one letter, small
  assert.deepEqual(F.names(R3), L3); assert.deepEqual(F.names({ names: { z: 1 } }), ['z']); for (const bad of [...HOSTILE, { names: {} }, { names: { P: 1 } }, { names: { pq: 1 } }, { names: { p: 1, '1': 2 } }, { names: { 'é': 1 } }]) assert.equal(F.names(bad), null, typeof bad);
});

test('a formula is written back one way, with brackets only where they are needed; figures may be put in the letters\' places', () => {
  for (const [t, want] of [['p - (c - d)', 'p - (c - d)'], ['(p - c) - d', 'p - c - d'], ['p ÷ (c × d)', 'p ÷ (c × d)'], ['(p × c) ÷ d', 'p × c ÷ d'], ['p × (c + d)', 'p × (c + d)'], ['(p + c) + d', 'p + c + d'], ['p + (c + d)', 'p + (c + d)'], ['p ÷ (c ÷ d)', 'p ÷ (c ÷ d)'], ['(p × c) + d', 'p × c + d'], ['p + (c × d)', 'p + c × d'], ['(p + c) ÷ d', '(p + c) ÷ d'], ['p-c-d', 'p - c - d'], ['p*c/d', 'p × c ÷ d'], ['  p   +c ', 'p + c'], ['1.50 + p', '1.5 + p']]) assert.equal(sh(t), want, t);
  // written back, it reads as the same formula, on every rule
  for (const t of [...RULES, 'p - (c - d)', '(p + c) ÷ d', 'p ÷ (c ÷ d) × 2']) { const letters = [...new Set(t.match(/[a-z]/g))]; assert.deepEqual(tree(F.shown(tree(t, letters)), letters), tree(t, letters), t); }
  assert.equal(F.shown(tree('p × (c + d)'), (n) => ({ p: '26', c: '12', d: '45' })[n]), '26 × (12 + 45)');
  assert.equal(F.applied('p × c + d', R3, { p: '26', c: '12', d: '45' }), '26 × 12 + 45'); assert.equal(F.applied('(p + d) × c', R3, { p: '26', c: '12', d: '1,250.50' }), '(26 + 1250.5) × 12'); assert.equal(F.applied('p + d ÷ c', R3, { p: '26', c: '15', d: '45' }), '26 + 45 ÷ 15');
  // a figure missing or not a number, a formula that cannot be read, a rule that is not one: nothing
  for (const figures of [{ p: '26', c: '12' }, { p: '26', c: '12', d: 'x' }, null, { p: '26', c: '12', d: 45 }]) assert.equal(F.applied('p × c + d', R3, figures), null, JSON.stringify(figures));
  assert.equal(F.applied('p ×', R3, { p: '1', c: '1', d: '1' }), null); assert.equal(F.applied('p', { names: 5 }, { p: '1' }), null); assert.equal(F.applied('p', { names: { p: 1, c: 1 } }, { p: '1' }), null, 'every letter of the rule needs its figure');
});

test('the near-misses of a formula: every change of one step', () => {
  assert.deepEqual(F.mutants(tree('p × c + d'), L3).map((m) => F.shown(m)), ['p × c - d', 'p × c × d', 'p × c ÷ d', 'd + p × c', 'p × c', 'd', 'p + c + d', 'p - c + d', 'p ÷ c + d', 'c × p + d', 'p + d', 'c + d', 'c × c + d', 'd × c + d', 'p × p + d', 'p × d + d', 'p × c + p', 'p × c + c']);
  assert.deepEqual(F.mutants(tree('2.5 × p', ['p', 'c']), ['p', 'c']).map((m) => F.shown(m)), ['2.5 + p', '2.5 - p', '2.5 ÷ p', 'p × 2.5', '2.5', 'p', '3.5 × p', '1.5 × p', '2.5 × c']);
  assert.deepEqual(F.mutants(tree('p', ['p']), ['p']), []); assert.deepEqual(F.mutants(tree('7', []), []).map((m) => F.shown(m)), ['8', '6']);
  for (const t of RULES) { const letters = [...new Set(t.match(/[a-z]/g))], n = F.mutants(tree(t, letters), letters).length, ops = (t.match(/[×÷+-]/g) || []).length; assert.equal(n, ops * 6 + letters.length * (letters.length - 1), t); }
});

test('the tests of a rule: drawn from its seed, chosen so that every near-miss that is a different rule fails one', () => {
  const s = F.suite(R3);
  assert.deepEqual(s.tests, [{ inputs: { p: '53', c: '48', d: '38' }, want: '2582' }, { inputs: { p: '44', c: '55', d: '29' }, want: '2449' }, { inputs: { p: '47', c: '16', d: '36' }, want: '788' }, { inputs: { p: '39', c: '60', d: '50' }, want: '2390' }]);
  assert.deepEqual([s.made, s.alike, s.killed, s.admitted, s.why], [18, 2, 16, true, null]); assert.deepEqual(F.DRAW, { low: 2, high: 60, least: 4, points: 16 });
  assert.deepEqual(F.suite(R3), s, 'the same seed, the same tests'); assert.notDeepEqual(F.suite({ ...R3, seed: 8 }).tests, s.tests);
  // inputs are whole numbers from 2 to 60, both ends reached
  const seen = new Set(); for (let seed = 1; seed < 400; seed++) for (const t of F.suite({ ...R3, seed }).tests) for (const v of Object.values(t.inputs)) seen.add(Number(v));
  assert.equal(Math.min(...seen), 2); assert.equal(Math.max(...seen), 60); assert.equal(seen.size, 59);
  for (const t of RULES) for (const seed of [1, 2, 3, 20261212]) {
    const r = rule(t, seed), letters = F.names(r), u = F.suite(r), base = tree(t, letters);
    assert.equal(u.admitted, true, `${t} ${seed}`); assert.ok(u.tests.length >= 4); assert.equal(u.made, u.alike + u.killed);
    // every near-miss: it fails a test, or it is the same rule (it agrees with the reference wherever both are drawn)
    for (const m of F.mutants(base, letters)) { const j = F.judge(F.shown(m), r), same = Array.from({ length: 40 }, (_, i) => Object.fromEntries(letters.map((n, k) => [n, X.num(String(3 + ((i * 7 + k * 11) % 50)))]))).every((p) => X.same(F.run(m, p), F.run(base, p))); assert.equal(j.why === 'bonded', same, `${t} seed ${seed}: ${F.shown(m)}`); }
    // the reference, and the reference written other ways, pass
    for (const w of [t, `(${t})`, `${t} + 0`, `0 + ${t}`, `${t} × 1`]) assert.equal(F.judge(w, r).why, 'bonded', w);
  }
  // a rule whose reference has no value on the drawn points has no tests, and nothing bonds against it
  const none = F.suite(rule('p ÷ (c - c)', 7)); assert.deepEqual([none.tests, none.admitted, none.why, none.killed, none.alike, none.made], [[], false, 'its tests cannot be made', 0, 15, 15]); assert.deepEqual(F.judge('p ÷ (c - c)', rule('p ÷ (c - c)', 7)), { value: null, why: 'its tests cannot be made', passed: 0, of: 0 });
  // a point where the reference divides by nought is no test: the rule p ÷ (c - d) is tested only where c and d differ
  for (const seed of [1, 2, 3, 4, 5]) for (const t of F.suite(rule('p ÷ (c - d)', seed)).tests) assert.notEqual(t.inputs.c, t.inputs.d);
  // a result that does not end as a decimal is kept exactly, and read back exactly
  const third = F.suite(rule('r + k ÷ n', 7)); assert.ok(third.tests.some((t) => t.want.includes('/')), JSON.stringify(third.tests)); assert.equal(F.judge('r + k ÷ n', rule('r + k ÷ n', 7)).why, 'bonded');
  for (const bad of HOSTILE) assert.deepEqual(F.suite(bad), { tests: [], made: 0, alike: 0, killed: 0, admitted: false, why: 'not a rule' }); assert.equal(F.suite({ names: { p: 1 }, reference: 'q' }).why, 'not a rule'); assert.equal(F.suite({ names: { p: 1 }, reference: 5 }).why, 'not a rule');
});

test('choosing the tests: the first few, then each later point some near-miss still passing fails', () => {
  const P = (p, want) => ({ inputs: { p: X.num(String(p)) }, want: X.num(String(want)) }), m = (t) => tree(t, ['p']);
  // p - 30 and 30 - p agree only at p = 30: four points there do not tell them apart, the fifth does
  const cases = [P(30, 0), P(30, 0), P(30, 0), P(30, 0), P(31, 1), P(32, 2), P(29, -1)];
  assert.deepEqual(F.choose(cases, [m('30 - p')], 4), cases.slice(0, 5)); assert.deepEqual(F.choose(cases, [m('30 - p'), m('p - 31')], 4), cases.slice(0, 4).concat(cases[4]), 'one point that kills both');
  assert.deepEqual(F.choose(cases, [m('30 - p'), m('p × 0')], 4), cases.slice(0, 5), 'p × 0 also agrees at 30, and the fifth point kills it too'); assert.deepEqual(F.choose(cases, [], 4), cases.slice(0, 4)); assert.deepEqual(F.choose(cases, [m('p + 1')], 4), cases.slice(0, 4), 'already killed');
  assert.deepEqual(F.choose(cases.slice(0, 3), [m('30 - p')], 4), cases.slice(0, 3)); assert.deepEqual(F.choose(cases, [m('30 - p')], 2), cases.slice(0, 2).concat(cases[4]));
  // a near-miss with no value at a point fails it
  assert.deepEqual(F.choose([P(30, 0), P(31, 1)], [m('p ÷ (p - 31)')], 1), [P(30, 0)], 'p ÷ (p - 31) is 0 at 30 and has no value at 31: killed at 31 only if still alive');
  assert.deepEqual(F.choose([P(31, 1), P(30, 0)], [m('(p - 30) ÷ (p - 30)')], 1), [P(31, 1), P(30, 0)], 'it gives 1 at 31 and nothing at 30, so 30 is taken');
});

test('judge: a formula bonds only when it is one formula in the language and passes every test', () => {
  const j = (reply, r = R3) => F.judge(reply, r);
  assert.deepEqual(j('p × c + d'), { value: 'p × c + d', why: 'bonded', passed: 4, of: 4 }); assert.deepEqual(j(' (c × p) + d. '), { value: 'c × p + d', why: 'bonded', passed: 4, of: 4 }); assert.deepEqual(j('p*c+d'), { value: 'p × c + d', why: 'bonded', passed: 4, of: 4 });
  assert.deepEqual(j('d + c × p\n'), { value: 'd + c × p', why: 'bonded', passed: 4, of: 4 });
  // a near-miss passes some tests and fails one: how many is counted
  assert.deepEqual(j('p × (c + d)'), { value: null, why: 'fails a test', passed: 0, of: 4 }); assert.deepEqual(j('p × c'), { value: null, why: 'fails a test', passed: 0, of: 4 });
  const part = F.judge('p + c', { names: { p: 1, c: 1 }, reference: 'p × c ÷ (c - 1) + p - p × c ÷ (c - 1)', seed: 3 }); assert.equal(part.why, 'fails a test');
  for (const [reply, why] of [['p × c + d = 2582', 'not a formula'], ['pc + d', 'not a formula'], ['p × c + x', 'a letter the rule does not have'], ['none', 'not a formula'], ['', 'not a formula'], ['The formula is p × c + d', 'not a formula'], ['p × c + d..', 'not a formula'], ['"p × c + d"', 'not a formula'], ['p × c + d\nThat is the rule.', 'not a formula']]) assert.deepEqual(j(reply), { value: null, why, passed: 0, of: 4 }, reply);
  // the length limit, exactly
  const long = (n) => `p × c + d${' + 0'.repeat((n - 9) / 4)}`; assert.equal(long(121).length, 121); assert.equal(j(`${long(117)}   `).why, 'bonded'); assert.equal(j(long(117)).why, 'bonded'); assert.equal(j(`${long(117)} + 0`).why, 'too long'); assert.equal(`${long(117)} + 0`.length, 121); assert.equal(F.LIMIT, 120);
  assert.equal(j(`${long(117)}.`).why, 'bonded', 'the full stop is let go before the length is counted');
  const at120 = `${long(117)} +0`, at121 = `${long(117)} + 0`; assert.deepEqual([at120.length, at121.length], [120, 121]); assert.equal(j(at120).why, 'bonded'); assert.equal(j(at121).why, 'too long'); assert.equal(j(`${at120}.`).why, 'bonded');
  // brackets: an inner formula that cannot be read is no formula, whatever follows it
  for (const t of ['(p ×) + d', '(p × c', '((p × c) + d', '(+) × c', '(p × c))']) assert.equal(F.read(t, ['p', 'c', 'd']).why, 'not a formula', t);
  // whatever it is handed, it rules and does not throw; a rule that is not one bonds nothing
  for (const a of HOSTILE) for (const b of HOSTILE) assert.doesNotThrow(() => F.judge(a, b)); for (const bad of HOSTILE) { if (typeof bad !== 'string') assert.equal(F.judge(bad, R3).why, 'not a formula'); assert.deepEqual(F.judge('p', bad), { value: null, why: 'not a rule', passed: 0, of: 0 }); }
  // the figures of a test are read back exactly, in either form
  assert.deepEqual([F.exact('31/3'), F.exact('-7/2'), F.exact('2.5'), F.exact('12'), F.exact('1/0'), F.exact('a/b'), F.exact(''), F.exact(null)], [X.make(31n, 3n), X.make(-7n, 2n), X.num('2.5'), X.num('12'), null, null, null, null]);
  assert.deepEqual(Object.keys(F.SIGNS), ['+', '-', '−', '×', '*', '÷', '/']);
});
