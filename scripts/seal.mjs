// seal.mjs — freeze everything that can change a result before the sealed problems are run: the kernels, the vendored
// memory, the settings (which hold the sealed seed, so they fix the problems), and the claims file. Writes SEAL.json
// (a SHA-256 of each file's bytes). test/seal.test.mjs then fails if any sealed byte changes, and a sealed run counts
// only when it records this seal's own hash.
//   node scripts/seal.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const sha = (b) => createHash('sha256').update(b).digest('hex');
export const SEALED = [
  ...readdirSync('src').filter((f) => f.endsWith('.mjs')).sort().map((f) => `src/${f}`),
  ...['vendor/crystal/src', 'vendor/crystal/vendor/climb/src', 'vendor/crystal/vendor/climb/vendor', 'vendor/docdec/src'].flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.mjs')).sort().map((f) => `${d}/${f}`)),
  'data/settings.json', 'data/seed.json', 'CLAIMS.md',
];
if (process.argv[1] && process.argv[1].endsWith('seal.mjs')) {
  const files = Object.fromEntries(SEALED.map((f) => {
    const b = readFileSync(f);
    if (b.includes(13)) throw new Error(`${f} has a carriage return: the seal hashes LF bytes only`);
    return [f, sha(b)];
  }));
  writeFileSync('SEAL.json', JSON.stringify({ v: 'the-verifier-set-seal/1', note: 'every file that can change a result, frozen before the sealed problems were run; a sealed run counts only when its sealSha256 equals the SHA-256 of this file', files }, null, 1) + '\n');
  console.log(`SEAL.json: ${SEALED.length} files · seal sha256 ${sha(readFileSync('SEAL.json')).slice(0, 12)}`);
}
