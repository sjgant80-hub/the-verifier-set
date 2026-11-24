import { test } from 'node:test';
import assert from 'node:assert/strict';
import F from '../src/citefuzz.mjs';
import C from '../src/cite.mjs';
import T from '../src/tasks.mjs';
import { sha256 } from '../vendor/crystal/vendor/climb/src/sha256.mjs';
import { DOC, HOSTILE } from './citetable.mjs';

// every figure a dev problem asks its document for, with that document: some can be cited, some (absent, conflict) cannot
const PAIRS = T.set(20261201, 5).filter((t) => t.doc).flatMap((t) => t.slots.map((s) => ({ cell: { text: s.text }, doc: t.doc })));
const ALL = [...F.HARD, ...PAIRS], HARD_DOC = F.HARD[0].doc;
const fixed = (k) => () => k;
const c1 = F.place({ text: 'the unit price' }, DOC), c10 = F.place({ text: 'the rebate rate' }, DOC), cs = F.place({ text: 'the surcharge' }, HARD_DOC), cm = F.place({ text: 'the margin' }, HARD_DOC);
const CUT = 'the line\'s own number cut in two';

test('the evidential bond-check, attacked: no forgery bonds, no honest quote is refused, nothing bonds where nothing can be cited', () => {
  const r = F.fuzz(ALL, { seed: 20261124 });
  assert.equal(PAIRS.length, 122); assert.deepEqual(r.places, { open: 121, barred: 20 }); assert.deepEqual(r.budget, { forged: 54, honest: 12, noise: 36, barred: 40 }); assert.deepEqual(F.BUDGET, r.budget);
  assert.deepEqual([r.forged.bonded, r.forged.unsound, r.forged.outside, r.honest.refused, r.barred.bonded, r.split, r.threw], [0, 0, 0, 0, 0, 0, 0], JSON.stringify(r.found));
  assert.deepEqual(r.found, []); assert.equal(r.clean, true);
  assert.equal(r.honest.tried, 121 * 12); assert.equal(r.noise.tried, 121 * 36); assert.equal(r.barred.tried, 20 * 40); assert.ok(r.forged.tried > 121 * 45 && r.forged.tried + r.forged.own <= 121 * 54, String(r.forged.tried));
  assert.equal(r.tried, r.forged.tried + r.honest.tried + r.noise.tried + r.barred.tried); assert.equal(r.forged.tried, r.forged.rows.reduce((a, x) => a + x.tried, 0));
  assert.deepEqual(r.forged.rows.map((x) => x.name), Object.keys(F.FORGERIES)); assert.equal(r.forged.rows.length, 18);
  // every way is tried on every place it can be made for: the two that need a figure of two digits or a label of two are tried less
  for (const row of r.forged.rows) { assert.ok(row.tried >= (row.name === CUT ? 10 : 200), `${row.name}: ${row.tried}`); assert.equal(row.bonded, 0); assert.equal(row.kind, F.FORGERIES[row.name][0]); }
  assert.deepEqual(r.forged.rows.filter((x) => x.kind === 'outside').map((x) => x.name), ['quote marks that do not match', 'too long, or built to break a reader']);
  // some noise bonds, where the noise left an honest quote: both readers said so
  assert.ok(r.noise.bonded > 0 && r.noise.bonded < r.noise.tried / 4, String(r.noise.bonded));
  // the sample is the first eight replies of each arm for the first place that can be cited
  for (const arm of ['forged', 'honest', 'noise']) assert.equal(r.sample.filter((s) => s.arm === arm).length, 8, arm);
  for (const s of r.sample) { assert.deepEqual(Object.keys(s), ['cell', 'arm', 'way', 'reply', 'bond']); assert.equal(s.cell, 'the gate fee'); }
  assert.equal(ALL.find((p) => F.place(p.cell, p.doc).can).cell.text, 'the gate fee');
  assert.deepEqual(r.sample.filter((s) => s.arm === 'honest').map((s) => s.bond), new Array(8).fill(true)); assert.deepEqual(r.sample.filter((s) => s.arm === 'forged').map((s) => s.bond), new Array(8).fill(false));
  assert.deepEqual(r.sample.filter((s) => s.arm === 'forged').map((s) => s.way), Object.keys(F.FORGERIES).slice(0, 8), 'each way in turn, first');
});

test('every way of forging is tried on every place it can be made for, before any is drawn at random', () => {
  const once = (cell, doc) => F.fuzz([{ cell: { text: cell }, doc }], { seed: 5, budget: { forged: 18, honest: 0, noise: 0, barred: 0 } }).forged;
  assert.deepEqual(once('the rebate rate', DOC).rows.map((x) => x.tried), new Array(18).fill(1)); assert.deepEqual(once('the surcharge', HARD_DOC).rows.map((x) => x.tried), [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], 'a figure of one digit has no shorter figure');
  const one = once('the unit price', DOC); assert.deepEqual(one.rows.filter((x) => x.tried === 0).map((x) => x.name), [CUT], 'a label of one digit has no number to cut'); assert.equal(one.tried, 17);
  const more = F.fuzz([{ cell: { text: 'the rebate rate' }, doc: DOC }], { seed: 5, budget: { forged: 40, honest: 0, noise: 0, barred: 0 } }).forged; assert.ok(more.rows.every((x) => x.tried >= 1) && more.tried + more.own === 40 && more.rows.some((x) => x.tried >= 3));
  assert.equal(F.fuzz([{ cell: { text: 'the rebate rate' }, doc: DOC }], { seed: 5, budget: { forged: 3, honest: 0, noise: 0, barred: 0 } }).forged.rows.map((x) => x.tried).join(''), '111000000000000000');
});

test('the same seed makes the same attack again, to the last reply', () => {
  const some = ALL.slice(0, 26), a = F.fuzz(some, { seed: 7 }), b = F.fuzz(some, { seed: 7 }), c = F.fuzz(some, { seed: 8 });
  assert.deepEqual(a, b); assert.notDeepEqual(a.sample, c.sample); assert.equal(c.clean, true);
  const seen = [], spy = (reply, cell, doc) => { seen.push(`${cell.text}|${doc.id}|${reply}`); return C.read(reply, cell, doc); };
  const r = F.fuzz([...F.HARD, ...PAIRS.slice(0, 12), { cell: { text: 'the deposit paid' }, doc: DOC }, { cell: { text: 'the late fee' }, doc: DOC }, { cell: { text: 'the discount' }, doc: DOC }], { seed: 20261124, read: spy });
  assert.equal(seen.length, r.tried); assert.equal(r.clean, true);
  assert.equal(sha256(JSON.stringify(seen)), 'c065c95c248f9a2cc16124f4fb23c8791da721bab8afaad1642750af03d97d7a');
});

test('the hard cases: each is what it was written to be, and the harness is clean on them alone', () => {
  assert.equal(F.HARD.length, 19); assert.equal(F.HARD.filter((h) => h.can).length, 9);
  for (const h of F.HARD) { const c = F.place(h.cell, h.doc); assert.equal(c.can, h.can, h.cell.text); assert.equal(c.about.length >= 1, true, h.cell.text); assert.equal(F.plainly(c.about[0], h.cell, h.doc), h.can, h.cell.text); assert.equal(C.read(c.about[0], h.cell, h.doc) !== null, h.can, h.cell.text); }
  assert.deepEqual(F.HARD.filter((h) => !h.can).map((h) => F.place(h.cell, h.doc).why), ['no figure there', 'no figure there', 'no figure there', 'no figure there', 'no figure there', 'no figure there', 'no figure there', 'no figure there', 'no figure there', 'more than one figure there']);
  assert.deepEqual(F.HARD.filter((h) => h.can).map((h) => [F.place(h.cell, h.doc).label, F.place(h.cell, h.doc).figure]), [['11. ', '20'], ['13. ', '5'], ['(14) ', '7'], ['- ', '12.5'], ['* ', '1,250.50'], ['  15)  ', '0.75'], ['• ', '007'], ['1. ', '20'], ['2. ', '6']]);
  assert.ok(F.HARD[F.HARD.length - 1].doc.text.includes('\r\n'));
  const r = F.fuzz(F.HARD, { seed: 3 }); assert.deepEqual([r.places, r.clean, r.found], [{ open: 9, barred: 10 }, true, []]); assert.ok(r.forged.tried > 400 && r.barred.tried === 400 && r.honest.tried === 108);
});

test('a place to attack: what the document states, the line, its label, its figure, and the lines about other things', () => {
  assert.deepEqual({ ...c1, doc: null, all: c1.all.length, others: c1.others.length }, { cell: { text: 'the unit price' }, doc: null, keys: ['unit', 'price'], can: true, why: null, line: 'The unit price is 126 pounds per crate.', label: '1. ', figure: '126', at: 18, about: ['The unit price is 126 pounds per crate.'], others: 11, all: 12 });
  assert.equal(c1.line.slice(c1.at, c1.at + c1.figure.length), '126'); assert.ok(DOC.text.includes(`\n${c1.label}${c1.line}\n`)); assert.deepEqual([c10.label, cs.label, cm.label, F.place({ text: 'the warranty period' }, DOC).label], ['10. ', '(14) ', '  15)  ', '- ']);
  // of two lines about it, the one that gives the figure is the line to quote; the others are not "other lines"
  const dp = F.place({ text: 'the deposit paid' }, DOC); assert.deepEqual([dp.line, dp.label, dp.figure, dp.at, dp.about, dp.others.length], ['The deposit paid is 1,250.50 pounds.', '5. ', '1,250.50', 20, ['The deposit paid is 1,250.50 pounds.', 'The deposit paid is held by the Buyer.'], 10]);
  const back = F.place({ text: 'the fee' }, { text: 'The fee is set by the board.\n3. The fee is 20 pounds.' }); assert.deepEqual([back.line, back.label, back.at], ['The fee is 20 pounds.', '3. ', 11]);
  const lf = F.place({ text: 'the late fee' }, DOC); assert.deepEqual([lf.can, lf.why, lf.line, lf.label, lf.figure, lf.at, lf.about.length, lf.others.length], [false, 'more than one figure there', null, '', null, -1, 2, 10]);
  const no = F.place({ text: 'the discount' }, DOC); assert.deepEqual([no.can, no.why, no.about, no.others.length, no.all.length], [false, 'not in the document', [], 12, 12]); assert.equal(F.place({ text: 'the' }, DOC), null); for (const bad of HOSTILE) assert.equal(F.place(bad, DOC), null);
  const none = F.fuzz([{ cell: { text: 'the' }, doc: DOC }, null, 7, {}], { seed: 1 }); assert.deepEqual([none.places, none.tried, none.clean], [{ open: 0, barred: 0 }, 0, true]); for (const bad of [null, undefined, 7, 'x', {}]) assert.equal(F.fuzz(bad, null).tried, 0);
  const small = F.fuzz([{ cell: { text: 'the unit price' }, doc: DOC }, { cell: { text: 'the late fee' }, doc: DOC }], { seed: 3, budget: { forged: 6, honest: 2, noise: 0, barred: 5 } });
  assert.deepEqual([small.places, small.forged.tried, small.honest.tried, small.noise.tried, small.barred.tried, small.budget], [{ open: 1, barred: 1 }, 6, 2, 0, 5, { forged: 6, honest: 2, noise: 0, barred: 5 }]);
  assert.deepEqual(F.fuzz([{ cell: { text: 'the unit price' }, doc: DOC }], { budget: { forged: -1, honest: 1.5, noise: '3', barred: null } }).budget, F.BUDGET); assert.equal(F.fuzz([], { seed: -1 }).seed, 4294967295);
  // the sample comes from the first place that can be cited from and from no other, wherever it stands in the list
  const order = F.fuzz([{ cell: { text: 'the late fee' }, doc: DOC }, { cell: { text: 'the unit price' }, doc: DOC }, { cell: { text: 'the discount' }, doc: DOC }, { cell: { text: 'the order size' }, doc: DOC }], { seed: 3 });
  assert.deepEqual([...new Set(order.sample.map((s) => `${s.cell}/${s.arm}`))], ['the unit price/forged', 'the unit price/honest', 'the unit price/noise']); assert.equal(order.sample.length, 24);
  // a document with nothing in it, or no document: nothing to cite, nothing bonds, nothing throws
  const empty = F.fuzz([{ cell: { text: 'the unit price' }, doc: { text: '' } }, { cell: { text: 'the unit price' }, doc: null }], { seed: 1 }); assert.deepEqual([empty.places, empty.barred, empty.threw, empty.clean], [{ open: 0, barred: 2 }, { tried: 80, bonded: 0 }, 0, true]);
});

test('each way of forging is what its name says', () => {
  const made = (k, c = c1) => Object.fromEntries(Object.entries(F.FORGERIES).map(([name, [, make]]) => [name, make(fixed(k), c)]));
  const m0 = made(0), m1 = made(1);
  assert.deepEqual({ ...m0, 'too long, or built to break a reader': m0['too long, or built to break a reader'].length }, {
    'the figure cut short': 'The unit price is 1', 'the figure with its front cut off': '26 pounds per crate.', 'a word cut in two': 'he unit price is 126 pounds per crate.', 'the figure changed': 'The unit price is 127 pounds per crate.',
    'another line\'s figure in this line': 'The unit price is 12 pounds per crate.', 'a quote of another line': 'Supply agreement between the Supplier and the Buyer', 'two lines stitched': 'The unit price is the Supplier and the Buyer', 'the figure alone': '126',
    'the line with its figure left out': 'The unit price is', 'none, when it is there': 'none', 'the line in other letters': 'the unit price is 126 pounds per crate.', 'words round the quote': 'The document says: The unit price is 126 pounds per crate.',
    'a second line with it': 'The unit price is 126 pounds per crate.\nSupply agreement between the Supplier and the Buyer', 'the figure twice': 'The unit price is 126 126', 'another clause\'s number on the line': '99. The unit price is 126 pounds per crate.', [CUT]: null,
    'quote marks that do not match': '"The unit price is 126 pounds per crate.', 'too long, or built to break a reader': 340,
  });
  assert.deepEqual([m1['the figure cut short'], m1['the figure with its front cut off'], m1['a word cut in two'], m1['the figure changed'], m1['another line\'s figure in this line'], m1['the figure alone'], m1['the line with its figure left out'], m1['the line in other letters'], m1['the figure twice'], m1['another clause\'s number on the line']],
    ['The unit price is 12', '6 pounds per crate.', 'e unit price is 126 pounds per crate.', 'The unit price is 125 pounds per crate.', 'The unit price is 45 pounds per crate.', '126 pounds per crate', 'the unit price', 'THE UNIT PRICE IS 126 POUNDS PER CRATE.', '126 The unit price is 126 pounds per crate.', '(98) The unit price is 126 pounds per crate.']);
  assert.deepEqual([2, 3, 4].map((k) => made(k)['another clause\'s number on the line']), ['97) The unit price is 126 pounds per crate.', '0. The unit price is 126 pounds per crate.', 'Clause 4. The unit price is 126 pounds per crate.']);
  assert.deepEqual([c10, cs, cm].map((c) => F.FORGERIES[CUT][1](fixed(0), c)), ['0. The rebate rate is 12.5.', '4) The surcharge is £7.', '5)  The margin is 0.75 of cost.']);
  // none of them is an honest quote of the line, and the readers and the spelling check all say so
  for (const c of [c1, c10, cs, cm]) for (const k of [0, 1, 2, 3, 4, 5, 6, 7]) for (const [name, reply] of Object.entries(made(k, c))) if (reply !== null) { assert.equal(F.own(reply, c), false, `${name}: ${reply.slice(0, 60)}`); assert.equal(C.read(reply, c.cell, c.doc), null, name); assert.equal(F.plainly(reply, c.cell, c.doc), false, name); }
  // a line whose figure has one digit has no shorter figure to cut; a line with no label, or with this very label, has no other number to wear
  const one = F.place({ text: 'the fee' }, { id: 'x', text: 'The fee is 7 pounds.\nThe term is 12 months.' });
  assert.equal(F.FORGERIES['the figure cut short'][1](fixed(0), one), null); assert.equal(F.FORGERIES['the figure with its front cut off'][1](fixed(0), one), null); assert.equal(F.FORGERIES[CUT][1](fixed(0), one), null); assert.equal(F.FORGERIES[CUT][1](fixed(0), c1), null);
  assert.equal(F.FORGERIES['another clause\'s number on the line'][1](fixed(0), F.place({ text: 'the fee' }, { text: '99. The fee is 7 pounds.' })), null); assert.equal(F.FORGERIES['another clause\'s number on the line'][1](fixed(1), F.place({ text: 'the fee' }, { text: '99. The fee is 7 pounds.' })), '(98) The fee is 7 pounds.');
  assert.equal(F.FORGERIES['another line\'s figure in this line'][1](fixed(0), one), 'The fee is 12 pounds.'); assert.equal(F.FORGERIES['another line\'s figure in this line'][1](fixed(0), F.place({ text: 'the fee' }, { text: 'The fee is 7 pounds.' })), 'The fee is 8 pounds.');
  // own(): a run of the line's own words, with its own label or not, that holds every key word and the whole figure, and nothing else
  for (const t of ['The unit price is 126 pounds per crate.', 'unit price is 126', '"The unit price is 126 pounds"', 'The unit price is 126 pounds per crate', '1. The unit price is 126 pounds per crate.', '1. The unit price is 126', '. The unit price is 126']) assert.equal(F.own(t, c1), true, t);
  for (const t of ['The unit price is 12', 'price is 126', 'The unit price is', '126', '', 'he unit price is 126', 'The unit price is 126 p', 'the unit price is 126', '2. The unit price is 126', '1. The unit price is', null]) assert.equal(F.own(t, c1), false, String(t));
  for (const [t, want] of [['10. The rebate rate is 12.5', true], ['0. The rebate rate is 12.5', false], ['The rebate rate is 12', false], ['The rebate rate is 12.5.', true], ['rebate rate is 12.5', true], ['rate is 12.5', false]]) assert.equal(F.own(t, c10), want, t);
  // a quote may begin on the figure itself, and end on it
  const front = F.place({ text: 'the gate fee' }, { text: 'Terms\n1. 20 is the gate fee.' }), back = F.place({ text: 'the gate fee' }, { text: 'The gate fee is 20' });
  for (const [c, t, want] of [[front, '20 is the gate fee', true], [front, '1. 20 is the gate fee.', true], [front, '0 is the gate fee', false], [front, ' 20 is the gate', false], [back, 'The gate fee is 20', true], [back, 'gate fee is 20', true], [back, 'The gate fee is 2', false]]) { assert.equal(F.own(t, c), want, t); assert.equal(C.read(t, c.cell, c.doc) !== null, want, t); }
});

test('an honest quote holds the key words and the figure, begins and ends at the edge of a word; noise is an honest quote damaged', () => {
  const seen = new Set();
  let s = 5; const r = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s >>> 8; };
  for (const p of [...F.HARD, ...PAIRS.slice(0, 30)]) { const c = F.place(p.cell, p.doc); if (!c.can) continue; for (let i = 0; i < 60; i++) { const h = F.honest(r, c); seen.add(h); assert.ok(C.read(h, p.cell, p.doc) !== null, JSON.stringify(h)); assert.equal(F.plainly(h, p.cell, p.doc), true, JSON.stringify(h)); assert.equal(F.own(h, c), true, JSON.stringify(h)); } }
  const all = [...seen]; assert.ok(all.some((h) => h.startsWith('"')) && all.some((h) => h.startsWith('“')) && all.some((h) => h.endsWith('.')) && all.some((h) => h.startsWith('\n')) && all.some((h) => /^[a-z]/.test(h)), 'with and without marks, stops, white space, and begun inside the line');
  assert.ok(all.some((h) => /^\s*["'“‘]?\d\. [A-Z]/.test(h)) && all.some((h) => h.includes('(14) The')) && all.some((h) => h.includes('• The')) && all.some((h) => h.includes('  15)  The')) && all.some((h) => h.includes('\r')), 'and with the line\'s own label, of each kind');
  assert.equal(F.honest(fixed(0), c1), 'The unit price is 126'); assert.equal(F.honest(fixed(1), c1), 'unit price is 126 pounds'); assert.equal(F.honest(fixed(2), c1), ' "1. The unit price is 126 pounds per". '); assert.equal(F.honest(fixed(3), c1), '\n\'unit price is 126 pounds per crate\'\n');
  // a quote never begins or ends inside a number, even one the line does not read as a figure
  const lv = F.place({ text: 'the levy' }, HARD_DOC), levy = new Set(Array.from({ length: 400 }, () => F.honest(r, lv)));
  assert.ok(![...levy].some((h) => /^\W*2 the levy/.test(h)) && [...levy].some((h) => h.includes('v1.2 the levy')) && [...levy].some((h) => /^\W*the levy/.test(h)), 'never from the 2 of v1.2');
  const n = Array.from({ length: 300 }, () => F.noise(r, c1)); const kept = n.filter((x) => C.read(x, c1.cell, DOC) !== null).length; assert.ok(kept > 0 && kept < 100, String(kept));
  for (const x of n) assert.equal(C.read(x, c1.cell, DOC) !== null, F.plainly(x, c1.cell, DOC), JSON.stringify(x));
  assert.equal(F.rng, undefined, 'this harness draws from The Crystal\'s own seeded source and exports none of its own');
});

test('the harness has teeth: every reader with a leak planted in it is caught, DocDec\'s own span check among them', () => {
  const t = F.teeth(PAIRS.slice(0, 12), { seed: 7 });
  assert.equal(t.planted, 12); assert.equal(t.caught, 12, JSON.stringify(t.rows.filter((x) => !x.caught))); assert.deepEqual(t.rows.map((x) => x.name), Object.keys(F.PLANTED));
  for (const row of t.rows) { assert.equal(row.caught, true, row.name); assert.equal(typeof row.way, 'string'); assert.equal(typeof row.reply, 'string'); }
  // on the hard cases alone, with no corpus at all, every one is still caught: the result does not rest on the documents of a run
  const alone = F.teeth(null, { seed: 1, budget: { forged: 18, honest: 4, noise: 0, barred: 20 } }); assert.deepEqual([alone.planted, alone.caught], [12, 12], JSON.stringify(alone.rows.filter((x) => !x.caught)));
  // each leak is the leak its name says: one reply the planted reader takes and the bond-check does not
  const cell = { text: 'the unit price' }, P = F.PLANTED, leak = { 'finds the quote wherever its letters are (DocDec\'s span check, as vendored)': 'The unit price is 12', 'does not mind capitals': 'the unit price is 126 pounds per crate.', 'takes a quote of any line': 'The order size is 12 crates.',
    'takes the figure when the quote does not say what it is the figure of': '126 pounds', 'takes the line\'s figure when the quote holds none': 'The unit price is', 'takes any clause number with the line': '99. The unit price is 126 pounds per crate.', 'reads the first line of the reply only': 'The unit price is 126 pounds\nThe order size is 12 crates.', 'lets words round the quote go': 'The document says: The unit price is 126 pounds' };
  for (const [name, reply] of Object.entries(leak)) { assert.ok(P[name](reply, cell, DOC) !== null, name); assert.equal(C.read(reply, cell, DOC), null, name); }
  assert.equal(P['finds the quote wherever its letters are (DocDec\'s span check, as vendored)']('The unit price is 12', cell, DOC), '12', 'a figure the document does not give: 12 cut out of 126');
  // DocDec's reader has one leak, the span check: where the document cannot give the figure it takes nothing, even a line about it with one figure in it
  for (const [reply, what] of [['The late fee is 5 pounds.', 'the late fee'], ['By amendment, the late fee is 8 pounds.', 'the late fee'], ['The discount is 5 pounds.', 'the discount']]) assert.equal(P['finds the quote wherever its letters are (DocDec\'s span check, as vendored)'](reply, { text: what }, DOC), null, reply);
  assert.ok(P['does not look for a second figure']('The late fee is 5 pounds.', { text: 'the late fee' }, DOC) !== null); assert.equal(C.read('The late fee is 5 pounds.', { text: 'the late fee' }, DOC), null); assert.equal(P['does not look for a second figure']('The order size is 12 crates.', { text: 'the late fee' }, DOC), null);
  assert.equal(P['reads a figure whatever touches it']('The credit note is -40 pounds.', { text: 'the credit note' }, HARD_DOC), '40', 'the sign is lost'); assert.equal(C.read('The credit note is -40 pounds.', { text: 'the credit note' }, HARD_DOC), null);
  assert.equal(P['reads a figure whatever touches it']('The budget cap is 5 million pounds', { text: 'the budget cap' }, HARD_DOC), '5', 'five million read as five'); assert.equal(P['reads a figure whatever touches it']('The gate fee is 20 pounds.', { text: 'the budget cap' }, HARD_DOC), null);
  assert.equal(P['refuses everything']('The unit price is 126', cell, DOC), null); assert.throws(() => P['throws on a reply it cannot read']('The unit price is １２６', cell, DOC)); assert.doesNotThrow(() => P['throws on a reply it cannot read']('The unit price is 127', cell, DOC));
  // apart from its leak, each still takes the plain quote; on nothing, none takes anything, and none throws
  for (const name of Object.keys(P)) if (name !== 'refuses everything') assert.ok(P[name]('The unit price is 126 pounds per crate.', cell, DOC) !== null, name);
  for (const name of Object.keys(P)) for (const reply of ['', 'abc', 'none', 'The unit price is 127 pounds', 'xyz 999']) assert.equal(P[name](reply, cell, DOC), null, `${name} ← ${reply}`);
  for (const name of Object.keys(P)) for (const bad of HOSTILE) assert.doesNotThrow(() => P[name](bad, bad, bad), name);
  // a reader that throws is counted; a reader that takes everything bonds every forgery and every barred reply; a sound reader is clean
  const thrown = F.fuzz(PAIRS.slice(0, 3), { seed: 1, read: () => { throw new Error('x'); } }); assert.deepEqual([thrown.threw, thrown.clean, thrown.split, thrown.found[0].bond], [thrown.tried, false, 0, null]); assert.equal(thrown.found.length, 12);
  const lax = F.fuzz(PAIRS, { seed: 1, read: () => 1, budget: { forged: 20, honest: 2, noise: 2, barred: 5 } });
  assert.deepEqual([lax.forged.bonded, lax.barred.bonded, lax.honest.refused, lax.clean], [lax.forged.tried, lax.barred.tried, 0, false]); assert.ok(lax.forged.unsound > 0 && lax.forged.outside > 0 && lax.barred.tried === 50); assert.equal(lax.forged.unsound + lax.forged.outside, lax.forged.bonded); assert.ok(lax.split > lax.forged.bonded);
  assert.equal(F.fuzz(F.HARD, { seed: 1, read: C.read }).clean, true, 'the count is of leaks found, never assumed: the sound reader, put through as a reader, is clean');
});
