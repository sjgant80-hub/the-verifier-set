import { test } from 'node:test';
import assert from 'node:assert/strict';
import C from '../src/cite.mjs';
import X from '../vendor/crystal/vendor/climb/src/exact.mjs';
import { sha256 } from '../vendor/crystal/vendor/climb/src/sha256.mjs';

import F from '../src/citefuzz.mjs';
import { DOC, TABLE, ODD, HOSTILE } from './citetable.mjs';

const HARD = F.HARD[0].doc, CRLF = F.HARD[F.HARD.length - 1].doc;

const why = (reply, cell, doc = DOC) => C.judge(reply, { text: cell }, doc).why;

test('the rule, case by case', () => {
  for (const [reply, cell, ruling] of TABLE) assert.equal(why(reply, cell), ruling, `${JSON.stringify(cell)} ← ${JSON.stringify(reply.slice(0, 70))}`);
  assert.deepEqual([...new Set(TABLE.map((r) => r[2]))].sort(), ['a quote of another line', 'bonded', 'more than one figure there', 'no figure there', 'not a question of the document', 'not a quote of the document', 'not in the document', 'the model says it is not there', 'the quote does not hold the figure', 'the quote does not name what was asked', 'too long']);
  for (const [reply, cell, ruling] of ODD) assert.equal(why(reply, cell, HARD), ruling, `${JSON.stringify(cell)} ← ${JSON.stringify(reply)}`);
  assert.ok(ODD.length >= 38); for (const h of F.HARD) assert.equal(C.stated(h.cell, h.doc).figure !== null, h.can, h.cell.text);
  assert.ok(TABLE.length >= 70); assert.equal(C.LIMIT, 300);
});

test('a bond gives the document\'s own figure and the place it stands, and nothing when it does not bond', () => {
  const r = C.judge('unit price is 126 pounds', { text: 'the unit price' }, DOC);
  assert.deepEqual(r.value, { n: 126n, d: 1n }); assert.deepEqual(r.source, { doc: 'd1', sha256: sha256(DOC.text), start: 59, end: 83, text: 'unit price is 126 pounds', line: 'The unit price is 126 pounds per crate.' });
  assert.equal(DOC.text.slice(r.source.start, r.source.end), r.source.text, 'the offsets are into the document, for anyone to check');
  assert.equal(X.show(C.read('The deposit paid is 1,250.50 pounds.', { text: 'the deposit paid' }, DOC)), '1250.5'); assert.equal(X.show(C.read('The rebate rate is 12.5.', { text: 'the rebate rate' }, DOC)), '12.5');
  for (const [reply, cell, ruling] of TABLE) {
    const j = C.judge(reply, { text: cell }, DOC);
    if (ruling === 'bonded') { assert.equal(DOC.text.slice(j.source.start, j.source.end), j.source.text); assert.ok(j.source.text.includes(X.show(j.value)) || j.source.text.includes('1,250.50')); assert.equal(j.source.sha256, sha256(DOC.text)); assert.ok(DOC.text.includes(j.source.line)); }
    else assert.deepEqual([j.value, j.source], [null, null], reply);
  }
  // the figure is the document's: the same quote on a document that says otherwise gives that document's figure, or nothing
  const other = { id: 'd2', text: DOC.text.replace('126 pounds', '621 pounds') };
  assert.equal(C.read('The unit price is 126 pounds', { text: 'the unit price' }, other), null); assert.equal(X.show(C.read('The unit price is 621 pounds', { text: 'the unit price' }, other)), '621');
  assert.equal(C.judge('The unit price is 621', { text: 'the unit price' }, { text: other.text }).source.doc, null, 'a document with no name is cited by its hash alone');
  // the same figure stated twice is no disagreement, and either line may be quoted; the quote may stand in both
  const twice = { id: 'd3', text: 'The fee is 20 pounds.\nNote that the fee is 20 pounds.\nThe fee is 20 pounds.' };
  assert.equal(why('The fee is 20 pounds.', 'the fee', twice), 'bonded'); assert.equal(why('Note that the fee is 20', 'the fee', twice), 'bonded'); assert.equal(C.judge('The fee is 20 pounds.', { text: 'the fee' }, twice).source.start, 0);
  assert.equal(C.judge('the fee is 20 pounds', { text: 'the fee' }, twice).source.start, 32, 'the first place it stands as a quote: the capital T lines do not hold it');
  // the limit is 300 characters, exactly: a quote of 300 is read, a quote of 301 is too long
  for (const [n, ruling] of [[299, 'bonded'], [300, 'bonded'], [301, 'too long'], [302, 'too long']]) { const line = `The fee is 20 pounds ${'a'.repeat(n - 21)}`; assert.equal(line.length, n); assert.equal(why(line, 'the fee', { text: `Terms\n${line}\nEnd` }), ruling, String(n)); assert.equal(why(`"${line}".`, 'the fee', { text: line }), ruling, 'the marks round it are not counted'); }
  // a quote that stands in two lines bonds from the one where it holds the figure, wherever that line comes
  for (const text of ['The fee is 20-day based.\nThe fee is 20 pounds.', 'The fee is 20 pounds.\nThe fee is 20-day based.']) {
    const j = C.judge('The fee is 20', { text: 'the fee' }, { id: 'd4', text }); assert.equal(j.why, 'bonded'); assert.equal(j.source.line, 'The fee is 20 pounds.'); assert.equal(text.slice(j.source.start, j.source.end + 7), 'The fee is 20 pounds'); assert.equal(X.show(j.value), '20');
  }
  assert.equal(why('The fee is 20-day', 'the fee', { text: 'The fee is 20-day based.\nThe fee is 20 pounds.' }), 'the quote does not hold the figure');
  // the figure is the line's own, whole: 20.00 is 20, a label's number is never it, and a quote with its label gives the same place in the document
  assert.equal(X.show(C.read('the gate fee is 20.00', { text: 'the gate fee' }, HARD)), '20'); assert.equal(X.show(C.read('• The quota is 007', { text: 'the quota' }, HARD)), '7'); assert.equal(X.show(C.read('The reserve is (1,250.50).', { text: 'the reserve' }, HARD)), '1250.5');
  const lab = C.judge('5. The deposit paid is 1,250.50 pounds.', { text: 'the deposit paid' }, DOC); assert.equal(X.show(lab.value), '1250.5'); assert.equal(DOC.text.slice(lab.source.start, lab.source.end), '5. The deposit paid is 1,250.50 pounds'); assert.equal(lab.source.line, 'The deposit paid is 1,250.50 pounds.');
  // line ends from another system: the line is still a line and its figure still a figure
  const cr = C.judge('1. The stall fee is 20 pounds.\r', { text: 'the stall fee' }, CRLF); assert.equal(cr.why, 'bonded'); assert.equal(X.show(cr.value), '20'); assert.equal(why('The stall term is 6 months.\r\n', 'the stall term', CRLF), 'bonded');
});

test('what the document says, with no model: stated()', () => {
  const s = (cell, doc = DOC) => { const r = C.stated({ text: cell }, doc); return [r.why, r.figure ? r.figure.text : null, r.at.length]; };
  assert.deepEqual(s('the unit price'), [null, '126', 1]); assert.deepEqual(s('the deposit paid'), [null, '1,250.50', 2], 'a line about it with no figure is no disagreement');
  assert.deepEqual(s('the late fee'), ['more than one figure there', null, 2]); assert.deepEqual(s('the notice period'), ['more than one figure there', null, 1]); assert.deepEqual(s('the discount'), ['not in the document', null, 0]);
  assert.deepEqual(s('the cover level'), ['no figure there', null, 1]); assert.deepEqual(s('the'), ['not a question of the document', null, 0]); assert.deepEqual(C.stated({ text: 'the unit price' }, DOC).keys, ['unit', 'price']);
  const f = C.stated({ text: 'the unit price' }, DOC).figure; assert.equal(DOC.text.slice(f.start, f.end), '126');
  // every word of the cell must be in the line, as a whole word
  assert.deepEqual(s('the unit'), [null, '126', 1]); assert.deepEqual(s('the unit cost'), ['not in the document', null, 0]); assert.deepEqual(s('the uni price'), ['not in the document', null, 0]); assert.deepEqual(s('prices'), ['not in the document', null, 0]);
  // key words: lower case, no stop words, each once
  assert.deepEqual(C.terms({ text: 'What is the Unit Price of the unit?' }), ['unit', 'price']); assert.equal(C.terms({ text: 'what is the' }), null); assert.equal(C.terms({ text: '12 34' }), null); for (const bad of HOSTILE) assert.equal(C.terms(bad), null);
  assert.ok(C.STOP.includes('the') && C.STOP.includes('what') && !C.STOP.includes('price'));
});

test('figures, lines and quotes are read one way', () => {
  const figs = (t) => C.figures(t).map((f) => f.text);
  assert.deepEqual(figs('The price is 126 pounds, or 1,250.50 with 3 crates at 12.5 each.'), ['126', '1,250.50', '3', '12.5']); assert.deepEqual(figs('3rd party, form A4, v2, 5kg, x86'), []);
  assert.deepEqual(figs('1234,567 and 1,23 and 1.2.3 and 12,3456'), [], 'a run that is not a number written plainly holds no figure'); assert.deepEqual(figs('It ends 26.'), ['26']); assert.deepEqual(figs('(26) 27, 28; 29'), ['26', '27', '28', '29']);
  assert.deepEqual(figs('0 and 007 and 0.5'), ['0', '007', '0.5']); assert.deepEqual(C.figures('ab 12 cd', 100), [{ text: '12', start: 103, end: 105 }]); assert.deepEqual(figs('9'.repeat(41)), [], 'a number too long to hold is no figure');
  for (const bad of HOSTILE) { assert.deepEqual(C.figures(bad), []); assert.deepEqual(C.lines(bad), []); assert.equal(C.quote(bad), ''); }
  // a label that opens a line is left outside it; blank lines are not lines
  assert.deepEqual(C.lines('Title\n1. First.\n\n  (2) Second.\n- Third\n12) Fourth\n1234. Fifth\n3.No space\n   \n• Sixth'), [{ text: 'Title', start: 0, end: 5, from: 0 }, { text: 'First.', start: 9, end: 15, from: 6 }, { text: 'Second.', start: 23, end: 30, from: 17 }, { text: 'Third', start: 33, end: 38, from: 31 }, { text: 'Fourth', start: 43, end: 49, from: 39 },
    { text: '1234. Fifth', start: 50, end: 61, from: 50 }, { text: '3.No space', start: 62, end: 72, from: 62 }, { text: 'Sixth', start: 79, end: 84, from: 77 }]);
  assert.deepEqual(C.lines('7.'), [{ text: '7.', start: 0, end: 2, from: 0 }]); assert.deepEqual(C.lines('7. '), []); assert.deepEqual(C.lines('* x\n(12. y\n123) z').map((l) => l.text), ['x', 'y', 'z']);
  // a figure is read only where it is written plainly: nothing touching it that could change what it says
  assert.deepEqual(figs('-40, −40, +40, .5, 5-10, 30-day, £7, $8, €9, (10), 11%, 12: 13; 14? 15! =16, ~17, "18", 19/20, #21, 1,250.50, 0,500, 01,250'), ['7', '8', '9', '10', '11', '12', '13', '14', '15', '1,250.50']);
  assert.deepEqual(figs('5 million and 6 Thousand and 7  hundred and 8 billion and 9 TRILLION and 10 millionaires, but 11 mill and 12million and 13 units'), ['11', '13']);
  assert.deepEqual(figs('part 1.9.3 of 9.5 and 5,9 and 9,5'), ['9.5']); assert.deepEqual(figs('5\tmillion'), []); assert.deepEqual(figs('5\r'), ['5']); assert.deepEqual(figs(' 5 '), ['5']); assert.deepEqual(figs('a 12,345,678.25 b'), ['12,345,678.25']);
  assert.deepEqual([C.BEFORE, C.AFTER, C.SCALE], [['(', '£', '$', '€'], [')', ';', ':', '%', '.', ',', '?', '!'], ['hundred', 'thousand', 'million', 'billion', 'trillion']]);
  // quote marks come off in matching pairs only, with one full stop outside them and one inside
  assert.deepEqual(['X', 'X.', '"X"', '"X."', '"X".', '"X.".', " 'X' ", '“X”', '‘X’', '"X', 'X"', '“X"', '\'X"', '""X""', 'X..', '"X.."', '"', '""', '"."'].map(C.quote), ['X', 'X', 'X', 'X', 'X', 'X', 'X', 'X', 'X', '"X', 'X"', '“X"', '\'X"', '"X"', 'X.', 'X.', '"', '', '']);
});

test('whatever it is handed, it gives a ruling and does not throw', () => {
  for (const reply of HOSTILE) for (const cell of HOSTILE) for (const doc of HOSTILE) assert.doesNotThrow(() => C.judge(reply, cell, doc));
  for (const bad of HOSTILE) { assert.deepEqual(C.judge('x', { text: 'the unit price' }, bad), { value: null, why: 'not in the document', source: null }); assert.equal(C.judge(bad, { text: 'the unit price' }, DOC).why, 'the model says it is not there'); assert.equal(C.judge('x', bad, DOC).why, 'not a question of the document'); }
  for (const reply of ['('.repeat(100000), '\ud800', '\u0000', 'x'.repeat(301), `${'The unit price is 126 '.repeat(30)}`]) { assert.doesNotThrow(() => C.judge(reply, { text: 'the unit price' }, DOC)); assert.equal(C.read(reply, { text: 'the unit price' }, DOC), null); }
  const big = { id: 'big', text: Array.from({ length: 4000 }, (_, i) => `${i + 1}. Item ${i} costs ${i} pounds.`).join('\n') + '\nThe unit price is 9 pounds.' };
  assert.equal(why('The unit price is 9 pounds.', 'the unit price', big), 'bonded');
});
