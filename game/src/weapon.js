// Weapons: one table, one view model, one set of rules. Main owns the ray and
// the damage; this module owns the numbers, the magazine and the kick.
// Spread grows with movement speed and with sustained fire, so stopping to aim
// pays — the same rule bots shoot by.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  sidearm: { name: 'S9 Sparrow', price: 0, damage: 24, headMult: 2, mag: 12, reserve: 48, gap: 0.16, reload: 1.4, spreadStill: 0.003, spreadMove: 0.02, auto: false, range: 45, adsFov: 62, pattern: [[0.010, 0], [0.011, 0.002], [0.010, -0.002], [0.012, 0.001]] },
  rifle: { name: 'KR-47 Kestrel', price: 2600, damage: 33, headMult: 2, mag: 30, reserve: 90, gap: 0.1, reload: 1.9, spreadStill: 0.0022, spreadMove: 0.028, auto: true, range: 80, adsFov: 55, pattern: [[0.011, 0], [0.012, 0.002], [0.013, -0.002], [0.012, 0.003], [0.014, -0.003], [0.013, 0.002], [0.012, -0.001], [0.014, 0.001]] },
  smg: { name: 'VX-9 Wasp', price: 1300, damage: 21, headMult: 2, mag: 28, reserve: 112, gap: 0.07, reload: 1.6, spreadStill: 0.004, spreadMove: 0.024, auto: true, range: 40, adsFov: 60, pattern: [[0.008, 0.001], [0.009, -0.002], [0.008, 0.002], [0.010, -0.001], [0.009, 0.003], [0.010, -0.002]] },
  shotgun: { name: 'M590 Dockside', price: 1700, damage: 14, headMult: 1.6, mag: 6, reserve: 24, gap: 0.8, reload: 2.4, spreadStill: 0.02, spreadMove: 0.03, auto: false, pellets: 7, range: 22, adsFov: 65, pattern: [[0.03, 0]] },
  sniper: { name: 'LR-80 Nightowl', price: 4000, damage: 100, headMult: 2, mag: 5, reserve: 15, gap: 1.1, reload: 2.8, spreadStill: 0.0008, spreadMove: 0.05, auto: false, range: 90, adsFov: 30, pattern: [[0.045, 0]] },
};
export const GRENADE = { name: 'Frag Grenade', price: 300, damage: 90, radius: 5.5, fuse: 1.6 };

export function createWeapon(camera) {
  // Dark gunmetal only — no brown/cream anywhere, so nothing reads as wood.
  const steel = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.38, metalness: 0.85 });
  const steelLight = new THREE.MeshStandardMaterial({ color: 0x43484f, roughness: 0.3, metalness: 0.9 });
  const polymer = new THREE.MeshStandardMaterial({ color: 0x1c1e21, roughness: 0.65, metalness: 0.15 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.6, metalness: 0.2 });

  function box(mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    return m;
  }
  function tube(mat, r, len, x, y, z) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mat);
    m.rotation.x = Math.PI / 2; // cylinder axis -> along Z (the barrel line)
    m.position.set(x, y, z);
    return m;
  }

  // KR-47 Kestrel: long receiver, long barrel, gas tube, front sight, and the
  // signature curved (banana) magazine — built from 4 angled segments.
  function buildKR47() {
    const g = new THREE.Group();
    g.add(box(steel, 0.085, 0.105, 0.44, 0, 0, 0)); // receiver
    g.add(box(steelLight, 0.07, 0.018, 0.38, 0, 0.06, -0.01)); // top cover
    g.add(box(steel, 0.05, 0.03, 0.06, 0, 0.075, 0.1)); // rear sight block
    g.add(box(steelLight, 0.03, 0.012, 0.1, 0, 0.085, 0.02, -0.08)); // sight leaf
    g.add(tube(steel, 0.014, 0.38, 0, 0.018, -0.4)); // barrel
    g.add(tube(steelLight, 0.012, 0.28, 0, 0.055, -0.33)); // gas tube
    g.add(box(steel, 0.04, 0.05, 0.05, 0, 0.04, -0.44)); // gas block
    g.add(box(polymer, 0.075, 0.065, 0.2, 0, 0.005, -0.3)); // handguard
    g.add(box(polymer, 0.08, 0.07, 0.015, 0, 0.005, -0.24));
    g.add(box(polymer, 0.08, 0.07, 0.015, 0, 0.005, -0.3));
    g.add(box(polymer, 0.08, 0.07, 0.015, 0, 0.005, -0.36));
    g.add(box(steel, 0.045, 0.025, 0.04, 0, 0.06, -0.57)); // front sight base
    g.add(box(steelLight, 0.012, 0.05, 0.012, 0, 0.09, -0.57)); // sight post
    g.add(box(steel, 0.008, 0.04, 0.03, -0.02, 0.085, -0.57));
    g.add(box(steel, 0.008, 0.04, 0.03, 0.02, 0.085, -0.57));
    g.add(tube(steelLight, 0.019, 0.07, 0, 0.018, -0.62)); // muzzle
    g.add(box(steel, 0.035, 0.035, 0.03, 0, 0.018, -0.65, 0, 0, Math.PI / 4)); // muzzle nut
    // Curved magazine — segments swing further forward as they go down.
    g.add(box(steelLight, 0.05, 0.13, 0.065, 0, -0.11, -0.03, 0.1));
    g.add(box(steelLight, 0.05, 0.13, 0.065, 0, -0.175, -0.065, 0.3));
    g.add(box(steelLight, 0.05, 0.13, 0.065, 0, -0.235, -0.115, 0.52));
    g.add(box(steelLight, 0.05, 0.13, 0.065, 0, -0.285, -0.175, 0.75));
    g.add(box(polymer, 0.055, 0.02, 0.075, 0, -0.335, -0.21, 0.75)); // mag base plate
    g.add(box(gripMat, 0.05, 0.14, 0.06, 0, -0.12, 0.15, 0.35)); // pistol grip
    g.add(box(steelLight, 0.012, 0.05, 0.02, 0, -0.09, 0.06, 0.2)); // trigger
    g.add(box(steel, 0.015, 0.012, 0.1, 0, -0.115, 0.07)); // trigger guard
    g.add(box(polymer, 0.07, 0.085, 0.22, 0, -0.015, 0.32)); // stock
    g.add(box(gripMat, 0.075, 0.1, 0.02, 0, -0.015, 0.435)); // butt plate
    g.add(box(steelLight, 0.03, 0.02, 0.05, 0.055, 0.01, -0.02)); // charging handle
    g.add(box(steel, 0.008, 0.015, 0.09, 0.047, 0.03, 0.05)); // selector lever
    return g;
  }

  // The other weapons keep the same dark-metal look, with distinct silhouettes.
  function buildSidearm() {
    const g = new THREE.Group();
    g.add(box(steel, 0.05, 0.05, 0.22, 0, 0.02, -0.05));
    g.add(box(steelLight, 0.04, 0.02, 0.06, 0, 0.05, -0.14));
    g.add(box(gripMat, 0.045, 0.13, 0.06, 0, -0.07, 0.06, 0.25));
    return g;
  }
  function buildSMG() {
    const g = new THREE.Group();
    g.add(box(steel, 0.07, 0.09, 0.3, 0, 0, 0));
    g.add(tube(steel, 0.013, 0.16, 0, 0.01, -0.22));
    g.add(box(steelLight, 0.045, 0.16, 0.05, 0, -0.12, -0.05)); // straight mag
    g.add(box(gripMat, 0.045, 0.1, 0.05, 0, -0.09, 0.12, 0.3));
    g.add(box(polymer, 0.06, 0.07, 0.12, 0, -0.01, 0.2));
    return g;
  }
  function buildShotgun() {
    const g = new THREE.Group();
    g.add(box(steel, 0.08, 0.09, 0.3, 0, 0, 0.05));
    g.add(tube(steel, 0.016, 0.5, 0, 0.02, -0.32));
    g.add(tube(steelLight, 0.014, 0.34, 0, -0.03, -0.28));
    g.add(box(polymer, 0.07, 0.06, 0.14, 0, -0.03, -0.28)); // pump
    g.add(box(polymer, 0.07, 0.085, 0.2, 0, -0.015, 0.3));
    g.add(box(gripMat, 0.05, 0.12, 0.06, 0, -0.11, 0.14, 0.3));
    return g;
  }
  function buildSniper() {
    const g = new THREE.Group();
    g.add(box(steel, 0.08, 0.1, 0.36, 0, 0, 0));
    g.add(tube(steel, 0.012, 0.6, 0, 0.02, -0.45));
    g.add(tube(steelLight, 0.025, 0.18, 0, 0.08, -0.05)); // scope
    g.add(box(steelLight, 0.05, 0.02, 0.03, 0.05, 0.02, 0.05)); // bolt handle
    g.add(box(steelLight, 0.05, 0.1, 0.06, 0, -0.1, -0.02)); // mag
    g.add(box(polymer, 0.07, 0.085, 0.2, 0, -0.015, 0.3));
    g.add(box(gripMat, 0.05, 0.12, 0.06, 0, -0.11, 0.14, 0.3));
    return g;
  }

  const models = {
    sidearm: buildSidearm(),
    rifle: buildKR47(),
    smg: buildSMG(),
    shotgun: buildShotgun(),
    sniper: buildSniper(),
  };
  // Rig: yawed slightly so the long KR-47 barrel points toward screen centre
  // instead of running off the right edge, and big enough to read clearly.
  const rig = new THREE.Group();
  for (const m of Object.values(models)) { m.visible = false; rig.add(m); }
  models.sidearm.visible = true;
  rig.position.set(0.24, -0.24, -0.5);
  rig.rotation.y = 0.28;
  rig.rotation.z = -0.04;
  rig.scale.setScalar(0.85);
  camera.add(rig);
  const model = rig; // recoil/reload animation drives the whole rig

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.09, -0.2, -1.02); // at the KR-47 muzzle tip
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5);
  flashLight.position.set(0.09, -0.18, -0.8);
  camera.add(flashLight);
  // A dim cool fill light on the camera, so the view-model gun reads as
  // dark metal instead of a black silhouette against the night map.
  const rigLight = new THREE.PointLight(new THREE.Color('#9fc8e8'), 3, 2.5, 2);
  rigLight.position.set(0.15, 0.05, -0.35);
  camera.add(rigLight);

  let def = WEAPONS.sidearm;
  const state = { id: 'sidearm', mag: def.mag, reserve: def.reserve, cooldown: 0, reloadLeft: 0, flash: 0, kick: 0, bloom: 0, grenades: 0, shotIndex: 0, aiming: false };

  function step(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.bloom = Math.max(0, state.bloom - dt * 0.35);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    model.position.z = -0.5 + state.kick;
    model.rotation.x = state.kick * 2.2;
    // Aim-down-sights: the rig slides to the centre of the screen.
    const aimX = state.aiming ? 0 : 0.24;
    const aimY = state.aiming ? -0.175 : -0.24;
    model.position.x += (aimX - model.position.x) * Math.min(1, dt * 18);
    model.position.y += (aimY - model.position.y) * Math.min(1, dt * 18);
    model.rotation.y += ((state.aiming ? 0 : 0.28) - model.rotation.y) * Math.min(1, dt * 18);
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 18 : 0;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      // Reload animation: dip the gun down and tilt it, then lift it back
      // as the fresh magazine seats.
      const phase = 1 - state.reloadLeft / def.reload;
      const dip = Math.sin(phase * Math.PI);
      model.position.y -= dip * 0.14;
      model.rotation.x = -0.55 * Math.min(1, (def.reload - state.reloadLeft) * 2);
      model.rotation.z = -0.04 - dip * 0.35;
      if (state.reloadLeft === 0) {
        const take = Math.min(def.mag - state.mag, state.reserve);
        state.mag += take;
        state.reserve -= take;
        state.shotIndex = 0; // a fresh mag resets the recoil pattern
        model.rotation.z = -0.04;
      }
    }
  }

  return {
    state,
    def() { return def; },
    step,
    ready() { return state.mag > 0 && state.cooldown === 0 && state.reloadLeft === 0; },
    pullTrigger() {
      state.cooldown = def.gap;
      state.flash = 0.06;
      state.kick = 0.055;
      state.bloom = Math.min(1, state.bloom + 0.12);
      // Recoil pattern: the kick follows the weapon's table by shot index,
      // so sustained fire climbs and drifts in a learnable shape.
      const pattern = def.pattern[state.shotIndex % def.pattern.length];
      state.shotIndex += 1;
      return { pitch: pattern[0], yaw: pattern[1] };
    },
    takeRound() { if (state.mag <= 0) return false; state.mag -= 1; return true; },
    reload() {
      if (state.reloadLeft > 0 || state.mag === def.mag || state.reserve === 0) return false;
      state.reloadLeft = def.reload;
      return true;
    },
    setAiming(aiming) { state.aiming = aiming && state.reloadLeft === 0; },
    adsFov() { return def.adsFov; },
    spread(speed) {
      const move = Math.min(1, speed / 5.2);
      const base = def.spreadStill + move * def.spreadMove + state.bloom * 0.012;
      return state.aiming ? base * 0.45 : base;
    },
    equip(id) {
      def = WEAPONS[id];
      state.id = id;
      for (const [key, m] of Object.entries(models)) m.visible = key === id;
      state.mag = def.mag;
      state.reserve = def.reserve;
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.shotIndex = 0;
    },
    refill() {
      state.mag = def.mag;
      state.reserve = def.reserve;
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.flash = 0;
      state.kick = 0;
      state.bloom = 0;
      state.shotIndex = 0;
    },
  };
}
