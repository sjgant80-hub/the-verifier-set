// score.mjs — every number on the page, worked out from the recorded runs. Pure and total.
// A problem is "home by pass d" when the checker ruled its answer right at pass d or earlier. For the naive loop,
// which no checker stops, the question is different: is the answer it holds at pass d right (it can lose a right one)?
import { mcnemar } from '../vendor/stats.mjs';

const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
const list = (x) => (Array.isArray(x) ? x : []);
const rate = (n, d) => (d > 0 ? n / d : null);
export const TIERS = ['easy', 'climb', 'wall'];

// homeBy(rec, d) → true when this record counts as right at depth d
export function homeBy(rec, d) {
  const passes = list(get(rec, 'passes'));
  if (get(rec, 'arm') === 'naive') { const p = passes[Math.min(d, passes.length) - 1]; return get(p, 'home') === true; }
  const at = get(rec, 'homeAt');
  return Number.isInteger(at) && at <= d;
}
// curve(records, depth) → the share right at each depth 1..depth
export function curve(records, depth) {
  const rs = list(records);
  return Array.from({ length: depth }, (_, i) => rate(rs.filter((r) => homeBy(r, i + 1)).length, rs.length));
}
// cost(records) → what the loop costs: its passes (each one is a model call when the loop runs by itself), and the
// tokens and model time of those passes. calls is how many of them this run had to ask the model for: a
// conversation another loop of the same run had already had is not asked for twice.
export function cost(records) {
  const passes = list(records).flatMap((r) => list(get(r, 'passes')));
  const sum = (k) => passes.reduce((a, p) => a + (Number(get(p, k)) || 0), 0);
  return { passes: passes.length, calls: passes.filter((p) => get(p, 'cached') !== true).length, replyTokens: sum('reply'), promptTokens: sum('prompt'), seconds: sum('ms') / 1000, passesPerTask: rate(passes.length, list(records).length) };
}
// summary(records, depth) → one loop's results: overall and by tier
export function summary(records, depth) {
  const rs = list(records);
  const part = (xs) => { const c = curve(xs, depth); return { tasks: xs.length, first: c[0] ?? null, solved: c[depth - 1] ?? null, home: xs.filter((r) => homeBy(r, depth)).length, curve: c }; };
  return { arm: get(rs[0], 'arm') || null, depth, ...part(rs), tiers: Object.fromEntries(TIERS.map((t) => [t, part(rs.filter((r) => get(r, 'tier') === t))])), cost: cost(rs) };
}
// paired(a, b, depth, tier) → problems only B got home, only A got home, and the exact two-sided McNemar p
export function paired(a, b, depth, tier) {
  const keep = (r) => tier === undefined || get(r, 'tier') === tier;
  const A = new Map(list(a).filter(keep).map((r) => [get(r, 'id'), homeBy(r, depth)]));
  let aOnly = 0, bOnly = 0, both = 0, neither = 0;
  for (const r of list(b).filter(keep)) {
    if (!A.has(get(r, 'id'))) continue;
    const x = A.get(get(r, 'id')), y = homeBy(r, depth);
    if (x && y) both++; else if (x) aOnly++; else if (y) bOnly++; else neither++;
  }
  return { aOnly, bOnly, both, neither, p: mcnemar(aOnly, bOnly) };
}
// squares(c) → does the share NOT home shrink like a squaring from one pass to the next? For each step: the share
// left after it, the square of the share left before it, and whether the first is at most the second. Shares are
// compared to twelve decimal places, so a share that is exactly the square counts as holding.
const twelve = (x) => Math.round(x * 1e12) / 1e12;
export function squares(c) {
  const left = list(c).map((s) => (s === null ? null : 1 - s));
  const steps = [];
  for (let d = 1; d < left.length; d++) if (left[d] !== null && left[d - 1] !== null) steps.push({ from: d, to: d + 1, before: left[d - 1], after: left[d], square: left[d - 1] ** 2, holds: twelve(left[d]) <= twelve(left[d - 1] ** 2) });
  return { steps, holds: steps.length > 0 && steps.every((s) => s.holds) };
}
// rot(records, depth) → for a loop no checker stops: how many problems held a right answer at some pass and a wrong one at the end
export function rot(records, depth) {
  let lost = 0, gained = 0;
  for (const r of list(records)) {
    const first = homeBy(r, 1), last = homeBy(r, depth), ever = list(get(r, 'passes')).some((p) => get(p, 'home') === true);
    if (ever && !last) lost++;
    if (!first && last) gained++;
  }
  return { lost, gained };
}
// reuse(pairs) → what reusing the earlier turns saved: each pair is one pass run twice, once continuing the
// conversation and once from nothing. factor = time to first word from nothing ÷ time continuing.
export function reuse(pairs) {
  const ok = list(pairs).filter((p) => Number(get(p, 'fresh')) > 0 && Number(get(p, 'kept')) > 0);
  const fresh = ok.reduce((a, p) => a + p.fresh, 0), kept = ok.reduce((a, p) => a + p.kept, 0);
  return { pairs: ok.length, fresh, kept, factor: kept > 0 ? fresh / kept : null, same: ok.filter((p) => p.same === true).length };
}

export default { TIERS, homeBy, curve, cost, summary, paired, squares, rot, reuse };
