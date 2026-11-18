// VELMORA HEAT — the entry program for make.fun's gta6-01 bounty.
//
// The game itself is plain static files under game/: index.html plus ES modules
// that play offline in a desktop browser, with no network request anywhere.
// This program is the hand-in: it copies game/ and screenshots/ into the
// output directory and writes dossier.json there, using buildDossier from the
// kit's vendored make.fun library, so the judge can read the game from its
// screenshots and its source outline.
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

// Walk a directory tree and count the regular files inside it.
function countFiles(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) total += countFiles(path);
    else if (entry.isFile()) total += 1;
  }
  return total;
}

function copyTree(source, target) {
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
}

// The game has to exist, and it has to fit the gate's own caps, before anything
// is copied: game/index.html must be there, game/ must hold at most 993 files.
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('game/index.html is missing: there is no game to hand in');
}
const gameFileCount = countFiles(gameDir);
if (gameFileCount > 993) {
  throw new Error(`game/ holds ${gameFileCount} files: the gate caps it at 993`);
}

mkdirSync(outputDir, { recursive: true });
copyTree(gameDir, join(outputDir, 'game'));
if (existsSync(shotDir)) copyTree(shotDir, join(outputDir, 'screenshots'));

// The scorer's caps, straight from the kit's gate: text_max_bytes shapes the
// dossier's source text; the rest refuse an entry the scorer would refuse —
// more than 4 screenshots or one over 256 KiB, more than 993 files in game/ or
// 48 MiB of game files in all, or a path under game/ over 1000 bytes. game/
// counts beside /output's own 1000-entry cap, its screenshots/ and dossier.json
// included, so the entry leaves room under every one.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outputDir, 'dossier.json'), dossier);

// Refuse a broken hand-in instead of handing it in quietly. The gate wants
// 3 or 4 screenshots and a dossier under 1.5 MiB; a missing screenshots/
// folder means the judge would see a game with no cover at all.
const shotCount = existsSync(join(outputDir, 'screenshots'))
  ? readdirSync(join(outputDir, 'screenshots')).filter((name) => !name.startsWith('.')).length
  : 0;
if (shotCount < 3 || shotCount > 4) {
  throw new Error(`expected 3-4 screenshots, found ${shotCount}: the entry is not shippable`);
}
if (dossier.length > 1572864) {
  throw new Error(`dossier.json is ${dossier.length} bytes: over the 1.5 MiB cap`);
}
console.log(
  `VELMORA HEAT handed in: ${gameFileCount} game files, ${shotCount} screenshots, dossier ${dossier.length} bytes`,
);
