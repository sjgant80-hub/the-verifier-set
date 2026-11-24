// formula.mjs — the executable bond-check: the one thing that can say a rule the model wrote as code passes its tests.
//
// A rule cell names a rule stated in words ("the cost of the order with delivery") and the letters for what goes into
// it (p: the unit price, c: the order size, d: the delivery charge). The model is asked to write the rule as a
// formula over those letters. Its reply bonds the cell when, and only when, BOTH of these hold:
//
//   1  the whole reply is one formula in the small language: the rule's letters, plain numbers, + - × ÷ and
//      brackets (one full stop at the end is let go). Nothing else: no words, no "=", no second line, no letter the
//      rule does not have, no number run on to a letter;
//   2  run on every test of the rule's suite, it gives exactly the expected result, as an exact fraction. A test on
//      which it divides by nought is a failed test.
//
// THE TESTS stand for the tests a rule's owner keeps. Here they are made by code from the rule's reference formula
// and a seed, and chosen so that they tell the reference from every near-miss of it that is a different rule (every
// mutant: an operator changed, the two sides of one the wrong way round, a side left out, a number one out, another
// letter in a letter's place). A suite that cannot tell + from - proves little: here, none can be chosen that way.
//
// WHAT A BOND HERE MEANS: PROVEN AGAINST ITS TESTS. The formula gave the right result on every test it was run on.
// It is not proven for every input: a formula built to pass exactly these tests and no others would bond too, and
// the harness (formulafuzz.mjs) shows one doing it. That is why this strength ranks below proven (strength.mjs).
//
// THE SANDBOX is the interpreter below. It can add, subtract, multiply and divide fractions and nothing else: a
// formula has no way to loop, call, read or write, and it ends, because a formula is at most LIMIT characters.
// Pure and total: whatever the reply or the rule is, this returns a ruling and never throws.
import { make, add, sub, mul, div, num, show, same } from '../vendor/crystal/vendor/climb/src/exact.mjs';
import { rng } from '../vendor/crystal/src/fuzz.mjs';

const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
const str = (x) => (typeof x === 'string' ? x : '');
const has = (o, k) => o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
export const LIMIT = 120;
// the signs a formula may use, and the operation each is read as
export const SIGNS = { '+': '+', '-': '-', '−': '-', '×': '*', '*': '*', '÷': '/', '/': '/' };
const OPS = { '+': add, '-': sub, '*': mul, '/': div }, GLYPH = { '+': '+', '-': '-', '*': '×', '/': '÷' }, RANK = { '+': 1, '-': 1, '*': 2, '/': 2 };

// names(rule) → the letters of the rule, in order: single small letters, or null when the rule has none it can use
export function names(rule) {
  const given = get(rule, 'names'), keys = given !== null && typeof given === 'object' ? Object.keys(given) : [];
  return keys.length > 0 && keys.every((k) => /^[a-z]$/.test(k)) ? keys : null;
}
// tokens(text, letters) → the formula as tokens, or the reason it is not one
function tokens(text, letters) {
  const out = [];
  for (let i = 0; i < text.length;) {
    const ch = text[i], digits = /^\d+(?:\.\d+)?/.exec(text.slice(i));
    if (ch === ' ') i++;
    else if (ch === '(' || ch === ')') { out.push({ t: ch }); i++; }
    else if (has(SIGNS, ch)) { out.push({ t: 'op', v: SIGNS[ch] }); i++; }
    else if (digits !== null && num(digits[0]) !== null) { out.push({ t: 'num', v: num(digits[0]) }); i += digits[0].length; }
    // a letter stands alone: two together are a word ("none") or a product written without its sign ("pc"), and
    // neither is a formula
    else if (/^[a-z]$/.test(ch) && !/^[A-Za-z]$/.test(text[i + 1] ?? '')) { if (!letters.includes(ch)) return 'a letter the rule does not have'; out.push({ t: 'name', v: ch }); i++; }
    else return 'not a formula';
  }
  return out;
}
// read(text, letters) → { tree } or { why }: a sum of products, × and ÷ before + and -, each from left to right
export function read(text, letters) {
  const toks = tokens(str(text), Array.isArray(letters) ? letters : []);
  if (typeof toks === 'string') return { why: toks };
  let at = 0;
  const is = (t, vs) => toks[at] !== undefined && toks[at].t === t && (vs === undefined || vs.includes(toks[at].v));
  const part = () => {
    if (is('num')) return { num: toks[at++].v };
    if (is('name')) return { name: toks[at++].v };
    if (!is('(')) return null;
    at++;
    const inner = sum();
    // an inner formula that could not be read is null, and stays null whatever follows it
    if (!is(')')) return null;
    at++;
    return inner;
  };
  const chain = (next, signs) => () => { let left = next(); while (left !== null && is('op', signs)) { const op = toks[at++].v, right = next(); left = right === null ? null : { op, a: left, b: right }; } return left; };
  const product = chain(part, '*/'), sum = chain(product, '+-'), tree = sum();
  return tree !== null && at === toks.length ? { tree } : { why: 'not a formula' };
}
// run(tree, inputs) → the formula worked out on the inputs ({ letter: fraction }), as an exact fraction, or null
// (it divides by nought, an input is missing, or a number passes the size limit)
export function run(tree, inputs) {
  if (has(tree, 'num')) return tree.num;
  if (has(tree, 'name')) return get(inputs, tree.name) ?? null;
  return OPS[tree.op](run(tree.a, inputs), run(tree.b, inputs));
}
// shown(tree, write) → the formula written one way: × ÷ + -, one space round each, brackets only where they are
// needed. write(letter) gives what to write for a letter (the letter itself, or a figure put in its place).
export function shown(tree, write = (n) => n, above = 0, right = false) {
  if (has(tree, 'num')) return show(tree.num);
  if (has(tree, 'name')) return write(tree.name);
  const r = RANK[tree.op], text = `${shown(tree.a, write, r, false)} ${GLYPH[tree.op]} ${shown(tree.b, write, r, true)}`;
  return r < above || (r === above && right) ? `(${text})` : text;
}
// mutants(tree, letters) → every near-miss of the formula, each one change away
export function mutants(tree, letters) {
  const out = [], one = make(1n);
  const walk = (node, put) => {
    if (has(node, 'op')) {
      for (const op of '+-*/') if (op !== node.op) out.push(put({ ...node, op }));
      out.push(put({ ...node, a: node.b, b: node.a }), put(node.a), put(node.b));
      walk(node.a, (x) => put({ ...node, a: x })); walk(node.b, (x) => put({ ...node, b: x }));
    } else if (has(node, 'num')) out.push(put({ num: add(node.num, one) }), put({ num: sub(node.num, one) }));
    else for (const n of letters) if (n !== node.name) out.push(put({ name: n }));
  };
  walk(tree, (x) => x);
  return out;
}
// what a test's inputs are drawn from (whole numbers from low to high), how many tests a suite has at least, and how
// many points are drawn to choose the tests from
export const DRAW = { low: 2, high: 60, least: 4, points: 16 };
const point = (R, letters) => Object.fromEntries(letters.map((n) => [n, make(BigInt(DRAW.low + (R() % (DRAW.high - DRAW.low + 1))))]));
// fails(formula, test) → the formula does not give the test's result there (no value at all is a failure)
const fails = (m, t) => !same(run(m, t.inputs), t.want);
// choose(cases, others, least) → the tests: the first `least` cases, then each later case that some formula of others
// fails while it passes every test chosen before it. cases: [{ inputs, want }] in the order drawn.
export function choose(cases, others, least) {
  const tests = cases.slice(0, least);
  for (const t of cases.slice(least)) if (others.some((m) => !tests.some((u) => fails(m, u)) && fails(m, t))) tests.push(t);
  return tests;
}
// suite(rule) → { tests, made, alike, killed, admitted, why }: the tests of a rule, chosen from points drawn from its
// seed. A point where the reference has no value (it divides by nought there) is no test. The first `least` points
// that are tests are taken; then, while a near-miss that is a different rule passes every test taken, the first
// point that it fails is taken too. So every near-miss that differs from the reference on a drawn point fails at
// least one test, by the way the tests are chosen; one that agrees with it on every drawn point is the same rule
// written another way (alike), and passing is right for it.
//   tests  [{ inputs: { letter: 'text' }, want: 'text' }]; a want that does not end as a decimal is written '31/3'
//   made   its near-misses; alike, killed: as above. admitted: there are at least `least` tests; why: else the reason
export function suite(rule) {
  const letters = names(rule), ref = letters === null ? { why: 'not a rule' } : read(get(rule, 'reference'), letters);
  if (ref.tree === undefined) return { tests: [], made: 0, alike: 0, killed: 0, admitted: false, why: 'not a rule' };
  const R = rng(get(rule, 'seed')), all = mutants(ref.tree, letters);
  const usable = Array.from({ length: DRAW.points }, () => point(R, letters)).map((inputs) => ({ inputs, want: run(ref.tree, inputs) })).filter((t) => t.want !== null);
  const others = all.filter((m) => usable.some((t) => fails(m, t))), tests = choose(usable, others, DRAW.least), admitted = tests.length >= DRAW.least;
  return { tests: tests.map((t) => ({ inputs: Object.fromEntries(letters.map((n) => [n, show(t.inputs[n])])), want: show(t.want) })), made: all.length, alike: all.length - others.length, killed: others.length, admitted, why: admitted ? null : 'its tests cannot be made' };
}
const no = (why, passed = 0, of = 0) => ({ value: null, why, passed, of });
// exact(text) → a test's figure read back exactly: a decimal ('3.75'), or a fraction as show() writes one that does not
// end as a decimal ('31/3'); null for anything else
export function exact(text) {
  const m = /^(-?\d+)\/(\d+)$/.exec(str(text));
  return m === null ? num(str(text)) : make(BigInt(m[1]), BigInt(m[2]));
}
// judge(reply, rule) → { value, why, passed, of }: value is the model's formula, written one way, when the reply
// bonds the rule, else null. why is 'bonded' or the reason: 'not a rule', 'its tests cannot be made', 'too long',
// 'not a formula', 'a letter the rule does not have', 'fails a test'. passed and of count the tests.
export function judge(reply, rule) {
  const s = suite(rule), letters = names(rule), trimmed = str(reply).trim(), text = trimmed.endsWith('.') ? trimmed.slice(0, -1) : trimmed;
  if (!s.admitted) return no(s.why);
  if (text.length > LIMIT) return no('too long', 0, s.tests.length);
  const f = read(text, letters);
  if (f.tree === undefined) return no(f.why, 0, s.tests.length);
  const passed = s.tests.filter((t) => same(run(f.tree, Object.fromEntries(letters.map((n) => [n, exact(t.inputs[n])]))), exact(t.want))).length;
  return passed === s.tests.length ? { value: shown(f.tree), why: 'bonded', passed, of: s.tests.length } : no('fails a test', passed, s.tests.length);
}
// applied(formula, rule, figures) → the calculation the formula makes with the figures in the letters' places
// ('26 × 12 + 45'), or null when the formula cannot be read or a figure is missing. figures: { letter: 'text' }.
export function applied(formula, rule, figures) {
  const letters = names(rule), f = letters === null ? {} : read(formula, letters);
  if (f.tree === undefined || !letters.every((n) => num(get(figures, n)) !== null)) return null;
  return shown(f.tree, (n) => show(num(figures[n])));
}

export default { LIMIT, SIGNS, DRAW, names, read, run, shown, mutants, choose, suite, exact, judge, applied };
