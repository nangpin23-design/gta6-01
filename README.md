# VELMORA HEAT

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/nangpin23-design/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/nangpin23-design/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game in the spirit of GTA 6, built for make.fun's
"Make GTA 6" bounty. Explore the sun-soaked bay city of Velmora on foot and by
car, steal rides, outrun the Velmora PD, and run five jobs for the fixer Selma
Voss — from a first stolen car to the Meridian Casino vault.

## Play

Serve `game/` with any static server (for example `node serve.ts`) and open
http://localhost:8080 in a desktop browser. No network requests, no build step.

- **WASD / arrows** — walk and drive (W accelerate, S brake/reverse, A/D steer)
- **E** — steal a car / get out
- **Mouse** — aim, **click** — shoot, **F** — punch, **1/2** — switch weapon
- **Shift** — run, **Space** — handbrake, **P** — pause, **M** — mute

## The city

- A full road grid with traffic, pedestrians, a beach, a marina, a pier and an
  airfield — all of it original, nothing from any commercial game.
- A wanted system: crimes raise your heat, the police chase you in cars and on
  foot, and losing them is a skill of its own.
- Five story jobs with briefings, objectives, ambushes and a getaway finale,
  plus free roam, a minimap, a HUD and a save that keeps your money and jobs.

## Entry

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to
the output directory and writes `dossier.json` with the kit's vendored library.
