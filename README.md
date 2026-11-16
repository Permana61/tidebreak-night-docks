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
Space jump. First team to 5 rounds wins the match. Rounds are 95 seconds,
buy phase 10 seconds.

## Structure

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
