// readers.test.mjs — the bond-check (cite.mjs) and the second reader (citefuzz.mjs) held side by side, part by part,
// on text made at random from the characters that matter to each rule. Each was written its own way (one with
// patterns, one by walking the text); where they differ on anything, one of them is wrong, and this fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import C from '../src/cite.mjs';
import F from '../src/citefuzz.mjs';
import { DOC, TABLE, ODD, HOSTILE } from './citetable.mjs';

const rnd = (seed) => { let s = seed >>> 0; return (n) => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s >>> 8) % n; }; };
const made = (r, parts, most, glue = '') => Array.from({ length: 1 + r(most) }, () => parts[r(parts.length)]).join(glue);

test('lines and labels: both cut every document into the same lines, and step over the same labels', () => {
  const r = rnd(11), parts = ['0', '1', '2', '9', '.', ')', '(', ',', ' ', ' ', '-', '*', '•', 'a', 'Z', '\n', '\n', '\t', '\r', '\u00a0'];
  let labelled = 0, plainLines = 0;
  for (let k = 0; k < 40000; k++) {
    const text = made(r, parts, 14), mine = C.lines(text);
    assert.deepEqual(F.SECOND.lines(text), mine.map((l) => [l.from, l.start, l.end]), JSON.stringify(text));
    for (const l of mine) { assert.equal(l.text, text.slice(l.start, l.end)); assert.ok(l.from <= l.start && l.start < l.end); if (l.start > l.from) labelled++; else plainLines++; }
  }
  assert.ok(labelled > 2000 && plainLines > 20000, `${labelled} ${plainLines}`);
  for (const text of ['1. x', '12. x', '123. x', '1234. x', '(1) x', '(1. x', '1) x', '- x', '* x', '• x', '-x', '1.x', '1 . x', '( 1) x', ' \t 7.\t\tx', '1.  ', '-  ', 'x\n\n\ny', '\n', '']) assert.deepEqual(F.SECOND.lines(text), C.lines(text).map((l) => [l.from, l.start, l.end]), JSON.stringify(text));
  assert.deepEqual(F.SECOND.lines('Title\n 12)  Rent is 5.\n- x'), [[0, 0, 5], [6, 12, 22], [23, 25, 26]]);
});

test('figures: both find the same plain figures in every line, and nothing outside the line touches them', () => {
  const r = rnd(12), chars = ['0', '1', '5', '9', '0', ',', ',', '.', '.', ' ', ' ', '-', '−', '+', '(', ')', '£', '$', '€', '%', ';', ':', '?', '!', 'a', 'z', 'A', 'Z', '/', '=', '\t', '\u00a0'];
  const tokens = ['5', '20', '007', '0.5', '.5', '1,250.50', '12,345', '123,456,789', '1,23', '0,500', '01,250', '1.250,50', '1234,567', '12,3456', '-40', '−40', '30-day', '5-10', '5kg', 'A4', '3rd', '£7', '(26)', '12.5%', '5 million', '6 Thousand', '7  hundred', '8 mill', '9 billions', 'million', 'thousand', 'trillion', 'hundred',
    'the', 'fee', 'is', ',', '.', ';', ':', '9'.repeat(40), '9'.repeat(41), '1.2.3', '2.', 'v1.2', '3.', '4,'];
  let found = 0, none = 0;
  for (let k = 0; k < 40000; k++) {
    const line = k % 2 === 0 ? made(r, chars, 12) : made(r, tokens, 6, r(3) === 0 ? '' : ' ');
    const mine = C.figures(line, 7);
    assert.deepEqual(F.SECOND.figures(`9,5 0.,${line}5 million`, 7, 7 + line.length), mine.map((f) => [f.start, f.end]), JSON.stringify(line));
    for (const f of mine) assert.equal(f.text, line.slice(f.start - 7, f.end - 7));
    if (mine.length > 0) found++; else none++;
  }
  assert.ok(found > 12000 && none > 8000, `${found} ${none}`);
});

test('key words and quotes: both read a cell, and a reply, the same way', () => {
  const r = rnd(13), parts = ['a', 'z', 'A', 'Z', '`', '{', '@', '[', '0', '9', ' ', ' ', '-', 'e', 'the', 'of', 'is', 'fee', 'Fee', 'FEE', 'unit', 'price', 'é', 'K', "'", '\n'];
  let some = 0;
  for (let k = 0; k < 20000; k++) { const text = made(r, parts, 8), keys = C.terms({ text }); assert.deepEqual(F.SECOND.keys({ text }), keys || [], JSON.stringify(text)); if (keys !== null) some++; }
  assert.ok(some > 15000, String(some)); for (const bad of HOSTILE) assert.deepEqual(F.SECOND.keys(bad), []);
  const marks = ['"', '"', "'", '“', '”', '‘', '’', '.', '.', ' ', '\n', 'X', 'none', 'a b'];
  for (let k = 0; k < 30000; k++) { const s = made(r, marks, 6); assert.equal(F.SECOND.quote(s), C.quote(s), JSON.stringify(s)); }
  for (const s of ['', '"', '""', '"."', '".".', '\'\'', '“”', '“X”.', ' "X" ', '"X', 'X"', '.', '..', '"X.".']) assert.equal(F.SECOND.quote(s), C.quote(s), JSON.stringify(s));
  for (const bad of HOSTILE) assert.equal(F.SECOND.quote(bad), '');
});

test('rulings: on documents and replies made at random, the bond-check and the second reader never differ', () => {
  const r = rnd(14);
  const words = ['The', 'the', 'fee', 'fee', 'rate', 'unit', 'price', 'is', 'is', 'of', 'Note', 'that', 'pounds', 'per', 'crate', 'gate'];
  const nums = ['5', '20', '20', '20', '20.00', '126', '1,250.50', '12.5', '007', '-40', '.5', '5 million', '30-day', '5kg', '0,500', '£7', '(26)', '12.5%', '7', '20'];
  const labels = ['', '', '', '1. ', '2. ', '(3) ', '12) ', '- ', '* ', '• ', '  4.  ', '123. ', '1234. ', '5.'];
  const cells = ['the fee', 'the fee', 'the rate', 'the unit price', 'the gate fee', 'the unit', 'price of the unit'];
  const line = () => { const body = Array.from({ length: 2 + r(4) }, () => words[r(words.length)]); body.splice(1 + r(body.length), 0, ...(r(5) === 0 ? [] : [nums[r(nums.length)]]), ...(r(9) === 0 ? [nums[r(nums.length)]] : [])); return `${labels[r(labels.length)]}${body.join(' ')}${['', '.', '.', ';'][r(4)]}`; };
  let bonded = 0, refused = 0, withLabel = 0;
  for (let k = 0; k < 9000; k++) {
    const text = Array.from({ length: 1 + r(4) }, line).join(r(9) === 0 ? '\r\n' : '\n'), doc = { id: 'r', text }, cell = { text: cells[r(cells.length)] }, ls = C.lines(text);
    for (let j = 0; j < 8; j++) {
      // a slice of the document: from the edge of a line, of a label, of a word, or from anywhere; sometimes in marks
      const l = ls[r(ls.length)], inLine = [l.from, l.start, l.end, ...[...text.slice(l.from, l.end).matchAll(/\b/g)].map((m) => l.from + m.index)];
      const a = r(4) === 0 ? r(text.length + 1) : inLine[r(inLine.length)], b = r(4) === 0 ? r(text.length + 1) : j < 4 ? l.end : inLine[r(inLine.length)], core = text.slice(Math.min(a, b), Math.max(a, b));
      const reply = [core, core, core, `"${core}"`, `${core}.`, ` ${core}\n`, `'${core}.'`][r(7)];
      const x = C.judge(reply, cell, doc), y = F.plainly(reply, cell, doc);
      assert.equal(y, x.value !== null, `${JSON.stringify(text)} | ${cell.text} | ${JSON.stringify(reply)} | ${x.why}`);
      if (x.value !== null) { bonded++; if (x.source.start < l.start && x.source.start >= l.from && l.start > l.from) withLabel++; assert.equal(text.slice(x.source.start, x.source.end), x.source.text); assert.ok(text.includes(x.source.line)); } else refused++;
    }
  }
  assert.ok(bonded > 900 && refused > 40000 && withLabel > 200, `${bonded} ${refused} ${withLabel}`);
});

test('rulings: both keep the rule of the tables, and of every hard case, quoted whole and in part', () => {
  const HARD = F.HARD[0].doc;
  for (const [reply, cell, ruling] of TABLE) assert.equal(F.plainly(reply, { text: cell }, DOC), ruling === 'bonded', `${JSON.stringify(cell)} ← ${JSON.stringify(reply.slice(0, 70))}`);
  for (const [reply, cell, ruling] of ODD) assert.equal(F.plainly(reply, { text: cell }, HARD), ruling === 'bonded', `${JSON.stringify(cell)} ← ${JSON.stringify(reply)}`);
  for (const reply of HOSTILE) for (const cell of HOSTILE) for (const doc of HOSTILE) assert.equal(F.plainly(reply, cell, doc), false);
  // the length limit, exactly at its edge, the same for both
  for (const [n, want] of [[299, true], [300, true], [301, false]]) { const line = `The fee is 20 pounds ${'a'.repeat(n - 21)}`, doc = { text: `Terms\n${line}\nEnd` }; assert.equal(line.length, n); assert.equal(F.plainly(line, { text: 'the fee' }, doc), want, String(n)); assert.equal(C.read(line, { text: 'the fee' }, doc) !== null, want, String(n)); }
  // a quote that begins or ends beside a point or a comma that is not inside a number: both readers let it stand
  for (const [text, reply, want] of [['The fee is 20 per lot v.5 of terms.', 'The fee is 20 per lot v', true], ['The fee is 20 per lot v,5 of terms.', 'The fee is 20 per lot v', true], ['Terms v.x the fee is 20 pounds.', 'x the fee is 20 pounds', true], ['Terms v,x the fee is 20 pounds.', 'x the fee is 20 pounds', true],
    ['The fee is 20,ab cd.', 'The fee is 20,', true], ['The fee is 20,ab cd.', 'The fee is 20,a', false], ['Terms ab,20 is the fee.', ',20 is the fee', false], ['Terms ab, 20 is the fee.', ', 20 is the fee', true], ['Terms ab, 20 is the fee.', 'b, 20 is the fee', false]]) {
    assert.equal(F.plainly(reply, { text: 'the fee' }, { text }), want, `${text} ← ${reply}`); assert.equal(C.read(reply, { text: 'the fee' }, { text }) !== null, want, `${text} ← ${reply}`);
  }
  // every run of characters of every hard line, label and all, for the cell of that line: the two never differ
  let yes = 0, no = 0;
  for (const h of F.HARD) for (const l of C.stated(h.cell, h.doc).at) for (let a = l.from; a < l.end; a++) for (let b = a + 1; b <= l.end; b++) {
    const reply = h.doc.text.slice(a, b), x = C.read(reply, h.cell, h.doc) !== null;
    assert.equal(F.plainly(reply, h.cell, h.doc), x, `${h.cell.text} ← ${JSON.stringify(reply)}`); assert.ok(h.can || !x, 'nothing bonds where the figure is not written plainly');
    if (x) yes++; else no++;
  }
  assert.ok(yes > 250 && no > 10000, `${yes} ${no}`);
});
