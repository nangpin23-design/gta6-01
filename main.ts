// SUNSET RUN — the entry program for make.fun's gta6-01 bounty.
//
// The game is plain static files under game/: index.html plus ES modules that
// run offline in a desktop browser, with no network request anywhere. This
// program is the hand-in: it copies game/ and screenshots/ beside this file
// into the output directory and writes /output/dossier.json with buildDossier
// from the kit's vendored make.fun library, so the judge can read the game
// from its screenshots and its source outline.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Node 22, standard library only. No installs, no network, deterministic:
// two runs write the same bytes.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const gameDir = join(repoRoot, 'game');
const shotDir = join(repoRoot, 'screenshots');

// Count the regular files inside a directory tree, for the hand-in log line.
function countFiles(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) total += countFiles(join(dir, entry.name));
    else if (entry.isFile()) total += 1;
  }
  return total;
}

mkdirSync(outputDir, { recursive: true });
cpSync(gameDir, join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(shotDir)) cpSync(shotDir, join(outputDir, 'screenshots'), { recursive: true });

// The scorer's caps, as the kit's gate states them: the dossier text is capped
// at 160 KiB; at most 4 screenshots of at most 256 KiB each; game/ holds at
// most 993 files and 48 MiB in all, with no path over 1000 bytes.
const gameFiles = countFiles(gameDir);
const shotFiles = existsSync(shotDir) ? countFiles(shotDir) : 0;
// Build the dossier in memory first, so a failure here never leaves a
// half-written /output behind.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(
  `SUNSET RUN handed in: ${gameFiles} game files, ${shotFiles} screenshots, dossier ${dossier.length} bytes`,
);
