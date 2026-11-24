// tasks.mjs — the problems, made by code from a seed. No dataset is used and nothing describes a real person or firm.
//
// Each problem is a short document (an agreement of numbered clauses, one statement to a line) and a question about
// it, or a question that gives its own figures. A sheet of twelve holds one of each kind of thing that can happen,
// and each kind is checked by the check it is there to show:
//
//   computed       no document: a calculation alone (The Crystal's own kind of problem)                  → proven
//   cited          the answer is one figure the document states                                         → grounded
//   mixed ×3       figures from the document, then a calculation the question holds                    → grounded
//   absent         the document does not state a figure the question needs   → right outcome: no answer, and say so
//   conflict       the document states a needed figure twice, differently    → right outcome: no answer, and say so
//   misstated      the document states a figure wrongly. The answer that follows the document is grounded and wrong
//                  in the world: the case that shows why grounded is not proven.
//   coded          no document: a rule in words and its figures. The model writes the rule as a formula, which must
//                  pass the rule's tests (formula.mjs); then it is worked out                  → proven against its tests
//   coded-cited    the same, with the figures cited from a document                                    → grounded
//   decided        no document: what is given (some figures only between two), and a claim. The model writes the
//                  claim as a comparison; the solver decides it (logic.mjs)               → proven within its encoding
//   decided-cited  the same, with the exact figures cited from a document                              → grounded
//
// Every problem carries what its document (or its question) gives (check.value), so the finish line is exact. For a
// decided problem that is the verdict on the question's own claim. A misstated problem also carries what is true in
// the world (world), which nothing on the page can see from the document alone.
// Pure and total. The same seed always makes the same problems.
import { evaluate, show } from '../vendor/crystal/vendor/climb/src/exact.mjs';
import { stated } from './cite.mjs';
import { suite } from './formula.mjs';
import { decide, SIGN } from './logic.mjs';

const rng = (seed) => { let a = (Number(seed) || 0) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return (t ^ (t >>> 14)) >>> 0; }; };
const int = (R, lo, hi) => lo + (R() % (hi - lo + 1));
const pick = (R, xs) => xs[R() % xs.length];
const shuffle = (R, xs) => { const t = [...xs]; for (let i = t.length - 1; i > 0; i--) { const j = R() % (i + 1); [t[i], t[j]] = [t[j], t[i]]; } return t; };

// the three kinds of agreement: what each states (key → [the cell's words, the line, a range]), the letter each
// quantity goes by in a formula, the quantity that a decided question gives only between two figures, and what can
// be asked: [question, calculation, the rule in words]
export const KINDS = {
  supply: {
    title: 'Supply agreement between the Supplier and the Buyer',
    slots: { price: ['the unit price', (v) => `The unit price is ${v} pounds per crate.`, [12, 98]], crates: ['the order size', (v) => `The order size is ${v} crates.`, [11, 49]], delivery: ['the delivery charge', (v) => `The delivery charge is ${v} pounds.`, [15, 95]], deposit: ['the deposit paid', (v) => `The deposit paid is ${v} pounds.`, [20, 90]] },
    letters: { price: 'p', crates: 'c', delivery: 'd', deposit: 'e' }, ranged: 'crates',
    asks: [['What does the order cost before delivery?', '{price} × {crates}', 'the unit price times the order size'], ['What does the order cost with delivery?', '{price} × {crates} + {delivery}', 'the unit price times the order size, plus the delivery charge'], ['What is left to pay, with delivery, after the deposit?', '{price} × {crates} + {delivery} - {deposit}', 'the unit price times the order size, plus the delivery charge, less the deposit paid'], ['What does each crate cost, with the delivery charge shared out?', '{price} + {delivery} ÷ {crates}', 'the unit price, plus the delivery charge divided by the order size']],
  },
  service: {
    title: 'Service agreement between the Provider and the Client',
    slots: { fee: ['the monthly fee', (v) => `The monthly fee is ${v} pounds.`, [14, 96]], term: ['the term length', (v) => `The term length is ${v} months.`, [12, 36]], setup: ['the setup charge', (v) => `The setup charge is ${v} pounds.`, [25, 95]], credit: ['the loyalty credit', (v) => `The loyalty credit is ${v} pounds.`, [10, 60]] },
    letters: { fee: 'f', term: 't', setup: 's', credit: 'l' }, ranged: 'term',
    asks: [['What do the monthly fees come to over the term?', '{fee} × {term}', 'the monthly fee times the term length'], ['What does the service cost over the term, with setup?', '{fee} × {term} + {setup}', 'the monthly fee times the term length, plus the setup charge'], ['What does the service cost over the term, with setup, after the credit?', '{fee} × {term} + {setup} - {credit}', 'the monthly fee times the term length, plus the setup charge, less the loyalty credit'], ['What does each month cost, with the setup charge shared out?', '{fee} + {setup} ÷ {term}', 'the monthly fee, plus the setup charge divided by the term length']],
  },
  hire: {
    title: 'Hire agreement between the Owner and the Hirer',
    slots: { rate: ['the daily rate', (v) => `The daily rate is ${v} pounds.`, [13, 97]], days: ['the hire period', (v) => `The hire period is ${v} days.`, [11, 45]], callout: ['the collection charge', (v) => `The collection charge is ${v} pounds.`, [15, 85]], bond: ['the damage bond', (v) => `The damage bond is ${v} pounds.`, [30, 90]] },
    letters: { rate: 'r', days: 'n', callout: 'k', bond: 'b' }, ranged: 'days',
    asks: [['What does the hire cost for the period?', '{rate} × {days}', 'the daily rate times the hire period'], ['What does the hire cost for the period, with collection?', '{rate} × {days} + {callout}', 'the daily rate times the hire period, plus the collection charge'], ['What is owed for the period, with collection and the bond?', '{rate} × {days} + {callout} + {bond}', 'the daily rate times the hire period, plus the collection charge, plus the damage bond'], ['What does each day cost, with the collection charge shared out?', '{rate} + {callout} ÷ {days}', 'the daily rate, plus the collection charge divided by the hire period']],
  },
};
// lines that state nothing a question asks for: some hold a figure, some none
const FILLER = [(R) => `The warranty lasts ${int(R, 6, 24)} months.`, (R) => `Payment falls due within ${int(R, 7, 60)} days.`, (R) => `The late fee is ${int(R, 2, 9)} pounds a week.`, () => 'Either party may end this agreement in writing.', () => 'Nothing in this agreement changes the rights the law gives.', () => 'Disputes go first to a meeting of both parties.', (R) => `Insurance cover is ${int(R, 2, 9)},000 pounds.`, () => 'This agreement is the whole of what was agreed.'];
export const TIERS = ['computed', 'cited', 'mixed', 'absent', 'conflict', 'misstated', 'coded', 'coded-cited', 'decided', 'decided-cited'];
export const SHEET = ['computed', 'cited', 'mixed', 'mixed', 'mixed', 'absent', 'conflict', 'misstated', 'coded', 'coded-cited', 'decided', 'decided-cited'];
// the words of a relation in a claim, and its sign
export const RELATIONS = [['at least', '>='], ['more than', '>'], ['at most', '<='], ['less than', '<']];
export const VERDICTS = ['yes', 'no', 'it depends'];
// claimWords(words, relation, figure) → the claim in words: "the unit price times the order size, plus the delivery charge, comes to
// at least 300 pounds"
export const claimWords = (words, relation, figure) => `${words}${words.includes(',') ? ',' : ''} comes to ${relation} ${figure} pounds`;

const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
// document(R, kind, values, twist) → { id, text }: the agreement, its clauses in a drawn order, numbered. twist may
// leave a clause out ({ absent: key }) or state one a second time, differently ({ conflict: [key, other] }).
function document(R, kind, values, twist, id) {
  const K = KINDS[kind], keys = Object.keys(K.slots).filter((k) => k !== get(twist, 'absent'));
  const body = [...keys.map((k) => K.slots[k][1](values[k])), ...shuffle(R, FILLER).slice(0, 3).map((f) => f(R))];
  const clauses = shuffle(R, body);
  if (get(twist, 'conflict')) clauses.push(`By amendment, ${K.slots[twist.conflict[0]][1](twist.conflict[1]).replace(/^The /, 'the ')}`);
  return { id, text: [K.title, ...clauses.map((c, i) => `${i + 1}. ${c}`)].join('\n') };
}
const fill = (ask, values) => ask.replace(/\{(\w+)\}/g, (_, k) => String(values[k]));
const needs = (ask) => [...ask.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
// the rule of an ask: its letters with their words, its reference formula, the seed its tests are drawn from
const ruleOf = (K, ask, words, seed) => ({ names: Object.fromEntries(needs(ask).map((k) => [K.letters[k], K.slots[k][0]])), reference: ask.replace(/\{(\w+)\}/g, (_, k) => K.letters[k]), words, seed });
// the twelve rules a problem can ask for, with their tests drawn from one fixed seed: every attack on the formula
// check keeps them, whatever else it is given
export const RULES = Object.values(KINDS).flatMap((K) => K.asks.map(([, ask, words]) => ruleOf(K, ask, words, 20261212)));
// draw(R, K, ask) → a figure for each quantity, in its range; a quantity that is divided gets a multiple of what it
// is divided by, so every answer ends as a plain decimal
function draw(R, K, ask) {
  const values = Object.fromEntries(Object.entries(K.slots).map(([k, [, , [lo, hi]]]) => [k, int(R, lo, hi)])), split = /\{(\w+)\} ÷ \{(\w+)\}/.exec(ask);
  if (split) values[split[1]] = values[split[2]] * int(R, 1, 3);
  return values;
}
const plainValue = (text) => { const v = evaluate(text); return v === null ? null : show(v.value); };

// one problem of a tier. Every problem: { id, sheet, tier, kind, statement, doc, slots, ask, check, expect } and,
// for the tiers that use them, rule (coded), decide (decided) and given (the figures the question itself gives).
//   slots   the figures to cite, in order: [{ key, text }]; text is the cell put to the model ("the unit price")
//   ask     the calculation, with a {key} where each cited figure goes ('{price} × {crates} + {delivery}'), or
//           the calculation itself for a computed problem, or one {key} alone for a cited one
//   rule    { names: { letter: words }, reference, words, seed }: the rule the model is to write as a formula
//   decide  { names, given: { letter: figure | [least, greatest] } (cited figures left out), ranged, claim,
//           words, relation }: the claim the model is to write as a comparison, with the question's own encoding
//   check   { value } what the document (or the question) gives; for a decided problem, the verdict
//   expect  for a problem that must NOT be answered: { key, why } the figure that cannot be cited and the reason
function problem(R, tier, id, sheet) {
  if (tier === 'computed') {
    const a = int(R, 12, 98), b = int(R, 11, 49), c = int(R, 15, 95), ask = pick(R, [`${a} × ${b}`, `${a} × ${b} + ${c}`, `${a} × ${b} - ${c}`]);
    return { id, sheet, tier, kind: null, statement: `Work out ${ask}.`, doc: null, slots: [], ask, check: { value: show(evaluate(ask).value) }, expect: null };
  }
  const kind = pick(R, Object.keys(KINDS)), K = KINDS[kind];
  if (tier === 'coded' || tier === 'coded-cited') {
    const [question, ask, words] = pick(R, K.asks), values = draw(R, K, ask), rule = ruleOf(K, ask, words, int(R, 1, 2 ** 30)), used = needs(ask), value = plainValue(fill(ask, values));
    if (tier === 'coded') {
      const facts = used.map((k) => K.slots[k][1](values[k])).join(' ');
      return { id, sheet, tier, kind, statement: `${facts} ${question} It is ${words}.`, doc: null, slots: [], ask, rule, given: Object.fromEntries(used.map((k) => [K.letters[k], String(values[k])])), check: { value }, expect: null };
    }
    return { id, sheet, tier, kind, statement: `${question} It is ${words}.`, doc: document(R, kind, values, null, id), slots: used.map((k) => ({ key: k, text: K.slots[k][0] })), ask, rule, check: { value }, expect: null };
  }
  if (tier === 'decided' || tier === 'decided-cited') {
    const [, ask, words] = pick(R, K.asks), values = draw(R, K, ask), key = K.ranged, lo = values[key], hi = lo + int(R, 2, 8), used = needs(ask), rule = ruleOf(K, ask, words, 1);
    const given = Object.fromEntries(used.map((k) => [K.letters[k], k === key ? [String(lo), String(hi)] : String(values[k])])), question = { names: rule.names, given };
    // the figure the claim is about: one of a few near the least and the greatest the quantity can be, so that the
    // verdict comes out yes, no or it depends about equally, and sometimes lands exactly on an edge
    const [relWords, rel] = pick(R, RELATIONS), edges = [plainValue(fill(ask, { ...values, [key]: lo })), plainValue(fill(ask, { ...values, [key]: hi }))].map(Number).sort((a, b) => a - b);
    const figure = Math.max(0, pick(R, [Math.floor(edges[0]) - int(R, 1, 30), Math.floor(edges[0]), Math.ceil(edges[0]), Math.round((edges[0] + edges[1]) / 2), Math.floor(edges[1]), Math.ceil(edges[1]), Math.ceil(edges[1]) + int(R, 1, 30)]));
    const claim = `${rule.reference} ${SIGN[rel]} ${figure}`, verdict = decide(claim, question), range = K.slots[key][1](`from ${lo} to ${hi}`), cites = used.filter((k) => k !== key);
    // given: what the question itself gives (for decided-cited, the range alone: the rest is cited); full: every
    // figure the question's own claim is decided on, as the problem maker drew them
    const decide_ = { names: rule.names, given: tier === 'decided' ? given : Object.fromEntries(Object.entries(given).filter(([n]) => n === K.letters[key])), full: given, ranged: K.letters[key], claim, words, relation: relWords, figure: String(figure) };
    const ask_ = `Is it certain that ${claimWords(words, relWords, figure)}?`;
    if (tier === 'decided') return { id, sheet, tier, kind, statement: `${cites.map((k) => K.slots[k][1](values[k])).join(' ')} ${range} ${ask_}`, doc: null, slots: [], ask, decide: decide_, check: { value: verdict }, expect: null };
    return { id, sheet, tier, kind, statement: `If ${range.replace(/^The /, 'the ').replace(/\.$/, '')}: ${ask_.replace(/^Is/, 'is')}`, doc: document(R, kind, values, { absent: key }, id), slots: cites.map((k) => ({ key: k, text: K.slots[k][0] })), ask, decide: decide_, check: { value: verdict }, expect: null };
  }
  const values = draw(R, K, '');
  const [question, ask] = tier === 'cited' ? (() => { const k = pick(R, Object.keys(K.slots)); return [`What is ${K.slots[k][0]}?`, `{${k}}`]; })() : pick(R, K.asks);
  const split = /\{(\w+)\} ÷ \{(\w+)\}/.exec(ask);
  if (split) values[split[1]] = values[split[2]] * int(R, 1, 3);
  const used = needs(ask), slots = used.map((k) => ({ key: k, text: K.slots[k][0] }));
  const base = { id, sheet, tier, kind, statement: question, slots, ask, expect: null };
  if (tier === 'absent') { const gone = pick(R, used); return { ...base, doc: document(R, kind, values, { absent: gone }, id), check: { value: null }, expect: { key: gone, why: 'not in the document' } }; }
  if (tier === 'conflict') {
    const twice = pick(R, used), other = values[twice] + int(R, 1, 9);
    return { ...base, doc: document(R, kind, values, { conflict: [twice, other] }, id), check: { value: null }, expect: { key: twice, why: 'more than one figure there' } };
  }
  if (tier === 'misstated') {
    // the document's clause gives a figure with two digits the wrong way round; the world's figure is the other one
    const wrong = pick(R, used.filter((k) => String(values[k])[0] !== String(values[k])[1] && String(values[k])[1] !== '0')), said = Number(String(values[wrong]).split('').reverse().join(''));
    const inDoc = { ...values, [wrong]: said };
    return { ...base, doc: document(R, kind, inDoc, null, id), check: { value: plainValue(fill(ask, inDoc)), world: plainValue(fill(ask, values)) }, misstated: { key: wrong, document: said, world: values[wrong] } };
  }
  return { ...base, doc: document(R, kind, values, null, id), check: { value: plainValue(fill(ask, values)) } };
}
// set(seed, sheets) → the problems: `sheets` sheets of twelve, each sheet holding SHEET's tiers in a drawn order.
// A problem is drawn again (from the same stream) until it is sound: its document says exactly what the problem
// means it to, its answer ends as a plain decimal, a rule's tests can be made, a claim can be decided.
export function set(seed, sheets) {
  const R = rng(seed), out = [], n = Number.isInteger(sheets) ? sheets : 0;
  for (let s = 0; s < n; s++) for (const [i, tier] of shuffle(R, SHEET).entries()) {
    const id = `${tier}:${(Number(seed) || 0) >>> 0}-${s * SHEET.length + i + 1}`;
    for (let tries = 0; tries < 50; tries++) { const p = problem(R, tier, id, s); if (sound(p)) { out.push(p); break; } }
  }
  return out;
}
// a plain decimal: what a calculation that is grown can end in
const decimal = (v) => typeof v === 'string' && !v.includes('/');
// sound(p) → the problem says what it means to say, checked with the checks themselves
export function sound(p) {
  const tier = get(p, 'tier');
  if (tier === 'computed') return evaluate(p.ask) !== null && p.doc === null;
  if (tier === 'decided') return VERDICTS.includes(p.check.value) && p.doc === null;
  if (tier === 'coded') return decimal(p.check.value) && suite(p.rule).admitted && p.doc === null;
  const says = (get(p, 'slots') || []).map((s) => [s.key, stated({ text: s.text }, p.doc)]), bad = says.filter(([, st]) => st.figure === null);
  if (tier === 'decided-cited') return bad.length === 0 && VERDICTS.includes(p.check.value) && stated({ text: KINDS[p.kind].slots[KINDS[p.kind].ranged][0] }, p.doc).why === 'not in the document';
  if (tier === 'coded-cited' && !suite(p.rule).admitted) return false;
  if (p.expect === null) return bad.length === 0 && decimal(p.check.value) && (tier !== 'misstated' || p.check.value !== p.check.world);
  return bad.length === 1 && bad[0][0] === p.expect.key && bad[0][1].why === p.expect.why;
}
// asked(p, figures) → the calculation with the cited figures in place ('26 × 12 + 45'); figures: { key: text }
export const asked = (p, figures) => fill(get(p, 'ask') || '', figures || {});
// letters(p) → for a problem with a rule or a claim: which letter each of its quantities goes by, { key: letter }
export const letters = (p) => { const K = KINDS[get(p, 'kind')]; return K ? K.letters : {}; };

export default { KINDS, TIERS, SHEET, RELATIONS, VERDICTS, RULES, claimWords, set, sound, asked, letters };
