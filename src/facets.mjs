// facets.mjs — where every facet stands, and what it is made of. One labelled lattice for every kind of bond.
//
// The places are The Crystal's (vendor/crystal lattice: a diamond-type lattice, the memory's twelve chambers for
// direction, depth for distance). What this adds is the LABEL on every facet:
//
//   type      the kind of bond that made it: 'cited' (a figure quoted from a document), 'executed' (a rule written
//             as a formula that passed its tests), 'logical' (a claim the solver decided), or 'computed' (a step
//             worked out). A cited figure is drawn as its own kind of cell ('cite'), and so are a rule ('rule') and a
//             claim ('claim'); one that could not be bonded is a shattered cell with the reason on it.
//   strength  by THE LAW (strength.mjs): a facet is as strong as the weakest bond beneath it. Every step of a problem
//             that stands on a cited figure is grounded, and so is its answer; every step worked out from a tested
//             formula is proven against its tests; a verdict on a claim is proven within its encoding, or grounded
//             when the claim's figures were cited. Only a problem with none of these under it is proven.
//   material  0 proven, 1 grounded, 2 proven against its tests, 3 proven within its encoding: how the glass draws it,
//             so a crystal resting on cited ground, or on tests, or on an encoding, can be told at a glance from one
//             proven to the floor. soft is true for a grounded facet.
//   says      one plain line of how true the facet is and why it is no truer; source, for a cited figure, is the
//             place in its document.
// Nothing here decides anything: it reads finished records. Pure and total.
import { lattice as places } from '../vendor/crystal/src/lattice.mjs';
import { say, label, ORDER } from './strength.mjs';

const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
const list = (x) => (Array.isArray(x) ? x : []);
const str = (x) => (typeof x === 'string' ? x : '');
const object = (x) => x !== null && typeof x === 'object';
export const MATERIAL = { proven: 0, grounded: 1, 'proven against its tests': 2, 'proven within its encoding': 3 };
const TYPE = { cited: 'cited', rule: 'executed', claim: 'logical' };

// lattice(seed, records, tasks) → The Crystal's lattice of the same growth ({ cells, links, pulses, span, depth,
// counts }), every cell labelled, and counts extended with cited, rules, claims and a count for each strength.
export function lattice(seed, records, tasks) {
  const rs = list(records), byId = new Map(list(tasks).map((t) => [get(t, 'id'), t])), sources = new Map();
  // each problem as The Crystal's lattice reads one: its cited figures first, as the first round, then its rule or its
  // claim, then its steps
  const as = rs.map((r) => {
    const id = str(get(r, 'id')), cites = list(get(r, 'cites')).filter(object).map((c) => {
      if (c.value === null || c.value === undefined) return { tick: 1, kind: 'dissolve', cell: `${str(c.cell)}: ${str(c.why)}`, canon: `dark:${id}:${str(c.key)}`, klass: 'cited', value: null };
      const canon = `cited:${str(get(c.source, 'sha256'))}:${str(c.cell)}`;
      sources.set(canon, c.source ?? null);
      return { tick: 1, kind: c.kind === 'set' ? 'set' : 'bond', cell: str(c.cell), canon, klass: 'cited', value: str(c.value) };
    });
    const round = cites.length ? 2 : 1, made = [];
    for (const [klass, cell] of [['rule', get(r, 'rule')], ['claim', get(r, 'claim')]]) {
      if (!object(cell)) continue;
      // bonded, The Crystal's lattice writes it "cell = value": "rule = p × c + d", "p × c + d ≥ 300? = yes"
      const bonded = cell.value !== null && cell.value !== undefined, text = !bonded ? `${klass}: ${str(cell.why)}` : klass === 'rule' ? 'rule' : `${str(cell.claim)}?`;
      made.push({ tick: round, kind: bonded ? 'bond' : 'dissolve', cell: text, canon: `${klass}:${id}`, klass, value: bonded ? str(cell.value) : null });
    }
    const lift = round - 1 + made.length, steps = list(get(get(r, 'crystal'), 'events')).filter(object).map((e) => ({ ...e, tick: (Number(e.tick) || 0) + lift }));
    const task = byId.get(get(r, 'id'));
    return { ask: str(get(task, 'statement')) || str(get(r, 'ask')) || id, events: [...cites, ...made, ...steps], complete: get(r, 'complete') === true, answer: get(r, 'answer'), left: get(get(r, 'crystal'), 'left') ?? null, calls: get(r, 'calls') };
  });
  const L = places(seed, as);
  // THE LAW, per problem: what each problem stands on
  const bonded = (x) => object(x) && x.value !== null && x.value !== undefined;
  const under = rs.map((r) => ({ cited: list(get(r, 'cites')).some(bonded), rule: bonded(get(r, 'rule')), claim: bonded(get(r, 'claim')) }));
  const counts = { ...L.counts, cited: 0, rules: 0, claims: 0, ...Object.fromEntries(ORDER.map((s) => [s, 0])) };
  const cells = L.cells.map((c) => {
    const lit = c.kind === 'seed' || c.kind === 'bond' || c.kind === 'home', own = TYPE[c.klass] && c.kind === 'bond' ? c.klass : null, type = own ? TYPE[own] : 'computed', u = c.problem >= 0 ? under[c.problem] : { cited: false, rule: false, claim: false };
    // the facet, on the cited ground (0), the tested rule (1) and the decided claim (2) it stands on: a figure stands
    // on nothing; a rule on nothing; a claim on its figures; a step and the answer on all that is under the problem
    const on = own === 'cited' || own === 'rule' ? [] : [...(u.cited ? [0] : []), ...(u.rule && own === null ? [1] : []), ...(u.claim && own === null ? [2] : [])];
    const l = label([{ type: 'cited' }, { type: 'executed' }, { type: 'logical' }, { type, on }])[3], strength = lit ? l.strength : null;
    if (own === 'cited') counts.cited++; else if (own === 'rule') counts.rules++; else if (own === 'claim') counts.claims++;
    if (strength !== null) counts[strength]++;
    return { ...c, kind: own === 'cited' ? 'cite' : own ?? c.kind, type: lit ? type : null, strength, material: MATERIAL[strength] ?? 0, soft: strength === 'grounded', says: lit ? say(l) : null, source: own === 'cited' ? sources.get(c.canon) ?? null : null };
  });
  counts.bond -= counts.cited + counts.rules + counts.claims;
  return { ...L, cells, counts };
}

export default { MATERIAL, lattice };
