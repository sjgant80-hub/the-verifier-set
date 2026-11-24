import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { judge, inLane, health } from '../genome/cell.mjs';

const seed = JSON.parse(readFileSync(new URL('../seed.json', import.meta.url), 'utf8'));
const D = 'The unit price is 126 pounds.\nThe order size is 12 crates.\nThe late fee is 5 pounds.\nBy amendment, the late fee is 8 pounds.';

test('the judge tells the seed\'s good case from its bad one: a quote cites a figure only when it is the document\'s own', async () => {
  assert.equal(await judge(seed.judge.cases.good), 'verified');
  assert.equal(await judge(seed.judge.cases.bad), 'unverified', 'a figure cut out of a longer one is not a quote of it');
  assert.equal(await judge({ document: D, cell: 'the unit price', reply: '"The unit price is 126"' }), 'verified'); assert.equal(await judge({ document: D, cell: 'the order size', reply: 'order size is 12 crates' }), 'verified');
  for (const reply of ['The unit price is 127 pounds.', 'The order size is 12 crates.', '126', 'none', '', 'the unit price is 126 pounds.']) assert.equal(await judge({ document: D, cell: 'the unit price', reply }), 'unverified', reply);
  // what the document cannot give is refused, whatever is quoted: not stated, stated two ways, no question at all
  for (const [cell, reply] of [['the discount', 'The discount is 5 pounds.'], ['the late fee', 'The late fee is 5 pounds.'], ['the', 'x']]) assert.equal(await judge({ document: D, cell, reply }), 'refused', cell);
  for (const bad of [{ document: D, cell: 'the unit price', reply: 126 }, { document: D, cell: 'the unit price' }, { cell: 'the unit price', reply: 'x' }, { document: 5, cell: 'the unit price', reply: 'x' }, { document: D, cell: 5, reply: 'x' }, null, 'x', 7]) assert.equal(await judge(bad), 'refused', JSON.stringify(bad));
});

test('the lane takes a figure the document states once and refuses anything else', async () => {
  assert.equal(await inLane(seed.boundary.inLane), true); assert.equal(await inLane(seed.boundary.outOfLane), false);
  assert.equal(await inLane({ document: D, cell: 'the unit price' }), true); assert.equal(await inLane({ document: D, cell: 'the late fee' }), false, 'stated two ways'); assert.equal(await inLane({ document: D, cell: 'the discount' }), false);
  for (const bad of [{ document: D }, { cell: 'the unit price' }, { document: 5, cell: 'x' }, null, {}, 7]) assert.equal(await inLane(bad), false);
});

test('health says what the repository cannot see from inside itself', async () => {
  assert.deepEqual(await health(), { used: null, dependedOn: null, lastEarned: null });
  assert.equal(seed.name, 'the-verifier-set'); assert.equal(seed.genome, '1'); assert.equal(seed.provenance.repo, 'sjgant80-hub/the-verifier-set'); assert.equal(seed.provenance.grownFrom, 'sjgant80-hub/the-crystal, as sealed');
});
