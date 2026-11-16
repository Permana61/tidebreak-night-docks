// Frag grenades: a thrown sphere with gravity, a 1.6 s fuse, then area damage
// that falls off with distance and is blocked by walls. One live grenade at a
// time per thrower; the mesh is pooled, never allocated per throw.
import * as THREE from 'three';
import { GRENADE } from './weapon.js';

const _v = new THREE.Vector3();
export function createGrenades(scene, world) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.6 }),
  );
  mesh.visible = false;
  scene.add(mesh);
  const blast = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0, depthWrite: false }),
  );
  scene.add(blast);
  const live = { active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), fuse: 0, blastT: 0, owner: null };
  function throwGrenade(from, dir, owner = null) {
    if (live.active) return false;
    live.active = true;
    live.owner = owner;
    live.pos.copy(from);
    live.vel.copy(dir).multiplyScalar(14);
    live.vel.y += 4;
    live.fuse = GRENADE.fuse;
    mesh.visible = true;
    return true;
  }
  // Returns {x, z, damage, owner} on detonation, else null.
  function step(dt) {
    if (live.blastT > 0) {
      live.blastT -= dt;
      const s = 1 + (0.25 - live.blastT) * 18;
      blast.scale.setScalar(Math.max(0.1, s));
      blast.material.opacity = Math.max(0, live.blastT * 2);
      if (live.blastT <= 0) blast.visible = false;
      return null;
    }
    if (!live.active) return null;
    live.fuse -= dt;
    live.vel.y -= 14 * dt;
    live.pos.addScaledVector(live.vel, dt);
    if (live.pos.y < 0.09) { live.pos.y = 0.09; live.vel.set(0, 0, 0); }
    mesh.position.copy(live.pos);
    if (live.fuse > 0) return null;
    live.active = false;
    mesh.visible = false;
    blast.visible = true;
    blast.position.copy(live.pos);
    blast.scale.setScalar(0.1);
    live.blastT = 0.25;
    return { x: live.pos.x, z: live.pos.z, damage: GRENADE.damage, radius: GRENADE.radius, owner: live.owner };
  }
  function damageAt(x, z, px, pz) {
    const d = Math.hypot(x - px, z - pz);
    if (d > GRENADE.radius) return 0;
    return Math.round(GRENADE.damage * (1 - d / GRENADE.radius));
  }
  return { throwGrenade, step, damageAt };
}
