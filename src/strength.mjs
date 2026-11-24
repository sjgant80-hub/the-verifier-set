// strength.mjs — how true a facet is, and the one law that carries it through the lattice.
//
// A facet is one bonded step. Every bond is made by one kind of check, and each kind proves a different amount:
//
//   computed   exact arithmetic says the step follows                       PROVEN
//   logical    a solver says it follows from the premises as encoded        PROVEN WITHIN ITS ENCODING
//   executed   the code passed its tests                                    PROVEN AGAINST ITS TESTS
//   cited      the words are in the source, at a place anyone can check     GROUNDED (the source may be wrong)
//
// THE LAW: a facet is only as strong as the weakest bond it stands on, all the way down. A sum worked out exactly
// from a figure cited from a contract is GROUNDED, not proven: the arithmetic is proven, the figure is only cited,
// and the result can be no truer than the figure. Grounded is never reported as proven, and what is not known to be
// one of the four is reported as UNKNOWN, which is weaker than all of them.
//
// Pure and total: label() takes any list and never throws; a facet that stands on itself, or on a facet that is not
// there, is UNKNOWN, never proven.
const get = (o, k) => { try { return o[k]; } catch { return undefined; } };

// the four kinds of bond, and what each proves
export const TYPES = {
  computed: { strength: 'proven', check: 'exact arithmetic', says: 'was worked out by exact arithmetic' },
  logical: { strength: 'proven within its encoding', check: 'a solver', says: 'follows from its premises as they were encoded' },
  executed: { strength: 'proven against its tests', check: 'its tests', says: 'passed every test it was given' },
  cited: { strength: 'grounded', check: 'the source', says: 'was found word for word in a source' },
};
// every strength, weakest first. A facet's strength is the first of these that any bond beneath it has.
export const ORDER = ['unknown', 'grounded', 'proven against its tests', 'proven within its encoding', 'proven'];
export const rank = (strength) => Math.max(0, ORDER.indexOf(strength));
// weakest(strengths) → the weakest of them; a list with nothing in it has nothing to stand on and is unknown
export function weakest(strengths) {
  const list = Array.isArray(strengths) ? strengths : [];
  return list.length === 0 ? 'unknown' : ORDER[Math.min(...list.map(rank))];
}
const own = (type) => (Object.prototype.hasOwnProperty.call(TYPES, type) ? TYPES[type].strength : 'unknown');

// label(facets) → for each facet, in the same order: { type, own, strength, roots }
//   facets    [{ type, on }]: the kind of bond that made it, and the numbers of the facets it stands on (on may be
//             left out for a facet that stands on nothing; anything else that is not a list is not a known footing)
//   own       what its own bond proves
//   strength  the weakest of its own and of everything it stands on, all the way down (THE LAW)
//   roots     every kind of bond beneath it and its own, weakest first: what it stands on, to show on inspection
export function label(facets) {
  const list = Array.isArray(facets) ? facets : [], done = new Map(), open = new Set();
  const lost = { strength: 'unknown', roots: ['unknown'] };
  const at = (i) => {
    // a facet that is not there (a number past the list, or below it) reads as a facet of no known kind: unknown
    if (!Number.isInteger(i) || open.has(i)) return lost;
    if (done.has(i)) return done.get(i);
    open.add(i);
    const type = get(list[i], 'type'), mine = own(type), on = get(list[i], 'on'), under = on === undefined ? [] : Array.isArray(on) ? on.map(at) : [lost];
    open.delete(i);
    const roots = [...new Set([mine === 'unknown' ? 'unknown' : type, ...under.flatMap((u) => u.roots)])].sort((a, b) => rank(own(a)) - rank(own(b)));
    const out = { type: typeof type === 'string' ? type : null, own: mine, strength: weakest([mine, ...under.map((u) => u.strength)]), roots };
    done.set(i, out);
    return out;
  };
  return list.map((_, i) => at(i));
}
// tally(labels) → how many facets of each strength, every strength listed, so grounded and proven are never one count
export const tally = (labels) => Object.fromEntries(ORDER.map((s) => [s, (Array.isArray(labels) ? labels : []).filter((l) => get(l, 'strength') === s).length]));
// say(label) → one plain line: how true this facet is, and why it is no truer
export function say(l) {
  const strength = get(l, 'strength'), roots = Array.isArray(get(l, 'roots')) ? l.roots : [];
  if (strength === 'proven') return 'Proven: exact arithmetic all the way down.';
  const low = roots.find((r) => own(r) === strength);
  if (rank(strength) === 0 || low === undefined) return 'Unknown: it stands on something this build cannot name, so it is not counted as checked.';
  return `${strength[0].toUpperCase()}${strength.slice(1)}, not proven: it is, or it stands on, a step that ${TYPES[low].says}. It can be no truer than that.`;
}

export default { TYPES, ORDER, rank, weakest, label, tally, say };
