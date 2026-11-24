# The Verifier Set: the claims, registered before the sealed run

This file is committed, with the seal (`SEAL.json`, [SEAL.md](SEAL.md)), before the model is shown one sealed
problem. The verdicts are worked out by `src/claims.mjs` from the recorded run, and the bars in that file are the bars
below, word for word (`test/claims.test.mjs` checks that on every push). A claim that fails stays on the page, failed,
in red. No bar is moved after the run.

## The question

The Crystal grows a calculation one checked step at a time, and its reach is exactly the reach of its one check: exact
arithmetic. Can three more kinds of check be added (for figures cited from a document, for a rule written as a
formula and run on its tests, and for a claim decided by a solver) without the kinds of truth being confused? A sum
is proven. A figure quoted from a contract is only as true as the contract. A formula that passed its tests is only
as true as its tests. A claim a solver decided is only as true as the way it was written down. Does every answer say
which it is, does anything get cited that is not there, do the checks hold under attack, and can a small model read,
write a rule and write a claim well enough for it to matter?

## What is run

One model: Llama 3.2 1B Instruct at 4 bits (`Llama-3.2-1B-Instruct-q4f16_1-MLC`), in a browser tab through WebLLM
0.2.79 on WebGPU, always choosing its likeliest next word. The sealed problems are the 144 that `src/tasks.mjs` makes
from the sealed seed in `data/settings.json`: twelve sheets of twelve, each sheet holding

- one **computed** problem: a calculation with no document (The Crystal's own kind);
- one **cited** problem: the answer is one figure a document states;
- three **mixed** problems: two to four figures from a document, then a calculation on them;
- one **absent** problem: the document does not state a figure the question needs;
- one **conflict** problem: the document states a needed figure twice, differently;
- one **misstated** problem: the document states a figure with two digits the wrong way round. What is true is known
  only to the code that made the problem;
- one **coded** problem: no document; a rule in words and its figures. The model writes the rule as a formula, which
  must pass the rule's tests;
- one **coded-cited** problem: the same, with the figures cited from a document;
- one **decided** problem: no document; some figures, one of them only between two figures, and a claim ("is it
  certain that … comes to at least 300 pounds?"). The model writes the claim as a comparison and the solver decides
  it: yes, no, or it depends;
- one **decided-cited** problem: the same, with the exact figures cited from a document.

The documents are short agreements made by code, one statement to a line, between parties named only by their roles.
None of the sealed problems is a dev problem (`test/seal.test.mjs` checks it).

Two things are run on every sealed problem:

- **The lattice** (`src/weave.mjs`). For each figure the question needs, the model is asked to copy the one line of
  the document that states it, and `src/cite.mjs` rules on the copy. The model is never asked whether the figure is
  there: that is for the check to say, from the document itself. With every figure cited, the calculation is grown as The Crystal grows one
  (`vendor/crystal/`, as sealed), from the seed: the steps The Crystal's sealed run bonded (`data/seed.json`). For a
  coded problem the calculation is the model's own formula, once it has passed the rule's tests (`src/formula.mjs`);
  for a decided problem there is no calculation: the model's comparison is decided by `src/logic.mjs`. If any cell
  does not bond there is no answer, and the record says which cell and why.
- **One unchecked reply** (`src/onetry.mjs`): the same model, the document and the question, one reply, read
  generously (its last number is its answer, however it is written round; for a yes-or-no question its first yes,
  no, it depends or cannot tell is its verdict).

For an absent or a conflict problem, the outcome counted as right is no answer, stopped at the figure that cannot be
cited, for the right reason. For one unchecked reply on those problems, the outcome counted as right is a reply that
says it cannot tell, or that has no number in it.

## The claims

| | claim | the bar |
|---|---|---|
| S1 | Every answer is labelled with what it stands on | every sealed answer is labelled with the weakest kind of bond it stands on: none is labelled stronger, so grounded is never called proven; and every answer to a problem with no document, no rule and no claim is labelled proven |
| S2 | An answer is what its document gives | no sealed problem whose bonds are all cited figures and exact steps reaches an answer other than the one its own document gives: none |
| S3 | Nothing is cited that is not there | no sealed problem whose document does not state a needed figure, or states it two ways, reaches an answer; and at least 9 in 10 of them stop at that figure with the right reason |
| S4 | The citation check holds | no forged quote bonds, of every forgery made for every figure the sealed run asked for and for the fixed set of hard cases; no honest quote is refused; nothing bonds where the document cannot be cited; the bond-check and the second reader never rule differently on a reply; and nothing throws |
| S5 | The harnesses can find a leak | the harness that attacks each of the three checks this build adds finds the leak in every reader, runner and solver that has one planted in it |
| S6 | The small model can read | of the figures that are in their documents, the model's quote bonds at least 8 in 10 |
| S7 | Checked beats unchecked | the lattice brings more of the sealed problems out as they should come out than the same model does in one unchecked reply, by an exact two-sided McNemar test, p < 0.05 |
| S8 | A wrong source gives a wrong answer, and it is labelled | every sealed problem whose document misstates a figure, and that reaches an answer, gives the document's answer and not the true one, and is labelled grounded |
| S9 | The formula check holds | no formula that is a different rule bonds, of every forgery made for every rule the sealed problems asked for and for the twelve rules every attack keeps; no honest formula is refused; no rule's tests let a near-miss through; the check and the second runner never rule differently on a reply; and nothing throws |
| S10 | The solver holds | on every claim the sealed run's model wrote, every sealed question's own claim, and every claim made to trip a solver for those questions and for the hard ones, the solver and a second procedure written apart from it give the same verdict or both refuse; and nothing throws |
| S11 | The small model can write a rule | of the rules the sealed problems asked for, the model's formula passes the rule's tests at least 7 in 10 |
| S12 | The small model can write a claim | of the claims the sealed problems asked for, the model's comparison is decided and its verdict is the question's own at least 7 in 10 |

S1, S2 and S3 follow from the checks and the strength law, and are tested on every push with scripted stand-ins for
the model; the sealed run is where they meet the real one. S4, S5, S9 and S10 are run by the page itself, with the
seed and the number of replies fixed in `data/settings.json` before the run. S6, S7, S11 and S12 are about the model,
and can fail. S8 is the limit of the whole thing, stated as a claim: a figure that is in the document and is wrong
bonds, and the answer built on it is wrong. What the build promises is the label.

The other two checks have limits of the same kind, and they are not hidden. A formula built to pass a rule's tests
and nothing else bonds: the harness makes one for every rule it attacks, and the page counts them apart (S9). A claim
the model wrote down wrongly is decided exactly, about the wrong claim: S12 counts how often that happened, and every
such verdict carries the label "proven within its encoding" or "grounded", never "proven". S2 is about the answers that
stand only on cited figures and exact steps, because those are the only ones the checks themselves can promise.

## What is and is not built

Four kinds of check are in the design, and all four are built here: computational (exact arithmetic: The Crystal's,
as sealed), evidential (a source document: `src/cite.mjs`), executable (a rule's tests: `src/formula.mjs`) and
logical (a solver: `src/logic.mjs`). Each was added with the harness that attacks it (`src/citefuzz.mjs`,
`src/formulafuzz.mjs`, `src/logicfuzz.mjs`), and each harness was turned on readers with a leak planted in each
before anything was grown on its check.

The logical check is a small exact solver written for this build, not a general one such as Z3. It decides one
fragment completely: a claim about a sum of products and quotients in which each quantity appears once, each known
exactly or only between two figures. A claim outside that fragment is refused, never decided. The executable check
runs a formula in a language of four signs and brackets; that language is its sandbox.

The evidential check was attacked before anything was grown on it (`src/citefuzz.mjs`). DocDec's own span check, as it
shipped (`vendor/docdec/`), was put through the same harness and lets a figure cut out of a longer one through (the
quote "The unit price is 12" bonds on a document that says 126). It is not used to make bonds here. It is kept as one
of the planted readers the harness must catch.

## What also goes on the page, whatever it shows

- For every kind of problem: how many, how many reached an answer, how many came out as they should.
- How many figures that were in their documents the model's quote bonded, and every reason a quote did not.
- For the figures that could not be cited: how often the model offered a quote all the same, and how many of those
  bonded.
- How many rules the model wrote as formulas that passed their tests, and every reason one did not.
- How many claims the model wrote that were decided, how many of those gave the question's own verdict, and every
  reason one was not decided.
- The bonds of the whole run counted by strength, each strength apart.
- Model calls and model time, against one unchecked reply.
- The network requests made while the run worked.

## Rules for the run

- The sealed run is one run of the lattice and of the one unchecked reply over all 144 problems, on one device, saved
  from the page. It may be made in more than one sitting; the number of sittings is recorded.
- The run is published only if `scripts/publish.mjs` finds it complete, made under this seal, and every problem comes
  out identically when grown again from its recorded replies with no model.
- If the run cannot be completed, that is reported, and no partial result is shown as the result.
- A second sealed run is not made to get a better number.
