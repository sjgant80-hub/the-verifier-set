// fuzz.mjs — the watcher that watches the bond-check. Before anything is grown on a bond, the check that makes bonds
// is attacked, and it must let nothing false through. A leak here would be copied into every cell above it.
//
// Three opinions are taken on every reply, and they are made three different ways:
//   THE LABEL       replies are MADE to be forgeries or to be honest, so how each was made says what it is.
//                   A forgery is a reply that is not one plain statement of the cell's value: a wrong value, other
//                   working that comes to the value, another step, no value, two values, a false line riding on a
//                   true one (these are UNSOUND: a bond would be false), or the right value outside the three forms
//                   the check allows (in a sentence, with a unit, in look-alike characters: OUTSIDE the forms).
//   THE BOND-CHECK  src/bond.mjs: reads the reply as numbers and signs, and works in exact fractions.
//   THE SECOND READER  plainly(), below: written apart from the bond-check to the same rule, a different way. It
//                   matches whole patterns and compares numbers as decimal text, with its own arithmetic. It shares
//                   no code with the bond-check and none with The Climb's kernels.
// Any reply on which the three do not agree is a finding, and it is kept and shown. A third arm has no label: random
// characters, and honest replies with a few characters changed. There only the two readers are compared.
//
// It has a budget: a fixed number of replies for each cell, from a seed, so a run can be made again exactly.
// teeth() turns the same harness on readers with a leak planted in each. A harness that cannot find a planted leak
// proves nothing by finding none in the real check, so that count is published beside the result.
// Nothing here uses a model. Pure and total: a reader that throws is caught and counted.
import { evaluate, num, same } from '../vendor/climb/src/exact.mjs';
import { claimsOf } from '../vendor/climb/src/checker.mjs';
import { read, LIMIT } from './bond.mjs';

const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
const str = (x) => (typeof x === 'string' ? x : '');

// ── the second reader's own numbers: a decimal is a whole number m and a count s of places after the point ──
const N = '[-−]?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?', W = '[ \\t]*', STEP = `(${N})${W}([×xX*÷/+\\-−^])${W}(${N})`;
const PLAIN = new RegExp(`^${N}$`), CELL = new RegExp(`^${W}${STEP}${W}$`);
const FORMS = [new RegExp(`^${W}${STEP}${W}=${W}(${N})${W}$`), new RegExp(`^${W}(${N})${W}=${W}${STEP}${W}$`), new RegExp(`^${W}(${N})${W}$`)];
const OP = { '×': '*', x: '*', X: '*', '*': '*', '÷': '/', '/': '/', '+': '+', '-': '-', '−': '-', '^': '^' };
const tidy = (x) => { let { m, s } = x; while (s > 0 && m % 10n === 0n) { m /= 10n; s--; } return { m, s }; };
// dec(text) → a plain number as { m, s }, or null (not a plain number, or more than forty digits)
export function dec(text) {
  if (typeof text !== 'string' || !PLAIN.test(text)) return null;
  const neg = text[0] === '-' || text[0] === '−', [w, f = ''] = (neg ? text.slice(1) : text).split(',').join('').split('.');
  if (w.length + f.length > 40) return null;
  const m = BigInt(w + f);
  return tidy({ m: neg ? -m : m, s: f.length });
}
// spell(x) → the number written one way: no commas, no noughts it does not need
export function spell(x) {
  const neg = x.m < 0n, digits = String(neg ? -x.m : x.m).padStart(x.s + 1, '0');
  return `${neg ? '-' : ''}${digits.slice(0, digits.length - x.s)}${x.s === 0 ? '' : `.${digits.slice(digits.length - x.s)}`}`;
}
const lift = (x, s) => x.m * 10n ** BigInt(s - x.s), ONE = { m: 1n, s: 0 }, TEN = { m: 10n, s: 0 };
// the second reader's arithmetic, on decimals; a division that does not end within forty places has no value here
export const ARITH = {
  '+': (a, b) => { const s = Math.max(a.s, b.s); return tidy({ m: lift(a, s) + lift(b, s), s }); },
  '-': (a, b) => { const s = Math.max(a.s, b.s); return tidy({ m: lift(a, s) - lift(b, s), s }); },
  '*': (a, b) => tidy({ m: a.m * b.m, s: a.s + b.s }),
  '/': (a, b) => {
    if (b.m === 0n) return null;
    const s = Math.max(a.s, b.s), top = lift(a, s), under = lift(b, s);
    for (let k = 0; k <= 40; k++) if ((top * 10n ** BigInt(k)) % under === 0n) return tidy({ m: (top * 10n ** BigInt(k)) / under, s: k });
    return null;
  },
  '^': (a, b) => {
    const down = String(b.m).startsWith('-'), times = BigInt(String(b.m).replace('-', ''));
    if (b.s !== 0 || times > 64n) return null;
    let out = ONE;
    for (let i = 0n; i < times; i++) out = ARITH['*'](out, a);
    return down ? ARITH['/'](ONE, out) : out;
  },
};
const SHOW = { '*': ' × ', '/': ' ÷ ', '+': ' + ', '-': ' - ', '^': '^' };
// parts(cell) → the cell as the second reader sees it: its two numbers, its operation and its value, as decimals
// (A, B, V) and as text (a, b, v), and w, the step written plainly. null when it is not one step with a value.
export function parts(cell) {
  const m = str(get(cell, 'text')).match(CELL), A = m ? dec(m[1]) : null, B = m ? dec(m[3]) : null;
  if (A === null || B === null) return null;
  // a power of a number below nothing is not a cell: written plainly, -3^2 means -(3^2), which is two steps
  const op = OP[m[2]], V = op === '^' && A.m < 0n ? null : ARITH[op](A, B);
  if (V === null || spell(V).replace(/[-.]/g, '').length > 40) return null;
  return { op, A, B, V, a: spell(A), b: spell(B), v: spell(V), w: `${spell(A)}${SHOW[op]}${spell(B)}`, text: cell.text };
}
// plainly(reply, cell) → true when the reply is one plain statement of the cell's value: the second reader
export function plainly(reply, cell) {
  const c = parts(cell), t = str(reply).trim();
  if (c === null || t.length > LIMIT) return false;
  const s = t.endsWith('.') ? t.slice(0, -1) : t, m = FORMS.map((re) => s.match(re)).find((x) => x !== null);
  if (m === undefined) return false;
  const [a, sign, b, v] = m.length === 2 ? [null, null, null, m[1]] : OP[m[2]] !== undefined ? [m[1], m[2], m[3], m[4]] : [m[2], m[3], m[4], m[1]];
  const text = (lit) => { const d = dec(lit); return d === null ? null : spell(d); };
  if (text(v) !== c.v) return false;
  if (a === null) return true;
  const x = text(a), y = text(b), turned = (c.op === '+' || c.op === '*') && x === c.b && y === c.a;
  return OP[sign] === c.op && ((x === c.a && y === c.b) || turned);
}

// ── a seeded source of numbers, so every run can be made again exactly ──
export const rng = (seed) => {
  let a = (Number(seed) || 0) >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return (t ^ (t >>> 14)) >>> 0; };
};
const int = (R, n) => R() % n, pick = (R, xs) => xs[R() % xs.length];
const whole = (n) => ({ m: BigInt(n), s: 0 });
const commas = (v) => v.replace(/^(-?)(\d+)/, (_, sign, w) => sign + w.replace(/\B(?=(\d{3})+$)/g, ','));

// near(R, c) → a number, as text, that is NOT the cell's value: the mistakes a model makes (one out, a place out, a
// digit dropped or swapped, the sign lost, the wrong operation on the same two numbers)
export function near(R, c) {
  const k = whole(1 + int(R, 9)), digits = c.v.replace('-', ''), at = int(R, digits.length);
  const ways = [
    () => ARITH['+'](c.V, k), () => ARITH['-'](c.V, k), () => ARITH['+'](c.V, ONE), () => ARITH['-'](c.V, ONE), () => ARITH['*'](c.V, TEN), () => ARITH['+'](c.V, TEN),
    () => ARITH['+'](c.V, c.A), () => c.A, () => c.B, () => ARITH['+'](c.A, c.B), () => ARITH['*'](c.A, c.B), () => ARITH['-'](c.A, c.B),
    () => dec(digits.slice(0, -1)), () => dec(`${digits}${digits.includes('.') ? '1' : '0'}`), () => dec(digits.slice(0, at) + (digits[at + 1] ?? '') + digits[at] + digits.slice(at + 2)),
    () => dec(c.a.replace('-', '') + c.b.replace(/[-.]/g, '')), () => whole(0),
  ];
  for (let i = 0; i < 6; i++) { const x = pick(R, ways)(); if (x !== null && spell(x) !== c.v) return spell(x); }
  return spell(ARITH['+'](c.V, ONE));
}
// another step that is true and is not the cell: two small numbers and their sum, product or difference
const elsewhere = (R) => { const p = whole(2 + int(R, 97)), q = whole(2 + int(R, 97)), op = pick(R, ['+', '*', '-']); return `${spell(p)}${SHOW[op]}${spell(q)} = ${spell(ARITH[op](p, q))}`; };
// other working that comes to the cell's value and is not the cell
const roundabout = (R, c) => { const k = whole(1 + int(R, 9)); return pick(R, [`${c.v} + 0`, `${c.v} × 1`, `1 × ${c.v}`, `${spell(ARITH['-'](c.V, k))} + ${spell(k)}`, `${spell(ARITH['+'](c.V, k))} - ${spell(k)}`, `${c.w} + 0`, `${c.w} × 1`]); };
const FULL = (v) => [...v].map((ch) => (ch >= '0' && ch <= '9' ? String.fromCharCode(0xff10 + Number(ch)) : ch)).join('');

// FORGERIES → every way a forgery is made: name → [kind, make(R, c)]. kind is 'unsound' (a bond would be false) or
// 'outside' (the right value, outside the three forms). make returns the reply, or null when the cell has no such
// forgery (a sum has no other way round).
export const FORGERIES = {
  'a wrong value': ['unsound', (R, c) => `${c.w} = ${near(R, c)}`],
  'a wrong value, alone': ['unsound', (R, c) => near(R, c)],
  'a wrong value, value first': ['unsound', (R, c) => `${near(R, c)} = ${c.w}`],
  'the value below nothing': ['unsound', (R, c) => (c.V.m === 0n ? null : pick(R, [`${c.w} = ${spell({ m: -c.V.m, s: c.V.s })}`, spell({ m: -c.V.m, s: c.V.s })]))],
  'other working that comes to the value': ['unsound', (R, c) => `${roundabout(R, c)} = ${c.v}`],
  'another step, true': ['unsound', (R) => elsewhere(R)],
  'another step, given the value': ['unsound', (R, c) => `${spell(ARITH['+'](c.A, whole(1 + int(R, 9))))}${SHOW[c.op]}${c.b} = ${c.v}`],
  'the other operation on the same numbers': ['unsound', (R, c) => `${c.a}${SHOW[pick(R, ['+', '*', '-'].filter((o) => o !== c.op))]}${c.b} = ${c.v}`],
  'the same numbers the other way round': ['unsound', (R, c) => { const back = ARITH[c.op](c.B, c.A); return c.op === '+' || c.op === '*' ? null : `${c.b}${SHOW[c.op]}${c.a} = ${back === null || int(R, 2) === 0 ? c.v : spell(back)}`; }],
  'the numbers and signs shuffled': ['unsound', (R, c) => { const t = [c.a, SHOW[c.op].trim(), c.b, '=', c.v]; for (let i = t.length - 1; i > 0; i--) { const j = int(R, i + 1); [t[i], t[j]] = [t[j], t[i]]; } return t.join(' '); }],
  'the right value after a wrong one': ['unsound', (R, c) => `${c.w} = ${near(R, c)}\n${c.w} = ${c.v}`],
  'a wrong value after the right one': ['unsound', (R, c) => `${c.w} = ${c.v}\n${c.w} = ${near(R, c)}`],
  'two values': ['unsound', (R, c) => { const n = near(R, c); return pick(R, [`${c.v}\n${n}`, `${c.v} ${n}`, `${c.v} or ${n}`, `${c.v} = ${n}`, `${n} = ${c.v}`, `${c.w} = ${c.v} or ${n}`]); }],
  'a chain that does not hold': ['unsound', (R, c) => { const n = near(R, c); return pick(R, [`${c.w} = ${c.v} = ${n}`, `${c.w} = ${n} = ${c.v}`, `${c.v} = ${c.w} = ${n}`]); }],
  'no value': ['unsound', (R, c) => pick(R, [`${c.w} =`, c.w, '', '=', ' ', `${c.w} = ${c.w}`, `${c.w} = ?`, '?', `= ${c.w}`])],
  'a true rewrite that states no value': ['unsound', (R, c) => `${c.w} = ${pick(R, [`${c.w} + 0`, roundabout(R, c)])}`],
  'a false line riding on a true one': ['unsound', (R, c) => pick(R, [`${c.w} = ${c.v}\n2 + 2 = 5`, `${c.w} = ${c.v}, 2 + 2 = 5`, `${c.w} = ${c.v} and 1 = 2`, `2 + 2 = 5\n${c.w} = ${c.v}`, `${c.v}\n2 + 2 = 5`])],
  'a space inside the value': ['unsound', (R, c) => { const d = c.v.replace('-', ''), at = 1 + int(R, d.length); return d.length < 2 || at >= d.length ? null : `${c.w} = ${d.slice(0, at)} ${d.slice(at)}`; }],
  'the value in a sentence': ['outside', (R, c) => pick(R, [`I think it is ${c.v}`, `The answer is ${c.v}.`, `ANSWER: ${c.v}`, `${c.w} is ${c.v}`, `${c.w} equals ${c.v}`, `So ${c.w} = ${c.v}`, `about ${c.v}`, `${c.w} ≈ ${c.v}`, `${c.v}?`, `${c.v}!`, `Step 1: ${c.w} = ${c.v}`, `- ${c.w} = ${c.v}`])],
  'the value with a unit or a mark': ['outside', (R, c) => pick(R, [`${c.v} m`, `${c.w} = ${c.v} m`, `(${c.w}) = ${c.v}`, `${c.w} = (${c.v})`, `$${c.v}`, `**${c.v}**`, `${c.v},`, `${c.v};`, `${c.v}..`, `=${c.v}`, `+${c.v}`, `${c.v}/1`, `${c.v}e0`, `${c.v} × 1`])],
  'a second line after the right one': ['outside', (R, c) => pick(R, [`${c.w} = ${c.v}\n${elsewhere(R)}`, `${c.w} = ${c.v}\n${c.w} = ${c.v}`, `${c.v}\n${c.v}`, `${c.v}\n\n${c.w}`, `${c.w}\n${c.v}`])],
  'the value in look-alike characters': ['outside', (R, c) => pick(R, [`${c.w} = ${FULL(c.v)}`, FULL(c.v), `${c.w} = ${c.v.replace(/0/, 'O').replace(/1/, 'l')}x`, `${c.v}​`, `​${c.w} = ${c.v}`, `${c.a} ${SHOW[c.op].trim()} ${c.b} = ${c.v}`, `${c.w} = ‮${c.v}`, `\u0000${c.v}`, `${c.v}\ud800`])],
  'too long, or built to break a reader': ['outside', (R, c) => pick(R, [`${c.a}${SHOW[c.op]}${' '.repeat(LIMIT)}${c.b} = ${c.v}`, `${'('.repeat(600)}${c.w}${')'.repeat(600)} = ${c.v}`, `${c.w} = ${c.v}${'0'.repeat(3000)}`, `${'9'.repeat(3000)}`, `${c.w} = ${c.v} ${'a'.repeat(3000)}`, `${'='.repeat(1000)}${c.v}`])],
};
const SPELL = { '*': ['×', 'x', 'X', '*'], '/': ['÷', '/'], '+': ['+'], '-': ['-', '−'], '^': ['^'] };
// honest(R, c) → a reply that IS one plain statement of the cell's value, written one of the ways the rule allows:
// any of the operation's signs, the two numbers of a sum or product either way round, the value first or last or
// alone, commas in the thousands, spaces or none, a full stop, white space at the ends
export function honest(R, c) {
  const gap = () => pick(R, [' ', ' ', '', '  ', '\t']), swap = (c.op === '+' || c.op === '*') && int(R, 2) === 0, num2 = (v) => pick(R, [v, v, commas(v), v.replace('-', '−')]);
  const w = `${num2(swap ? c.b : c.a)}${gap()}${pick(R, SPELL[c.op])}${gap()}${num2(swap ? c.a : c.b)}`, v = num2(c.v);
  const core = pick(R, [`${w}${gap()}=${gap()}${v}`, `${w}${gap()}=${gap()}${v}`, `${v}${gap()}=${gap()}${w}`, v]);
  return `${pick(R, ['', '', ' ', '\n', '\t'])}${core}${pick(R, ['', '', '.'])}${pick(R, ['', '', ' ', '\n', '\r\n'])}`;
}
// own(reply, c) → true when a reply made as a forgery has come out as the cell's own plain statement (the cell
// 311 + 1 and the forgery "311 + 1 = 312"): that is not a forgery of this cell, and it is not tried. This is decided
// by spelling alone, against the statements written out one by one, and uses neither reader.
export function own(reply, c) {
  const t = str(reply).trim().replace(/\.$/, ''), sign = SHOW[c.op].trim(), pairs = c.op === '+' || c.op === '*' ? [[c.a, c.b], [c.b, c.a]] : [[c.a, c.b]];
  const steps = pairs.flatMap(([p, q]) => [`${p}${SHOW[c.op]}${q}`, `${p} ${sign} ${q}`]);
  return [c.v, ...steps.flatMap((w) => [`${w} = ${c.v}`, `${c.v} = ${w}`])].includes(t);
}
const STOCK = [...'0123456789', ' ', ' ', '=', '.', ',', '-', '−', '+', '×', 'x', '÷', '/', '^', '(', ')', '\n', '\t', 'O', 'l', 'e', '²', '?', '​', ' ', '３'];
// noise(R, c) → a reply with no label: an honest reply with one to three characters dropped, added, changed, swapped
// or doubled, or (one time in four) a short run of characters drawn from the cell's own and a stock of awkward ones
export function noise(R, c) {
  const stock = [...STOCK, ...`${c.w} = ${c.v}`];
  if (int(R, 4) === 0) return Array.from({ length: int(R, 25) }, () => pick(R, stock)).join('');
  const t = [...honest(R, c)];
  for (let k = 1 + int(R, 3); k > 0; k--) {
    const i = int(R, t.length + 1), how = int(R, 5);
    if (how === 0) t.splice(i, 1); else if (how === 1) t.splice(i, 0, pick(R, stock)); else if (how === 2) t.splice(i, 1, pick(R, stock));
    else if (how === 3) t.splice(i, 2, ...t.slice(i, i + 2).reverse()); else t.splice(i, 0, ...t.slice(i, i + 1));
  }
  return t.join('');
}

export const BUDGET = { forged: 48, honest: 12, noise: 48 };
// fuzz(cells, opts) → the count. cells are steps as text. opts.seed and opts.budget (replies for each cell, by arm)
// fix the run; opts.read puts another reader in the bond-check's place (teeth() does).
//   forged   { tried, bonded, unsound, outside, rows }: bonded is how many forgeries bonded; unsound and outside
//            say how many of those were of each kind; rows is the same for each way of forging. own counts the
//            forgeries that came out as the cell's own statement and were not tried.
//   honest   { tried, refused }   noise { tried, bonded }: a noise reply may bond, when the noise left it honest
//   split    replies on which the bond-check, the second reader and the label did not all agree
//   threw    replies on which the reader threw
//   found    the first few such replies: { cell, reply, arm, way, bond, second, label }
//   sample   the first replies of each arm made for the first cell: { cell, arm, way, reply, bond }
//   clean    nothing bonded that was forged, nothing honest refused, no split, nothing thrown
export function fuzz(cells, opts) {
  const reader = typeof get(opts, 'read') === 'function' ? opts.read : read, R = rng(get(opts, 'seed')), names = Object.keys(FORGERIES);
  const budget = Object.fromEntries(Object.keys(BUDGET).map((k) => { const v = get(get(opts, 'budget'), k); return [k, Number.isInteger(v) && v >= 0 ? v : BUDGET[k]]; }));
  const rows = names.map((name) => ({ name, kind: FORGERIES[name][0], tried: 0, bonded: 0 })), found = [], sample = [];
  const out = { seed: (Number(get(opts, 'seed')) || 0) >>> 0, budget, cells: 0, tried: 0, forged: { tried: 0, bonded: 0, unsound: 0, outside: 0, own: 0, rows }, honest: { tried: 0, refused: 0 }, noise: { tried: 0, bonded: 0 }, split: 0, threw: 0, found, sample, clean: false };
  for (const text of Array.isArray(cells) ? cells : []) {
    const cell = { text }, c = parts(cell);
    if (c === null) continue;
    out.cells++;
    // one reply, three opinions: label is true (made honest), false (made a forgery) or null (noise)
    const rule = (reply, arm, way, label) => {
      let bond = null;
      try { bond = reader(reply, cell) !== null; } catch { out.threw++; }
      const second = plainly(reply, cell), agreed = bond === second && (label === null || label === second);
      out.tried++;
      if (!agreed) { if (bond !== null) out.split++; if (found.length < 12) found.push({ cell: c.w, reply: reply.slice(0, 120), arm, way, bond, second, label }); }
      if (out.cells === 1 && sample.filter((s) => s.arm === arm).length < 8) sample.push({ cell: c.w, arm, way, reply: reply.slice(0, 120), bond });
      return bond === true;
    };
    for (let i = 0; i < budget.forged; i++) {
      const k = int(R, names.length), reply = FORGERIES[names[k]][1](R, c);
      if (reply === null) continue;
      if (own(reply, c)) { out.forged.own++; continue; }
      out.forged.tried++; rows[k].tried++;
      if (rule(reply, 'forged', names[k], false)) { out.forged.bonded++; rows[k].bonded++; out.forged[rows[k].kind]++; }
    }
    for (let i = 0; i < budget.honest; i++) { out.honest.tried++; if (!rule(honest(R, c), 'honest', 'honest', true)) out.honest.refused++; }
    for (let i = 0; i < budget.noise; i++) { out.noise.tried++; if (rule(noise(R, c), 'noise', 'noise', null)) out.noise.bonded++; }
  }
  out.clean = out.forged.bonded === 0 && out.honest.refused === 0 && out.split === 0 && out.threw === 0;
  return out;
}

// ── readers with a leak planted in each: what the harness must be able to catch ──
const exact = (cell) => evaluate(str(get(cell, 'text')));
const turnedRound = (cell) => { const c = parts(cell); return c === null ? { text: '' } : { text: `${c.b}${SHOW[c.op]}${c.a}` }; };
export const PLANTED = {
  'takes the value wherever it stands in the reply': (reply, cell) => { const c = parts(cell); return c !== null && str(reply).includes(c.v) ? c.v : null; },
  // The Climb's reading of a line of working: right for a page of working, too generous for a bond
  'takes any true line that comes to the value': (reply, cell) => {
    const e = exact(cell), hit = str(reply).split('\n').map((l) => l.split(' = ')).find((p) => p.length === 2 && evaluate(p[0]) !== null && num(p[1]) !== null && same(evaluate(p[0]).value, num(p[1])));
    return e !== null && hit !== undefined && same(num(hit[1]), e.value) ? e.value : null;
  },
  // the crystal's own first bond-check, as it stood before this harness was written
  'lets the first line about the step decide': (reply, cell) => {
    const e = exact(cell), said = e === null ? undefined : claimsOf(str(reply)).find((c) => c.canon === e.canon);
    if (e === null) return null;
    if (said !== undefined) return said.ok && said.fact !== null ? e.value : null;
    const bare = num(str(reply).trim().replace(/[.;,]$/, ''));
    return bare !== null && same(bare, e.value) ? e.value : null;
  },
  'takes the last number in the reply': (reply, cell) => { const c = parts(cell), all = str(reply).match(/-?\d+(?:\.\d+)?/g); return c !== null && all !== null && all[all.length - 1] === c.v ? c.v : null; },
  'takes a value that is nearly right': (reply, cell) => {
    const c = parts(cell), m = str(reply).trim().match(/^(.*?)(-?\d+(?:\.\d+)?)$/s);
    return read(reply, cell) ?? (c !== null && m !== null && Math.abs(Number(m[2]) - Number(c.v)) * 100 <= Math.abs(Number(c.v)) ? read(m[1] + c.v, cell) : null);
  },
  'does not look at the step': (reply, cell) => { const c = parts(cell), t = str(reply).trim(); return c !== null && (t === c.v || t.endsWith(`= ${c.v}`)) ? c.v : null; },
  'takes a step either way round': (reply, cell) => read(reply, cell) ?? read(reply, turnedRound(cell)),
  'reads the sign off the value': (reply, cell) => read(reply, cell) ?? read(str(reply).replace(/(^|=)(\s*)[-−](?=\d)/, '$1$2'), cell),
  'reads the first line only': (reply, cell) => read(str(reply).split('\n')[0], cell),
  'lets words go': (reply, cell) => read(str(reply).replace(/[A-Za-z]+:?\s/g, ''), cell),
  'refuses everything': () => null,
  'throws on a reply it cannot read': (reply, cell) => { const r = read(reply, cell); if (r === null && /[^\x20-\x7e×÷−\n\r\t]/.test(str(reply))) throw new Error('unreadable'); return r; },
};
// one cell of every operation, so that each planted leak has a cell it can show on (a reader that takes a step
// either way round shows only on a taking away, a division or a power)
export const EVERY = ['26 × 12', '450 + 37', '494 - 228', '231 - 551', '96 ÷ 2', '21^2', '0.5 × 26', '7 × -55'];
// teeth(cells, opts) → the harness turned on each planted reader, over EVERY and the cells given: { planted, caught,
// rows: [{ name, caught, way, reply }] }, way and reply being the first reply that gave the leak away
export function teeth(cells, opts) {
  const all = [...EVERY, ...(Array.isArray(cells) ? cells : [])];
  const rows = Object.keys(PLANTED).map((name) => {
    const r = fuzz(all, { seed: get(opts, 'seed'), budget: get(opts, 'budget'), read: PLANTED[name] }), first = r.found[0];
    return { name, caught: !r.clean, way: first === undefined ? null : first.way, reply: first === undefined ? null : first.reply };
  });
  return { planted: rows.length, caught: rows.filter((r) => r.caught).length, rows };
}

export default { BUDGET, EVERY, FORGERIES, PLANTED, ARITH, dec, spell, parts, plainly, rng, near, honest, own, noise, fuzz, teeth };
