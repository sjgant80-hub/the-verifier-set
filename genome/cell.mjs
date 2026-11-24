// cell.mjs — The Verifier Set's three answers for the estate genome's birth check (seed.json, genome/).
//
// judge  the citation check's own ruling on one quote { document, cell, reply }: verified when the quote bonds the
//        cell (it is in the document letter for letter, in the line that states the cell, with its one figure);
//        unverified when it does not; refused when the document cannot give the figure at all (it does not state
//        it, states it two ways, or the cell is no question of the document).
// lane   a cell is in lane when its document states it once, with one figure: that is all this check ever cites.
// health the repository cannot see its page's visitors or callers from inside it, so it says so.
import { judge as rule, stated } from '../src/cite.mjs';

const ask = (input) => (input !== null && typeof input === 'object' && typeof input.cell === 'string' && typeof input.document === 'string' ? { cell: { text: input.cell }, doc: { id: 'given', text: input.document } } : null);

export async function judge(input) {
  const a = ask(input);
  if (a === null || typeof input.reply !== 'string' || stated(a.cell, a.doc).figure === null) return 'refused';
  return rule(input.reply, a.cell, a.doc).value !== null ? 'verified' : 'unverified';
}

export async function inLane(input) {
  const a = ask(input);
  return a !== null && stated(a.cell, a.doc).figure !== null;
}

export async function health() {
  return { used: null, dependedOn: null, lastEarned: null };
}
