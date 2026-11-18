// NEON TIDE — the entry program for make.fun's gta6-01 bounty.
//
// The game itself is plain static files under game/: index.html plus ES modules
// that run offline in a desktop browser, with no network request anywhere. This
// program is the hand-in: it copies game/ and screenshots/ beside this file into
// the output directory and writes /output/dossier.json with buildDossier from the
// kit's vendored make.fun library, so the judge can read the game from its
// screenshots and its source outline.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Node 22, standard library only. No installs, no network, deterministic:
// two runs write the same bytes.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function countTree(dir) {
  let files = 0;
  let bytes = 0;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name);
    if (name.isDirectory()) {
      const sub = countTree(path);
      files += sub.files;
      bytes += sub.bytes;
    } else if (name.isFile()) {
      files += 1;
      bytes += statSync(path).size;
    }
  }
  return { files, bytes };
}

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

const gameStats = countTree(join(repoRoot, 'game'));
const shotStats = existsSync(join(repoRoot, 'screenshots'))
  ? countTree(join(repoRoot, 'screenshots'))
  : { files: 0, bytes: 0 };

// Build the dossier in memory first, so the hand-in log can report its size
// before anything is written to disk.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

console.log(
  `NEON TIDE handed in: ${gameStats.files} game files, ${shotStats.files} screenshots, dossier ${dossier.length} bytes`,
);
