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
      // Tactics: peek-strafe state, aim-settle timer, one frag per round,
      // flank role, and a kill count for the round MVP.
      peekT: 0, peekDir: 1, aimT: 0, grenadeUsed: false, flank: false, kills: 0,
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
      bot.peekT = 0;
      bot.aimT = 0;
      bot.grenadeUsed = false;
      bot.flank = false;
      bot.kills = 0;
    }
  }

  // Re-deal lanes at the start of a round: each bot draws a fresh route key
  // from the shuffled deck, so no two rounds play the same lane split. The
  // first Dockwatch bot draws the Back Lane as the flanker: it moves faster,
  // never holds at waypoints, and comes around behind the attackers.
  function assignRoutes(keys) {
    let flankerSet = false;
    for (let i = 0; i < bots.length; i += 1) {
      const bot = bots[i];
      bot.route = ROUTES[keys[i % keys.length]].slice();
      bot.wp = 0;
      bot.holdUntil = 0;
      bot.flank = false;
      if (bot.team === 'cinder' && !flankerSet && keys[i % keys.length] === 'BACK') {
        bot.flank = true;
        flankerSet = true;
      }
    }
    if (!flankerSet) {
      const defender = bots.find((b) => b.team === 'cinder');
      if (defender) { defender.route = ROUTES.BACK.slice(); defender.wp = 0; defender.flank = true; }
    }
  }

  // A step is walkable when no collider box covers it at body height.
  function blocked(x, z) {
    for (const c of world.colliders) {
      if (x > c.min.x - 0.35 && x < c.max.x + 0.35 && z > c.min.z - 0.35 && z < c.max.z + 0.35
        && c.max.y > 0.4 && c.min.y < 1.7) return true;
    }
    return false;
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
    // A freshly acquired target costs the bot an aim-settle beat.
    const freshTarget = target && !target.isNoise && !bot.target;
    bot.target = target && !target.isNoise ? target : null;
    if (freshTarget) bot.aimT = 0.35;

    if (target && !target.isNoise) {
      bot.state = 'engage';
      const dx = target.pos.x - bot.pos.x;
      const dz = target.pos.z - bot.pos.z;
      bot.yaw = Math.atan2(-dx, -dz);
      // Aim-settle: a bot that just acquired its target takes a beat to aim
      // before its first shot, so a player who peeks first wins the duel.
      if (bot.aimT > 0) { bot.aimT -= dt; return null; }
      // Peek-strafe: shuffle sideways while firing so the bot is a moving
      // target, but only into open ground (never inside a wall).
      bot.peekT -= dt;
      if (bot.peekT <= 0) { bot.peekDir = rng() < 0.5 ? -1 : 1; bot.peekT = 0.35 + rng() * 0.35; }
      const strafeX = bot.pos.x + (-dz / (best || 1)) * bot.peekDir * bot.speed * 0.45 * dt;
      const strafeZ = bot.pos.z + (dx / (best || 1)) * bot.peekDir * bot.speed * 0.45 * dt;
      if (!blocked(strafeX, strafeZ)) { bot.pos.x = strafeX; bot.pos.z = strafeZ; }
      // Utility: at long range a bot spends its one frag on the enemy's
      // position instead of duelling at a disadvantage.
      if (!bot.grenadeUsed && best > 12 && rng() < 0.006) {
        bot.grenadeUsed = true;
        return { shooter: bot, target, grenade: true };
      }
      // Fire in bursts; accuracy improves when the bot stands still to aim.
      if (bot.cooldown === 0 && best < 30) {
        bot.cooldown = 0.16 + rng() * 0.12;
        bot.burst += 1;
        const spread = 0.02 + Math.min(1, best / 30) * 0.05;
        return { shooter: bot, target, spread, damage: 16, headChance: 0.08 };
      }
      return null;
    }
    // Heard a shot but sees nobody: walk toward the noise to investigate,
    // stopping at the first wall.
    if (target && target.isNoise && bot.hearPos) {
      bot.state = 'investigate';
      const dx = bot.hearPos.x - bot.pos.x;
      const dz = bot.hearPos.z - bot.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 1.2) {
        bot.yaw = Math.atan2(-dx, -dz);
        const nx = bot.pos.x + (dx / dist) * bot.speed * dt;
        const nz = bot.pos.z + (dz / dist) * bot.speed * dt;
        if (!blocked(nx, nz)) { bot.pos.x = nx; bot.pos.z = nz; }
        return null;
      }
      bot.hearAt = -99;
    }
    // No target: walk the route, pausing to hold angles at waypoints.
    // The flanker never holds: it keeps moving around the back.
    bot.state = 'route';
    if (time < bot.holdUntil && !bot.flank) return null;
    const wp = WAYPOINTS[bot.route[bot.wp]];
    const dx = wp.x - bot.pos.x;
    const dz = wp.z - bot.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.6) {
      bot.wp = Math.min(bot.wp + 1, bot.route.length - 1);
      bot.holdUntil = bot.flank ? 0 : time + 1.2 + rng() * 1.6;
      return null;
    }
    bot.yaw = Math.atan2(-dx, -dz);
    const step = bot.speed * (bot.flank ? 1.15 : 1) * dt;
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
