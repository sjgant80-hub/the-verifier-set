# The Verifier Set: the seal

`SEAL.json` holds a SHA-256 of every file that can change a result: this repository's kernels (`src/`), The
Crystal's kernels and The Climb's inside them as vendored (`vendor/crystal/`), DocDec's gate as vendored
(`vendor/docdec/`), the settings (which hold the sealed seed and every attack's seed and budget, so they fix the
problems and the attacks), the seed crystal (`data/seed.json`) and the claims (`CLAIMS.md`). It was made and committed
before the model was shown one sealed problem. `test/seal.test.mjs` fails if a sealed byte changes, and a sealed run
counts only when it records the hash of `SEAL.json` itself.

## What the build was shaped on before the seal

Everything below was found on the dev problems (seed 20261201) or by code with no model, and fixed before the seal.

**The citation check, attacked.** The first harness was too kind to the check. Rebuilt with a second reader that walks
the document by hand, every way of forging a quote tried on every figure, and a fixed set of hard cases, it found:

1. A figure was read wherever digits stood, so ".5" in "2.5", "5" in "5 million" and "40" in "-40" were figures. A
   figure is now read only where it is written plainly, from an allowed list of what may touch it; such a line cannot
   be cited from at all.
2. A quote could not carry its line's own clause number ("3. The fee is 20 pounds."), which the model often copies.
   It may now, and only its own: "4. The fee…" on clause 3 is refused, and the number is never the figure.
3. Nine survivors of the mutation gate in the harness, each fixed by a test or by removing code that changed nothing.

**How the model is asked for a figure.** Offered the word "none" for a figure the document does not state, this model
said none of 14 of the 44 figures that were in front of it, and its copy bonded for 27. Asked only to copy the line,
it bonded for 44 of 44 (`data/bench.json`, every reply kept with its document). It is never asked whether a figure is
there: that is the check's to say.

**The unchecked reply it is set against.** In an early try at 48 tokens (not kept as a record) about a quarter of the
unchecked replies were cut off mid-working; it is now given 192, and 4 of its 60 dev replies ran to that limit. Its
system line was chosen as the stronger of two on the 60 dev problems (`data/baseline.json`, every reply kept): told it
may reply "cannot tell", it got 16 right; not told, 15. The two are close; the build keeps the stronger, so the
lattice is not set against the weaker baseline.

**The two checks added.** The formula check and the solver were built with their harnesses, and each harness was turned
on twelve planted readers before either check was used. They found, among others:

4. A formula's tests stored a result that does not end as a decimal ("31/3") as text the reader could not read back,
   so every formula failed that test, the right one included. Tests now keep their figures exactly.
5. A claim with no quantity in it ("300 ≥ 200") was decided. It is refused.
6. The model wrote "shared out over" as a product, never a division. The rules now say "divided by", and the model
   wrote 10 of 12 rules right on the builder's bench (a try of the wording, not kept as a record; the dev run is).
7. Survivors of the mutation gate: in the growth law (the claim prompt's text was not pinned), the solver (a sum past
   the size limit at one end of a range only), and in the solver's harness, 45 in all, each fixed by a test or by
   simpler code.

## The dev run

One dev run was made before the seal, on the 60 dev problems, in a browser tab on an Intel integrated GPU: the lattice
on every problem, then one unchecked reply to each. It is published whole (`data/runs/dev.json`), and
`scripts/publish.mjs` grew all 60 again identically from their recorded replies with no model before it was published.

| kind of problem | problems | reached an answer | came out as it should | one unchecked reply right |
|---|---|---|---|---|
| computed | 5 | 5 | 5 | 3 |
| cited | 5 | 5 | 5 | 4 |
| mixed | 15 | 14 | 14 | 2 |
| absent | 5 | 0 | 5 | 1 |
| conflict | 5 | 0 | 5 | 2 |
| misstated | 5 | 4 | 4 | 0 |
| coded | 5 | 4 | 4 | 1 |
| coded-cited | 5 | 5 | 5 | 0 |
| decided | 5 | 5 | 5 | 2 |
| decided-cited | 5 | 5 | 5 | 1 |

57 of 60 came out as they should, against 16 of 60 for one unchecked reply: 41 only with the checks, none only
without them. Of the 112 figures that were in their documents, the model's copy bonded for all 112. It wrote 10 of 10
rules as formulas that passed their tests, and 10 of 10 claims that gave the question's own verdict. No answer was
wrong and none was labelled stronger than what it stands on. 250 model calls, 3,698 seconds in one sitting, no
network requests while it worked.

The three that did not come out each held a division the model got wrong (it wrote 26 ÷ 13 = 1.923). The Crystal, as
its seal froze it, has smaller steps for adding, taking away and multiplying, but none for dividing, so the step
dissolved and the problem had no answer. That limit is The Crystal's and is not changed here; the page states it.

## The bars set knowing the dev run

S6 (the model reads): 8 in 10, as before; dev 112 of 112. S11 (the model writes a rule) and S12 (the model writes a
claim): 7 in 10 each; dev 10 of 10 each, the builder's bench 10 of 12 and 9 of 12. The bars were set from both, below
the dev result, because ten is few and the bench was lower. Every other bar is a promise of the checks themselves, not a
measurement of the model, and is set at none.

## The first seal, and why it was made again

The first seal (`SEAL.json` with SHA-256 `377307f151da…`, commit `52b6385`) was made after the dev run, and the sealed
run was begun under it. The first CI run then failed: the page built on GitHub's runner (Node 22) differed from the
one built here (Node 25) in one number, the claims put to the solver in its attack (853 against 850). The solver's
harness drew a new order for a claim's quantities with a sort whose comparator answered at random. How often an engine
calls a comparator, and what it makes of answers that contradict each other, is the engine's own, so every draw after
it, and every count of that attack, could differ between Node versions and between browsers. The harness now turns the
list round by one draw instead (`rotate` in `src/logicfuzz.mjs`); a test pins what it makes, and a test sweeps every
kernel for a sort of that kind. It was the only one.

Nothing the model is shown, and nothing that judges its replies, changed: the problems, the four checks and the growth
law are byte for byte as first sealed. The harness was gated again, the build was sealed again, and the sealed run was
started again from nothing. The 34 of 288 replies made under the first seal are kept as they were saved
(`data/runs/sealed-seal1-partial.json`). The run was stopped after 394 seconds; nothing in it was looked at except how
many replies it held.

## The seal

Made after the dev run and before the model was shown a sealed problem, then made again as told above, before the
sealed run was started again.

## The sealed run

Made under the second seal (`7670651e141b…`), in a browser tab on the same Intel integrated GPU: the lattice on all 144
sealed problems, then one unchecked reply to each. 584 model calls for the lattice and 144 for the unchecked replies,
4,234 seconds in one sitting, no network requests
while it worked. It is published whole (`data/runs/sealed.json`), and `scripts/publish.mjs` grew all 144 again
identically from their recorded replies, with no model, before it was published. Its first 34 replies are identical,
apart from their timings, to the 34 made under the first seal.

| kind of problem | problems | reached an answer | came out as it should | one unchecked reply right |
|---|---|---|---|---|
| computed | 12 | 12 | 12 | 4 |
| cited | 12 | 12 | 12 | 5 |
| mixed | 36 | 33 | 33 | 3 |
| absent | 12 | 0 | 12 | 2 |
| conflict | 12 | 0 | 12 | 0 |
| misstated | 12 | 11 | 11 | 0 |
| coded | 12 | 12 | 12 | 5 |
| coded-cited | 12 | 11 | 11 | 5 |
| decided | 12 | 12 | 12 | 5 |
| decided-cited | 12 | 12 | 12 | 5 |

139 of 144 came out as they should, against 34 of 144 for one unchecked reply: 105 only with the checks, none only
without them (exact McNemar test, p = 4.9e-32). On the 24 problems that have no answer, the unchecked reply gave a
number 22 times; the lattice answered none of them, and stopped at the right figure for the right reason on all 24. No
answer was wrong, and none was labelled stronger than what it stands on. All twelve claims in `CLAIMS.md` pass.

The five that did not come out were given no answer, none a wrong one. Three held a division the model got wrong
(102 ÷ 34 = 3.026, 93 ÷ 31 = 3.051, 51 ÷ 17 = 3.059), which The Crystal as sealed cannot split smaller. One held a sum
already as small as steps go that the model got wrong (4270 + 8 = 4288), which dissolved. In one, the model copied the
unit price from another line of the document, and the figure did not bond. The sealed run is the 144 problems the sealed
seed (20261212) makes; none of them is a dev problem, and no sealed document is a dev document (`test/seal.test.mjs`).
