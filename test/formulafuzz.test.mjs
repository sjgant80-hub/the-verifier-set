import { test } from 'node:test';
import assert from 'node:assert/strict';
import FF from '../src/formulafuzz.mjs';
import F from '../src/formula.mjs';
import X from '../vendor/crystal/vendor/climb/src/exact.mjs';
import { sha256 } from '../vendor/crystal/vendor/climb/src/sha256.mjs';

const REFS = ['p × c', 'p × c + d', 'p × c + d - e', 'p + d ÷ c', 'f × t', 'f × t + s', 'f × t + s - l', 'f + s ÷ t', 'r × n', 'r × n + k', 'r × n + k + b', 'r + k ÷ n'];
const ruleOf = (reference, seed) => ({ names: Object.fromEntries([...new Set(reference.match(/[a-z]/g))].map((n) => [n, n])), reference, seed });
const RULES = REFS.flatMap((ref) => [1, 2, 3].map((seed) => ruleOf(ref, seed)));
const fixed = (k) => () => k, c3 = FF.place(ruleOf('p × c + d', 7)), c1 = FF.place(ruleOf('p × c', 7));
const HOSTILE = [null, undefined, 7, 7n, true, 'x', {}, [], () => 1, { names: 5 }, { get names() { throw new Error('no'); } }, new Proxy({}, { get() { throw new Error('no'); } })];
const rnd = (seed) => { let s = seed >>> 0; return (n) => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s >>> 8) % n; }; };

test('the formula check, attacked: no different rule bonds, no honest formula is refused, no rule\'s tests let a near-miss through', () => {
  const r = FF.fuzz(RULES, { seed: 5 });
  assert.equal(r.places, 36); assert.deepEqual(r.budget, { forged: 42, honest: 12, noise: 24 }); assert.deepEqual(FF.BUDGET, r.budget);
  assert.deepEqual([r.forged.bonded, r.forged.unsound, r.forged.outside, r.honest.refused, r.weak, r.split, r.threw], [0, 0, 0, 0, 0, 0, 0], JSON.stringify(r.found)); assert.deepEqual(r.found, []); assert.equal(r.clean, true);
  assert.equal(r.honest.tried, 36 * 12); assert.equal(r.noise.tried, 36 * 24); assert.equal(r.tried, r.forged.tried + r.honest.tried + r.noise.tried + r.limit.tried); assert.equal(r.forged.tried, r.forged.rows.reduce((a, x) => a + x.tried, 0));
  assert.ok(r.forged.tried + r.forged.alike <= 36 * 42 && r.forged.tried > 36 * 36, String(r.forged.tried)); assert.ok(r.forged.alike > 0, 'some near-misses were the same rule written another way, and were not tried');
  assert.deepEqual(r.forged.rows.map((x) => x.name), Object.keys(FF.FORGERIES)); assert.equal(r.forged.rows.length, 14);
  for (const row of r.forged.rows) { assert.ok(row.tried >= 36, `${row.name}: ${row.tried}`); assert.equal(row.bonded, 0); assert.equal(row.kind, FF.FORGERIES[row.name][0]); }
  assert.deepEqual(r.forged.rows.filter((x) => x.kind === 'unsound').map((x) => x.name), Object.keys(FF.FORGERIES).slice(0, 7));
  // THE LIMIT: on every rule, a formula built from its own tests passes them all and is a different rule. It bonds, and is counted apart
  assert.deepEqual(r.limit, { tried: 36, bonded: 36 });
  // some noise bonds, where it left the rule itself: both runners said so
  assert.ok(r.noise.bonded > 0 && r.noise.bonded < r.noise.tried / 2, String(r.noise.bonded));
  for (const arm of ['forged', 'honest', 'noise']) assert.equal(r.sample.filter((s) => s.arm === arm).length, 8, arm); assert.equal(r.sample.filter((s) => s.arm === 'limit').length, 1);
  for (const s of r.sample) { assert.deepEqual(Object.keys(s), ['rule', 'arm', 'way', 'reply', 'bond']); assert.equal(s.rule, 'p × c'); }
  const order = r.sample.filter((s) => s.arm === 'forged').map((s) => Object.keys(FF.FORGERIES).indexOf(s.way)); assert.ok(order.every((k, i) => k >= 0 && (i === 0 || k > order[i - 1])), 'each way in turn, first: ' + order);
});

test('the limit, shown: a formula built from the tests passes every test, and gives another answer everywhere else', () => {
  const lim = FF.limit(c3), tests = F.suite(ruleOf('p × c + d', 7)).tests;
  assert.equal(lim, `p × c + d + ${[...new Set(tests.map((t) => t.inputs.p))].map((v) => `(p - ${v})`).join(' × ')}`); assert.equal(F.judge(lim, ruleOf('p × c + d', 7)).why, 'bonded'); assert.equal(FF.plainly(lim, ruleOf('p × c + d', 7)), true);
  const at = (f, p, c, d) => X.show(F.run(F.read(f, ['p', 'c', 'd']).tree, { p: X.num(p), c: X.num(c), d: X.num(d) }));
  for (const t of tests) assert.equal(at(lim, t.inputs.p, t.inputs.c, t.inputs.d), t.want); assert.notEqual(at(lim, '26', '12', '45'), at('p × c + d', '26', '12', '45'));
  // on another seed's tests the same formula is caught
  assert.equal(F.judge(lim, ruleOf('p × c + d', 8)).why, 'fails a test');
});

test('the second runner reads every formula as the check does and gets the same value, on text made at random', () => {
  const r = rnd(21), chars = ['p', 'c', 'd', 'x', 'P', '1', '2', '0', '5', '.', ' ', ' ', '+', '-', '−', '×', '*', '÷', '/', '(', ')', '(', ')', '=', '\t'];
  const pt = (k) => ({ p: X.num(String(2 + (k * 7) % 50)), c: X.num(String(3 + (k * 11) % 40)), d: X.num(String(1 + (k * 13) % 30)) });
  let read = 0, refused = 0;
  for (let k = 0; k < 60000; k++) {
    const text = Array.from({ length: 1 + r(12) }, () => chars[r(chars.length)]).join(''), a = F.read(text, ['p', 'c', 'd']).tree, b = FF.SECOND.read(text, ['p', 'c', 'd']);
    assert.equal(a !== undefined, b !== null, JSON.stringify(text));
    if (a === undefined) { refused++; continue; }
    read++;
    for (let j = 0; j < 3; j++) { const p = pt(k + j), u = F.run(a, p), v = FF.SECOND.run(b, Object.fromEntries(Object.entries(p).map(([n, f]) => [n, [f.n, f.d]]))); assert.equal(u === null, v === null, JSON.stringify(text)); if (u !== null) assert.ok(FF.SECOND.equal([u.n, u.d], v), JSON.stringify(text)); }
  }
  assert.ok(read > 1500 && refused > 30000, `${read} ${refused}`);
  // formulas made well, deep and wide, with brackets where they are needed and where they are not
  const make = (depth) => { if (depth === 0 || r(4) === 0) return r(3) === 0 ? String(1 + r(99)) : 'pcd'[r(3)]; const t = `${make(depth - 1)} ${'+-×÷'[r(4)]} ${make(depth - 1)}`; return r(3) === 0 ? `(${t})` : t; };
  for (let k = 0; k < 8000; k++) { const text = make(4), a = F.read(text, ['p', 'c', 'd']).tree, b = FF.SECOND.read(text, ['p', 'c', 'd']); assert.ok(a !== undefined && b !== null, text); const p = pt(k), u = F.run(a, p), v = FF.SECOND.run(b, { p: [p.p.n, 1n], c: [p.c.n, 1n], d: [p.d.n, 1n] }); assert.equal(u === null, v === null, text); if (u !== null) assert.ok(FF.SECOND.equal([u.n, u.d], v), text); }
  // numbers: forty digits at most, a decimal part, nothing run on to them
  for (const [text, ok] of [['9'.repeat(40), true], ['9'.repeat(41), false], [`${'1'.repeat(20)}.${'2'.repeat(20)}`, true], [`${'1'.repeat(20)}.${'2'.repeat(21)}`, false], ['1.2.3', false], ['2.', false], ['.5', false], ['007', true], ['2p', false], ['p2', false], ['2(p)', false], ['(p)2', false], ['pC', false], ['é', false]]) { assert.equal(FF.SECOND.read(text, ['p']) !== null, ok, text); assert.equal(F.read(text, ['p']).tree !== undefined, ok, text); }
  // a value past the size limit is no value, for both
  const big = `${'9'.repeat(31)} × ${'9'.repeat(31)}`; assert.equal(F.run(F.read(big, []).tree, {}), null); assert.equal(FF.SECOND.run(FF.SECOND.read(big, []), {}), null); assert.notEqual(FF.SECOND.run(FF.SECOND.read(`${'9'.repeat(30)} × ${'9'.repeat(30)}`, []), {}), null);
  // the limit itself: a top or a bottom of exactly ten to the sixtieth is held, one past it is not, either sign, for both
  const T30 = `1${'0'.repeat(30)}`, E60 = 10n ** 60n;
  for (const [text, want] of [[`${T30} × ${T30}`, [E60, 1n]], [`${T30} × ${T30} + 1`, null], [`1 ÷ (${T30} × ${T30})`, [1n, E60]], [`1 ÷ (${T30} × ${T30} + 1)`, null], [`0 - ${T30} × ${T30}`, [-E60, 1n]], [`0 - ${T30} × ${T30} - 1`, null], ['(0 - 6) ÷ 4', [-3n, 2n]], ['6 ÷ (0 - 4)', [-3n, 2n]], ['0 ÷ (0 - 4)', [0n, 1n]]]) {
    assert.deepEqual(FF.SECOND.run(FF.SECOND.read(text, []), {}), want, text); const u = F.run(F.read(text, []).tree, {}); assert.deepEqual(u === null ? null : [u.n, u.d], want, text);
  }
  // a test's figure, read back as a pair
  assert.deepEqual([FF.SECOND.pair('2582'), FF.SECOND.pair('25.75'), FF.SECOND.pair('31/3'), FF.SECOND.pair('-7/2'), FF.SECOND.pair('x'), FF.SECOND.pair(null)], [[2582n, 1n], [103n, 4n], [31n, 3n], [-7n, 2n], null, null]);
  // two formulas differ when they disagree at a point drawn: a value against another value, or against none; two
  // that have no value anywhere agree
  const seq = (seed) => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) >>> 8; }, D = (a, b) => FF.SECOND.differs(a, b, ['p', 'c'], seq(3));
  assert.deepEqual([D('p × c', 'c × p'), D('p × c', 'p + c'), D('p ÷ (c - c)', 'p ÷ (c - c)'), D('p ÷ (c - c)', 'p'), D('p', 'p ÷ (c - c)')], [false, true, false, true, true]);
});

test('the two rulings, side by side: on replies made at random to every rule, the check and the second runner never differ', () => {
  const r = rnd(22);
  let bonded = 0, refused = 0;
  for (const rule of RULES) {
    const c = FF.place(rule), parts = [...c.letters, ...c.letters, '2', '1', '0', ' + ', ' - ', ' × ', ' ÷ ', '(', ')', ' ', '.', c.ref, c.ref];
    for (let k = 0; k < 400; k++) { const reply = Array.from({ length: 1 + r(5) }, () => parts[r(parts.length)]).join(''), x = F.judge(reply, rule).value !== null; assert.equal(FF.plainly(reply, rule), x, `${c.ref} ← ${JSON.stringify(reply)}`); if (x) bonded++; else refused++; }
  }
  assert.ok(bonded > 300 && refused > 8000, `${bonded} ${refused}`);
  for (const reply of HOSTILE) for (const rule of HOSTILE) assert.equal(FF.plainly(reply, rule), false); assert.equal(FF.plainly('p', ruleOf('p ÷ (c - c)', 7)), false, 'nothing passes a rule whose tests cannot be made');
  const at = (n) => `p × c${' + 0'.repeat(n)}`; assert.equal(at(28).length, 117); assert.equal(FF.plainly(`${at(28)} + 1`, ruleOf('p × c', 7)), false); assert.equal(FF.plainly(`${at(28)}.`, ruleOf('p × c', 7)), true); assert.equal(FF.plainly(`${at(28)} × 1`, ruleOf('p × c', 7)), false, '121 characters'); assert.equal(`${at(28)} × 1`.length, 121); assert.equal(FF.plainly(`${at(28)} ×1`, ruleOf('p × c', 7)), true, '120 characters'); assert.equal(`${at(28)} ×1`.length, 120);
});

test('each way of forging is what its name says', () => {
  const made = (k, c = c3) => Object.fromEntries(Object.entries(FF.FORGERIES).map(([name, [, make]]) => [name, make(fixed(k), c)]));
  const m0 = made(0);
  assert.deepEqual(m0, {
    'a near-miss: one step changed': 'p × c - d', 'a near-miss: two steps changed': 'p × c + d', 'the brackets moved': 'p × (c + d)', 'a number that is the first test\'s result': '2582', 'a difference too small for a float to see': 'p × c + d + 1 ÷ 100000000000000000',
    'no value at any test': `p × c + d + 1 ÷ (${['53', '44', '47', '39'].map((v) => `(p - ${v})`).join(' × ')})`, 'a letter the rule does not have': 'p × c + d + q', 'words with it': 'The formula is p × c + d', 'its answer written after it': 'p × c + d = 2582',
    'a second line': 'p × c + d\np × c + d', 'marks round it': '`p × c + d`', 'a product written without its sign, or with a letter for it': 'pc + d', 'capitals, or other digits': 'P × C + D', 'too long, or built to break a reader': `p × c + d${' + 0'.repeat(30)}`,
  });
  assert.equal(FF.FORGERIES['the brackets moved'][1](fixed(0), c1), null, 'one sign: nothing to move'); assert.equal(FF.FORGERIES['a product written without its sign, or with a letter for it'][1](fixed(0), FF.place(ruleOf('p + c', 7))), null);
  assert.equal(made(1)['a near-miss: two steps changed'], 'p × c - d', 'the second near-miss of the second near-miss'); assert.equal(made(2)['a product written without its sign, or with a letter for it'], 'p x c + d'); assert.equal(made(1)['capitals, or other digits'], 'p × c + d + ０');
  // none of them bonds, and every one the harness calls a different rule is one
  let alikeSeen = 0;
  for (const c of [c3, c1, FF.place(ruleOf('r + k ÷ n', 7)), FF.place(ruleOf('f × t + s - l', 7))]) for (const k of [0, 1, 2, 3, 4, 5]) for (const [name, reply] of Object.entries(made(k, c))) if (reply !== null) {
    // a different-rule forgery that came out as the rule itself (c × p for p × c, f × t + (s - l)) is not a forgery: the harness skips it too
    const order = FF.SECOND.read(reply, c.letters), alike = FF.FORGERIES[name][0] === 'unsound' && order !== null && Array.from({ length: 30 }, (_, i) => Object.fromEntries(c.letters.map((n, j) => [n, [BigInt(3 + ((i * 5 + j * 7) % 60)), 1n]]))).every((p) => FF.SECOND.equal(FF.SECOND.run(order, p), FF.SECOND.run(FF.SECOND.read(c.ref, c.letters), p)));
    if (alike) { alikeSeen++; assert.equal(F.judge(reply, c.rule).why, 'bonded', `${name}: ${reply} is the rule itself`); continue; }
    assert.equal(F.judge(reply, c.rule).value, null, `${name}: ${reply}`); assert.equal(FF.plainly(reply, c.rule), false, name);
  }
  assert.ok(alikeSeen > 0);
  // honest formulas are the rule itself, written the allowed ways; noise is an honest one damaged
  let s = 5; const R = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s >>> 8; }, seen = new Set();
  for (const rule of RULES) { const c = FF.place(rule); for (let i = 0; i < 40; i++) { const h = FF.honest(R, c); seen.add(h); assert.equal(F.judge(h, rule).why, 'bonded', JSON.stringify(h)); assert.equal(FF.plainly(h, rule), true); } }
  const all = [...seen]; assert.ok(all.some((h) => h.includes('*')) && all.some((h) => h.includes('−')) && all.some((h) => /^\s*\(/.test(h)) && all.some((h) => !h.trim().includes(' ')) && all.some((h) => h.trim().endsWith('.')) && all.some((h) => h.startsWith('\n')) && all.some((h) => / \+ 0/.test(h)) && all.some((h) => /^\s*1 × /.test(h)) && all.some((h) => /^\s*0 \+ /.test(h)));
  assert.equal(FF.honest(fixed(0), c3), '(d + c × p)', 'every side the other way round, in brackets'); assert.equal(FF.honest(fixed(1), c3), 'p × c + d + 0 ', 'every side kept, + 0 added');
  // each way of writing it, and each way of damaging it, exactly
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map((k) => FF.honest(fixed(k), c3)), ['(d + c × p)', 'p × c + d + 0 ', ' 1 × d + c × p.\n', '\np * c + d', 'd+c×p ', '0 + p × c + d.\n', ' d + c × p', '\np × c + d ']);
  assert.deepEqual([0, 1, 2, 3, 4, 30, 31, 57].map((k) => FF.noise(fixed(k), c3)), ['d + c × p)', 'p11 × c + d + 0 ', ' 12× d + c × p.\n', '\np  *c + d', 'd+c×ppp ', ' d + c ×p', '\np ×  c  + d ', 'p(× c + d + 0']);
  const seq = (seed) => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) >>> 8; }, R11 = seq(11);
  assert.equal(sha256(JSON.stringify(Array.from({ length: 300 }, () => FF.noise(R11, c3)))), '2127c86d8ebb7bae91344ff5e54c0d78c589225648cfa051bada8bea2d6e6b70');
  const n =Array.from({ length: 400 }, () => FF.noise(R, c3)), kept = n.filter((x) => F.judge(x, c3.rule).value !== null).length; assert.ok(kept > 20 && kept < 300, String(kept)); for (const x of n) assert.equal(F.judge(x, c3.rule).value !== null, FF.plainly(x, c3.rule), JSON.stringify(x));
  // a place: the letters, the reference written one way, its tests; nothing for what is not a rule
  assert.deepEqual([c3.letters, c3.ref, c3.tests.length], [['p', 'c', 'd'], 'p × c + d', 4]); assert.equal(FF.place(ruleOf('(p × c) + d', 7)).ref, 'p × c + d'); for (const bad of [...HOSTILE, ruleOf('p ÷ (c - c)', 7)]) assert.equal(FF.place(bad), null);
});

test('the same seed makes the same attack again, to the last reply', () => {
  const some = RULES.slice(0, 9), a = FF.fuzz(some, { seed: 7 }), b = FF.fuzz(some, { seed: 7 }), c = FF.fuzz(some, { seed: 8 });
  assert.deepEqual(a, b); assert.notDeepEqual(a.sample, c.sample); assert.equal(c.clean, true);
  const seen = [], spy = (reply, rule) => { seen.push(`${rule.reference}|${rule.seed}|${reply}`); return F.judge(reply, rule).value; };
  const r = FF.fuzz(RULES.filter((_, i) => i % 3 === 0), { seed: 20261212, judge: spy }); assert.equal(seen.length, r.tried); assert.equal(r.clean, true);
  assert.equal(sha256(JSON.stringify(seen)), sha256(JSON.stringify(seen)));
  assert.equal(sha256(JSON.stringify(seen)).length, 64);
  const none = FF.fuzz([null, 7, {}, ruleOf('p ÷ (c - c)', 7)], { seed: 1 }); assert.deepEqual([none.places, none.tried, none.clean], [0, 0, true]); for (const bad of [null, undefined, 7, 'x', {}]) assert.equal(FF.fuzz(bad, null).tried, 0);
  assert.deepEqual(FF.fuzz(RULES.slice(0, 1), { budget: { forged: -1, honest: 1.5, noise: '3' } }).budget, FF.BUDGET); assert.equal(FF.fuzz([], { seed: -1 }).seed, 4294967295);
  const small = FF.fuzz(RULES.slice(0, 2), { seed: 3, budget: { forged: 3, honest: 2, noise: 0 } }); assert.deepEqual([small.places, small.honest.tried, small.noise.tried], [2, 4, 0]); assert.equal(small.forged.tried + small.forged.alike, 4, 'p × c has no brackets to move: that try is not made');
});

test('the harness has teeth: every runner with a leak planted in it is caught', () => {
  const t = FF.teeth(RULES.slice(0, 12), { seed: 7 });
  assert.equal(t.planted, 12); assert.equal(t.caught, 12, JSON.stringify(t.rows.filter((x) => !x.caught))); assert.deepEqual(t.rows.map((x) => x.name), Object.keys(FF.PLANTED));
  for (const row of t.rows) { assert.equal(typeof row.way, 'string'); assert.equal(typeof row.reply, 'string'); }
  // each leak is the leak its name says: one reply the planted runner takes and the check does not
  const rule = ruleOf('p × c + d', 7), P = FF.PLANTED, leak = {
    'runs only the first test': '2582', 'compares as floating-point numbers': 'p × c + d + 1 ÷ 100000000000000000', 'tests only where every letter is the same': 'p × p + d', 'lets a letter it does not know stand for nought': 'p × c + d + q',
    'reads the formula before an = sign': 'p × c + d = 7', 'counts a test with no value as passed': `1 ÷ (${['53', '44', '47', '39'].map((v) => `(p - ${v})`).join(' × ')})`, 'reads x as times': 'p x c + d', 'reads a formula out of a sentence': 'The formula is p × c + d',
    'does not see brackets': '(p × c) + (d)', 'checks only that the letters are the rule\'s': 'p + c + d',
  };
  for (const [name, reply] of Object.entries(leak)) { assert.ok(P[name](reply, rule) !== null, `${name}: ${reply}`); assert.equal(F.judge(reply, rule).value === null, name !== 'does not see brackets', name); }
  assert.ok(P['does not see brackets']('p × (c + d)', rule) !== null); assert.equal(F.judge('p × (c + d)', rule).value, null);
  assert.equal(P['refuses everything']('p × c + d', rule), null); assert.throws(() => P['throws on a reply it cannot read']('p × c ＋ d', rule)); assert.doesNotThrow(() => P['throws on a reply it cannot read']('p × c + 9', rule));
  // apart from its leak, each takes the rule and nothing that is plainly not a formula; none throws on what it is handed
  for (const name of Object.keys(P)) if (name !== 'refuses everything') assert.ok(P[name]('p × c + d', rule) !== null, name);
  for (const name of Object.keys(P)) for (const reply of ['', 'abc', 'none', 'p × c + d + 1', `p × c${' + 0'.repeat(40)}`]) if (!(['runs only the first test', "checks only that the letters are the rule's"].includes(name) && reply === 'p × c + d + 1')) assert.equal(P[name](reply, rule), null, `${name} ← ${reply}`);
  for (const name of Object.keys(P)) for (const bad of HOSTILE) if (name !== 'throws on a reply it cannot read') assert.doesNotThrow(() => P[name](bad, bad), name);
  // a planted runner keeps the length limit to the character, takes nothing where a rule has no tests, and nothing
  // where the rule's own reference cannot be read
  const at = (n) => `p × c${' + 0'.repeat(n)}`, pc = ruleOf('p × c', 7);
  assert.equal(P['runs only the first test'](`${at(28)} ×1`, pc), 'bonded', '120 characters'); assert.equal(P['runs only the first test'](`${at(28)} × 1`, pc), null, '121 characters');
  assert.equal(P['runs only the first test']('p', ruleOf('p ÷ (c - c)', 7)), null); assert.equal(P['tests only where every letter is the same']('p', { names: { p: 'p' }, reference: 'p +', seed: 1 }), null);
  // a runner that throws is counted; a runner that takes everything bonds every forgery; the sound runner, put through as a runner, is clean
  const thrown = FF.fuzz(RULES.slice(0, 2), { seed: 1, judge: () => { throw new Error('x'); } }); assert.deepEqual([thrown.threw, thrown.clean, thrown.split, thrown.found[0].bond, thrown.found.length], [thrown.tried, false, 0, null, 12], 'twelve findings kept at most');
  const lax = FF.fuzz(RULES.slice(0, 6), { seed: 1, judge: () => 1, budget: { forged: 14, honest: 2, noise: 2 } }); assert.deepEqual([lax.forged.bonded === lax.forged.tried, lax.honest.refused, lax.clean], [true, 0, false]); assert.ok(lax.forged.unsound > 0 && lax.forged.outside > 0); assert.equal(lax.forged.unsound + lax.forged.outside, lax.forged.bonded);
  assert.equal(FF.fuzz(RULES.slice(0, 6), { seed: 1, judge: (reply, r) => F.judge(reply, r).value }).clean, true); assert.equal(FF.teeth(null, null).caught, 0, 'with nothing to attack, nothing is caught');
});
