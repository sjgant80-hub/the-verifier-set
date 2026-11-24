// helpers.mjs — scripted stand-ins for the model, for the tests. None of them is a measurement of anything.
import C from '../src/cite.mjs';
import T from '../src/tasks.mjs';
import X from '../vendor/crystal/vendor/climb/src/exact.mjs';

export const val = (t) => X.show(X.evaluate(t).value);
// what a conversation is asking: { cite, text } (a figure, and the document), { rule } (a rule's words), { claim }
// (a claim's words) or { sum } (a step of a calculation)
export function asking(messages) {
  const ASK = '\n\nCopy the one line that states ', last = messages[messages.length - 1].content, q = last.match(/Copy the one line that states (.*)\.$/), r = last.match(/^The rule: (.*)\. Letters: .*\.$/), c = last.match(/^The claim: (.*)\. Letters: .*\.$/);
  if (r) return { rule: r[1] };
  if (c) return { claim: c[1] };
  if (!q) return { sum: last };
  const holder = [...messages].reverse().map((m) => m.content).find((x) => x.includes(ASK) && !x.startsWith('Lease between'));
  return { cite: q[1], text: holder.split(ASK)[0] };
}
// the line of the document that states what is asked, read by code; null when no one line does
export const lineFor = (cite, text) => { const s = C.stated({ text: cite }, { text }), hit = s.at.find((l) => C.figures(l.text).length === 1); return hit ? hit.text : null; };
// every rule a problem can ask for, by its words: the formula the problem maker holds for it
export const RULES = Object.fromEntries(Object.values(T.KINDS).flatMap((K) => K.asks.map(([, ask, words]) => [words, ask.replace(/\{(\w+)\}/g, (_, k) => K.letters[k])])));
export const rightRule = (words) => RULES[words] ?? 'none';
// the claim as the problem maker writes it: the rule's formula, the relation's sign, the figure
export const rightClaim = (text) => { const m = text.match(/^(.*?),? comes to (at least|more than|at most|less than) ([\d.]+) pounds$/); return m ? `${RULES[m[1]]} ${{ 'at least': '≥', 'more than': '>', 'at most': '≤', 'less than': '<' }[m[2]]} ${m[3]}` : 'none'; };
// model(read, sum, rule, claim) → { seen, call }: read(cite, text) gives the reply to a cite question, sum(cell) to a
// sum, rule(words) to a rule, claim(text) to a claim
export function model(read, sum, rule = rightRule, claim = rightClaim) {
  const seen = [];
  return { seen, call: async (messages, maxTokens, more) => { const a = asking(messages); seen.push({ ...a, messages: messages.map((m) => ({ ...m })), maxTokens, more }); return { text: a.sum !== undefined ? sum(a.sum) : a.rule !== undefined ? rule(a.rule) : a.claim !== undefined ? claim(a.claim) : read(a.cite, a.text), ms: a.sum !== undefined ? 2 : 3, prompt: 10, reply: 5 }; } };
}
export const rightSum = (c) => `${c} = ${val(c)}`;
export const wrongSum = (c) => `${c} = ${X.show(X.add(X.evaluate(c).value, X.num('1')))}`;
// a reader that copies the right line, or says none
export const reads = (cite, text) => lineFor(cite, text) ?? 'none';
// a reader that makes a figure up when the document does not give one, and otherwise copies the first line about it
export const invents = (cite, text) => { const s = C.stated({ text: cite }, { text }); return s.at.length ? s.at[0].text : `${cite[0].toUpperCase()}${cite.slice(1)} is 50 pounds.`; };
