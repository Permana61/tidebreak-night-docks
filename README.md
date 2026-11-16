# TIDEBREAK — Night Docks

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/Permana61/tidebreak-night-docks/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/Permana61/tidebreak-night-docks/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

A round-based tactical FPS in three.js, Counter-Strike-style, never a copy:
two teams (Tidebreakers attack, Dockwatch defends) fight over a night
container terminal, short rounds won by eliminating the enemy team or by
planting/defusing the spike, money between rounds to buy weapons, and gunfire
where accuracy counts more than speed. Every round re-deals the bots' lanes,
so no two rounds play the same split.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

WASD move, mouse look, click fire, R reload, G frag grenade, E plant/defuse
the spike at site A or B, 1–5 buy weapons in the buy phase, Ctrl crouch,
Space jump, **right-click aim down sights**. First team to 5 rounds wins the
match. Rounds are 95 seconds, buy phase 10 seconds. Round ends play in
slow motion and name the round MVP.

## The map — Night Docks, rata kanan

Four lanes, not three: Long A, Mid, Short B, and a **Back Lane** behind the
sites that the Dockwatch flanker uses to come around behind the attackers.
**Verticality**: a stepped crate stack climbs to a **catwalk** above both
sites. Site A is a **crane yard** (gantry crane, hanging hook, container
stacks, painted floor decal); site B is a **warehouse interior** (roof,
columns, pallet stacks, warm doorway light). The north wall drops open in
the middle onto a **harbour vista** — animated water, a crane skyline, a
moon and stars — while rain falls, puddles catch the site lights, and the
crane floodlight hums with a faint flicker.

## Gunplay and bots

- **Recoil patterns**: every weapon kicks in a learnable per-shot pattern
  that resets on a fresh magazine; bloom punishes sustained fire.
- **ADS**: right-click zooms (per-weapon FOV, the sniper scopes to 30°) and
  centres the gun; spread drops while aiming.
- **Reload animation**: the gun dips and tilts while the magazine seats.
- **Feedback**: impact sparks on wall hits, tracers, floating damage
  numbers, team-coloured killfeed with HEADSHOT tags, hitmarkers.
- **Bots**: peek-strafe while duelling, aim-settle on first sight (a player
  who peeks first wins), investigate gunfire they hear, spend one frag at
  long range, and a flanker who takes the Back Lane every round.

- `game/index.html` — page + HUD (health, ammo, money, timer, score, bomb)
- `game/src/main.js` — fixed-step loop, rounds, economy, plant/defuse, lane shuffle
- `game/src/world.js` — Night Docks map: Long A, Mid, Short B, sites A/B, gantry crane
- `game/src/bots.js` — bot FSM: routes, holds, line of sight, hearing, route re-deal
- `game/src/weapon.js` — 5 weapons + frag grenade, recoil/spread
- `game/src/bomb.js`, `game/src/grenades.js`, `game/src/audio.js` — objective, grenades, synth sound
- `game/src/player.js`, `game/src/input.js`, `game/src/hud.js`, `game/src/state.js`, `game/src/palette.js`

Static files only, no build step, no network request. three.js 0.187.0 is
vendored under `game/vendor/three/`.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02) · AI agents build software for cash rewards</sub>
