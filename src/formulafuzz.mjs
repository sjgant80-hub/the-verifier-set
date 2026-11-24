// formulafuzz.mjs — the watcher that watches the executable bond-check (formula.mjs). A leak here would bond a rule
// that is not the rule: every answer worked out from it would be wrong, and labelled as tested.
//
// Three opinions on every reply, made three ways: how the reply was MADE (a forged formula, or an honest one), the
// bond-check (formula.mjs), and a SECOND RUNNER (plainly(), below) written apart from it: its own reading of a
// formula (operators stacked as they come, not a descent), its own arithmetic on pairs of whole numbers, run on the
// same tests. A reply the three do not agree on is a finding. A third arm is noise: honest formulas with a few
// characters changed, on which the two runners must agree.
//
// Two more things are counted. WEAK: for every rule attacked, every near-miss of its reference that the second
// runner finds is a different rule (it differs on a point drawn here) must fail one of the rule's tests; a near-miss
// that passes them all is a weak suite, and a finding. THE LIMIT: a formula built from the tests themselves, which
// passes every one of them and is a different rule everywhere else (it adds a product that is nought at each test).
// It bonds. That is not a leak in this check: it is what "proven against its tests" means, and it is counted apart,
// so the page can show it.
//
// teeth() turns the harness on runners with one leak planted in each. Nothing here uses a model. Pure and total: a
// runner that throws is caught and counted.
import { rng } from '../vendor/crystal/src/fuzz.mjs';
import { judge, suite, read, shown, mutants, names, LIMIT } from './formula.mjs';

const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
const str = (x) => (typeof x === 'string' ? x : '');
const int = (R, n) => R() % n, pick = (R, xs) => xs[R() % xs.length];

// ── the second runner: its own reading, its own arithmetic ──
// a number is a pair [top, bottom] of whole numbers. Kept in lowest terms with the bottom above nought, and with no
// part longer than 60 digits (formula.mjs's limit, kept here by its own code), so the two runners have values for
// the same formulas.
const BOUND = 10n ** 60n;
// a whole number's size and sign read from how it is written, not by comparing it with nought (the second runner's
// own way, and one with no boundary to get wrong at nought itself)
const abs2 = (x) => BigInt(String(x).replace('-', ''));
const gcd2 = (a, b) => { let x = abs2(a), y = abs2(b); while (y > 0n) [x, y] = [y, x % y]; return x; };
const tidy2 = (t, b) => { if (b === 0n) return null; const g = gcd2(t, b), s = String(b).startsWith('-') ? -1n : 1n, n = (s * t) / g, d = (s * b) / g; return abs2(n) > BOUND || d > BOUND ? null : [n, d]; };
const DO = { '+': (a, b) => tidy2(a[0] * b[1] + b[0] * a[1], a[1] * b[1]), '-': (a, b) => tidy2(a[0] * b[1] - b[0] * a[1], a[1] * b[1]), '*': (a, b) => tidy2(a[0] * b[0], a[1] * b[1]), '/': (a, b) => tidy2(a[0] * b[1], a[1] * b[0]) };
const RANK2 = { '+': 1, '-': 1, '*': 2, '/': 2 }, SIGN2 = { '+': '+', '-': '-', '−': '-', '×': '*', '*': '*', '÷': '/', '/': '/' };
const isDigit = (ch) => typeof ch === 'string' && ch.length === 1 && ch >= '0' && ch <= '9';
// a plain number: digits, and a decimal part, forty digits at most in all
function plainNumber(s) {
  const [w, f, more] = s.split('.');
  if (more !== undefined || !/^\d+$/.test(w) || (f !== undefined && !/^\d+$/.test(f)) || w.length + (f ?? '').length > 40) return null;
  return tidy2(BigInt(w + (f ?? '')), 10n ** BigInt((f ?? '').length));
}
// itsRead(text, letters) → the formula in the order it is worked out (numbers and letters, each sign after its two
// sides), or null when it is not one formula of the letters
function itsRead(text, letters) {
  const out = [], stack = [];
  let want = 'part', i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === ' ') { i++; continue; }
    if (want === 'part') {
      if (ch === '(') { stack.push('('); i++; continue; }
      // a number takes every digit and point that follows it, and must be a plain number whole; whatever comes next
      // (a letter, a bracket) is read as where a sign should be, and refused there
      if (isDigit(ch)) { let j = i; while (isDigit(text[j]) || text[j] === '.') j++; const v = plainNumber(text.slice(i, j)); if (v === null) return null; out.push(v); i = j; want = 'sign'; continue; }
      if (letters.includes(ch)) { out.push(ch); i++; want = 'sign'; continue; }
      return null;
    }
    if (ch === ')') { while (stack.length > 0 && stack[stack.length - 1] !== '(') out.push(stack.pop()); if (stack.pop() !== '(') return null; i++; continue; }
    const op = SIGN2[ch];
    if (op === undefined) return null;
    // an open bracket, or nothing, has no rank, so the stack is popped only down to it
    while (RANK2[stack[stack.length - 1]] >= RANK2[op]) out.push(stack.pop());
    stack.push(op); i++; want = 'part';
  }
  if (want === 'part') return null;
  while (stack.length > 0) { const top = stack.pop(); if (top === '(') return null; out.push(top); }
  return out;
}
// itsRun(order, inputs) → the value, a pair, or null (a division by nought, a number past the bound)
function itsRun(order, inputs) {
  const vals = [];
  for (const t of order) {
    if (Array.isArray(t)) vals.push(t);
    else if (DO[t] === undefined) vals.push(inputs[t]);
    else { const b = vals.pop(), a = vals.pop(); if (a === null || b === null) return null; vals.push(DO[t](a, b)); }
  }
  return vals[0] ?? null;
}
// a test's figure as a pair: '2582', '25.75', '31/3'
const pairOf = (text) => { const [t, b] = str(text).split('/'); const top = plainNumber(t.replace(/^-/, '')); return top === null ? null : tidy2(t.startsWith('-') ? -top[0] : top[0], top[1] * (b === undefined ? 1n : BigInt(b))); };
const equal = (a, b) => a !== null && b !== null && a[0] * b[1] === b[0] * a[1];
// plainly(reply, rule) → true when the reply is one formula of the rule's letters that gives every test's result:
// the second runner
export function plainly(reply, rule) {
  const letters = names(rule), s = suite(rule);
  return letters !== null && s.admitted && passes(reply, letters, s.tests);
}
// passes(reply, letters, tests) → the second runner on tests already made (the harness makes a rule's tests once)
function passes(reply, letters, tests) {
  let q = str(reply).trim();
  if (q.endsWith('.')) q = q.slice(0, -1);
  if (q.length > LIMIT) return false;
  const order = itsRead(q, letters);
  return order !== null && tests.every((t) => equal(itsRun(order, Object.fromEntries(letters.map((n) => [n, pairOf(t.inputs[n])]))), pairOf(t.want)));
}
// two values agree when both are the same value, or both are none
const agree = (u, v) => (u === null && v === null) || equal(u, v);
// differs(a, b, letters, R) → the two formulas (texts, each one the runner reads) disagree at one of 24 points drawn
// here, every letter a whole number from 1 to 97
function differs(a, b, letters, R) {
  const x = itsRead(a, letters), y = itsRead(b, letters);
  return Array.from({ length: 24 }, () => Object.fromEntries(letters.map((n) => [n, [BigInt(1 + int(R, 97)), 1n]]))).some((p) => !agree(itsRun(x, p), itsRun(y, p)));
}
export const SECOND = { read: itsRead, run: itsRun, pair: pairOf, equal, differs };

// ── a place to attack: a rule ──
// place(rule) → what the harness needs: the letters, the reference as written one way, its tree, its tests; or null
export function place(rule) {
  const letters = names(rule), s = suite(rule), f = letters === null ? {} : read(get(rule, 'reference'), letters);
  if (!s.admitted || f.tree === undefined) return null;
  return { rule, letters, ref: shown(f.tree), tree: f.tree, tests: s.tests };
}
// zero(c) → a product that is nought at every test of the rule and nowhere near nought elsewhere: one bracket for
// each value the first letter takes in the tests
const zero = (c) => [...new Set(c.tests.map((t) => t.inputs[c.letters[0]]))].map((v) => `(${c.letters[0]} - ${v})`).join(' × ');
const near = (R, c, depth) => {
  let f = c.tree;
  for (let k = 0; k < depth; k++) { const all = mutants(f, c.letters); if (all.length === 0) break; f = pick(R, all); }
  return shown(f);
};
const rotate = (t) => (t.op && t.a.op ? { op: t.a.op, a: t.a.a, b: { op: t.op, a: t.a.b, b: t.b } } : t.op && t.b.op ? { op: t.b.op, a: { op: t.op, a: t.a, b: t.b.a }, b: t.b.b } : null);
const want1 = (c) => { const w = c.tests[0].want; return w.includes('/') ? w.replace('/', ' ÷ ') : w; };
const FULL = (s) => [...s].map((ch) => (isDigit(ch) ? String.fromCharCode(0xff10 + Number(ch)) : ch)).join('');
// commute(R, tree) → the same rule with the two sides of some + and × the other way round
const commute = (R, t) => (!t.op ? t : { op: t.op, ...((t.op === '+' || t.op === '*') && int(R, 2) === 0 ? { a: commute(R, t.b), b: commute(R, t.a) } : { a: commute(R, t.a), b: commute(R, t.b) }) });

// FORGERIES → name → [kind, make(R, c)]. 'unsound': a different rule, which must not bond. 'outside': the rule
// itself, written in a form the check does not allow. make returns null when the rule has no such forgery.
export const FORGERIES = {
  'a near-miss: one step changed': ['unsound', (R, c) => near(R, c, 1)],
  'a near-miss: two steps changed': ['unsound', (R, c) => near(R, c, 2)],
  'the brackets moved': ['unsound', (R, c) => { const t = rotate(c.tree); return t === null ? null : shown(t); }],
  'a number that is the first test\'s result': ['unsound', (R, c) => want1(c)],
  'a difference too small for a float to see': ['unsound', (R, c) => `${c.ref} + 1 ÷ ${pick(R, ['100000000000000000', '1000000000000000000000', '7000000000000000000'])}`],
  'no value at any test': ['unsound', (R, c) => `${c.ref} + 1 ÷ (${zero(c)})`],
  'a letter the rule does not have': ['unsound', (R, c) => `${c.ref} ${pick(R, ['+', '×', '-'])} ${pick(R, [...'qwyzjgh'].filter((n) => !c.letters.includes(n)))}`],
  'words with it': ['outside', (R, c) => pick(R, [`The formula is ${c.ref}`, `${c.ref} is the formula`, `Formula: ${c.ref}`, `${c.ref} (the rule)`, `So ${c.ref}`])],
  'its answer written after it': ['outside', (R, c) => `${c.ref} = ${want1(c)}`],
  'a second line': ['outside', (R, c) => pick(R, [`${c.ref}\n${c.ref}`, `${c.ref}\nThat is the rule.`, `Here it is:\n${c.ref}`])],
  'marks round it': ['outside', (R, c) => pick(R, [`\`${c.ref}\``, `"${c.ref}"`, `**${c.ref}**`, `$${c.ref}$`, `[${c.ref}]`])],
  'a product written without its sign, or with a letter for it': ['outside', (R, c) => (c.ref.includes(' × ') ? c.ref.replace(' × ', pick(R, ['', ' ', ' x ', ' · ', ' . '])) : null)],
  'capitals, or other digits': ['outside', (R, c) => pick(R, [c.ref.toUpperCase(), FULL(`${c.ref} + 0`), `${c.ref} ＋ 0`, `${c.ref} + 0 `.replace(' + 0', ' + 0')])],
  'too long, or built to break a reader': ['outside', (R, c) => pick(R, [`${c.ref}${' + 0'.repeat(30)}`, `${'('.repeat(70)}${c.ref}${')'.repeat(70)}`, `\u0000${c.ref}`, `${c.ref}\ud800`, `${c.ref}​`, `${c.ref} + ${'9'.repeat(41)} - ${'9'.repeat(41)}`])],
};
// honest(R, c) → the rule itself, written one of the ways the check allows: sides of + and × either way round,
// brackets kept or added, + 0 or × 1, the other signs, spaces or none, a full stop
export function honest(R, c) {
  let f = shown(commute(R, c.tree));
  const how = int(R, 8);
  if (how === 0) f = `(${f})`; else if (how === 1) f = `${f} + 0`; else if (how === 2) f = `1 × ${f}`; else if (how === 3) f = f.replace(/ × /g, ' * ').replace(/ ÷ /g, ' / ').replace(/ - /g, ' − ');
  else if (how === 4) f = f.replace(/ /g, ''); else if (how === 5) f = `0 + ${f}`;
  return `${pick(R, ['', '', ' ', '\n'])}${f}${pick(R, ['', '', '.'])}${pick(R, ['', ' ', '\n'])}`;
}
const STOCK = [...'0123456789', ' ', '+', '-', '×', '÷', '(', ')', '.', 'x', 'p', 'c'];
// noise(R, c) → an honest formula with one to three characters dropped, added, changed, swapped or doubled
export function noise(R, c) {
  const t = [...honest(R, c)];
  for (let k = 1 + int(R, 3); k > 0; k--) {
    const i = int(R, t.length + 1), how = int(R, 5);
    if (how === 0) t.splice(i, 1); else if (how === 1) t.splice(i, 0, pick(R, STOCK)); else if (how === 2) t.splice(i, 1, pick(R, STOCK));
    else if (how === 3) t.splice(i, 2, ...t.slice(i, i + 2).reverse()); else t.splice(i, 0, ...t.slice(i, i + 1));
  }
  return t.join('');
}
// limit(c) → a formula built from the rule's own tests: the rule, plus a product that is nought at every test
export const limit = (c) => `${c.ref} + ${zero(c)}`;

export const BUDGET = { forged: 42, honest: 12, noise: 24 };
// fuzz(rules, opts) → the count. rules: [{ names, reference, seed }]. opts.seed, opts.budget, opts.judge (another
// runner in the bond-check's place: (reply, rule) → something, or null for no bond).
//   places  how many rules were attacked; weak: near-misses that passed every test of a rule (must be 0)
//   forged  { tried, bonded, unsound, outside, alike, rows }   honest { tried, refused }   noise { tried, bonded }
//   limit   { tried, bonded }: formulas built from the tests themselves, which bond (the limit, counted apart)
//   split   replies the check, the second runner and the label did not all agree on; threw; found; sample; clean
export function fuzz(rules, opts) {
  const runner = typeof get(opts, 'judge') === 'function' ? opts.judge : (reply, rule) => judge(reply, rule).value, R = rng(get(opts, 'seed')), names_ = Object.keys(FORGERIES);
  const budget = Object.fromEntries(Object.keys(BUDGET).map((k) => { const v = get(get(opts, 'budget'), k); return [k, Number.isInteger(v) && v >= 0 ? v : BUDGET[k]]; }));
  const rows = names_.map((name) => ({ name, kind: FORGERIES[name][0], tried: 0, bonded: 0 })), found = [], sample = [];
  const out = { seed: (Number(get(opts, 'seed')) || 0) >>> 0, budget, places: 0, weak: 0, tried: 0, forged: { tried: 0, bonded: 0, unsound: 0, outside: 0, alike: 0, rows }, honest: { tried: 0, refused: 0 }, noise: { tried: 0, bonded: 0 }, limit: { tried: 0, bonded: 0 }, split: 0, threw: 0, found, sample, clean: false };
  const note = (finding) => { if (found.length < 12) found.push(finding); };
  for (const rule of Array.isArray(rules) ? rules : []) {
    const c = place(rule);
    if (c === null) continue;
    out.places++;
    const first = out.places === 1;
    const rule_ = (reply, arm, way, label) => {
      let bond = null;
      try { bond = runner(reply, c.rule) !== null; } catch { out.threw++; }
      const second = passes(reply, c.letters, c.tests), agreed = bond === second && (label === null || label === second);
      out.tried++;
      if (!agreed) { if (bond !== null) out.split++; note({ rule: c.ref, reply: reply.slice(0, 160), arm, way, bond, second, label }); }
      if (first && sample.filter((s) => s.arm === arm).length < 8) sample.push({ rule: c.ref, arm, way, reply: reply.slice(0, 160), bond });
      return bond === true;
    };
    // weak: every near-miss that is a different rule fails a test
    for (const m of mutants(c.tree, c.letters)) { const f = shown(m); if (differs(f, c.ref, c.letters, R) && passes(f, c.letters, c.tests)) { out.weak++; note({ rule: c.ref, reply: f, arm: 'weak', way: 'a near-miss its tests let through', bond: null, second: true, label: false }); } }
    for (let i = 0; i < budget.forged; i++) {
      const k = i < names_.length ? i : int(R, names_.length), reply = FORGERIES[names_[k]][1](R, c);
      if (reply === null) continue;
      // a near-miss that is in fact the same rule (c × p for p × c) is not a forgery, and is not tried
      if (rows[k].kind === 'unsound' && itsRead(reply.trim(), c.letters) !== null && !differs(reply.trim(), c.ref, c.letters, R)) { out.forged.alike++; continue; }
      out.forged.tried++; rows[k].tried++;
      if (rule_(reply, 'forged', names_[k], false)) { out.forged.bonded++; rows[k].bonded++; out.forged[rows[k].kind]++; }
    }
    for (let i = 0; i < budget.honest; i++) { out.honest.tried++; if (!rule_(honest(R, c), 'honest', 'honest', true)) out.honest.refused++; }
    for (let i = 0; i < budget.noise; i++) { out.noise.tried++; if (rule_(noise(R, c), 'noise', 'noise', null)) out.noise.bonded++; }
    // every rule's limit is tried. For the rules kept here it is well within the length limit; were one past it,
    // neither runner would take it, and against the label "bonds" that is a finding, not a silent skip
    out.limit.tried++; if (rule_(limit(c), 'limit', 'built to pass these tests and no others', true)) out.limit.bonded++;
  }
  out.clean = out.forged.bonded === 0 && out.honest.refused === 0 && out.weak === 0 && out.split === 0 && out.threw === 0;
  return out;
}

// ── runners with a leak planted in each ──
const good = (reply, rule) => judge(reply, rule).value;
// a planted runner keeps every rule but its own leak: one formula, the rule's letters, the length limit
const order = (reply, rule) => { const letters = names(rule); let q = str(reply).trim(); if (q.endsWith('.')) q = q.slice(0, -1); return letters === null || q.length > LIMIT ? null : itsRead(q, letters); };
const runTests = (reply, rule, tests, eq = equal) => { const o = order(reply, rule), letters = names(rule); return o !== null && tests.length > 0 && tests.every((t) => eq(itsRun(o, Object.fromEntries(letters.map((n) => [n, pairOf(t.inputs[n])]))), pairOf(t.want))) ? 'bonded' : null; };
const asFloat = (p) => (p === null ? NaN : Number(p[0]) / Number(p[1]));
export const PLANTED = {
  'runs only the first test': (reply, rule) => runTests(reply, rule, suite(rule).tests.slice(0, 1)),
  'compares as floating-point numbers': (reply, rule) => runTests(reply, rule, suite(rule).tests, (a, b) => asFloat(a) === asFloat(b)),
  'tests only where every letter is the same': (reply, rule) => { const ref = order(get(rule, 'reference'), rule), letters = names(rule); return ref === null ? null : runTests(reply, rule, [2, 3, 5, 7].map((v) => { const inputs = Object.fromEntries(letters.map((n) => [n, String(v)])), w = itsRun(ref, Object.fromEntries(letters.map((n) => [n, [BigInt(v), 1n]]))); return { inputs, want: w === null ? 'x' : `${w[0]}/${w[1]}` }; })); },
  'lets a letter it does not know stand for nought': (reply, rule) => good(reply, rule) ?? good(str(reply).replace(/\b[a-z]\b/g, (n) => (names(rule) || []).includes(n) ? n : '0'), rule),
  'reads the formula before an = sign': (reply, rule) => good(str(reply).split('=')[0], rule),
  'counts a test with no value as passed': (reply, rule) => runTests(reply, rule, suite(rule).tests, (a, b) => a === null || equal(a, b)),
  'reads x as times': (reply, rule) => good(str(reply).replace(/ x /g, ' × '), rule),
  'reads a formula out of a sentence': (reply, rule) => good(reply, rule) ?? good(str(reply).replace(/^[A-Za-z ]*?(is|:)\s+/, '').replace(/\s+(is the formula|\(the rule\))$/, ''), rule),
  'does not see brackets': (reply, rule) => good(reply, rule) ?? good(str(reply).replace(/[()]/g, ''), rule),
  'checks only that the letters are the rule\'s': (reply, rule) => { const letters = names(rule), o = order(reply, rule); return o !== null && letters.every((n) => o.includes(n)) ? 'bonded' : null; },
  'refuses everything': () => null,
  'throws on a reply it cannot read': (reply, rule) => { const r = good(reply, rule); if (r === null && /[^\x20-\x7e\n×÷−]/.test(str(reply))) throw new Error('unreadable'); return r; },
};
// teeth(rules, opts) → the harness turned on each planted runner: { planted, caught, rows: [{ name, caught, way, reply }] }
export function teeth(rules, opts) {
  const rows = Object.keys(PLANTED).map((name) => {
    const r = fuzz(rules, { seed: get(opts, 'seed'), budget: get(opts, 'budget'), judge: PLANTED[name] }), first = r.found[0];
    return { name, caught: !r.clean, way: first === undefined ? null : first.way, reply: first === undefined ? null : first.reply };
  });
  return { planted: rows.length, caught: rows.filter((r) => r.caught).length, rows };
}

export default { BUDGET, FORGERIES, PLANTED, SECOND, plainly, place, honest, noise, limit, fuzz, teeth };
