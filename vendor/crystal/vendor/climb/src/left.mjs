// left.mjs — what is left to do. The checker holds the calculation a problem asks for and, as the model writes
// steps, crosses off each part the model got right. What remains is a smaller problem, and that is what the model is
// shown next. Nothing here works a step out for the model: a part is crossed off only with a value the model wrote
// in a line the checker found true, or with a fact an earlier problem's checked line put in the memory.
//
//   start('15 × 15 × 37')                         →  15 × 15 × 37
//   a true line   15 × 15 = 225                   →  225 × 37
//   a false line  225 × 37 = 8355  is split       →  225 × 30 + 225 × 7
//   a true line   225 × 30 = 6750                 →  6750 + 225 × 7
//
// The one law of this file: whatever is done to it, what is left always has the same exact value as the calculation
// it started from. Every change is checked against that before it is accepted. Pure and total.
import { evaluate, show, same, make, add, sub, mul } from './exact.mjs';
import { ways } from './plan.mjs';

const ZERO = make(0n), ONE = make(1n);
const num = (value) => ({ op: 'n', value });
const isN = (x) => x.op === 'n';

// A calculation is held as: a number; a product of items; a sum of signed terms; or a division or power of two parts.
// A sum written in brackets after a plus sign (270 + (4 + 8)) is HELD: it stays a bracket, to be done first.
function product(items) {
  const flat = items.flatMap((x) => (x.op === '*' ? x.items : [x]));
  return flat.length === 1 ? flat[0] : { op: '*', items: flat, value: flat.reduce((a, x) => mul(a, x.value), ONE) };
}
function total(terms) {
  // a sum added inside a sum is opened up unless it is held, and adding a negative number is written as taking the number away
  const flat = terms.flatMap((t) => (t.node.op === '+' && !t.neg && t.node.held !== true ? t.node.terms : [t])).map((t) => (isN(t.node) && t.node.value !== null && t.node.value.n < 0n ? { neg: !t.neg, node: num(sub(ZERO, t.node.value)) } : t));
  if (flat.length === 1 && !flat[0].neg) return flat[0].node;
  if (flat.length === 1 && isN(flat[0].node)) return num(sub(ZERO, flat[0].node.value));
  return { op: '+', terms: flat, value: flat.reduce((a, t) => (t.neg ? sub(a, t.node.value) : add(a, t.node.value)), ZERO) };
}
const hold = (x) => (x.op === '+' ? { ...x, held: true } : x);
function norm(t) {
  if (t.op === 'n') return num(t.value);
  if (t.op === 'neg') return total([{ neg: true, node: norm(t.args[0]) }]);
  if (t.op === '*') return product(t.args.map(norm));
  if (t.op === '+') return total([{ neg: false, node: norm(t.args[0]) }, { neg: false, node: hold(norm(t.args[1])) }]);
  if (t.op === '-') return total([{ neg: false, node: norm(t.args[0]) }, { neg: true, node: norm(t.args[1]) }]);
  return { op: t.op, args: t.args.map(norm), value: t.value };
}
const read = (text) => { const e = evaluate(text); return e === null ? null : norm(e.tree); };
// sound(x) → true when x is a calculation as this file holds one; anything else handed in is refused, not read
const frac = (v) => v !== null && typeof v === 'object' && typeof v.n === 'bigint' && typeof v.d === 'bigint';
function sound(x) {
  if (x === null || typeof x !== 'object' || !frac(x.value)) return false;
  if (x.op === 'n') return true;
  if (x.op === '*') return Array.isArray(x.items) && x.items.length > 1 && x.items.every(sound);
  if (x.op === '+') return Array.isArray(x.terms) && x.terms.length > 0 && x.terms.every((t) => t !== null && typeof t === 'object' && typeof t.neg === 'boolean' && sound(t.node));
  return (x.op === '/' || x.op === '^') && Array.isArray(x.args) && x.args.length === 2 && x.args.every(sound);
}

// spell(x) → one spelling for every way of writing the same calculation, whatever the order of a product or a sum
function spell(x) {
  if (isN(x)) return show(x.value);
  if (x.op === '*') return `*(${x.items.map(spell).sort().join(',')})`;
  if (x.op === '+') return `+(${x.terms.map(sign).sort().join(',')})`;
  return `${x.op}(${x.args.map(spell).join(',')})`;
}
const sign = (t) => (t.neg ? '-' : '') + spell(t.node);

// write(x) → the calculation as a person writes it
function write(x) {
  if (isN(x)) return show(x.value);
  if (x.op === '*') return x.items.map((i) => (i.op === '+' || i.op === '/' ? `(${write(i)})` : write(i))).join(' × ');
  if (x.op === '+') {
    // written with a term that is added first, when there is one that is not a bracket
    const lead = x.terms.findIndex((t) => !t.neg && t.node.op !== '+'), order = lead > 0 ? [x.terms[lead], ...x.terms.filter((_, i) => i !== lead)] : x.terms;
    return order.map((t, k) => { const s = isN(t.node) || (t.node.op !== '+' && !(k === 0 && t.neg)) ? write(t.node) : `(${write(t.node)})`; return k === 0 ? `${t.neg ? '-' : ''}${s}` : `${t.neg ? ' - ' : ' + '}${s}`; }).join('');
  }
  const [a, b] = x.args, plain = (n) => isN(n) && n.value.n >= 0n;
  if (x.op === '/') return `${plain(a) || a.op === '*' || a.op === '/' || a.op === '^' ? write(a) : `(${write(a)})`} ÷ ${plain(b) ? write(b) : `(${write(b)})`}`;
  return `${plain(a) ? write(a) : `(${write(a)})`}^${plain(b) ? write(b) : `(${write(b)})`}`;
}
// size(x) → how many operations are left in it; 0 means it is a number and there is nothing left to do
function size(x) {
  if (isN(x)) return 0;
  if (x.op === '*') return x.items.length - 1 + x.items.reduce((a, i) => a + size(i), 0);
  if (x.op === '+') return x.terms.length - 1 + x.terms.reduce((a, t) => a + size(t.node), 0);
  return 1 + size(x.args[0]) + size(x.args[1]);
}
// start(text) → the calculation a problem asks for, ready to be crossed off, or null when the text is not one
export function start(text) { return read(typeof text === 'string' ? text : ''); }

// pick(have, need) → the positions in have that make up need, each used once, or null
function pick(have, need) {
  const used = [];
  for (const k of need) { const i = have.findIndex((h, j) => h === k && !used.includes(j)); if (i < 0) return null; used.push(i); }
  return used;
}
// again(node, terms) → the sum with new terms; a held bracket stays held for as long as it is still a sum
const again = (node, terms) => { const made = total(terms); return node.held === true ? hold(made) : made; };
const put = (list, at, item) => { const first = Math.min(...at); return list.flatMap((x, i) => (i === first ? [item] : at.includes(i) ? [] : [x])); };
// swap(node, w, wk, fresh) → node with the first part that is the working w replaced by fresh, or null when w is
// not in it. A working is in a product when its items are some of the product's, and in a sum when its terms are
// some of the sum's, as written or all with the other sign (b + c is in a - b - c, as what is taken away).
function swap(node, w, wk, fresh) {
  if (isN(node)) return null;
  if (spell(node) === wk) return fresh;
  if (node.op === '*') {
    const at = w.op === '*' ? pick(node.items.map(spell), w.items.map(spell)) : null;
    if (at !== null) return product(put(node.items, at, fresh));
    for (let i = 0; i < node.items.length; i++) { const r = swap(node.items[i], w, wk, fresh); if (r !== null) return product(node.items.map((x, k) => (k === i ? r : x))); }
    return null;
  }
  if (node.op === '+') {
    const have = node.terms.map(sign), as = w.op === '+' ? pick(have, w.terms.map(sign)) : null;
    if (as !== null) return again(node, put(node.terms, as, { neg: false, node: fresh }));
    const other = w.op === '+' ? pick(have, w.terms.map((t) => sign({ neg: !t.neg, node: t.node }))) : null;
    if (other !== null) return again(node, put(node.terms, other, { neg: true, node: fresh }));
    for (let i = 0; i < node.terms.length; i++) { const r = swap(node.terms[i].node, w, wk, fresh); if (r !== null) return again(node, node.terms.map((t, k) => (k === i ? { neg: t.neg, node: r } : t))); }
    return null;
  }
  for (let i = 0; i < 2; i++) { const r = swap(node.args[i], w, wk, fresh); if (r !== null) return { op: node.op, args: node.args.map((x, k) => (k === i ? r : x)), value: node.value }; }
  return null;
}
// byValue(node, value) → node with its first (outermost) unfinished part of exactly that value replaced by the value
function byValue(node, value) {
  if (isN(node)) return null;
  if (same(node.value, value)) return num(value);
  if (node.op === '*') { for (let i = 0; i < node.items.length; i++) { const r = byValue(node.items[i], value); if (r !== null) return product(node.items.map((x, k) => (k === i ? r : x))); } return null; }
  if (node.op === '+') { for (let i = 0; i < node.terms.length; i++) { const r = byValue(node.terms[i].node, value); if (r !== null) return again(node, node.terms.map((t, k) => (k === i ? { neg: t.neg, node: r } : t))); } return null; }
  for (let i = 0; i < 2; i++) { const r = byValue(node.args[i], value); if (r !== null) return { op: node.op, args: node.args.map((x, k) => (k === i ? r : x)), value: node.value }; }
  return null;
}
// the law: a change is accepted only when what is left still has the value it had
const lawful = (before, after) => (after !== null && same(before.value, after.value) ? after : null);

// steps(x) → every single step that could be done next: one operation on two plain numbers that sit together in a
// product, a sum, a division or a power. [{ text, canon }], each once.
function steps(x) {
  const out = new Map();
  const say = (text) => { const e = evaluate(text); if (e !== null && e.ops === 1 && !out.has(e.canon)) out.set(e.canon, { text: e.shown, canon: e.canon }); };
  const walk = (n) => {
    if (isN(n)) return;
    if (n.op === '*') {
      const ns = n.items.filter(isN);
      ns.forEach((p, i) => ns.slice(i + 1).forEach((q) => say(`${show(p.value)} × ${show(q.value)}`)));
      n.items.forEach(walk);
    } else if (n.op === '+') {
      const ns = n.terms.filter((t) => isN(t.node));
      ns.forEach((p, i) => ns.slice(i + 1).forEach((q) => {
        const a = show(p.node.value), b = show(q.node.value);
        say(p.neg === q.neg ? `${a} + ${b}` : p.neg ? `${b} - ${a}` : `${a} - ${b}`);
      }));
      n.terms.forEach((t) => walk(t.node));
    } else {
      if (n.args.every(isN)) say(`${show(n.args[0].value)} ${n.op === '/' ? '÷' : '^'} ${show(n.args[1].value)}`);
      n.args.forEach(walk);
    }
  };
  walk(x);
  return [...out.values()];
}
// adopt(x, w, wk, fresh) → the model split a step its own way (wrote 225 × 30 where 225 × 37 is asked): when the
// working w is part of a split this file knows for one of the next steps, that step is replaced by its split, with w
// in it replaced by fresh. null when no split of any next step holds w.
function adopt(x, w, wk, fresh) {
  for (const a of steps(x)) for (const way of ways(a.text)) {
    const smaller = read(way), inside = smaller === null ? null : swap(smaller, w, wk, fresh), whole = read(a.text);
    const r = inside === null || whole === null ? null : swap(x, whole, spell(whole), inside);
    if (r !== null) return r;
  }
  return null;
}

// cross(x, working, value) → what is left after a TRUE line "working = value": { left, how } or null when the line
// crosses nothing off. how is 'step' (the working is a part of what is left), 'split' (it is a part of a split of a
// next step) or 'value' (it is some other working that comes to exactly the value of an unfinished part).
export function cross(x, working, value) {
  const e = evaluate(typeof working === 'string' ? working : '');
  if (e === null || e.ops === 0 || !same(e.value, value) || !sound(x)) return null;
  const w = norm(e.tree), wk = spell(w), fresh = num(value);
  for (const [how, r] of [['step', () => swap(x, w, wk, fresh)], ['split', () => adopt(x, w, wk, fresh)], ['value', () => byValue(x, value)]]) {
    let got = lawful(x, r());
    if (got === null) continue;
    // a step that is asked for more than once is crossed off everywhere it stands
    for (let more = lawful(got, swap(got, w, wk, fresh)); more !== null; more = lawful(got, swap(got, w, wk, fresh))) got = more;
    return { left: got, how };
  }
  return null;
}
// rewrite(x, from, to) → what is left after a TRUE line with working on both sides ("0.5 × 6 × 9 = 0.5 × 54"): the
// first working, where it is a part of what is left, is replaced by the second. null when it is not, or they differ.
export function rewrite(x, from, to) {
  const a = evaluate(typeof from === 'string' ? from : ''), b = evaluate(typeof to === 'string' ? to : '');
  // (a bare number as the first side is never found: only working is a part of what is left)
  if (a === null || b === null || !same(a.value, b.value) || !sound(x)) return null;
  const w = norm(a.tree), got = lawful(x, swap(x, w, spell(w), norm(b.tree)));
  return got === null ? null : { left: got, how: 'step' };
}
// wrong(x, working) → what is left after a FALSE line about this working: { left, on, split }. on says whether the
// working is a part of what is left (as it stands, or as a part of a split of a next step, which is then adopted).
// When it is, and it is one operation that can be made smaller, it is replaced by its gentlest split, and split is
// that line ("225 × 37 = 225 × 30 + 225 × 7"). A wrong line about anything else changes nothing.
export function wrong(x, working) {
  const e = evaluate(typeof working === 'string' ? working : '');
  if (e === null || e.ops === 0 || !sound(x)) return null;
  const w = norm(e.tree), wk = spell(w);
  const at = swap(x, w, wk, w) !== null ? x : lawful(x, adopt(x, w, wk, w));
  if (at === null) return { left: x, on: false, split: null };
  const way = ways(e.shown)[0], smaller = way === undefined ? null : read(way), got = smaller === null ? null : lawful(at, swap(at, w, wk, smaller));
  return got === null ? { left: at, on: true, split: null } : { left: got, on: true, split: `${e.shown} = ${way}` };
}

// what the rest of the code reads off a calculation; each refuses anything that is not one
// left(x) → it as a person writes it · ops(x) → how many operations are left · key(x) → its one spelling ·
// atoms(x) → every single step that could be done next
export const left = (x) => (sound(x) ? write(x) : '');
export const ops = (x) => (sound(x) ? size(x) : 0);
export const key = (x) => (sound(x) ? spell(x) : '');
export const atoms = (x) => (sound(x) ? steps(x) : []);

export default { start, left, ops, key, atoms, cross, rewrite, wrong };
