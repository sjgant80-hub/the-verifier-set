// tasks.mjs — the problems, made by code so every one has a finish line that is not a model. Each task is a physics
// or maths calculation with whole-number inputs chosen so the right answer is exact. The answer is worked out here in
// whole-number arithmetic when the task is made. Tasks come in SHEETS: one sheet is one setting (a cart, a car, a
// circuit) and its questions share that setting's numbers, the way a worked problem sheet does, so a step checked for
// one question can be the same step another question needs.
//
// Three tiers, set before anything is measured (they are predictions, and the page shows where they were wrong):
//   easy   one small step: expected right first time
//   climb  two to five steps with two-digit numbers: expected wrong first time, reachable with checked steps
//   wall   nothing to climb by (a search with no partial credit) or far more steps than the passes allow:
//          expected not reached
// Pure and deterministic: the same seed gives the same sheets, byte for byte.

import { evaluate, show } from './exact.mjs';

function prng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const PRIMES = [101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199];
const value = (n) => ({ type: 'value', value: String(n) });

// every family: its tier, what it asks, and its finish line. q holds the sheet's shared numbers. A problem with one
// right value carries the calculation it asks for (ask), and its finish line is that calculation's exact value.
export const FAMILIES = {
  force: { tier: 'easy', make: (q) => ({ statement: `A ${q.s1} kg mass accelerates at ${q.s2} m/s². Force = mass × acceleration. What is the force in newtons?`, ask: `${q.s1} × ${q.s2}` }) },
  distance: { tier: 'easy', make: (q) => ({ statement: `A cyclist rides at ${q.s3} m/s for ${q.t} s. Distance = speed × time. How many metres?`, ask: `${q.s3} × ${q.t}` }) },
  volts: { tier: 'easy', make: (q) => ({ statement: `A current of ${q.s2} A flows through a ${q.s4} Ω resistor. Voltage = current × resistance. How many volts?`, ask: `${q.s2} × ${q.s4}` }) },
  weight: { tier: 'easy', make: (q) => ({ statement: `A ${q.m} kg crate sits on the floor. Weight = mass × 10. What is its weight in newtons?`, ask: `${q.m} × 10` }) },

  energy: { tier: 'climb', make: (q) => ({ statement: `A ${q.m} kg cart moves at ${q.v} m/s. Kinetic energy = 0.5 × mass × speed × speed. How many joules?`, ask: `0.5 × ${q.m} × ${q.v} × ${q.v}` }) },
  squares: { tier: 'climb', make: (q) => ({ statement: `A box is ${q.v} cm long, ${q.d} cm wide and ${q.m2} cm high. Diagonal squared = length × length + width × width + height × height. What is the diagonal squared?`, ask: `${q.v} × ${q.v} + ${q.d} × ${q.d} + ${q.m2} × ${q.m2}` }) },
  tank: { tier: 'climb', make: (q) => ({ statement: `A tank is ${q.v} cm long, ${q.d} cm wide and ${q.m2} cm deep. Volume = length × width × depth. How many cubic centimetres?`, ask: `${q.v} × ${q.d} × ${q.m2}` }) },
  dot: { tier: 'climb', make: (q) => ({ statement: `Work out ${q.v} × ${q.d} + ${q.i} × ${q.m2} + ${q.r} × ${q.s4}.`, ask: `${q.v} × ${q.d} + ${q.i} × ${q.m2} + ${q.r} × ${q.s4}` }) },
  power: { tier: 'climb', make: (q) => ({ statement: `A current of ${q.i} A flows through a ${q.r} Ω resistor. Power = current × current × resistance. How many watts?`, ask: `${q.i} × ${q.i} × ${q.r}` }) },
  series: { tier: 'climb', make: (q) => ({ statement: `Add up all the whole numbers from ${q.i} to ${q.r}. Sum = (first + last) × how many ÷ 2, and there are ${q.r - q.i + 1} numbers. What is the sum?`, ask: `(${q.i} + ${q.r}) × ${q.r - q.i + 1} ÷ 2` }) },
  momentum: { tier: 'climb', make: (q) => ({ statement: `Three carts move the same way: ${q.m} kg at ${q.v} m/s, ${q.m2} kg at ${q.d} m/s and ${q.i} kg at ${q.r} m/s. Total momentum = ${q.m} × ${q.v} + ${q.m2} × ${q.d} + ${q.i} × ${q.r}. What is it in kg m/s?`, ask: `${q.m} × ${q.v} + ${q.m2} × ${q.d} + ${q.i} × ${q.r}` }) },
  trapezium: { tier: 'climb', make: (q) => ({ statement: `A trapezium has parallel sides of ${q.i} cm and ${q.r} cm, and they are ${q.m} cm apart. Area = 0.5 × (first side + second side) × distance apart. How many square centimetres?`, ask: `0.5 × (${q.i} + ${q.r}) × ${q.m}` }) },

  factor: { tier: 'wall', make: (q) => ({ statement: `The number ${q.p1 * q.p2} is two prime numbers multiplied together. Find the two primes. Give the answer as: prime × prime.`, check: { type: 'factors', n: String(q.p1 * q.p2) } }) },
  root: { tier: 'wall', make: (q) => ({ statement: `A whole number x satisfies x × x × x + ${q.s2} × x = ${q.v * q.v * q.v + q.s2 * q.v}. Find x.`, check: { type: 'root', n: String(q.v * q.v * q.v + q.s2 * q.v), b: String(q.s2) } }) },
  product: { tier: 'wall', make: (q) => ({ statement: `Work out ${q.m} × ${q.v} × ${q.d} × ${q.r}.`, ask: `${q.m} × ${q.v} × ${q.d} × ${q.r}` }) },
  grid: { tier: 'wall', make: (q) => ({ statement: `Work out ${q.v} × (${q.d} × ${q.r} - ${q.i} × ${q.m}) - ${q.m2} × (${q.i} × ${q.r} - ${q.d} × ${q.v}) + ${q.s4} × (${q.i} × ${q.m} - ${q.d} × ${q.d}).`, ask: `${q.v} × (${q.d} × ${q.r} - ${q.i} × ${q.m}) - ${q.m2} × (${q.i} × ${q.r} - ${q.d} × ${q.v}) + ${q.s4} × (${q.i} × ${q.m} - ${q.d} × ${q.d})` }) },
};
export const TIERS = ['easy', 'climb', 'wall'];
const of = (tier) => Object.keys(FAMILIES).filter((f) => FAMILIES[f].tier === tier);

// sheet(seed, index) → one sheet: its shared numbers, and eight questions (2 easy, 4 climb, 2 wall). The families
// rotate with the sheet's index so every family appears equally often across a set.
export function sheet(seed, index) {
  const r = prng((Math.imul(seed | 0, 2654435761) ^ Math.imul(index + 1, 40503)) >>> 0);
  const between = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const q = {
    m: 2 * between(6, 19), v: between(11, 29), m2: between(11, 29), a: 2 * between(1, 4), t: between(3, 9), d: between(11, 29),
    i: between(11, 19), r: between(21, 48), s1: between(2, 9), s2: between(2, 9), s3: between(2, 9), s4: between(2, 9),
  };
  const p = between(0, PRIMES.length - 2);
  q.p1 = PRIMES[p]; q.p2 = PRIMES[between(p + 1, PRIMES.length - 1)];
  const pick = (tier, n) => { const fams = of(tier); return Array.from({ length: n }, (_, k) => fams[(index * n + k) % fams.length]); };
  const tasks = [...pick('easy', 2), ...pick('climb', 4), ...pick('wall', 2)].map((family) => {
    const made = FAMILIES[family].make(q), ask = made.ask === undefined ? null : made.ask;
    return { id: `${family}:${seed}-${index}`, sheet: index, family, tier: FAMILIES[family].tier, statement: made.statement, ask, check: ask === null ? made.check : value(show(evaluate(ask).value)) };
  });
  return { index, numbers: q, tasks };
}
// set(seed, sheets) → the tasks of that many sheets, in the order a run works through them
export function set(seed, sheets) {
  const n = Number.isInteger(sheets) && sheets <= 200 ? sheets : 0;                // none, or fewer than none, makes no sheets
  return Array.from({ length: n }, (_, i) => sheet(seed, i)).flatMap((s) => s.tasks);
}
// own(text) → a visitor's own calculation as a task, or null: the finish line is the exact value of what they typed
export function own(text) {
  const e = typeof text === 'string' ? evaluate(text) : null;
  return e === null || e.ops === 0 ? null : { id: 'own', sheet: -1, family: 'own', tier: 'own', statement: `Work out ${e.shown}.`, ask: e.shown, check: value(show(e.value)) };
}

export default { FAMILIES, TIERS, sheet, set, own };
