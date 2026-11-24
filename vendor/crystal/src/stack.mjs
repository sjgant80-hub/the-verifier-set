// stack.mjs — the watcher stack: the whole build as seven layers, each watching the one beneath it, and what each
// one put out in a run. The glass and the page draw this and nothing else: they do not guess what happened.
//
// A stack of watchers only works if it ends at both ends. This one does:
//   THE FLOOR    depth 0. Nothing is kept that does not come down to a step the model was asked and got exactly
//                right, by a check that is code. Leave the floor open and the stack makes things up.
//   THE CEILING  depth 6. A person. Nothing here changes the model. If a later build does, each change stops at a
//                person first. Leave the ceiling open and the stack rewrites its own floor with nobody looking.
// Every layer between is a small module that does one job, is tested alone, and has a limit it cannot run past
// (ends). Depth 5 is not built: it is the one layer that would change the floor, so it waits.
// Pure and total: stack() only reads counts that other kernels made.
import { LIMIT } from './bond.mjs';
import { BUDGET } from './fuzz.mjs';
import { SETTINGS, AGAIN } from './grow.mjs';
import { SITES } from './lattice.mjs';
import { floor } from './measure.mjs';

const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
const int = (x) => (Number.isInteger(x) ? x : null);
const held = (o, k) => { const v = get(o, k); return v !== null && typeof v === 'object' ? v : null; };
const pct = (n, d) => `${((n / d) * 100).toFixed(1)}%`;
const of = (n, d) => (int(n) === null || int(d) === null ? null : d === 0 ? `${n} of ${d}` : `${n} of ${d} (${pct(n, d)})`);
const each = Object.values(BUDGET).reduce((a, b) => a + b, 0);

// LAYERS → the seven layers: what each is, the module that is it, what it stops, and the limit it cannot run past
export const LAYERS = [
  { depth: 0, name: 'The substrate', module: 'the 1B model in the tab', job: 'Makes the replies. With the kinds of step it gets right nearly every time, it is the floor everything else stands on.', stops: null, ends: `a reply is cut off at ${SETTINGS.maxTokens} tokens`, status: 'built' },
  { depth: 1, name: 'The step watcher', module: 'src/bond.mjs', job: 'Rules on every reply. One plain statement of the cell\'s value, exactly right, bonds. Anything else does not.', stops: 'a made-up step', ends: `one reply, read once, ${LIMIT} characters at most`, status: 'built' },
  { depth: 2, name: 'The trajectory watcher', module: 'vendor/climb/src/left.mjs, plan.mjs', job: 'Holds what is left to do. A true line that is no step of the problem earns nothing. A step the model gets wrong is split into smaller ones.', stops: 'true lines that go nowhere, and going round in circles', ends: `a cell is asked once and split again at most ${AGAIN} times; a crystal has ${SETTINGS.maxTicks} rounds at most`, status: 'built' },
  { depth: 3, name: 'The topology watcher', module: 'src/grow.mjs, src/lattice.mjs', job: 'Grows every ready cell of a round, keeps what set so it is never grown twice, washes away what cannot be made smaller, and gives each cell its place.', stops: 'growing the same thing twice, and branches that cannot finish', ends: `${SITES.length} places in the lattice; the glass draws 8192 cells at most and slows to 12 frames a second while the model works`, status: 'built' },
  { depth: 4, name: 'The ceiling watcher', module: 'src/fuzz.mjs', job: 'Attacks the step watcher: forged replies made many ways, and a second reader written apart from it. Then it is turned on readers with a leak planted in each, to show it can find one.', stops: 'a check that lets something false through', ends: `${each} replies for each cell, from a seed`, status: 'built' },
  { depth: 5, name: 'The axiom-floor watcher', module: 'not built', job: 'Would train the model again on what the crystal proved, to move the wall out. It is the one layer that changes the floor all the others stand on, so it is not built here.', stops: 'a wall that never moves', ends: 'a new model would be kept only if it beat the old one on the sealed problems', status: 'parked' },
  { depth: 6, name: 'The human', module: 'a person', job: 'Nothing on this page changes the model, and nothing here is published as a sealed result until a person has run the seal and the check on it. If depth 5 is ever built, each new model stops here first.', stops: 'the stack changing its own floor with nobody looking', ends: 'always on', status: 'always on' },
];

// stack(F) → the seven layers with what each put out: LAYERS, each with emits: [{ label, value }]. A value of null
// is a thing not measured yet. F holds m (measure.mjs's counts of a run), fuzz and teeth (fuzz.mjs's counts),
// counts (lattice.mjs's counts of the same run) and seal (the seal's hash).
export function stack(F) {
  const m = held(F, 'm'), fz = held(F, 'fuzz'), th = held(F, 'teeth'), lc = held(F, 'counts'), seal = get(F, 'seal');
  const ev = get(m, 'events') || {}, whys = get(m, 'whys') || {}, carried = get(m, 'carried') || {}, forged = get(fz, 'forged') || {}, honest = get(fz, 'honest') || {};
  const sure = m === null ? [] : floor(get(m, 'classes')), asked = int(get(m, 'asked'));
  const said = Object.keys(whys).filter((k) => k !== 'bonded').sort().map((k) => `${k} ${whys[k]}`).join(', ');
  const cells = lc === null ? null : ['seed', 'bond', 'dissolve', 'dark', 'home'].reduce((a, k) => a + (int(lc[k]) ?? 0), 0);
  const emits = [
    [{ label: 'replies it gave', value: asked }, { label: 'kinds of step it gets right at least 19 times in 20', value: m === null ? null : sure.length === 0 ? 'none yet' : sure.join(', ') }],
    [{ label: 'replies that bonded', value: of(int(ev.bond), asked) }, { label: 'replies refused, by the reason', value: m === null ? null : said === '' ? 'none' : said }],
    [{ label: 'steps split smaller', value: int(ev.split) }, { label: 'steps washed away', value: int(ev.dissolve) }, { label: 'rounds in the deepest crystal', value: int(get(get(m, 'depth'), 'deepest')) }, { label: 'crystals that ran into the limit on rounds', value: int(get(m, 'capped')) }],
    [{ label: 'cells set from what was already held, with no model call', value: m === null ? null : of(int(ev.set), int(ev.set) + int(ev.bond)) }, { label: 'calls that carried the last conversation on', value: of(int(carried.calls), int(get(m, 'calls'))) },
      { label: 'middle time of a call carried on, and of one begun afresh', value: typeof carried.ms === 'number' && typeof carried.fresh === 'number' ? `${Math.round(carried.ms)} ms, ${Math.round(carried.fresh)} ms` : null },
      { label: 'cells ready in one round, at the widest', value: int(get(get(m, 'width'), 'widest')) }, { label: 'places filled in the lattice', value: cells === null ? null : of(cells - (int(lc.unplaced) ?? 0), SITES.length) }],
    [{ label: 'forged replies that bonded', value: of(int(forged.bonded), int(forged.tried)) }, { label: 'honest replies refused', value: of(int(honest.refused), int(honest.tried)) }, { label: 'replies the two readers ruled differently on', value: of(int(get(fz, 'split')), int(get(fz, 'tried'))) },
      { label: 'planted leaks found', value: of(int(get(th, 'caught')), int(get(th, 'planted'))) }],
    [],
    [{ label: 'the seal this page was built under', value: typeof seal === 'string' && seal !== '' ? seal.slice(0, 12) : null }],
  ];
  return LAYERS.map((layer, i) => ({ ...layer, emits: emits[i] }));
}

export default { LAYERS, stack };
