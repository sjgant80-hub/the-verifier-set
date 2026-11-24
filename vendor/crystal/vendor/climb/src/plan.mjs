// plan.mjs — how to make a step smaller. When the checker drops a step, the model is not told the right value.
// The step is split into smaller ones, and this file makes the split, by code, from the step's own numbers:
// 144 × 45 becomes 144 × 40 + 144 × 5. If a smaller step is dropped too, it is split again, so each pass goes one
// level finer until the steps are ones a small model gets right, or until there is nothing smaller to offer.
// A split never contains a result: both sides are working, and they are equal by construction (the tests check each
// one with the exact arithmetic). Pure and total.
import { evaluate, show, same, make } from './exact.mjs';

// a number as written, with no sign in front: every split here is for numbers above nothing
const isNum = (t) => t.op === 'n';
const whole = (t) => isNum(t) && t.value.d === 1n && t.value.n > 0n;
// places(n) → a whole number as its place-value parts: 345 → [300, 40, 5]
export function places(n) {
  const s = String(n), out = [];
  for (let i = 0; i < s.length; i++) if (s[i] !== '0') out.push(BigInt(s[i]) * 10n ** BigInt(s.length - 1 - i));
  return out;
}

// ways(working) → every way this file knows to write a one-operation step as smaller steps, gentlest first. Each is
// the smaller working only, as text. [] when the step has more than one operation or there is nothing smaller.
export function ways(working) {
  const e = evaluate(working);
  if (e === null || e.ops !== 1 || e.tree.op === 'neg') return [];
  const t = e.tree, [a, b] = t.args;
  if (t.op === '^') {
    if (!whole(a) || !whole(b) || b.value.n < 2n || b.value.n > 4n) return [];
    return [Array.from({ length: Number(b.value.n) }, () => show(a.value)).join(' × ')];
  }
  if (t.op === '*') {
    // half of a whole number is a division by two
    const half = [a, b].findIndex((x) => isNum(x) && x.value.n === 1n && x.value.d === 2n);
    if (half >= 0) return whole([a, b][1 - half]) ? [`${show([a, b][1 - half].value)} ÷ 2`] : [];
    // a number with a decimal part, times a whole number: its whole part and its decimal part, each times that number
    const mixed = [a, b].findIndex((x) => isNum(x) && x.value.d !== 1n && x.value.n > x.value.d);
    if (mixed >= 0) {
      const f = [a, b][mixed].value, other = [a, b][1 - mixed], part = show(make(f.n % f.d, f.d));
      return whole(other) && !part.includes('/') ? [`${f.n / f.d} × ${show(other.value)} + ${part} × ${show(other.value)}`] : [];
    }
    if (!whole(a) || !whole(b)) return [];
    const pa = places(a.value.n), pb = places(b.value.n);
    if (pa.length === 1 && pb.length === 1) {
      // one digit each, with noughts: 40 × 300 is 4 × 3 with three noughts put back
      const da = BigInt(String(pa[0])[0]), db = BigInt(String(pb[0])[0]), tens = (pa[0] / da) * (pb[0] / db);
      return tens === 1n ? [] : [`${da} × ${db} × ${tens}`];
    }
    const byB = pb.length > 1 ? pb.map((y) => `${show(a.value)} × ${y}`).join(' + ') : null;
    const byA = pa.length > 1 ? pa.map((x) => `${x} × ${show(b.value)}`).join(' + ') : null;
    const grid = pa.length > 1 && pb.length > 1 ? pa.flatMap((x) => pb.map((y) => `${x} × ${y}`)).join(' + ') : null;
    // the gentlest split takes apart the number with fewer parts; the finest takes apart both
    return [...(byB !== null && (byA === null || pb.length <= pa.length) ? [byB, byA] : [byA, byB]), grid].filter((x) => x !== null);
  }
  if (t.op === '+' || t.op === '-') {
    if (!whole(a) || !whole(b)) return [];
    const pb = places(b.value.n), sign = t.op;
    // take the second number one place at a time
    if (pb.length > 1) return [`${show(a.value)} ${sign} ${pb.join(` ${sign} `)}`];
    // one place to add, and the first number has a digit in that place: add the two digits on their own, so the
    // carry is a step of its own. 8400 + 200 is 8000 + (4 + 2) × 100; 274 + 8 is 270 + (4 + 8).
    const unit = 10n ** BigInt(String(pb[0]).length - 1), da = (a.value.n / unit) % 10n, rest = a.value.n - da * unit;
    if (sign !== '+' || da === 0n || (rest === 0n && unit === 1n)) return [];
    const digits = `(${da} + ${pb[0] / unit})${unit === 1n ? '' : ` × ${unit}`}`;
    return [rest === 0n ? digits : `${rest} + ${digits}`];
  }
  if (!whole(a) || !whole(b)) return [];
  // a division, when every place of the first number divides exactly
  const pa = places(a.value.n);
  return pa.length < 2 || pa.some((p) => p % b.value.n !== 0n) ? [] : [pa.map((p) => `${p} ÷ ${show(b.value)}`).join(' + ')];
}
// split(working) → one line "working = smaller working", the gentlest split, or null
export function split(working) {
  const w = ways(working);
  return w.length === 0 ? null : `${evaluate(working).shown} = ${w[0]}`;
}
// holds(line) → true when a split line says nothing false: it has two sides and they are the same number
export function holds(line) {
  const sides = String(line).split(' = ').map((s) => evaluate(s));
  return sides.length === 2 && sides.every((s) => s !== null) && same(sides[0].value, sides[1].value);
}

export default { places, ways, split, holds };
