// The objective: plant the spike at a site, defend it, or defuse it.
// Plant takes 3 s of holding E inside a site ring; defuse takes 4 s.
// A planted spike ticks for 30 s, then detonates for the attackers.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { SITES } from './world.js';

export function createBomb(scene) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.35, 0.5),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.4, emissive: new THREE.Color(PALETTE.accent), emissiveIntensity: 0.4 }),
  );
  mesh.visible = false;
  scene.add(mesh);
  const light = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 8);
  scene.add(light);
  return {
    mesh, light,
    nearSite(x, z) {
      for (const key of Object.keys(SITES)) {
        const s = SITES[key];
        if (Math.hypot(x - s.x, z - s.z) < 2.2) return key;
      }
      return null;
    },
    place(x, z, planted) {
      mesh.visible = true;
      mesh.position.set(x, 0.18, z);
      light.position.set(x, 1.2, z);
      light.intensity = planted ? 6 : 0;
    },
    hide() { mesh.visible = false; light.intensity = 0; },
    blink(time) { light.intensity = 3 + 3 * Math.sin(time * 6); },
  };
}
