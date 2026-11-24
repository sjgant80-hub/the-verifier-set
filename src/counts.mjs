// counts.mjs — every number on the page, counted from recorded problems (weave.mjs records). Pure and total.
// Nothing is estimated: each number is a count of things that happened in a record, or a share of such counts.
import { measure as crystals } from '../vendor/crystal/src/measure.mjs';
import { mcnemar } from '../vendor/crystal/vendor/climb/vendor/stats.mjs';
import { TIERS } from './tasks.mjs';
import { ORDER } from './strength.mjs';

const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
const list = (x) => (Array.isArray(x) ? x : []);
const rate = (n, d) => (d > 0 ? n / d : null);
const middle = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length === 0 ? null : s[(s.length - 1) >> 1]; };
const object = (x) => x !== null && typeof x === 'object';
// what an answer must be labelled, by THE LAW: the weakest kind of bond it stands on
const owed = (r) => (list(get(r, 'cites')).some((c) => object(c) && c.value !== null && c.value !== undefined) ? 'grounded' : object(get(r, 'rule')) && r.rule.value !== null ? 'proven against its tests' : object(get(r, 'claim')) && r.claim.value !== null ? 'proven within its encoding' : 'proven');

// measure(records, tasks) → the counts of a run. tasks are the problems the records answer (for what each document
// gives, what is true in the world, and what must be refused).
//   tiers      for each kind of problem: how many, how many reached an answer, how many came out as they should
//   answers    how many answers are of each strength; other: of none; collapsed: answers labelled other than THE LAW
//              says (stronger than the weakest bond they stand on: none can be)
//   wrong      answers that stand only on cited figures and exact steps, and are not what the problem's own document
//              gives (the checks say none can be). wrongTested: answers from a formula that passed its tests and are
//              not the rule's; wrongEncoded: verdicts on the model's claim that are not the question's own verdict
//   cites      figures put to the model: asked, bonded, dark (and why, counted), and set from what was held
//   reads      of the figures that WERE in the document: how many the model's quote bonded (can the model read?)
//   madeUp     of the figures that were NOT there to cite: how often the model offered a quote anyway (none bonded)
//   rules      rules put to the model: asked, bonded (the formula passed its tests), and why not, counted
//   claims     claims put to the model: asked, bonded (decided), matched (the verdict is the question's own), whys
//   misstated  problems whose document states a figure wrongly: answered, following the document, differing from
//              what is true, and labelled grounded
//   facets     every bond of every problem, by strength: each strength its own count
//   steps      The Crystal's own counts over the calculations that were grown (vendor/crystal measure)
export function measure(records, tasks) {
  const rs = list(records).filter(object), byId = new Map(list(tasks).map((t) => [get(t, 'id'), t]));
  const tiers = Object.fromEntries(TIERS.map((t) => [t, { problems: 0, answered: 0, home: 0 }])), whys = {}, ruleWhys = {}, claimWhys = {}, warm = [], cold = [];
  const out = { problems: rs.length, home: 0, answers: { ...Object.fromEntries(ORDER.slice(1).map((s) => [s, 0])), other: 0, collapsed: 0 }, wrong: 0, wrongTested: 0, wrongEncoded: 0, cites: { asked: 0, bonded: 0, dark: 0, set: 0, whys }, reads: { there: 0, bonded: 0 }, madeUp: { notThere: 0, saidNone: 0, offered: 0, bonded: 0 }, rules: { asked: 0, bonded: 0, whys: ruleWhys }, claims: { asked: 0, bonded: 0, matched: 0, whys: claimWhys }, misstated: { problems: 0, answered: 0, followDocument: 0, differFromWorld: 0, grounded: 0 }, facets: Object.fromEntries(ORDER.map((s) => [s, 0])), calls: 0, seconds: 0, tiers };
  for (const r of rs) {
    const task = byId.get(get(r, 'id')) || null, tier = tiers[get(r, 'tier')], complete = get(r, 'complete') === true, home = get(r, 'home') === true, strength = get(r, 'strength');
    if (tier) { tier.problems++; if (complete) tier.answered++; if (home) tier.home++; }
    if (home) out.home++;
    out.calls += Number(get(r, 'calls')) || 0;
    const cites = list(get(r, 'cites')).filter(object), rule = object(get(r, 'rule')) ? r.rule : null, claim = object(get(r, 'claim')) ? r.claim : null, want = get(get(task, 'check'), 'value');
    if (complete) {
      if (Object.prototype.hasOwnProperty.call(out.answers, strength) && strength !== 'other' && strength !== 'collapsed') out.answers[strength]++; else out.answers.other++;
      if (strength !== owed(r)) out.answers.collapsed++;
      const off = typeof want !== 'string' || get(r, 'answer') !== want;
      if (off) { if (claim !== null) out.wrongEncoded++; else if (rule !== null) out.wrongTested++; else out.wrong++; }
    }
    const expect = get(task, 'expect') || null;
    for (const c of cites) {
      if (c.kind === 'set') { out.cites.set++; continue; }
      out.cites.asked++; out.seconds += (Number(c.ms) || 0) / 1000;
      (c.carried === true ? warm : cold).push(Number(c.ms) || 0);
      const why = typeof c.why === 'string' ? c.why : 'not recorded';
      whys[why] = (whys[why] || 0) + 1;
      const bonded = c.kind === 'bond';
      if (bonded) out.cites.bonded++; else out.cites.dark++;
      // was the figure there to cite? The problem's maker says which figure is not (expect); every other one is
      if (expect !== null && expect.key === c.key) { out.madeUp.notThere++; if (/^\s*["'“‘]?none["'”’]?\.?\s*$/i.test(String(c.said ?? '')) || String(c.said ?? '').trim() === '') out.madeUp.saidNone++; else out.madeUp.offered++; if (bonded) out.madeUp.bonded++; } else { out.reads.there++; if (bonded) out.reads.bonded++; }
    }
    for (const [cell, into, hows] of [[rule, out.rules, ruleWhys], [claim, out.claims, claimWhys]]) {
      if (cell === null) continue;
      into.asked++; out.seconds += (Number(cell.ms) || 0) / 1000;
      const why = typeof cell.why === 'string' ? cell.why : 'not recorded';
      hows[why] = (hows[why] || 0) + 1;
      if (cell.value !== null && cell.value !== undefined) { into.bonded++; if (cell === claim && cell.value === want) into.matched++; }
    }
    if (get(r, 'tier') === 'misstated') {
      out.misstated.problems++;
      if (complete) { out.misstated.answered++; if (get(r, 'answer') === want) out.misstated.followDocument++; if (get(r, 'answer') !== get(get(task, 'check'), 'world')) out.misstated.differFromWorld++; if (strength === 'grounded') out.misstated.grounded++; }
    }
    for (const s of ORDER) out.facets[s] += Number(get(get(r, 'facets'), s)) || 0;
  }
  // The Crystal's own counter takes each record's calculation, and passes over a record that has none
  out.steps = crystals(rs.map((r) => get(r, 'crystal'))); out.seconds += out.steps.seconds;
  out.cites.carried = { calls: warm.length, ms: middle(warm), fresh: middle(cold) };
  out.reads.share = rate(out.reads.bonded, out.reads.there);
  return out;
}
// against(records, others) → the same problems with the checks and with nothing checking: others are one-try
// records { id, right } (the model given the document and the question, answering in one go). How many only the
// lattice brought home, how many only the one try got right, and the exact two-sided McNemar p.
export function against(records, others) {
  const theirs = new Map(list(others).map((o) => [get(o, 'id'), o]));
  let both = 0, only = 0, other = 0, neither = 0;
  for (const r of list(records)) {
    if (!theirs.has(get(r, 'id'))) continue;
    const a = get(r, 'home') === true, b = get(theirs.get(r.id), 'right') === true;
    if (a && b) both++; else if (a) only++; else if (b) other++; else neither++;
  }
  return { both, only, other, neither, compared: both + only + other + neither, p: mcnemar(other, only) };
}

export default { measure, against };
