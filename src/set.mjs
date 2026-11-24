// set.mjs — the verifier set: the kinds of check this build can bond with, each with what it proves, what it stands
// on, how it says no, the watcher that attacks it, its limit, and what both put out in a run. The page draws this and
// nothing else about them.
//
// The reach of the whole engine is exactly the reach of these checks. Where none of them can check, nothing bonds,
// and the engine says it cannot tell. Four are in the design and four are built; each was added only with the harness
// that attacks it.
// Pure and total: verifiers() only reads counts that other kernels made.
import { TYPES } from './strength.mjs';
import { BUDGET as CITE_BUDGET } from './citefuzz.mjs';
import { BUDGET as RULE_BUDGET } from './formulafuzz.mjs';
import { BUDGET as CLAIM_BUDGET } from './logicfuzz.mjs';
import { BUDGET as SUM_BUDGET } from '../vendor/crystal/src/fuzz.mjs';
import { LIMIT as SUM_LIMIT } from '../vendor/crystal/src/bond.mjs';
import { LIMIT as CITE_LIMIT } from './cite.mjs';
import { LIMIT as RULE_LIMIT, DRAW } from './formula.mjs';
import { LIMIT as CLAIM_LIMIT } from './logic.mjs';

const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
const held = (o, k) => { const v = get(o, k); return v !== null && typeof v === 'object' ? v : null; };
const int = (x) => (Number.isInteger(x) ? x : null);
const of = (n, d) => (int(n) === null || int(d) === null ? null : d === 0 ? `${n} of ${d}` : `${n} of ${d} (${((n / d) * 100).toFixed(1)}%)`);
const sum = (b) => Object.values(b).reduce((a, x) => a + x, 0);
const reasons = (whys, m) => { const w = whys || {}, dark = Object.keys(w).filter((k) => k !== 'bonded').sort().map((k) => `${k} ${w[k]}`).join(', '); return m === null ? null : dark === '' ? 'none' : dark; };

export const VERIFIERS = [
  { type: 'computed', name: 'Computational', asks: 'Does this step follow?', check: 'vendor/crystal/src/bond.mjs', floor: 'the steps the model is asked and gets exactly right', strength: TYPES.computed.strength, no: 'the step is split smaller, or dissolves', watcher: 'vendor/crystal/src/fuzz.mjs', ends: `one reply, ${SUM_LIMIT} characters at most; attacked with ${sum(SUM_BUDGET)} replies a step`, status: 'built' },
  { type: 'cited', name: 'Evidential', asks: 'Is this figure in the source, where the source says it is?', check: 'src/cite.mjs', floor: 'the source documents', strength: TYPES.cited.strength, no: 'I can\'t find that in your documents', watcher: 'src/citefuzz.mjs', ends: `one quote, ${CITE_LIMIT} characters at most, asked once; attacked with up to ${sum(CITE_BUDGET) - CITE_BUDGET.barred} replies a figure`, status: 'built' },
  { type: 'logical', name: 'Logical', asks: 'Does this claim follow from what is given?', check: 'src/logic.mjs', floor: 'the claim as it was written for the solver, and what is given', strength: TYPES.logical.strength, no: 'the claim cannot be decided as written', watcher: 'src/logicfuzz.mjs', ends: `one comparison, ${CLAIM_LIMIT} characters at most, each quantity once; a small exact solver, not a general one; attacked with ${CLAIM_BUDGET.claims} claims a question`, status: 'built' },
  { type: 'executed', name: 'Executable', asks: 'Does this formula pass the rule\'s tests?', check: 'src/formula.mjs', floor: 'the rule\'s tests', strength: TYPES.executed.strength, no: 'it fails a test', watcher: 'src/formulafuzz.mjs', ends: `one formula, ${RULE_LIMIT} characters at most, four signs and brackets; at least ${DRAW.least} tests a rule; attacked with ${sum(RULE_BUDGET)} replies a rule`, status: 'built' },
];

// verifiers(F) → VERIFIERS, each with emits: [{ label, value }] (a value of null is a thing not measured yet). F holds
// m (counts.mjs's counts of a run), sums and sumTeeth (The Crystal's fuzz on the steps the run asked), cites and
// citeTeeth (citefuzz.mjs's counts on the figures the run asked), rules and ruleTeeth (formulafuzz.mjs's on the rules),
// claims and claimTeeth (logicfuzz.mjs's on the claims).
export function verifiers(F) {
  const m = held(F, 'm'), steps = held(m, 'steps'), ev = held(steps, 'events') || {}, cm = held(m, 'cites') || {}, rm = held(m, 'rules') || {}, lm = held(m, 'claims') || {};
  const sums = held(F, 'sums'), cites = held(F, 'cites'), rules = held(F, 'rules'), claims = held(F, 'claims'), st = held(F, 'sumTeeth'), ct = held(F, 'citeTeeth'), rt = held(F, 'ruleTeeth'), lt = held(F, 'claimTeeth');
  const sf = held(sums, 'forged') || {}, sh = held(sums, 'honest') || {}, cf = held(cites, 'forged') || {}, ch = held(cites, 'honest') || {}, cb = held(cites, 'barred') || {}, rf = held(rules, 'forged') || {}, rh = held(rules, 'honest') || {}, rl = held(rules, 'limit') || {};
  const emits = {
    computed: [{ label: 'steps the model stated that bonded', value: of(int(ev.bond), int(get(steps, 'asked'))) }, { label: 'forged replies that bonded', value: of(int(sf.bonded), int(sf.tried)) }, { label: 'honest replies refused', value: of(int(sh.refused), int(sh.tried)) },
      { label: 'replies its two readers ruled differently on', value: of(int(get(sums, 'split')), int(get(sums, 'tried'))) }, { label: 'planted leaks its harness found', value: of(int(get(st, 'caught')), int(get(st, 'planted'))) }],
    cited: [{ label: 'figures the model quoted that bonded', value: of(int(cm.bonded), int(cm.asked)) }, { label: 'figures not cited, by the reason', value: reasons(cm.whys, m) }, { label: 'forged quotes that bonded', value: of(int(cf.bonded), int(cf.tried)) },
      { label: 'honest quotes refused', value: of(int(ch.refused), int(ch.tried)) }, { label: 'replies that bonded where nothing can be cited', value: of(int(cb.bonded), int(cb.tried)) }, { label: 'replies its two readers ruled differently on', value: of(int(get(cites, 'split')), int(get(cites, 'tried'))) },
      { label: 'planted leaks its harness found', value: of(int(get(ct, 'caught')), int(get(ct, 'planted'))) }],
    logical: [{ label: 'claims the model wrote that were decided', value: of(int(lm.bonded), int(lm.asked)) }, { label: 'of those, with the question\'s own verdict', value: of(int(lm.matched), int(lm.bonded)) }, { label: 'claims not decided, by the reason', value: reasons(lm.whys, m) },
      { label: 'claims its solver and second procedure decided differently', value: of(int(get(claims, 'split')), int(get(claims, 'tried'))) }, { label: 'planted leaks its harness found', value: of(int(get(lt, 'caught')), int(get(lt, 'planted'))) }],
    executed: [{ label: 'formulas the model wrote that passed their tests', value: of(int(rm.bonded), int(rm.asked)) }, { label: 'formulas refused, by the reason', value: reasons(rm.whys, m) }, { label: 'different rules that bonded', value: of(int(rf.bonded), int(rf.tried)) },
      { label: 'honest formulas refused', value: of(int(rh.refused), int(rh.tried)) }, { label: 'near-misses a rule\'s tests let through', value: int(get(rules, 'weak')) === null ? null : String(rules.weak) }, { label: 'replies its two runners ruled differently on', value: of(int(get(rules, 'split')), int(get(rules, 'tried'))) },
      { label: 'the limit: formulas built from the tests that bonded', value: of(int(rl.bonded), int(rl.tried)) }, { label: 'planted leaks its harness found', value: of(int(get(rt, 'caught')), int(get(rt, 'planted'))) }],
  };
  return VERIFIERS.map((v) => ({ ...v, emits: emits[v.type] }));
}

export default { VERIFIERS, verifiers };
