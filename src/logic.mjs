// logic.mjs — the logical bond-check: the one thing that can say a claim follows from what is given.
//
// A claim cell names a yes-or-no question about a quantity ("is it certain that the order with delivery comes to at
// least 300 pounds?") and what is given: some quantities exactly (26 pounds), and some only between two figures
// (from 10 to 14 crates). The model is asked to write the CLAIM as a comparison over the letters for the quantities:
// "p × c + d ≥ 300". Its reply bonds the cell when, and only when, ALL of this holds:
//
//   1  the whole reply is one comparison: a formula in the small language (formula.mjs), one of ≥ > ≤ < (or >= <=),
//      and one plain number (one full stop at the end is let go). Nothing else;
//   2  it names at least one of the question's quantities; every letter in it is a letter the question gives, and
//      each is used once at most;
//   3  the solver below can decide it: no division by a quantity that could be nought.
//
// The value is the VERDICT, worked out here, never by the model: 'yes' when the claim holds for every value the
// given quantities can take, 'no' when it holds for none, and 'it depends' when it holds for some and not others.
//
// THE SOLVER is exact and complete for its fragment: a formula of + - × ÷ in which each quantity appears once,
// each quantity known to lie in a closed range of exact fractions. On such a formula, arithmetic on ranges gives
// exactly the least and the greatest value the formula can take (each is reached at a corner of the ranges), and
// the verdict follows from those two by exact comparison. A formula that uses a quantity twice is outside the
// fragment (arithmetic on ranges would only bound it, not give it), and is refused, never decided.
//
// WHAT A BOND HERE MEANS: PROVEN WITHIN ITS ENCODING. The verdict is exactly what follows from the claim as the
// model wrote it down. Whether the model wrote down the claim the question asked is NOT checked here: a comparison
// written the wrong way round is decided, exactly, about the wrong claim. That is what the strength names
// (strength.mjs), and the page counts how often the model's claim gives the question's own verdict.
// Pure and total: whatever the reply or the question is, this returns a ruling and never throws.
import { make, add, sub, mul, div, num, show, same } from '../vendor/crystal/vendor/climb/src/exact.mjs';
import { read, names, shown } from './formula.mjs';

const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
const str = (x) => (typeof x === 'string' ? x : '');
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
export const LIMIT = 140;
// the relation signs a claim may use, and the relation each is read as
export const RELATIONS = { '≥': '>=', '>=': '>=', '>': '>', '≤': '<=', '<=': '<=', '<': '<' };
export const SIGN = { '>=': '≥', '>': '>', '<=': '≤', '<': '<' };
export const VERDICTS = ['yes', 'no', 'it depends'];

// the relation that says the same with its two sides the other way round: 300 ≤ x is x ≥ 300
export const TURN = { '>=': '<=', '>': '<', '<=': '>=', '<': '>' };
const figure = (side) => (/^\d[\d,]*(?:\.\d+)?$/.test(side) ? num(side) : null);
// comparison(text, letters) → { tree, rel, figure } or { why }: the reply read as one comparison, a formula on one
// side and one plain number on the other, either way round
export function comparison(text, letters) {
  const t = str(text).trim(), s = t.endsWith('.') ? t.slice(0, -1) : t, signs = [...s.matchAll(/>=|<=|[≥>≤<]/g)];
  if (signs.length !== 1) return { why: 'not one comparison' };
  const at = signs[0].index, rel = RELATIONS[signs[0][0]], left = s.slice(0, at).trim(), right = s.slice(at + signs[0][0].length).trim();
  const [side, other, way] = figure(right) !== null ? [left, right, rel] : [right, left, TURN[rel]], f = read(side, letters);
  if (figure(other) === null) return { why: 'not one comparison' };
  if (f.tree === undefined) return { why: f.why };
  return { tree: f.tree, rel: way, figure: figure(other) };
}
// uses(tree) → how many times each letter is used: { letter: count }
export function uses(tree, out = {}) {
  if (has(tree, 'name')) out[tree.name] = (out[tree.name] || 0) + 1;
  else if (has(tree, 'op')) { uses(tree.a, out); uses(tree.b, out); }
  return out;
}
const lt = (a, b) => a.n * b.d < b.n * a.d;
const least = (xs) => xs.reduce((m, x) => (lt(x, m) ? x : m)), most = (xs) => xs.reduce((m, x) => (lt(m, x) ? x : m));
// range(tree, given) → { lo, hi } the least and greatest value the formula takes when each letter lies in its range
// (given: { letter: { lo, hi } }, fractions, lo ≤ hi), or null: a letter with no range, a division by a range that
// holds nought, or a number past the size limit
export function range(tree, given) {
  if (has(tree, 'num')) return { lo: tree.num, hi: tree.num };
  if (has(tree, 'name')) return get(given, tree.name) ?? null;
  const a = range(tree.a, given), b = range(tree.b, given);
  if (a === null || b === null) return null;
  if (tree.op === '+') return pair(add(a.lo, b.lo), add(a.hi, b.hi));
  if (tree.op === '-') return pair(sub(a.lo, b.hi), sub(a.hi, b.lo));
  if (tree.op === '/' && !lt(make(0n), b.lo) && !lt(b.hi, make(0n))) return null;
  const by = tree.op === '*' ? b : { lo: div(make(1n), b.hi), hi: div(make(1n), b.lo) }, all = [mul(a.lo, by.lo), mul(a.lo, by.hi), mul(a.hi, by.lo), mul(a.hi, by.hi)];
  return all.includes(null) ? null : pair(least(all), most(all));
}
const pair = (lo, hi) => (lo === null || hi === null ? null : { lo, hi });
// verdict(rel, figure, r) → 'yes' | 'no' | 'it depends': whether "the formula REL figure" holds for every value in
// the range r, for none, or for some
export function verdict(rel, figure, r) {
  const holds = (x) => (rel === '>=' ? !lt(x, figure) : rel === '>' ? lt(figure, x) : rel === '<=' ? !lt(figure, x) : lt(x, figure));
  const [worst, best] = rel === '>=' || rel === '>' ? [r.lo, r.hi] : [r.hi, r.lo];
  return holds(worst) ? 'yes' : holds(best) ? 'it depends' : 'no';
}
// given(question) → the ranges the question gives, as fractions: { letter: { lo, hi } }, or null when they are not
// ranges of plain numbers with the least first. question.given: { letter: 'figure' | ['least', 'greatest'] }
export function given(question) {
  const g = get(question, 'given'), letters = names(question);
  // a letter the question does not give a figure for is no question; nor is a question with no letters
  if (letters === null) return null;
  const out = {};
  for (const n of letters) {
    const v = get(g, n), [lo, hi] = Array.isArray(v) && v.length === 2 ? v.map((x) => num(str(x))) : [num(str(v)), num(str(v))];
    if (lo === null || hi === null || lt(hi, lo)) return null;
    out[n] = { lo, hi };
  }
  return out;
}
const no = (why) => ({ value: null, why, claim: null, least: null, greatest: null });
// judge(reply, question) → { value, why, claim, least, greatest }: value is the verdict when the reply bonds the
// cell, else null. why is 'bonded' or the reason: 'not a question', 'too long', 'not one comparison', 'not a
// formula', 'a letter the question does not give', 'the claim names none of the quantities', 'a letter used
// twice', 'a division by what could be nought'.
// claim is the model's comparison written one way; least and greatest the range the solver found for its formula.
export function judge(reply, question) {
  const letters = names(question), g = given(question), text = str(reply).trim();
  // given() has a range for every letter, or is null (so letters is not null below)
  if (g === null) return no('not a question');
  // the length is counted with the one full stop at the end let go, as formula.mjs counts it
  if ((text.endsWith('.') ? text.length - 1 : text.length) > LIMIT) return no('too long');
  const c = comparison(text, letters);
  if (c.tree === undefined) return no(c.why === 'a letter the rule does not have' ? 'a letter the question does not give' : c.why);
  const used = Object.values(uses(c.tree));
  if (used.length === 0) return no('the claim names none of the quantities');
  if (used.some((k) => k > 1)) return no('a letter used twice');
  const r = range(c.tree, g);
  if (r === null) return no('a division by what could be nought');
  return { value: verdict(c.rel, c.figure, r), why: 'bonded', claim: `${shown(c.tree)} ${SIGN[c.rel]} ${show(c.figure)}`, least: show(r.lo), greatest: show(r.hi) };
}
// decide(claim, question) → the verdict on a claim written by whoever set the question (its own encoding), or null
export const decide = (text, question) => judge(text, question).value;

export default { LIMIT, RELATIONS, SIGN, TURN, VERDICTS, comparison, uses, range, verdict, given, judge, decide };
