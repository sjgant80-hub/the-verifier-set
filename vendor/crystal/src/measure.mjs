// measure.mjs — every number on the page, worked out from recorded crystals. Pure and total.
// A crystal is one problem's record from grow.mjs. A number here is a count of things that happened in a record, or
// a share of such counts; nothing is estimated.
import { mcnemar } from '../vendor/climb/vendor/stats.mjs';

const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
const list = (x) => (Array.isArray(x) ? x : []);
const rate = (n, d) => (d > 0 ? n / d : null);
// the middle value of a list of times (the lower of the two middle ones when the list is even), or null for none
const middle = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length === 0 ? null : s[(s.length - 1) >> 1]; };
const eventsOf = (r) => list(get(r, 'events')).filter((e) => e !== null && typeof e === 'object');
export const TIERS = ['easy', 'climb', 'wall'];

// measure(records) → the counts of a run
//   grown      problems that carry a calculation (the others have nothing to grow, and are counted apart as none)
//   complete   crystals that bonded all the way to their answer; wrong is how many of those answers were not right
//              (the law says none can be); dark is how many did not complete; capped is how many ran out of rounds
//   events     how many cells were set from what was held, bonded by the model, split, dissolved
//   calls      model calls; asked is cells put to the model; repeats is cells put to it twice in one problem
//   depth      rounds: the deepest crystal, the deepest that completed, and the mean
//   width      cells ready in the same round: the widest round, and the mean over rounds
//   classes    for each kind of step: how many were asked, and how many of those bonded, split, dissolved
//   whys       the bond-check's ruling on every reply, counted: bonded, wrong value, not a statement, another step,
//              too long (a record made before the ruling was kept counts under 'not recorded')
//   carried    calls whose conversation was the last one with one turn more, so the GPU could keep its work:
//              { calls, ms, fresh }: how many, and the middle time of such a call and of a call that began afresh
export function measure(records) {
  const rs = list(records).filter((r) => r !== null && typeof r === 'object'), grown = rs.filter((r) => typeof get(r, 'ask') === 'string');
  const events = { set: 0, bond: 0, split: 0, dissolve: 0 }, classes = {}, widths = [], whys = {}, warm = [], cold = [];
  let calls = 0, asked = 0, repeats = 0, prompt = 0, reply = 0, ms = 0;
  for (const r of grown) {
    const seen = new Set(), perTick = new Map();
    calls += Number(get(r, 'calls')) || 0;
    for (const e of eventsOf(r)) {
      if (events[e.kind] !== undefined) events[e.kind]++;
      perTick.set(e.tick, (perTick.get(e.tick) || 0) + 1);
      if (typeof e.said !== 'string') continue;
      asked++; prompt += Number(e.prompt) || 0; reply += Number(e.reply) || 0; ms += Number(e.ms) || 0;
      const why = typeof e.why === 'string' ? e.why : 'not recorded';
      whys[why] = (whys[why] || 0) + 1;
      (e.carried === true ? warm : cold).push(Number(e.ms) || 0);
      if (seen.has(e.canon)) repeats++;
      seen.add(e.canon);
      const c = classes[e.klass] || (classes[e.klass] = { asked: 0, bonded: 0, split: 0, dissolved: 0 });
      c.asked++;
      if (e.kind === 'bond') c.bonded++; else if (e.kind === 'split') c.split++; else if (e.kind === 'dissolve') c.dissolved++;
    }
    widths.push(...perTick.values());
  }
  const complete = grown.filter((r) => get(r, 'complete') === true), ticks = grown.map((r) => Number(get(r, 'ticks')) || 0);
  const part = (xs) => ({ problems: xs.length, complete: xs.filter((r) => get(r, 'complete') === true && get(r, 'home') === true).length });
  return {
    problems: rs.length, grown: grown.length, none: rs.length - grown.length,
    complete: complete.length, wrong: complete.filter((r) => get(r, 'home') !== true).length, dark: grown.length - complete.length, capped: grown.filter((r) => get(r, 'capped') === true).length,
    share: rate(complete.filter((r) => get(r, 'home') === true).length, grown.length),
    events, calls, asked, repeats, reused: rate(events.set, events.set + events.bond),
    depth: { deepest: Math.max(0, ...ticks), complete: Math.max(0, ...complete.map((r) => Number(get(r, 'ticks')) || 0)), mean: rate(ticks.reduce((a, b) => a + b, 0), ticks.length) },
    width: { widest: Math.max(0, ...widths), mean: rate(widths.reduce((a, b) => a + b, 0), widths.length) },
    classes, whys, carried: { calls: warm.length, ms: middle(warm), fresh: middle(cold) }, tokens: { prompt, reply }, seconds: ms / 1000,
    tiers: Object.fromEntries(TIERS.map((t) => [t, part(grown.filter((r) => get(r, 'tier') === t))])),
  };
}
// floor(classes, least) → the kinds of step the model got right nearly every time it was asked: at least `least`
// asked, and at least 19 in 20 bonded. These are the cells the crystal can stand on.
export function floor(classes, least = 10) {
  return Object.entries(classes && typeof classes === 'object' ? classes : {}).filter(([, c]) => c.asked >= least && c.bonded * 20 >= c.asked * 19).map(([k]) => k).sort();
}
// against(crystals, others, homeOf) → the same problems under the crystal and under another loop: how many only the
// crystal finished, how many only the other did, and the exact two-sided McNemar p. homeOf(record) says whether the
// other loop's record counts as finished. Only problems that carry a calculation and are in both are compared.
export function against(crystals, others, homeOf, tier) {
  const theirs = new Map(list(others).map((r) => [get(r, 'id'), r]));
  let both = 0, only = 0, other = 0, neither = 0;
  for (const r of list(crystals)) {
    if (typeof get(r, 'ask') !== 'string' || !theirs.has(get(r, 'id')) || (tier !== undefined && get(r, 'tier') !== tier)) continue;
    const a = get(r, 'complete') === true && get(r, 'home') === true, b = homeOf(theirs.get(r.id)) === true;
    if (a && b) both++; else if (a) only++; else if (b) other++; else neither++;
  }
  return { both, only, other, neither, compared: both + only + other + neither, p: mcnemar(other, only) };
}

export default { TIERS, measure, floor, against };
