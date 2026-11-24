// cite.mjs — the evidential bond-check: the one thing that can say a figure has been cited from a document.
//
// A cited cell names something a document may state ("the unit price"). The model is shown the document and asked
// to copy out the line that states it. Its reply bonds the cell when, and only when, ALL of this holds:
//
//   1  the whole reply is one quote (outer quote marks and one full stop at the end are let go);
//   2  the quote is in the document byte for byte, and begins and ends at the edge of a word or a number, so
//      "26 pounds" cut out of "126 pounds" is not a quote of it;
//   3  the quote lies inside one line of the document (it may be copied with that line's own label, "3."), and
//      that line is about what was asked: it holds every key word of the cell;
//   4  the quote itself holds those key words and the line's figure, whole, so it says the figure and what it is
//      the figure of;
//   5  the document does not disagree with itself: every line that is about what was asked gives that same figure.
//
// The value is the document's own figure, read by code from the document's bytes at offsets anyone can check. A model
// never supplies it.
//
// A FIGURE is read only where it is written plainly: digits, with commas in the thousands and a decimal part, with
// nothing touching it that could change what it says. "-40", ".5", "30-day", "5kg", "1.250,50" and "5 million" hold
// no plain figure, and a line that states its figure that way cannot be cited from. Refusing is the safe side: the
// check says it cannot find the figure, and never reads 5 where the document says five million.
//
// WHAT A BOND HERE MEANS: the figure is GROUNDED. It is in the source, where the source says it is. It is not
// proven: the source may be wrong, and nothing here can tell. Whatever is worked out from it is grounded too
// (strength.mjs). When the document does not state the thing, or states it two ways, nothing bonds and the reason
// says which: that is this check saying "I can't find that in your documents".
//
// The words-match in 3 and 4 is a plain match of English words (the letters a to z). A question put in other words
// than the document's is beyond it, and the page says so. DocDec's own span check (vendor/docdec) is not used to make
// bonds: put through the harness in citefuzz.mjs it lets a figure cut out of a longer one through. It is kept there
// as a reader to catch. Pure and total: whatever the reply, the cell or the document is, this returns a ruling and
// never throws.
import { num, show } from '../vendor/crystal/vendor/climb/src/exact.mjs';
import { sha256 } from '../vendor/crystal/vendor/climb/src/sha256.mjs';

const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
const str = (x) => (typeof x === 'string' ? x : '');
export const LIMIT = 300;
// words that say nothing about what is asked
export const STOP = ['the', 'a', 'an', 'of', 'for', 'per', 'in', 'on', 'to', 'and', 'is', 'are', 'was', 'what', 'how', 'much', 'many', 'does', 'do'];
const wordy = (ch) => typeof ch === 'string' && /^[A-Za-z0-9]$/.test(ch);
const digit = (ch) => typeof ch === 'string' && /^[0-9]$/.test(ch);
// wordsOf(text) → the words in a piece of text (runs of the letters a to z), lower case, in order
const wordsOf = (text) => (str(text).match(/[A-Za-z]+/g) || []).map((w) => w.toLowerCase());
const about = (text, keys) => { const have = new Set(wordsOf(text)); return keys.every((k) => have.has(k)); };

// terms(cell) → the key words of what is asked, lower case, in order, or null when there are none
export function terms(cell) {
  const words = wordsOf(get(cell, 'text')).filter((w) => !STOP.includes(w));
  return words.length === 0 ? null : [...new Set(words)];
}
// what may stand directly before a plain figure, and directly after it; white space and the ends of the line may too
export const BEFORE = ['(', '£', '$', '€'], AFTER = [')', ';', ':', '%', '.', ',', '?', '!'];
// a word after a figure that changes what the figure says
export const SCALE = ['hundred', 'thousand', 'million', 'billion', 'trillion'];
const scaled = new RegExp(`\\s+(?:${SCALE.join('|')})`, 'iy');
// figures(text, from) → every plain figure written in the text: { text, start, end }, offsets counted from `from`.
export function figures(text, from = 0) {
  const t = str(text), out = [];
  for (const m of t.matchAll(/[1-9]\d{0,2}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)) {
    const end = m.index + m[0].length, before = t[m.index - 1], after = t[end];
    if (before !== undefined && !/\s/.test(before) && !BEFORE.includes(before)) continue;
    if (after !== undefined && !/\s/.test(after) && !AFTER.includes(after)) continue;
    if ((after === '.' || after === ',') && digit(t[end + 1])) continue;
    scaled.lastIndex = end;
    if (scaled.test(t) || num(m[0]) === null) continue;
    out.push({ text: m[0], start: from + m.index, end: from + end });
  }
  return out;
}
// lines(text) → the document's lines that hold anything: { text, start, end, from }. A label that opens a line ("3.",
// "(3)", "-") numbers the line and is not part of what the line says: text, start and end leave it out, so its
// number is never read as a figure. from is where the line begins on the page, label and all: a quote may be copied
// with its line's own label.
export function lines(text) {
  const t = str(text), out = [];
  let at = 0;
  for (const raw of t.split('\n')) {
    const label = (raw.match(/^\s*(?:\(?\d{1,3}[.)]|[-*•])\s+/) || [''])[0].length;
    if (raw.slice(label).trim() !== '') out.push({ text: raw.slice(label), start: at + label, end: at + raw.length, from: at });
    at += raw.length + 1;
  }
  return out;
}
// edge(text, start, end) → true when [start, end) begins and ends at the edge of a word or a number
function edge(text, start, end) {
  const first = text[start], last = text[end - 1], before = text[start - 1], after = text[end];
  if (wordy(first) && wordy(before)) return false;
  if (wordy(last) && wordy(after)) return false;
  if (digit(first) && (before === '.' || before === ',') && digit(text[start - 2])) return false;
  return !(digit(last) && (after === '.' || after === ',') && digit(text[end + 1]));
}
// quote(reply) → the reply as a quote: white space at the ends, one full stop at the end, one pair of outer quote
// marks, and one full stop inside them, let go (so "X", "X.", "X". and X. are all the quote X)
const unstopped = (s) => (s.endsWith('.') ? s.slice(0, -1) : s);
export function quote(reply) {
  const s = unstopped(str(reply).trim()), open = '"\'“‘'.indexOf(s[0]), close = '"\'”’'.indexOf(s[s.length - 1]);
  return s.length >= 2 && open >= 0 && open === close ? unstopped(s.slice(1, -1).trim()) : s;
}
const no = (why) => ({ value: null, why, source: null });

// stated(cell, doc) → what the document itself says about the cell, with no model: { keys, at, figure, why }.
// at is the lines about it; figure is the one figure they give ({ text, start, end }), or null with the reason:
// 'not a question of the document', 'not in the document', 'no figure there', 'more than one figure there'.
export function stated(cell, doc) {
  const keys = terms(cell), text = str(get(doc, 'text'));
  if (keys === null) return { keys, at: [], figure: null, why: 'not a question of the document' };
  const at = lines(text).filter((l) => about(l.text, keys));
  if (at.length === 0) return { keys, at, figure: null, why: 'not in the document' };
  const each = at.map((l) => figures(l.text, l.start)), all = each.flat(), values = new Set(all.map((f) => show(num(f.text))));
  if (all.length === 0) return { keys, at, figure: null, why: 'no figure there' };
  if (values.size > 1 || each.some((f) => f.length > 1)) return { keys, at, figure: null, why: 'more than one figure there' };
  return { keys, at, figure: all[0], why: null };
}
// judge(reply, cell, doc) → { value, why, source }: value is the document's figure (an exact fraction) when the
// reply bonds the cell, else null. why is 'bonded' or the reason. source is where it stands: { doc, sha256, start,
// end, text, line }, offsets into the document's text.
export function judge(reply, cell, doc) {
  const text = str(get(doc, 'text')), s = stated(cell, doc);
  if (s.figure === null) return no(s.why);
  const q = quote(reply);
  if (q.length > LIMIT) return no('too long');
  if (q === '' || /^none$/i.test(q)) return no('the model says it is not there');
  // every place the quote stands in the document, byte for byte, at the edge of a word or a number
  const found = [];
  for (let i = text.indexOf(q); i !== -1; i = text.indexOf(q, i + 1)) if (edge(text, i, i + q.length)) found.push(i);
  if (found.length === 0) return no('not a quote of the document');
  // the places where it stands inside one line that is about what was asked
  const hits = found.map((i) => ({ i, line: s.at.find((l) => i >= l.from && i + q.length <= l.end) })).filter((h) => h.line !== undefined);
  if (hits.length === 0) return no('a quote of another line');
  if (!about(q, s.keys)) return no('the quote does not name what was asked');
  // the line's own figure, as the line itself reads, must stand whole inside the quote. The figure is never read from
  // the quote: a quote that begins at the point of 2.5 holds a 5 the line does not, and holds no figure of the line.
  const held = hits.map((h) => ({ ...h, figure: figures(h.line.text, h.line.start).find((f) => f.start >= h.i && f.end <= h.i + q.length) })).find((h) => h.figure !== undefined);
  if (held === undefined) return no('the quote does not hold the figure');
  return { value: num(held.figure.text), why: 'bonded', source: { doc: get(doc, 'id') ?? null, sha256: sha256(text), start: held.i, end: held.i + q.length, text: q, line: held.line.text } };
}
// read(reply, cell, doc) → the document's figure when the reply bonds the cell, else null
export const read = (reply, cell, doc) => judge(reply, cell, doc).value;

export default { LIMIT, STOP, BEFORE, AFTER, SCALE, terms, figures, lines, quote, stated, judge, read };
