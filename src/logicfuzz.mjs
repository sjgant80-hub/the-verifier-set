// logicfuzz.mjs — the watcher that watches the logical bond-check (logic.mjs). A leak here would say a claim follows
// when it does not, or that it does not when it does: a verdict that is wrong about the very claim it was given.
//
// Two decisions on every claim, made two ways: the solver (logic.mjs: arithmetic on ranges) and a SECOND PROCEDURE
// (plainly(), below) written apart from it: its own reading of a comparison, formulas run by formulafuzz.mjs's
// second runner, and no arithmetic on ranges at all. It works the formula out at EVERY corner of the ranges (each
// quantity at its least or its greatest, every way), takes the least and the greatest of those values, and decides
// from them; a division whose divisor is nought, or changes sign, across the corners is refused. For the fragment
// the solver decides (each quantity once) the two must give the same verdict on every claim, and refuse the same
// claims. A claim they do not agree on is a finding.
//
// Claims are made three ways for each question: the question's own claim, claims built to trip a solver (a figure
// on the edge of the range, strict and not; a quantity that takes away; a product across nought; a division by a
// range below nought; the figure written first; decimals a float cannot hold), and claims that must be refused (a
// letter twice, no quantity at all, a division by what could be nought, two comparisons, none, a letter not given,
// too long). For those, the label is "refused", and both must refuse. A fixed set of hard questions (HARD) is
// attacked with every corpus. teeth() turns the harness on solvers with one leak planted in each.
// Nothing here uses a model. Pure and total: a solver that throws is caught and counted.
import { rng } from '../vendor/crystal/src/fuzz.mjs';
import { make, show } from '../vendor/crystal/vendor/climb/src/exact.mjs';
import { judge, LIMIT } from './logic.mjs';
import { names } from './formula.mjs';
import { SECOND } from './formulafuzz.mjs';

const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
const str = (x) => (typeof x === 'string' ? x : '');
const int = (R, n) => R() % n, pick = (R, xs) => xs[R() % xs.length];

// ── the second procedure ──
// a number is a pair [top, bottom], the bottom above nought (formulafuzz.mjs's second runner keeps them so)
const lt2 = (a, b) => a[0] * b[1] < b[0] * a[1], ZERO = [0n, 1n];
const least2 = (xs) => xs.reduce((m, x) => (lt2(x, m) ? x : m)), most2 = (xs) => xs.reduce((m, x) => (lt2(m, x) ? x : m));
// its own reading of a figure in a claim: digits, commas in threes, a decimal part, no sign; as a pair
const figure2 = (s) => (/^\d{1,3}(,\d{3})+(\.\d+)?$|^\d+(\.\d+)?$/.test(s) ? SECOND.pair(s.split(',').join('')) : null);
// a figure in what is given may carry a sign, and may begin at its point
const signed2 = (s) => { const m = /^([+-]?)(.*)$/.exec(s), p = figure2(m[2]) ?? (/^\.\d+$/.test(m[2]) ? SECOND.pair(`0${m[2]}`) : null); return p === null ? null : m[1] === '-' ? [-p[0], p[1]] : p; };
// its own reading of what is given: every letter, a figure or two with the least first
function ranges2(question) {
  const letters = names(question), g = get(question, 'given'), out = {};
  if (letters === null) return null;
  for (const n of letters) {
    const v = get(g, n), two = Array.isArray(v) && v.length === 2 ? v : [v, v], lo = signed2(str(two[0])), hi = signed2(str(two[1]));
    if (lo === null || hi === null || lt2(hi, lo)) return null;
    out[n] = [lo, hi];
  }
  return out;
}
// its own reading of a comparison: the two-letter signs written as one, then the text cut at its one sign. A formula
// on one side, a figure on the other, either way round.
const REL2 = { '≥': 'ge', '≤': 'le', '>': 'gt', '<': 'lt' }, FLIP2 = { ge: 'le', le: 'ge', gt: 'lt', lt: 'gt' };
function claim2(text) {
  const t = str(text).trim(), u = (t.endsWith('.') ? t.slice(0, -1) : t).split('>=').join('≥').split('<=').join('≤'), parts = u.split(/[≥≤><]/);
  if (parts.length !== 2) return null;
  const rel = REL2[u[parts[0].length]], left = parts[0].trim(), right = parts[1].trim();
  if (figure2(right) !== null) return { formula: left, rel, figure: figure2(right) };
  if (figure2(left) !== null) return { formula: right, rel: FLIP2[rel], figure: figure2(left) };
  return null;
}
// corners(order, box, letters) → the formula's value at every corner, or null: a value past the bound, or a division
// whose divisor is not wholly above nought or wholly below it across the corners. Each value on the stack is the list
// of its values at every corner, so each divisor is seen whole before it divides.
function corners(order, box, letters) {
  const count = 2 ** letters.length, at = (n, c) => box[n][(c >> letters.indexOf(n)) & 1], stack = [];
  for (const t of order) {
    if (Array.isArray(t)) stack.push(Array.from({ length: count }, () => t));
    else if (!['+', '-', '*', '/'].includes(t)) stack.push(Array.from({ length: count }, (_, c) => at(t, c)));
    else {
      const b = stack.pop(), a = stack.pop(), low = least2(b), high = most2(b);
      // the least and the greatest divisor on one side of nought: their product is above nought
      if (t === '/' && !lt2(ZERO, [low[0] * high[0], 1n])) return null;
      const v = a.map((x, c) => SECOND.run([x, b[c], t], {}));
      if (v.includes(null)) return null;
      stack.push(v);
    }
  }
  return stack[0];
}
const decide2 = (rel, n, lo, hi) => {
  const holds = (x) => (rel === 'ge' ? !lt2(x, n) : rel === 'gt' ? lt2(n, x) : rel === 'le' ? !lt2(n, x) : lt2(x, n));
  const [worst, best] = rel === 'ge' || rel === 'gt' ? [lo, hi] : [hi, lo];
  return holds(worst) ? 'yes' : holds(best) ? 'it depends' : 'no';
};
// plainly(reply, question) → the verdict ('yes' | 'no' | 'it depends'), or null when the claim is refused: the second
// procedure
export function plainly(reply, question) {
  const box = ranges2(question), t = str(reply).trim();
  if (box === null || (t.endsWith('.') ? t.length - 1 : t.length) > LIMIT) return null;
  const letters = names(question), c = claim2(t), order = c === null ? null : SECOND.read(c.formula, letters);
  if (order === null) return null;
  const used = order.filter((x) => letters.includes(x));
  if (used.length === 0 || new Set(used).size !== used.length) return null;
  const vals = corners(order, box, letters);
  return vals === null ? null : decide2(c.rel, c.figure, least2(vals), most2(vals));
}
export const SECOND_PROCEDURE = { claim: claim2, ranges: ranges2, corners, decide: decide2 };

// ── questions to attack ──
// a question is { names, given, claim }: claim is the question's own claim, as whoever set it wrote it
const Q = (given, claim) => ({ names: Object.fromEntries(Object.keys(given).map((n) => [n, n])), given, claim });
export const HARD = [
  Q({ p: '26', c: ['10', '14'], d: '45' }, 'p × c + d ≥ 305'), Q({ p: '26', c: ['10', '14'], d: '45' }, 'p × c + d > 305'), Q({ p: ['100', '120'], e: ['20', '50'] }, 'p - e ≥ 50'),
  Q({ p: ['2', '3'], e: ['4', '5'] }, 'p - e < 0'), Q({ p: ['6', '12'], e: ['2', '3'] }, 'p ÷ e ≤ 6'), Q({ p: ['0.1', '0.1'], e: ['0.2', '0.2'] }, 'p + e > 0.3'),
  Q({ p: ['1', '2'], e: ['0.5', '1'] }, 'p ÷ e ≥ 1'), Q({ f: '91', t: ['12', '24'], s: '60', l: ['10', '30'] }, 'f × t + s - l ≥ 1122'), Q({ r: ['13', '13'], n: ['11', '45'], k: '60' }, '600 ≤ r × n + k'),
  Q({ r: '13', n: ['11', '45'], k: '60' }, 'r + k ÷ n < 18.5'), Q({ p: ['1,000', '1,250.50'] }, 'p ≤ 1,250.5'), Q({ p: ['0', '4'], e: ['3', '5'] }, 'e ÷ (p + 1) ≥ 0.6'),
  // ranges on each side of nought, for the solvers that get signs wrong
  Q({ p: ['-2', '3'], e: ['-5', '4'] }, 'p × e ≥ 0'), Q({ p: ['-3', '-2'], e: ['4', '5'] }, 'p × e < 0'), Q({ p: ['6', '12'], e: ['-3', '-2'] }, 'p ÷ e < 0'),
];
// a random formula that uses each of the letters once, with a few figures in it
const formula = (R, letters) => { if (letters.length === 1) return int(R, 3) === 0 ? `(${letters[0]} ${pick(R, ['+', '-', '×'])} ${1 + int(R, 9)})` : letters[0]; const cut = 1 + int(R, letters.length - 1); return `(${formula(R, letters.slice(0, cut))} ${pick(R, ['+', '-', '×', '÷', '+', '×'])} ${formula(R, letters.slice(cut))})`; };
// random(R) → a question made at random: one to four quantities, some exact, some in ranges, some across nought
export function random(R) {
  const letters = [...'pcdefg'].slice(0, 1 + int(R, 4)), given = Object.fromEntries(letters.map((n) => { const a = int(R, 40) - (int(R, 4) === 0 ? 15 : 0), w = int(R, 3) === 0 ? 0 : 1 + int(R, 20); return [n, w === 0 ? String(a) : [String(a), String(a + w)]]; }));
  return Q(given, `${formula(R, letters)} ${pick(R, ['≥', '>', '≤', '<'])} ${int(R, 200)}`);
}
// the least and the greatest of a formula on a question's ranges, worked out by the second procedure
const extremes = (q, f) => { const box = ranges2(q), order = box ? SECOND.read(f, names(q)) : null, v = order ? corners(order, box, names(q)) : null; return v === null ? null : [least2(v), most2(v)]; };
// a pair written as a plain decimal, or null when it does not end as one
const text2 = (p) => { const t = show(make(p[0], p[1])); return t.includes('/') ? null : t; };
const formulaOf = (q) => { const c = claim2(get(q, 'claim')); return c === null ? null : c.formula; };
// edge(R, q) → one end of the question's claim's formula's range, as a plain figure above or at nought, or null
const edge = (R, q) => { const f = formulaOf(q), e = f && extremes(q, f), at = e && text2(pick(R, e)); return at && !at.startsWith('-') ? [f, at] : null; };

// FORGERIES → name → [label, make(R, q)]: label 'decide' (both must give one verdict) or 'refuse' (both must refuse)
export const FORGERIES = {
  'the figure on the edge of the range': ['decide', (R, q) => { const e = edge(R, q); return e === null ? null : `${e[0]} ${pick(R, ['≥', '>', '≤', '<'])} ${e[1]}`; }],
  'the figure just inside or outside the edge': ['decide', (R, q) => { const e = edge(R, q); if (e === null) return null; const step = Number(pick(R, ['1', '0.5', '0.001'])), base = Number(e[1]); return `${e[0]} ${pick(R, ['≥', '>', '≤', '<'])} ${pick(R, [String(base + step), String(Math.max(0, base - step))])}`; }],
  'the figure written first': ['decide', (R, q) => { const c = claim2(get(q, 'claim')); return c === null ? null : `${text2(c.figure)} ${{ ge: '≤', gt: '<', le: '≥', lt: '>' }[c.rel]} ${c.formula}`; }],
  'the relation turned': ['decide', (R, q) => { const c = claim2(get(q, 'claim')); return c === null ? null : `${c.formula} ${pick(R, ['≥', '>', '≤', '<', '>=', '<='])} ${text2(c.figure)}`; }],
  'a figure far outside the range': ['decide', (R, q) => { const f = formulaOf(q); return f === null ? null : `${f} ${pick(R, ['≥', '≤'])} ${pick(R, ['0', '1,000,000', '99999999999'])}`; }],
  'a claim made at random on the same quantities': ['decide', (R, q) => { const letters = names(q); return letters === null ? null : `${formula(R, [...letters].sort(() => int(R, 3) - 1))} ${pick(R, ['≥', '>', '≤', '<'])} ${int(R, 300)}`; }],
  'a letter used twice': ['refuse', (R, q) => { const letters = names(q); return letters === null ? null : `${letters[0]} ${pick(R, ['+', '-', '×'])} ${letters[0]} ≥ ${int(R, 50)}`; }],
  'no quantity at all': ['refuse', (R) => `${1 + int(R, 90)} ${pick(R, ['+', '×'])} ${1 + int(R, 9)} ≥ ${int(R, 50)}`],
  'a division by what could be nought': ['refuse', (R, q) => { const box = ranges2(q), n = box && Object.keys(box).find((x) => lt2(box[x][0], box[x][1])); return n ? `1 ÷ (${n} - ${q.given[n][0]}) ≥ 0` : null; }],
  'two comparisons, or none': ['refuse', (R, q) => { const f = formulaOf(q); return f === null ? null : pick(R, [`${f} ≥ 1 ≥ 0`, `${f}`, `${f} = 5`, `${f} ≠ 5`, `0 ≤ ${f} ≤ 9`, `${f} => 4`]); }],
  'a letter the question does not give': ['refuse', (R, q) => { const f = formulaOf(q), letters = names(q) ?? []; return f === null ? null : `${f} + ${[...'wxyz'].find((n) => !letters.includes(n))} ≥ 1`; }],
  'words, or too long': ['refuse', (R, q) => { const f = formulaOf(q); return f === null ? null : pick(R, [`Yes: ${f} ≥ 1`, `${f} ≥ 1 pounds`, `${f}${' + 0'.repeat(40)} ≥ 1`, `the claim is ${f} ≥ 1`, `${f} ≥ 1\n${f} ≥ 2`]); }],
};

export const BUDGET = { claims: 24 };
// fuzz(questions, opts) → the count. questions: [{ names, given, claim }]. opts.seed, opts.budget.claims, opts.random
// (how many questions made at random to add), opts.judge (another solver in the solver's place: (reply, question) →
// a verdict, or null for none).
//   places   questions attacked; tried; agreed; refused (both refused); verdicts { yes, no, 'it depends' } (both gave)
//   rows     for each way of making a claim: tried, and how many the two did not agree on
//   split    claims the two did not agree on, or a refusal the label wanted that did not come; threw; found; sample
export function fuzz(questions, opts) {
  const solver = typeof get(opts, 'judge') === 'function' ? opts.judge : (reply, question) => judge(reply, question).value, R = rng(get(opts, 'seed')), names_ = Object.keys(FORGERIES);
  const v = get(get(opts, 'budget'), 'claims'), budget = { claims: Number.isInteger(v) && v >= 0 ? v : BUDGET.claims }, extra = Number.isInteger(get(opts, 'random')) ? Math.max(0, opts.random) : 0;
  const rows = [{ name: 'the question\'s own claim', label: 'decide', tried: 0, split: 0 }, ...names_.map((name) => ({ name, label: FORGERIES[name][0], tried: 0, split: 0 }))], found = [], sample = [];
  const out = { seed: (Number(get(opts, 'seed')) || 0) >>> 0, budget, places: 0, tried: 0, agreed: 0, refused: 0, verdicts: { yes: 0, no: 0, 'it depends': 0 }, rows, split: 0, threw: 0, found, sample, clean: false };
  const all = [...(Array.isArray(questions) ? questions : []), ...Array.from({ length: extra }, () => random(R))];
  for (const q of all) {
    if (ranges2(q) === null || claim2(get(q, 'claim')) === null) continue;
    out.places++;
    const first = out.places === 1;
    const rule = (reply, row) => {
      let a = null, threw = false;
      try { a = solver(reply, q) ?? null; } catch { out.threw++; threw = true; }
      const b = plainly(reply, q), agreed = !threw && a === b && (row.label === 'decide' || b === null);
      out.tried++; row.tried++;
      if (agreed) { out.agreed++; if (b === null) out.refused++; else out.verdicts[b]++; } else { out.split++; row.split++; if (found.length < 12) found.push({ given: q.given, reply: reply.slice(0, 160), way: row.name, solver: threw ? 'threw' : a, second: b }); }
      if (first && sample.length < 16) sample.push({ way: row.name, reply: reply.slice(0, 160), verdict: a });
    };
    rule(str(q.claim), rows[0]);
    for (let i = 0; i < budget.claims; i++) {
      const k = i < names_.length ? i : int(R, names_.length), reply = FORGERIES[names_[k]][1](R, q);
      if (reply !== null) rule(reply, rows[k + 1]);
    }
  }
  out.clean = out.split === 0 && out.threw === 0 && out.places > 0;
  return out;
}

// ── solvers with a leak planted in each: each keeps every rule but its own leak ──
const good = (reply, q) => judge(reply, q).value;
// a claim the solver decides, read the second procedure's way: { c, order, box, letters }, or null
const decided = (reply, q) => { const box = ranges2(q), c = claim2(reply); return box !== null && c !== null && good(reply, q) !== null ? { c, order: SECOND.read(c.formula, names(q)), box, letters: names(q) } : null; };
// the formula at one corner only: each quantity at the end pick(range) chooses
const atOne = (s, end) => SECOND.run(s.order, Object.fromEntries(s.letters.map((n) => [n, end(s.box[n])])));
// a float written as the exact fraction it is
const exactOf = (x) => { let n = x, d = 1n; while (!Number.isInteger(n)) { n *= 2; d *= 2n; } return [BigInt(n), d]; };
const asFloat = (p) => Number(p[0]) / Number(p[1]);
const FLOAT = { '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b };
const inFloats = (s, c) => { const st = []; for (const t of s.order) { if (Array.isArray(t)) st.push(asFloat(t)); else if (FLOAT[t] === undefined) st.push(asFloat(s.box[t][(c >> s.letters.indexOf(t)) & 1])); else { const b = st.pop(); st.push(FLOAT[t](st.pop(), b)); } } return st[0]; };
// the solver, except where it refused for the given reason: there it says 'it depends'
const decidesAnyway = (why) => (reply, q) => (judge(reply, q).why === why ? 'it depends' : good(reply, q));
export const PLANTED = {
  'treats more than as at least': (reply, q) => good(str(reply).replace(/>(?!=)/g, '≥').replace(/<(?!=)/g, '≤'), q),
  'takes each quantity at its least for the least value': (reply, q) => { const s = decided(reply, q); if (s === null) return null; const a = atOne(s, (r) => r[0]), b = atOne(s, (r) => r[1]); return decide2(s.c.rel, s.c.figure, least2([a, b]), most2([a, b])); },
  'looks only at the middle': (reply, q) => { const s = decided(reply, q); if (s === null) return null; const mid = atOne(s, (r) => SECOND.run([r[0], r[1], '+', [2n, 1n], '/'], {})); return decide2(s.c.rel, s.c.figure, mid, mid); },
  'decides a claim that uses a letter twice': decidesAnyway('a letter used twice'),
  'divides by a range that holds nought': decidesAnyway('a division by what could be nought'),
  'works in floating point': (reply, q) => { const s = decided(reply, q); if (s === null) return null; const vals = Array.from({ length: 2 ** s.letters.length }, (_, c) => exactOf(inFloats(s, c))); return decide2(s.c.rel, exactOf(asFloat(s.c.figure)), least2(vals), most2(vals)); },
  'reads a claim written figure first the wrong way round': (reply, q) => { const m = /^([\d.,]+)\s*(≥|>=|>|≤|<=|<)\s*(.+)$/.exec(str(reply).trim()); return good(m === null ? reply : `${m[3]} ${m[2]} ${m[1]}`, q); },
  'never says it depends': (reply, q) => { const r = good(reply, q); return r === 'it depends' ? 'no' : r; },
  'takes the claim out of words': (reply, q) => good(reply, q) ?? good(str(reply).replace(/^[A-Za-z ]*?(:|is)\s+/, '').replace(/\s+pounds$/, ''), q),
  'lets a letter the question does not give stand for nought': (reply, q) => good(reply, q) ?? good(str(reply).replace(/\b[a-z]\b/g, (n) => ((names(q) ?? []).includes(n) ? n : '0')), q),
  'refuses everything': () => null,
  'throws on a claim it cannot read': (reply, q) => { const r = good(reply, q); if (r === null && /[^\x20-\x7e\n×÷≥≤−]/.test(str(reply))) throw new Error('unreadable'); return r; },
};
// teeth(questions, opts) → the harness turned on each planted solver (opts.planted, or PLANTED), over HARD and the
// questions given: { planted, caught, rows: [{ name, caught, way, reply }] }
export function teeth(questions, opts) {
  const all = [...HARD, ...(Array.isArray(questions) ? questions : [])], planted = get(opts, 'planted') ?? PLANTED;
  const rows = Object.keys(planted).map((name) => {
    const r = fuzz(all, { seed: get(opts, 'seed'), budget: get(opts, 'budget'), random: get(opts, 'random'), judge: planted[name] }), f = r.found[0];
    return { name, caught: !r.clean, way: f === undefined ? null : f.way, reply: f === undefined ? null : f.reply };
  });
  return { planted: rows.length, caught: rows.filter((r) => r.caught).length, rows };
}

export default { BUDGET, FORGERIES, PLANTED, HARD, SECOND_PROCEDURE, plainly, random, fuzz, teeth };
