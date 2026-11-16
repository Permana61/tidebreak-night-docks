// Bots: one finite-state machine per agent — route, hold, engage, plant, defuse.
// They walk the waypoint graph, hold angles at sites, react to what they see
// (line of sight) and hear (gunfire within earshot), and shoot with the same
// spread rule as the player: worse on the move, better when stopped and aimed.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { ROUTES, WAYPOINTS } from './world.js';

const HEALTH = 100;
const SPEED = 3.4;
const EYE = 1.55;
const SIGHT = 34;
const HEAR = 22;

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _ray = new THREE.Raycaster();

export function createBots(scene, world, rng) {
  const group = new THREE.Group();
  scene.add(group);
  const teamMat = {
    vanguard: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.teal), roughness: 0.6 }),
    cinder: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ember), roughness: 0.6 }),
  };
  const headMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5 });
  const darkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.85 });
  const torsoGeo = new THREE.BoxGeometry(0.52, 0.78, 0.3);
  const headGeo = new THREE.SphereGeometry(0.155, 16, 12);
  const legGeo = new THREE.BoxGeometry(0.2, 0.5, 0.22);
  const gunGeo = new THREE.BoxGeometry(0.07, 0.09, 0.5);
  const bots = [];
  const hitMeshes = [];

  function makeBot(team, name, spawn, routeKey) {
    const g = new THREE.Group();
    g.position.set(spawn[0], 0, spawn[1]);
    const torso = new THREE.Mesh(torsoGeo, teamMat[team]);
    torso.position.y = 1.0;
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.53;
    const legL = new THREE.Mesh(legGeo, darkMat);
    legL.position.set(-0.13, 0.25, 0);
    const legR = new THREE.Mesh(legGeo, darkMat);
    legR.position.set(0.13, 0.25, 0);
    const gun = new THREE.Mesh(gunGeo, darkMat);
    gun.position.set(0.2, 1.05, -0.3);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.07, 0.06),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE[team]), emissive: new THREE.Color(PALETTE[team]), emissiveIntensity: 0.9 }),
    );
    visor.position.set(0, 1.56, -0.14);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.1, 0.32),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE[team]), roughness: 0.5 }));
    stripe.position.y = 1.18;
    g.add(torso, head, legL, legR, gun, visor, stripe);
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; } });
    scene.add(g);
    const bot = {
      team, name, group: g, torso, head,
      pos: g.position, yaw: team === 'vanguard' ? Math.PI : 0,
      health: HEALTH, alive: true, respawnAt: 0,
      route: ROUTES[routeKey].slice(), wp: 0, holdUntil: 0,
      state: 'route', target: null, lastSeen: null, lastSeenAt: -99,
      cooldown: 0, burst: 0, burstAt: 0, hearAt: -99, hearPos: null,
      planting: 0, defusing: 0, speed: SPEED * (0.9 + rng() * 0.2), home: [spawn[0], spawn[1]],
    };
    torso.userData.bot = bot; torso.userData.part = 'torso';
    head.userData.bot = bot; head.userData.part = 'head';
    hitMeshes.push(torso, head);
    bots.push(bot);
    return bot;
  }

  function canSee(from, to, time) {
    _a.set(from.x, EYE, from.z);
    _b.set(to.x, EYE, to.z);
    const dist = _a.distanceTo(_b);
    if (dist > SIGHT) return false;
    _ray.set(_a, _b.sub(_a).normalize());
    _ray.far = dist;
    return _ray.intersectObjects(world.shootables, false).length === 0;
  }

  // Gunfire noise: bots within earshot turn toward the shot.
  function hear(x, z, time) {
    for (const bot of bots) {
      if (!bot.alive) continue;
      const d = Math.hypot(bot.pos.x - x, bot.pos.z - z);
      if (d < HEAR) { bot.hearAt = time; bot.hearPos = { x, z }; }
    }
  }

  function damage(bot, amount) {
    if (!bot.alive) return false;
    bot.health -= amount;
    if (bot.health > 0) return false;
    bot.alive = false;
    bot.group.visible = false;
    bot.respawnAt = 0; // round-based: no respawn until the next round
    return true;
  }

  function reset() {
    for (const bot of bots) {
      const s = bot.home;
      bot.pos.set(s[0], 0, s[1]);
      bot.health = HEALTH;
      bot.alive = true;
      bot.group.visible = true;
      bot.state = 'route';
      bot.wp = 0;
      bot.target = null;
      bot.planting = 0;
      bot.defusing = 0;
      bot.cooldown = 0;
    }
  }

  // Re-deal lanes at the start of a round: each bot draws a fresh route key
  // from the shuffled deck, so no two rounds play the same lane split.
  function assignRoutes(keys) {
    for (let i = 0; i < bots.length; i += 1) {
      const bot = bots[i];
      bot.route = ROUTES[keys[i % keys.length]].slice();
      bot.wp = 0;
      bot.holdUntil = 0;
    }
  }

  // One bot, one fixed step. Returns a shot event for main to resolve, or null.
  function stepBot(bot, dt, time, player, enemies, phase) {
    if (!bot.alive) return null;
    bot.cooldown = Math.max(0, bot.cooldown - dt);
    // Pick a target: nearest living enemy with line of sight.
    let target = null;
    let best = Infinity;
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(bot.pos.x - e.pos.x, bot.pos.z - e.pos.z);
      if (d < best && canSee(bot.pos, e.pos, time)) { best = d; target = e; }
    }
    if (target) { bot.lastSeen = { x: target.pos.x, z: target.pos.z }; bot.lastSeenAt = time; }
    else if (bot.hearAt > 0 && time - bot.hearAt < 2 && bot.hearPos) {
      target = { pos: bot.hearPos, alive: true, isNoise: true };
    }
    bot.target = target && !target.isNoise ? target : null;

    if (target && !target.isNoise) {
      bot.state = 'engage';
      const dx = target.pos.x - bot.pos.x;
      const dz = target.pos.z - bot.pos.z;
      bot.yaw = Math.atan2(-dx, -dz);
      // Fire in bursts; accuracy improves when the bot stands still to aim.
      if (bot.cooldown === 0 && best < 30) {
        bot.cooldown = 0.16 + rng() * 0.12;
        bot.burst += 1;
        const spread = 0.02 + Math.min(1, best / 30) * 0.05;
        return { shooter: bot, target, spread, damage: 16, headChance: 0.08 };
      }
      return null;
    }
    // No target: walk the route, pausing to hold angles at waypoints.
    bot.state = 'route';
    if (time < bot.holdUntil) return null;
    const wp = WAYPOINTS[bot.route[bot.wp]];
    const dx = wp.x - bot.pos.x;
    const dz = wp.z - bot.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.6) {
      bot.wp = Math.min(bot.wp + 1, bot.route.length - 1);
      bot.holdUntil = time + 1.2 + rng() * 1.6;
      return null;
    }
    bot.yaw = Math.atan2(-dx, -dz);
    const step = bot.speed * dt;
    bot.pos.x += (dx / dist) * step;
    bot.pos.z += (dz / dist) * step;
    return null;
  }

  function sync() {
    for (const bot of bots) {
      bot.group.rotation.y = bot.yaw;
      bot.group.position.set(bot.pos.x, 0, bot.pos.z);
    }
  }

  return { bots, hitMeshes, makeBot, canSee, hear, damage, reset, stepBot, sync, assignRoutes };
}
