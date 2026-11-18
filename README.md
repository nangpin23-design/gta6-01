# NEON TIDE

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/nangpin23-design/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/nangpin23-design/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game in the spirit of GTA 6 — entry for make.fun's "Make GTA 6" bounty, $1,666 in USDC.

**Rook Delgado** drives for fixer **Iris Vane** in **Calder Bay**, a dusk-neon coastal city. Steal cars, outrun Calder PD, and run five story jobs — from a first set of keys to the $600 Neon Tide finale.

## The city

- A full open world on foot and by car: a road grid, harbour and pier, traffic and pedestrians on the sidewalks
- Wanted level 0–5 stars: interceptors chase your car, foot cops arrest you on touch — busted costs 15% of your cash, wasted costs 10%
- Five story missions with cash rewards ($150 / $250 / $300 / $400 / $600), timers, checkpoints and crate runs
- Combat: pistol (click to shoot), fists, reloads; procedural WebAudio engine, sirens, gunshots and mission stingers
- HUD with cash, stars, objective, health, ammo, speed and a live minimap; save with S, Continue from the title screen

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

WASD move / drive · E steal & enter car · Click shoot · F punch · R reload · S save · P pause. No build step, no network — the game is plain static files under `game/`.
