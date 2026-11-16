// TIDEBREAK — a round-based tactical FPS on three.js.
// Boot and the one loop: a fixed 60 Hz simulation feeding a render at the
// display's rate. ?shot=start|play|buy|end with &seed=N sets up a deterministic
// frame for a capture, renders it twice, then freezes it and sets
// window.__shotReady. Tidebreakers (you + 5 bots) attack; Dockwatch (6 bots)
// defends. Win a round by eliminating the enemy team or by planting the spike
// and letting it detonate; lose it if the spike is defused or time runs out.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWorld, SITES, SPAWNS } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeapon, WEAPONS, GRENADE } from './weapon.js';
import { createBots } from './bots.js';
import { createBomb } from './bomb.js';
import { createGrenades } from './grenades.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createState, PHASE, ECONOMY } from './state.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(seed);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.canvas), 30, 85);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 140);
scene.add(camera);

const world = createWorld(scene);
const bots = createBots(scene, world, random);
const bomb = createBomb(scene);
const grenades = createGrenades(scene, world);
const weapon = createWeapon(camera);
const hud = createHud();
const audio = createAudio();
const player = createPlayer(world.colliders);
const input = createInput(renderer.domElement, onLockChange);
const raycaster = new THREE.Raycaster();
raycaster.far = 90;
const direction = new THREE.Vector3();
const tmpDir = new THREE.Vector3();
const tmpPos = new THREE.Vector3();

const state = createState();
const body = player.state;
const me = { pos: body.position, alive: true, health: 100, isPlayer: true, name: 'You' };
let started = false;
let frozen = false;
let accumulator = 0;
let lastTime = performance.now();
let plantHold = 0;
let defuseHold = 0;
let lastBeep = 0;
let buyItems = [];

// Tracers: a fixed pool, reused — no allocation in the hot loop.
const tracers = [];
for (let i = 0; i < 10; i += 1) {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffb02e, transparent: true, opacity: 0 }));
  scene.add(line);
  tracers.push({ line, life: 0 });
}
function tracer(from, to) {
  const t = tracers.find((x) => x.life <= 0) ?? tracers[0];
  const p = t.line.geometry.attributes.position;
  p.setXYZ(0, from.x, from.y, from.z);
  p.setXYZ(1, to.x, to.y, to.z);
  p.needsUpdate = true;
  t.line.material.opacity = 0.9;
  t.life = 0.08;
}

// Display names for the two teams; the simulation keys stay 'vanguard' and
// 'cinder' so the state, HUD and bots need no other changes.
const TEAM_NAMES = { vanguard: 'Tidebreakers', cinder: 'Dockwatch' };
const TIDE_CALLSIGNS = ['Anchor', 'Buoy', 'Current', 'Harbor', 'Tide'];
const DOCK_CALLSIGNS = ['Crane', 'Lantern', 'Mast', 'Quay', 'Siren', 'Tug'];
const LANE_DECK = ['A', 'B', 'MID', 'A', 'B', 'MID'];

function shuffledDeck() {
  const deck = LANE_DECK.slice();
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function makeTeams() {
  const vSpawns = SPAWNS.vanguard.slice();
  const cSpawns = SPAWNS.cinder.slice();
  const routes = ['A', 'B', 'MID', 'A', 'B'];
  for (let i = 0; i < 5; i += 1) bots.makeBot('vanguard', TIDE_CALLSIGNS[i], vSpawns[i + 1], routes[i]);
  const cRoutes = ['A', 'B', 'MID', 'A', 'B', 'MID'];
  for (let i = 0; i < 6; i += 1) bots.makeBot('cinder', DOCK_CALLSIGNS[i], cSpawns[i], cRoutes[i]);
}

function startRound() {
  state.phase = PHASE.BUY;
  state.timeLeft = state.buyTime;
  state.bomb.state = 'idle';
  state.bomb.site = null;
  state.bomb.timer = 30;
  bomb.hide();
  plantHold = 0;
  defuseHold = 0;
  me.alive = true;
  me.health = 100;
  body.position.set(SPAWNS.vanguard[0][0], 0, SPAWNS.vanguard[0][1]);
  body.velocity.set(0, 0, 0);
  body.yaw = 0;
  body.pitch = 0;
  bots.reset();
  bots.assignRoutes(shuffledDeck()); // fresh lane split every round
  weapon.refill();
  refreshBuy();
  hud.setRound(state.round);
  hud.setScore(state.score.vanguard, state.score.cinder);
  hud.setMoney(state.money);
  hud.setHealth(100);
  hud.setBomb('SPIKE NOT PLANTED', 'idle');
  hud.showOverlay('buy');
  hud.showBuy(state.money, buyItems);
  audio.round();
}

function refreshBuy() {
  buyItems = [
    { key: '1', id: 'rifle', name: WEAPONS.rifle.name, price: WEAPONS.rifle.price, owned: weapon.state.id === 'rifle' },
    { key: '2', id: 'smg', name: WEAPONS.smg.name, price: WEAPONS.smg.price, owned: weapon.state.id === 'smg' },
    { key: '3', id: 'shotgun', name: WEAPONS.shotgun.name, price: WEAPONS.shotgun.price, owned: weapon.state.id === 'shotgun' },
    { key: '4', id: 'sniper', name: WEAPONS.sniper.name, price: WEAPONS.sniper.price, owned: weapon.state.id === 'sniper' },
    { key: '5', id: 'grenade', name: GRENADE.name, price: GRENADE.price, owned: weapon.state.grenades > 0 },
  ];
}

function buy(id) {
  if (state.phase !== PHASE.BUY) return;
  if (id === 'grenade') {
    if (state.money < GRENADE.price || weapon.state.grenades >= 2) return;
    state.money -= GRENADE.price;
    weapon.state.grenades += 1;
  } else {
    const w = WEAPONS[id];
    if (state.money < w.price || weapon.state.id === id) return;
    state.money -= w.price;
    weapon.equip(id);
  }
  hud.setMoney(state.money);
  hud.setWeapon(weapon.def().name);
  hud.setAmmo(weapon.state.mag, weapon.state.reserve);
  refreshBuy();
  hud.showBuy(state.money, buyItems);
}

function deploy() {
  if (state.phase !== PHASE.BUY) return;
  state.phase = PHASE.LIVE;
  state.timeLeft = state.roundTime;
  hud.hideOverlay();
  hud.hideBuy();
  input.requestLock();
  audio.unlock();
}

function endRound(winner, reason) {
  if (state.phase === PHASE.OVER || state.phase === PHASE.MATCH) return;
  state.phase = PHASE.OVER;
  state.winner = winner;
  if (winner === 'vanguard') {
    state.score.vanguard += 1;
    state.money += ECONOMY.roundWin;
  } else {
    state.score.cinder += 1;
    state.money += ECONOMY.roundLoss;
  }
  hud.setScore(state.score.vanguard, state.score.cinder);
  hud.setMoney(state.money);
  hud.feedLine(`${TEAM_NAMES[winner]} takes the round — ${reason}`);
  if (document.pointerLockElement) document.exitPointerLock();
  if (state.score.vanguard >= state.winsToTake || state.score.cinder >= state.winsToTake) {
    state.phase = PHASE.MATCH;
    state.matchWinner = winner;
    hud.showOverlay('match', `${TEAM_NAMES[winner]} wins the match ${state.score.vanguard} — ${state.score.cinder}.`);
  } else {
    hud.showOverlay('round', `${TEAM_NAMES[winner]} takes round ${state.round} — ${reason}.`);
  }
}

function nextRound() {
  if (state.phase === PHASE.MATCH) {
    state.round = 1;
    state.score.vanguard = 0;
    state.score.cinder = 0;
    state.money = ECONOMY.start;
    weapon.equip('sidearm');
    weapon.state.grenades = 0;
  } else {
    state.round += 1;
  }
  startRound();
}

function damagePlayer(amount, fromName) {
  if (shot) return; // staged capture: the player never dies in a screenshot
  if (!me.alive || state.phase === PHASE.BUY) return;
  me.health -= amount;
  hud.setHealth(me.health);
  hud.hurt();
  if (me.health <= 0) {
    me.alive = false;
    state.deaths += 1;
    hud.feedLine(`${fromName} eliminated You`);
    if (document.pointerLockElement) document.exitPointerLock();
    hud.showOverlay('round', 'You are down. Your squad fights on — spectating.');
    // Death does not end the round: bots decide it. The overlay is a pause
    // screen; clicking resumes the spectator view.
    state.phase = PHASE.LIVE;
  }
}

function damageBot(bot, amount, part, byPlayer) {
  const killed = bots.damage(bot, amount);
  if (byPlayer) {
    hud.hitMarker(killed);
    audio.hit();
    if (killed) {
      audio.kill();
      state.kills += 1;
      state.money += ECONOMY.kill;
      hud.setMoney(state.money);
      hud.feedLine(`You eliminated ${bot.name}${part === 'head' ? ' (headshot)' : ''}`);
    }
  }
  return killed;
}

// Resolve a bot's shot against its target (player or another bot).
function resolveBotShot(shot) {
  const from = shot.shooter;
  tmpPos.set(from.pos.x, 1.45, from.pos.z);
  const target = shot.target;
  const tx = target.pos.x;
  const tz = target.pos.z;
  const dx = tx - from.pos.x;
  const dz = tz - from.pos.z;
  const dist = Math.hypot(dx, dz) || 1;
  tmpDir.set(dx / dist + (random() * 2 - 1) * shot.spread, (1.45 - 1.45) / dist + (random() * 2 - 1) * shot.spread * 0.5, dz / dist + (random() * 2 - 1) * shot.spread);
  tmpDir.normalize();
  raycaster.set(tmpPos, tmpDir);
  raycaster.far = dist + 2;
  const wall = raycaster.intersectObjects(world.shootables, false)[0];
  if (wall && wall.distance < dist - 0.5) return; // cover stops the shot
  const head = random() < shot.headChance;
  const dmg = head ? shot.damage * 2 : shot.damage;
  tracer(tmpPos, new THREE.Vector3(tx, 1.3, tz));
  if (target.isPlayer) damagePlayer(dmg, from.name);
  else damageBot(target, dmg, head ? 'head' : 'torso', false);
}

function shoot(spread) {
  if (!weapon.takeRound()) return false;
  camera.getWorldDirection(direction);
  const def = weapon.def();
  const pellets = def.pellets ?? 1;
  let hitAny = false;
  for (let p = 0; p < pellets; p += 1) {
    tmpDir.copy(direction);
    tmpDir.x += (random() * 2 - 1) * spread;
    tmpDir.y += (random() * 2 - 1) * spread;
    tmpDir.z += (random() * 2 - 1) * spread;
    tmpDir.normalize();
    raycaster.set(camera.position, tmpDir);
    raycaster.far = def.range;
    const hits = raycaster.intersectObjects(world.shootables.concat(bots.hitMeshes), false);
    const hit = hits[0];
    if (!hit) continue;
    tracer(camera.position, hit.point);
    if (hit.object.userData.bot) {
      const bot = hit.object.userData.bot;
      const part = hit.object.userData.part;
      const dmg = Math.round(def.damage * (part === 'head' ? def.headMult : 1));
      damageBot(bot, dmg, part, true);
      hitAny = true;
    }
  }
  weapon.pullTrigger();
  player.recoil(0.009 + random() * 0.004, (random() * 2 - 1) * 0.004);
  bots.hear(body.position.x, body.position.z, state.elapsed);
  hud.setAmmo(weapon.state.mag, weapon.state.reserve);
  audio.shot();
  return hitAny;
}

function throwGrenade() {
  if (weapon.state.grenades <= 0) return;
  camera.getWorldDirection(direction);
  tmpPos.copy(camera.position);
  if (grenades.throwGrenade(tmpPos, direction)) weapon.state.grenades -= 1;
}

function step(dt) {
  state.elapsed += dt;
  if (state.phase === PHASE.BUY) {
    state.timeLeft -= dt;
    hud.setTimer(state.timeLeft);
    if (state.timeLeft <= 0) deploy();
    return;
  }
  if (state.phase !== PHASE.LIVE && state.phase !== PHASE.PLANTED) return;
  state.timeLeft -= dt;
  hud.setTimer(state.timeLeft);

  // Bomb clock.
  if (state.phase === PHASE.PLANTED) {
    state.bomb.timer -= dt;
    bomb.blink(state.elapsed);
    hud.setBomb(`SPIKE PLANTED — ${Math.ceil(state.bomb.timer)}s`, 'planted');
    if (Math.floor(state.bomb.timer) !== lastBeep) { lastBeep = Math.floor(state.bomb.timer); audio.beep(); }
    if (state.bomb.timer <= 0) {
      audio.explode();
      endRound('vanguard', 'the spike detonated');
      return;
    }
  } else if (state.timeLeft <= 0) {
    endRound('cinder', 'time expired, spike not planted');
    return;
  }

  // Player movement and plant/defuse holds.
  player.step(dt, input.state.keys);
  weapon.step(dt);
  const site = bomb.nearSite(body.position.x, body.position.z);
  const holdingE = input.state.keys.has('KeyE');
  if (me.alive && holdingE && site && state.phase === PHASE.LIVE) {
    plantHold += dt;
    hud.setPlant(plantHold / 3, `Planting spike at ${site}…`);
    if (plantHold >= 3) {
      state.phase = PHASE.PLANTED;
      state.bomb.state = 'planted';
      state.bomb.site = site;
      state.bomb.x = SITES[site].x;
      state.bomb.z = SITES[site].z;
      state.bomb.timer = 30;
      state.money += ECONOMY.plant;
      hud.setMoney(state.money);
      bomb.place(SITES[site].x, SITES[site].z, true);
      hud.setPlant(null);
      hud.feedLine(`You planted the spike at ${site}`);
      audio.plant();
    }
  } else if (me.alive && holdingE && state.phase === PHASE.PLANTED && Math.hypot(body.position.x - state.bomb.x, body.position.z - state.bomb.z) < 2.2) {
    defuseHold += dt;
    hud.setPlant(defuseHold / 4, 'Defusing spike…');
    if (defuseHold >= 4) {
      state.money += ECONOMY.defuse;
      endRound('cinder', 'the spike was defused');
      return;
    }
  } else {
    plantHold = 0;
    defuseHold = 0;
    hud.setPlant(null);
  }

  // Grenades.
  const boom = grenades.step(dt);
  if (boom) {
    audio.explode();
    const targets = [me, ...bots.bots];
    for (const t of targets) {
      if (!t.alive) continue;
      const d = grenades.damageAt(boom.x, boom.z, t.pos.x, t.pos.z);
      if (d <= 0) continue;
      if (t.isPlayer) damagePlayer(d, 'Frag grenade');
      else damageBot(t, d, 'torso', true);
    }
  }

  // Bots: each returns a shot event for main to resolve.
  const vanguardAlive = bots.bots.filter((b) => b.team === 'vanguard' && b.alive);
  const cinderAlive = bots.bots.filter((b) => b.team === 'cinder' && b.alive);
  for (const bot of bots.bots) {
    if (!bot.alive) continue;
    const enemies = bot.team === 'vanguard'
      ? [...cinderAlive]
      : [...vanguardAlive, ...(me.alive ? [me] : [])];
    // Dockwatch bots converge on a planted spike to defuse it.
    if (bot.team === 'cinder' && state.phase === PHASE.PLANTED && state.bomb.site) {
      bot.route = [SITES[state.bomb.site].x < 0 ? 10 : 11];
      bot.wp = 0;
    }
    const shotEv = bots.stepBot(bot, dt, state.elapsed, me, enemies, state.phase);
    if (shotEv) resolveBotShot(shotEv);
    // A Dockwatch bot standing on the planted spike defuses it in 4 s.
    if (bot.team === 'cinder' && state.phase === PHASE.PLANTED) {
      const near = Math.hypot(bot.pos.x - state.bomb.x, bot.pos.z - state.bomb.z) < 2.2;
      bot.defusing = near ? bot.defusing + dt : 0;
      if (near) hud.setPlant(bot.defusing / 4, `${bot.name} is defusing the spike…`);
      if (bot.defusing >= 4) {
        hud.setPlant(null);
        endRound('cinder', 'the spike was defused');
        return;
      }
    }
  }
  bots.sync();

  // Round end by elimination.
  const vanguardUp = me.alive || vanguardAlive.length > 0;
  const cinderUp = cinderAlive.length > 0;
  if (!cinderUp) endRound('vanguard', 'enemy team eliminated');
  else if (!vanguardUp) endRound('cinder', 'Tidebreakers eliminated');
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    const look = input.takeLook();
    player.look(look.x, look.y);
    if (state.phase === PHASE.LIVE || state.phase === PHASE.PLANTED) {
      if (input.state.firing && weapon.ready() && me.alive) shoot(weapon.spread(player.groundSpeed()));
      if (input.state.keys.has('KeyR')) weapon.reload();
      if (input.takePressed('KeyG')) throwGrenade();
    }
    if (state.phase === PHASE.BUY) {
      for (const key of ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5']) {
        if (input.takePressed(key)) buy(['rifle', 'smg', 'shotgun', 'sniper', 'grenade'][Number(key.slice(-1)) - 1]);
      }
    }
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
    for (const t of tracers) {
      if (t.life > 0) {
        t.life -= dt;
        t.line.material.opacity = Math.max(0, t.life * 10);
      }
    }
  }
  renderer.render(scene, camera);
}

function syncCamera() {
  camera.position.set(body.position.x, body.position.y + body.eye, body.position.z);
  camera.rotation.set(body.pitch, body.yaw, 0, 'YXZ');
}

function aimAt(point) {
  const dx = point.x - body.position.x;
  const dy = point.y - (body.position.y + body.eye);
  const dz = point.z - body.position.z;
  const length = Math.hypot(dx, dy, dz) || 1;
  body.yaw = Math.atan2(-dx, -dz);
  body.pitch = Math.asin(Math.max(-1, Math.min(1, dy / length)));
  syncCamera();
}

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    started = true;
    hud.hideOverlay();
    hud.hideBuy();
  } else if (state.phase === PHASE.LIVE || state.phase === PHASE.PLANTED) {
    hud.showOverlay('paused');
  }
}

hud.onPlay(() => {
  if (shot) return;
  audio.unlock();
  if (state.phase === PHASE.BUY) deploy();
  else if (state.phase === PHASE.OVER || state.phase === PHASE.MATCH) nextRound();
  else input.requestLock();
});

function settle(steps) {
  for (let index = 0; index < steps; index += 1) step(FIXED_STEP);
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

function runShot(name) {
  hud.hideOverlay();
  hud.hideBuy();
  body.pitch = 0;
  body.yaw = 0;
  if (name === 'start') {
    body.position.set(-10, 0, 11);
    settle(20);
    aimAt(new THREE.Vector3(0, 1.4, -6));
    hud.showOverlay('start');
  } else if (name === 'buy') {
    state.money = 2700;
    refreshBuy();
    body.position.set(-10, 0, 11);
    settle(20);
    aimAt(new THREE.Vector3(0, 1.4, -6));
    hud.setMoney(2700);
    hud.showBuy(2700, buyItems);
  } else if (name === 'play') {
    weapon.equip('rifle'); // play shot shows the KR-47 Kestrel, the main weapon
    hud.setWeapon(weapon.def().name);
    state.phase = PHASE.LIVE;
    state.timeLeft = 88;
    body.position.set(-6, 0, 6);
    settle(30);
    const enemies = bots.bots.filter((b) => b.team === 'cinder' && b.alive).slice(0, 3);
    const spots = [[1, 0], [4, -2], [7, -1]]; // open mid ground, clear of the container stack
    enemies.forEach((enemy, i) => { enemy.pos.set(spots[i][0], 0, spots[i][1]); });
    bots.sync();
    if (enemies.length > 0) {
      aimAt(new THREE.Vector3(4, 1.3, -2));
      shoot(0);
      settle(6);
      // Staged capture: fade the shot tracer so it does not read as a
      // full-screen laser line in the still.
      for (const t of tracers) { t.life = 0; t.line.material.opacity = 0; }
    }
    hud.setHealth(100);
    hud.setMoney(3500);
  } else if (name === 'end') {
    state.phase = PHASE.OVER;
    state.round = 5;
    state.score.vanguard = 3;
    state.score.cinder = 2;
    hud.setRound(5);
    hud.setScore(3, 2);
    body.position.set(0, 0, 8);
    settle(20);
    aimAt(new THREE.Vector3(0, 1.4, -10));
    hud.showOverlay('round', 'Tidebreakers take round 5 — the spike detonated.');
  }
  hud.setAmmo(weapon.state.mag, weapon.state.reserve);
  hud.setMoney(state.money);
  paintTwiceThenReady();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

makeTeams();
startRound();
syncCamera();
hud.setWeapon(weapon.def().name);
if (shot) runShot(shot);
else requestAnimationFrame(frame);
