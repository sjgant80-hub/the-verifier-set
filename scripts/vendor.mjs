// vendor.mjs — what this build stands on, byte for byte.
//   vendor/crystal/   The Crystal's kernels as its seal froze them (and, inside them, The Climb's as ITS seal froze
//                     them). A file is taken only if its hash is the one The Crystal's own SEAL.json gives it.
//   vendor/docdec/    DocDec's verifier gate (src/gate.mjs) at a fixed commit of the docdecdemo repository.
// Nothing in vendor/ is edited here. What this build adds is in src/, and wraps these.
//   node scripts/vendor.mjs <path to the-crystal> <path to docdecdemo>     copy the files out of those commits
//   node scripts/vendor.mjs --check                                        fetch the same files from GitHub at those
//                                                                          commits and compare every byte (CI)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';

export const CRYSTAL = { repo: 'sjgant80-hub/the-crystal', commit: '6f19e28' };
export const DOCDEC = { repo: 'sjgant80-hub/docdecdemo', commit: '85bb7f6', files: ['src/gate.mjs'] };
const sha = (b) => createHash('sha256').update(b).digest('hex');
const raw = async (repo, commit, path) => { const r = await fetch(`https://raw.githubusercontent.com/${repo}/${commit}/${path}`); if (!r.ok) throw new Error(`${repo} ${path}: ${r.status}`); return Buffer.from(await r.arrayBuffer()); };
const put = (path, bytes) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes); };

if (process.argv[1] && process.argv[1].endsWith('vendor.mjs')) {
  if (process.argv[2] === '--check') {
    const prov = JSON.parse(readFileSync('vendor/PROVENANCE.json', 'utf8'));
    const sealBytes = await raw(prov.crystal.repo, prov.crystal.commit, 'SEAL.json'), seal = JSON.parse(sealBytes.toString('utf8'));
    let bad = 0;
    if (sha(sealBytes) !== prov.crystal.sealSha256) { bad++; console.error('DIFFERS The Crystal SEAL.json'); }
    for (const f of prov.crystal.files) {
      const theirs = await raw(prov.crystal.repo, prov.crystal.commit, f.path), ours = readFileSync(`vendor/crystal/${f.path}`);
      if (!(sha(theirs) === sha(ours) && sha(ours) === f.sha256 && seal.files[f.path] === f.sha256)) { bad++; console.error(`DIFFERS crystal ${f.path}`); }
    }
    for (const f of prov.docdec.files) {
      const theirs = await raw(prov.docdec.repo, prov.docdec.commit, f.path), ours = readFileSync(`vendor/docdec/${f.path}`);
      if (!(sha(theirs) === sha(ours) && sha(ours) === f.sha256)) { bad++; console.error(`DIFFERS docdec ${f.path}`); }
    }
    console.log(bad ? `${bad} vendored files differ from their source` : `same: ${prov.crystal.files.length} files = ${prov.crystal.repo}@${prov.crystal.commit.slice(0, 7)} as its seal froze them; ${prov.docdec.files.length} = ${prov.docdec.repo}@${prov.docdec.commit.slice(0, 7)}`);
    process.exitCode = bad ? 1 : 0;
  } else {
    const [crystal, docdec] = process.argv.slice(2);
    if (!crystal || !docdec) { console.error('usage: node scripts/vendor.mjs <path to the-crystal> <path to docdecdemo> | --check'); process.exit(2); }
    const git = (from, ...args) => execFileSync('git', ['-C', from, ...args], { maxBuffer: 64 << 20 });
    const cc = git(crystal, 'rev-parse', CRYSTAL.commit).toString('utf8').trim(), sealBytes = git(crystal, 'show', `${cc}:SEAL.json`), seal = JSON.parse(sealBytes.toString('utf8'));
    const cFiles = [];
    for (const path of Object.keys(seal.files).filter((p) => p.endsWith('.mjs'))) {
      const bytes = git(crystal, 'show', `${cc}:${path}`), h = sha(bytes);
      if (seal.files[path] !== h) throw new Error(`${path} at ${cc.slice(0, 7)} is not the file The Crystal's seal froze`);
      put(`vendor/crystal/${path}`, bytes);
      cFiles.push({ path, sha256: h });
    }
    const dc = git(docdec, 'rev-parse', DOCDEC.commit).toString('utf8').trim(), dFiles = [];
    for (const path of DOCDEC.files) { const bytes = git(docdec, 'show', `${dc}:${path}`); put(`vendor/docdec/${path}`, bytes); dFiles.push({ path, sha256: sha(bytes) }); }
    writeFileSync('vendor/PROVENANCE.json', JSON.stringify({
      v: 'the-verifier-set-vendor/1', note: 'what this build stands on, byte for byte; every crystal hash is the hash The Crystal\'s own SEAL.json gives the file',
      crystal: { repo: CRYSTAL.repo, commit: cc, sealSha256: sha(sealBytes), files: cFiles }, docdec: { repo: DOCDEC.repo, commit: dc, files: dFiles },
    }, null, 1) + '\n');
    console.log(`vendored ${cFiles.length} files from ${CRYSTAL.repo}@${cc.slice(0, 7)} (seal ${sha(sealBytes).slice(0, 12)}) and ${dFiles.length} from ${DOCDEC.repo}@${dc.slice(0, 7)}`);
  }
}
