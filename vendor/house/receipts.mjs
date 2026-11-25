// receipts.mjs — read a flagship's own published page for the numbers it has sealed, so that the front door never
// types a number: it reads each one from the page that proves it, and can read it again, live, in a visitor's tab.
//
// A flagship's page is baked by its own gated kernels from its own sealed records. What is read here is what that
// page says, word for word; this file adds nothing and rounds nothing.
//
//   text(html)              the page as a visitor reads it: the body, tags gone, spaces single
//   claims(html)            every pre-registered claim on the page: [{ id, name, result, pass }] (pass: true, false,
//                           or null while it is still sealing). Both layouts are read: the table and the house stack.
//   headline(repo, html)    that build's headline receipt, or null when its page does not state one:
//                           { was, now, of, label }  (was → now, out of how many, in plain words)
//   extra(repo, html)       further receipts a page states: [{ key, value, of, label }]
// Pure and total.
const str = (x) => (typeof x === 'string' ? x : '');
const un = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const flat = (s) => un(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// shown(html) → the body as markup, without its scripts and styles: only what a visitor is shown is ever read
const shown = (html) => { const h = str(html), a = h.search(/<body[\s>]/i); return a === -1 ? '' : h.slice(a).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' '); };

export function text(html) { return flat(shown(html)); }

export function claims(html) {
  const h = shown(html), out = [], seen = new Set();
  const add = (id, name, result, pass) => { if (!seen.has(id)) { seen.add(id); out.push({ id, name: flat(name), result: flat(result), pass }); } };
  // the table: <tr><td><b>C1</b> name</td><td>the bar</td><td>what happened</td><td><span class="pass">PASS</span>…
  for (const m of h.matchAll(/<tr><td><b>([A-Z]\d{1,2})<\/b>([^<]*)<\/td>([\s\S]*?)<\/tr>/g)) {
    const cells = [...m[3].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]);
    add(m[1], m[2], cells[1] ?? '', /class="pass">PASS</.test(m[3]) ? true : /class="fail">FAIL</.test(m[3]) ? false : null);
  }
  // the house stack: <div class="srow"><div class="d">K1</div><div class="nm"><b>name</b><span>what happened</span><span class="tag cy">pass</span>
  for (const m of h.matchAll(/<div class="srow[^"]*"><div class="d">([A-Z]\d{1,2})<\/div><div class="nm"><b>([^<]*)<\/b><span>([\s\S]*?)<\/span><span class="tag (cy|rd|gd)">/g)) add(m[1], m[2], m[3], m[4] === 'cy' ? true : m[4] === 'rd' ? false : null);
  return out;
}

const READ = {
  'the-climb': (t) => { const m = t.match(/right at the first try (\d+(?:\.\d+)?%) \((\d+) of (\d+)\) right after the climb (\d+(?:\.\d+)?%) \((\d+) of \3\)/); return m && { was: m[1], now: m[4], of: Number(m[3]), label: 'sealed problems right: at one try, then after the climb' }; },
  'the-crystal': (t) => { const m = t.match(/one try (\d+(?:\.\d+)?%), the crystal (\d+(?:\.\d+)?%) of (\d+) problems/); return m && { was: m[1], now: m[2], of: Number(m[3]), label: 'sealed problems right: at one try, then as a crystal' }; },
  'the-verifier-set': (t) => { const m = t.match(/got (\d+) of (\d+) right; on the \d+ problems that have no answer it gave a number \d+ times\. The lattice brought (\d+) of \2 out/); return m && { was: m[1], now: m[3], of: Number(m[2]), label: 'sealed problems that came out as they should: unchecked, then checked' }; },
  'the-distillation': (t) => { const m = t.match(/(\d+(?:\.\d+)?%) → (\d+(?:\.\d+)?%) Right, cold, on (\d+) held-out problems/); return m && { was: m[1], now: m[2], of: Number(m[3]), label: 'held-out problems right, cold: before, then after training on its own verified work' }; },
};
const MORE = {
  'the-crystal': (t) => { const m = t.match(/forged replies that bonded (\d+) of (\d+)/); return m ? [{ key: 'forged', value: m[1], of: Number(m[2]), label: 'forged replies that got past the check' }] : []; },
  'the-verifier-set': (t) => { const m = t.match(/on the (\d+) with no answer it gave a number (\d+) times\. With the checks, \d+ of \d+ came out as they should, and none of those \1 was answered/); return m ? [{ key: 'unanswerable', value: m[2], after: '0', of: Number(m[1]), label: 'confident numbers given to questions that have no answer: unchecked, then checked' }] : []; },
};
const own = (map, repo) => (typeof repo === 'string' && Object.prototype.hasOwnProperty.call(map, repo) ? map[repo] : null);

export function headline(repo, html) { const f = own(READ, repo); return f ? f(text(html)) || null : null; }
export function extra(repo, html) { const f = own(MORE, repo); return f ? f(text(html)) : []; }

export default { text, claims, headline, extra };
