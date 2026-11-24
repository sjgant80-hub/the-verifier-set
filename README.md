# The Verifier Set

**Live: https://sjgant80-hub.github.io/the-verifier-set/** · open it, turn the crystal, press Enter, and watch a
small model read documents, write rules and claims, and work out answers on your own graphics chip.

Four checks, one for each kind of work the model does. A figure it cites must be in the document, word for word. A
rule it writes as a formula must pass the rule's tests. A claim it writes down is decided by a solver. A step it works
out is checked by exact arithmetic. Every answer says how true it is, by the weakest check beneath it, and the glass
draws each strength in its own material: proven hard and bright, grounded soft and warm, tested orchid, decided leaf
green. Where a document does not state a figure, or states it two ways, there is no answer, and the page says which
figure and why. Nothing leaves the browser.

The Verifier Set is the third build in a line. [The Climb](https://sjgant80-hub.github.io/the-climb/) showed that a
small model gets further when code checks each step. [The Crystal](https://sjgant80-hub.github.io/the-crystal/) took
that down to single steps and hardened the check. This build adds three more kinds of check and one rule that keeps
the kinds of truth apart. It stands on The Crystal's kernels, byte for byte as The Crystal's seal froze them
(`vendor/crystal/`, compared with that repository on every push).

- [CLAIMS.md](CLAIMS.md) — the twelve claims and their bars, committed before the model sees a sealed problem.
- [SEAL.md](SEAL.md) — what the build was shaped on, and the seal that froze every file that can change a result.
- `data/runs/` — the published runs, with every reply of the model.

## The one rule

**A facet is only as strong as the weakest bond it stands on.** A sum worked out exactly from a figure cited from a
contract is grounded, not proven: the sum is exact, the figure is only as true as the contract, and the result can be
no truer than the figure. A sum worked out from a formula that passed its tests is proven against its tests. No two
strengths are ever counted, labelled or drawn as the same thing (`src/strength.mjs`).

## The checks

| check | asks | a bond proves | built in, attacked by |
|---|---|---|---|
| Computational | does this step follow? | proven | `vendor/crystal/src/bond.mjs`, `vendor/crystal/src/fuzz.mjs` |
| Evidential | is this figure in the source, where the source says it is? | grounded | `src/cite.mjs`, `src/citefuzz.mjs` |
| Executable | does this formula pass the rule's tests? | proven against its tests | `src/formula.mjs`, `src/formulafuzz.mjs` |
| Logical | does this claim follow from what is given? | proven within its encoding | `src/logic.mjs`, `src/logicfuzz.mjs` |

Each check was added only together with the harness that attacks it. Every harness takes three opinions on every
reply (how the reply was made, the check, and a second reader written apart from it) and is then turned on twelve
readers with a leak planted in each, to show it can find one.

**Evidential.** A quote bonds only when it is in the document letter for letter, begins and ends at the edge of a word
or a number, lies in a line that is about what was asked, and holds that line's figure, whole; and only when the
document does not disagree with itself about that figure. The value is read from the document by code. A figure is
read only where it is written plainly: a figure with a sign in front, a leading point, a range, a unit run on to it,
or a word like "million" after it is not read at all. The model is asked to copy the one line that states the figure
and is never asked whether the figure is there: offered the word "none", this model said none of a third of the
figures that were in front of it (`data/bench.json`, made on dev problems before the seal). One of the planted readers
is DocDec's own span check as it shipped, which lets a figure cut out of a longer one through.

**Executable.** The model writes a rule given in words as a formula over a letter for each quantity, in a language of
four signs and brackets that is its own sandbox. The formula bonds only if it passes every one of the rule's tests,
and the tests are chosen so that every near-miss of the rule (a sign changed, the two sides of one swapped, a side
left out, a number one out, a letter swapped) fails one. The limit is shown, not hidden: a formula built from the
tests themselves (the rule plus a product that is nought at every test) passes them all and is a different rule; the
harness makes one for every rule and counts it bonding.

**Logical.** The model writes a yes-or-no claim as a comparison (`p × c + d ≥ 300`), and a small exact solver decides
it from what is given: yes, no, or it depends. The solver is written for this build, not a general one such as Z3. It
decides one fragment completely (a sum of products and quotients, each quantity used once, each known exactly or
between two figures) by arithmetic on ranges, and refuses every other claim. Its second procedure works the formula
out at every corner of the ranges instead. The verdict is exact about the claim as the model wrote it down; whether
the model wrote down the right claim is not checked, and the page counts how often it did not.

```bash
node --test test/cite.test.mjs test/citefuzz.test.mjs test/readers.test.mjs test/formula.test.mjs test/formulafuzz.test.mjs test/logic.test.mjs test/logicfuzz.test.mjs
```

## What is in it

| path | what |
|---|---|
| `vendor/crystal/` | The Crystal's sealed kernels, and The Climb's inside them (`vendor/PROVENANCE.json`) |
| `vendor/docdec/` | DocDec's verifier gate at a fixed commit: a reader to catch, never a bond-check here |
| `src/strength.mjs` | the four kinds of bond, what each proves, and the weakest-root rule (gated) |
| `src/cite.mjs`, `src/citefuzz.mjs` | the evidential check, and the attack on it: 18 ways of forging a quote, 19 hard cases, a second reader, 12 leaky readers (gated) |
| `src/formula.mjs`, `src/formulafuzz.mjs` | the executable check, and the attack on it: 14 ways of forging a formula, the 12 kept rules, a check for weak tests, a second runner, the limit shown, 12 leaky runners (gated) |
| `src/logic.mjs`, `src/logicfuzz.mjs` | the logical check, and the attack on it: 12 ways of making a claim to trip a solver or to be refused, 15 hard questions, a second procedure over every corner, 12 leaky solvers (gated) |
| `src/tasks.mjs` | the problems and their documents, twelve kinds to a sheet, made by code from a seed (gated) |
| `src/weave.mjs` | the growth law: cite, write the rule or the claim, then work out; refuse when a cell cannot be bonded (gated) |
| `src/facets.mjs`, `src/set.mjs` | the labelled lattice, and the table of checks (gated) |
| `src/counts.mjs`, `src/claims.mjs`, `src/onetry.mjs` | every count, every verdict, and the one unchecked reply (gated) |
| `page/gem.js` | the glass: WebGL2; each strength is its own material. It draws a record and decides nothing |
| `page/`, `index.html` | the page: every kernel inlined, every published number baked in at build time |
| `scripts/` | vendor, lay the seed, build, gate, seal, publish; `dev.html`, the builder's bench |

## Run it

```bash
node --test test/*.test.mjs
```

```bash
node scripts/make-page.mjs
```

```bash
node scripts/vendor.mjs --check
```

The model work happens in the browser: open the live page (or `index.html` from any static server) and press
**Grow it here**. It needs a browser with WebGPU. The record plays without one, and so does the citation check you can
try on your own document.

## Honest edges

- Grounded is not true. If the document is wrong the answer is wrong, and it is still grounded. The label is what the
  build promises.
- Passing the tests is not being right. A formula built to pass exactly a rule's tests and nothing else passes; the
  harness shows it. That is why such a facet is proven against its tests, never proven.
- A claim is decided as it was written down. If the model wrote "at most" for "at least", the verdict is exact about
  the wrong claim. That is why such a facet is proven within its encoding, never proven, and the page counts them.
- The solver is small: one fragment, decided completely, everything else refused.
- A division the model gets wrong is not split smaller: The Crystal, as sealed, has smaller steps for adding, taking
  away and multiplying, but not for dividing. Such a problem gets no answer, never a wrong one.
- "About what was asked" is a match of words. A question put in other words than the document's is refused, not
  guessed.
- A figure must be written plainly to be read. A signed figure, a leading point, a range, or "5 million" is refused,
  not read: strict on purpose.
- The documents here are short agreements made by code, one statement to a line, and the rules' tests are made by
  code too. Nothing here measures the checks on long, messy documents or on tests a person wrote.
- The attack on each check is evidence, not a proof: it shows that many forged replies, made many ways, found no leak.
- For the problems that give no rule, the problem holds the question: which figures it needs and how they combine.
- Nothing here trains the model. The model's files come from the public WebLLM model library; this page does not pin
  their hashes.

Built by Kar. MIT licence, holder Simon Gant. Supplied by [AI Native Solutions](https://www.ai-nativesolutions.com);
support is agreed per deployment, in each deployment's agreement.
Powered by the Konomi architecture, created by Thomas Frumkin.
