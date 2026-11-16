// The map: "Night Docks", an original 44 x 28 m container terminal after dark.
// Three lanes — Long A (west), Mid (centre, through the container stack) and
// Short B (east) — join two bomb sites set into the dock wall. Every box is a
// collider for players and bots and a surface a bullet stops on. Procedural
// canvas textures (no external assets) give the wet asphalt, container steel
// and crates detail at a modest cost: 512px textures, one 2048px shadow map,
// a handful of point lights.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

// Sites sit forward of the north wall, closer to Mid than a classic layout:
// rotations between them are short, so retakes are fast and loud.
export const SITES = {
  A: { x: -17, z: -8, label: 'A' },
  B: { x: 17, z: -8, label: 'B' },
};
export const SPAWNS = {
  // 5v5: vanguard[0] is the player, vanguard[1..4] the 4 friendly bots;
  // cinder[0..4] are the 5 Dockwatch bots.
  vanguard: [[-14, 11], [-8, 12], [-2, 12], [4, 12], [10, 11]],
  cinder: [[-16, -11], [-8, -12], [0, -12], [8, -12], [16, -11]],
};
// Waypoint graph bots walk: spawn -> mid/lanes -> sites. Edges are implicit:
// each node lists its neighbours by index. Nodes 20-22 are the Back Lane,
// a third rotation behind the sites, used by the flanker.
export const WAYPOINTS = [
  { x: -14, z: 11 }, { x: -8, z: 12 }, { x: -2, z: 12 }, { x: 4, z: 12 }, { x: 10, z: 11 },
  { x: -16, z: 2 }, { x: -8, z: 2 }, { x: 0, z: 2 }, { x: 8, z: 2 }, { x: 16, z: 2 },
  { x: -17, z: -8 }, { x: 17, z: -8 },
  { x: -16, z: -11 }, { x: -8, z: -12 }, { x: 0, z: -12 }, { x: 8, z: -12 }, { x: 16, z: -11 },
  { x: 0, z: -6 }, { x: -12, z: -6 }, { x: 12, z: -6 },
  { x: -17, z: -11.5 }, { x: 0, z: -11.5 }, { x: 17, z: -11.5 },
];
export const ROUTES = {
  A: [5, 18, 10],
  B: [9, 19, 11],
  MID: [7, 17, 14],
  BACK: [13, 20, 21, 22, 11],
};

// Deterministic pseudo-random so the same seed renders the same map.
function srand(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(w, h, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4; // modest: sharper at grazing angles, cheap on GPU
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function floorTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    const r = srand(11);
    // Wet asphalt, dark navy.
    g.fillStyle = '#141d29'; g.fillRect(0, 0, w, h);
    // Expansion joints.
    g.strokeStyle = '#0b1119'; g.lineWidth = 3;
    for (let i = 0; i <= 4; i += 1) {
      g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke();
    }
    // Aggregate speckle and rain stains.
    for (let i = 0; i < 2600; i += 1) {
      g.fillStyle = r() > 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(160,200,230,0.06)';
      g.fillRect(r() * w, r() * h, 2, 2);
    }
    // Puddles: pale moonlit ellipses that read as wet ground.
    for (let i = 0; i < 12; i += 1) {
      g.fillStyle = 'rgba(150,190,225,0.10)';
      g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 50, 12 + r() * 30, r() * 3, 0, Math.PI * 2); g.fill();
    }
    // Painted lane lines: amber dashes down the middle, white edge lines.
    g.strokeStyle = 'rgba(255,176,46,0.6)'; g.lineWidth = 5; g.setLineDash([26, 18]);
    g.beginPath(); g.moveTo(0, 256); g.lineTo(w, 256); g.stroke();
    g.setLineDash([]);
    g.strokeStyle = 'rgba(233,242,247,0.35)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 12); g.lineTo(w, 12); g.stroke();
    g.beginPath(); g.moveTo(0, h - 12); g.lineTo(w, h - 12); g.stroke();
  }, 6, 4);
}

function waterTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const r = srand(53);
    g.fillStyle = '#0a1a26'; g.fillRect(0, 0, w, h);
    // Moonlit wave lines.
    for (let i = 0; i < 42; i += 1) {
      g.strokeStyle = r() > 0.5 ? 'rgba(150,200,235,0.16)' : 'rgba(90,140,175,0.12)';
      g.lineWidth = 2 + r() * 2;
      const y = r() * h; const x = r() * w; const len = 20 + r() * 60;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y + (r() - 0.5) * 8); g.stroke();
    }
    // Amber harbour-light glints.
    for (let i = 0; i < 10; i += 1) {
      g.fillStyle = 'rgba(255,176,46,0.14)';
      g.beginPath(); g.ellipse(r() * w, r() * h, 8 + r() * 22, 3 + r() * 5, 0, 0, Math.PI * 2); g.fill();
    }
  }, 5, 3);
}

function decalTexture(letter, sub, fg, accent) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = accent; g.lineWidth = 10; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = fg; g.textAlign = 'center';
    g.font = 'bold 120px sans-serif'; g.fillText(letter, w / 2, h / 2 + 20);
    g.font = 'bold 26px sans-serif'; g.fillText(sub, w / 2, h / 2 + 74);
  });
}

// The player's tag, painted big in amber with a cyan sub-line: the same
// procedural canvas style as the site decals, no external asset.
function nameTexture() {
  return canvasTexture(512, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#ffb02e'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16);
    g.textAlign = 'center';
    g.font = 'bold 92px sans-serif';
    g.lineWidth = 12; g.strokeStyle = '#0a0f16';
    g.strokeText('ox90_666', w / 2, h / 2 + 8);
    g.fillStyle = '#ffb02e'; g.fillText('ox90_666', w / 2, h / 2 + 8);
    g.font = 'bold 28px sans-serif';
    g.fillStyle = '#27c8e8'; g.fillText('T I D E B R E A K', w / 2, h / 2 + 62);
  });
}

function hazardTexture() {
  return canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#141c26'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffb02e';
    for (let x = -h; x < w; x += 32) {
      g.save(); g.translate(x, 0); g.rotate(Math.PI / 4); g.fillRect(0, -h, 16, h * 3); g.restore();
    }
  });
}

function wallTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    const r = srand(23);
    // Container steel, deep blue-grey panels.
    g.fillStyle = '#22303f'; g.fillRect(0, 0, w, h);
    // Vertical corrugation.
    for (let x = 0; x < w; x += 32) {
      g.fillStyle = x % 64 === 0 ? 'rgba(180,215,235,0.07)' : 'rgba(0,0,0,0.16)';
      g.fillRect(x, 0, 16, h);
    }
    g.strokeStyle = '#101823'; g.lineWidth = 3;
    for (let y = 0; y <= h; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    // Rivets.
    g.fillStyle = '#0a0f16';
    for (let y = 64; y < h; y += 128) for (let x = 16; x < w; x += 32) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
    // Rain streaks running down from the top.
    for (let i = 0; i < 26; i += 1) {
      const x = r() * w; const len = 40 + r() * 160;
      const grad = g.createLinearGradient(x, 0, x, len);
      grad.addColorStop(0, 'rgba(90,130,160,0.30)'); grad.addColorStop(1, 'rgba(90,130,160,0)');
      g.fillStyle = grad; g.fillRect(x, 0, 5 + r() * 8, len);
    }
    // Hazard stripe along the base.
    g.fillStyle = '#ffb02e';
    for (let x = 0; x < w; x += 32) {
      g.save(); g.translate(x, h - 28); g.rotate(-0.5); g.fillRect(0, 0, 16, 56); g.restore();
    }
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, h - 28, w, 6);
  }, 8, 1);
}

function crateTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const r = srand(37);
    // Shipping container, teal-blue with a painted number.
    g.fillStyle = '#274b63'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#12222f'; g.lineWidth = 6; g.strokeRect(4, 4, w - 8, h - 8);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke();
    for (let i = 0; i < 500; i += 1) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(r() * w, r() * h, 2, 2); }
    g.fillStyle = 'rgba(233,242,247,0.9)'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center';
    g.fillText('TIDEBREAK', w / 2, h / 2 - 6);
    g.font = 'bold 18px sans-serif'; g.fillText('TDU 4417', w / 2, h / 2 + 24);
  });
}

function posterTexture(lines, bg, fg, accent) {
  return canvasTexture(256, 384, (g, w, h) => {
    const r = srand(lines.join('').length * 7 + 5);
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = accent; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14);
    g.fillStyle = fg; g.textAlign = 'center';
    g.font = 'bold 44px sans-serif';
    lines.forEach((line, i) => g.fillText(line, w / 2, 90 + i * 56));
    g.strokeStyle = fg; g.lineWidth = 4; g.strokeRect(14, 14, w - 28, h - 28);
    for (let i = 0; i < 300; i += 1) { g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(r() * w, r() * h, 3, 3); }
  });
}

export function createWorld(scene, initialMode = { time: 'night', rain: true }) {
  // Modes: time of day (Night / Day) and rain (on / off). Night + rain is
  // the default look; applyMode() below swaps the whole lighting rig, sky
  // and wetness live, so the player can change them from the start screen
  // or mid-match (N / H keys) without a reload.
  let mode = { time: initialMode.time === 'day' ? 'day' : 'night', rain: initialMode.rain !== false };
  const group = new THREE.Group();
  scene.add(group);
  const materials = {};
  for (const name of Object.keys(PALETTE)) {
    materials[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[name]),
      roughness: name === 'accent' || name === 'ink' ? 0.55 : 0.92,
      metalness: 0.03,
    });
  }
  // Textured hero materials: wet asphalt, container steel and crates.
  materials.canvas = new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.85, metalness: 0.08 });
  materials.surface = new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: 0.8, metalness: 0.25 });
  materials.hairline = new THREE.MeshStandardMaterial({ map: crateTexture(), roughness: 0.85, metalness: 0.1 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x4a5560, roughness: 0.4, metalness: 0.75 });
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x3d4b5a, roughness: 0.5, metalness: 0.6 });
  const barrelTeal = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.teal), roughness: 0.55, metalness: 0.3 });
  const barrelEmber = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ember), roughness: 0.55, metalness: 0.3 });

  const colliders = [];
  const shootables = [];
  function box(w, h, d, x, y, z, material, collide = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials[material]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (collide) colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
    return mesh;
  }
  function prop(mesh, collide = false) {
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    if (collide) colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
    return mesh;
  }
  function poster(lines, bg, fg, accent, w, h, x, y, z, rotY) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: posterTexture(lines, bg, fg, accent), roughness: 0.85 }),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    group.add(mesh); // flat on a wall: decor only, not a collider/shootable
    return mesh;
  }
  function siteMarker(site, material) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 2.0, 32),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE[material]), side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(site.x, 0.02, site.z);
    group.add(ring);
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 2.2, 0.3),
      materials[material],
    );
    post.position.set(site.x + 2.4, 1.1, site.z - 2.4);
    post.castShadow = true;
    group.add(post);
  }

  // Floor and outer walls, 44 x 28 m, 5 m high, open night sky — except the
  // north wall's centre, which drops to 2.2 m so the harbour vista (water,
  // skyline, moon) reads from Mid and both sites.
  box(44.4, 0.4, 28.4, 0, -0.2, 0, 'canvas');
  box(0.4, 5, 28.4, -22.2, 2.5, 0, 'surface');
  box(0.4, 5, 28.4, 22.2, 2.5, 0, 'surface');
  box(16.2, 5, 0.4, -14.1, 2.5, -14.2, 'surface');
  box(12, 2.2, 0.4, 0, 1.1, -14.2, 'surface');
  box(16.2, 5, 0.4, 14.1, 2.5, -14.2, 'surface');
  box(44.4, 5, 0.4, 0, 2.5, 14.2, 'surface');
  // Harbour vista beyond the low north wall: animated water, a dark crane
  // skyline, a moon and stars. Outside the playable bounds: decor only.
  const waterTex = waterTexture();
  const waterMat = new THREE.MeshStandardMaterial({ map: waterTex, color: 0x9fc8e8, roughness: 0.22, metalness: 0.85 });
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 14),
    waterMat,
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.15, -21.5);
  group.add(water);
  const skylineMat = new THREE.MeshStandardMaterial({ color: 0x060b12, roughness: 1, metalness: 0 });
  function skylineBox(w, h, d, x, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), skylineMat);
    m.position.set(x, h / 2, z);
    group.add(m);
    return m;
  }
  skylineBox(6, 9, 3, -14, -27); skylineBox(4, 12, 3, -6, -28); skylineBox(8, 6, 3, 3, -27);
  skylineBox(5, 10, 3, 11, -28); skylineBox(7, 7, 3, 18, -27);
  const skyCraneLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 11, 8), skylineMat);
  skyCraneLeg.position.set(-10, 5.5, -26); group.add(skyCraneLeg);
  const skyCraneBeam = new THREE.Mesh(new THREE.BoxGeometry(12, 0.6, 0.6), skylineMat);
  skyCraneBeam.position.set(-6, 10.5, -26); group.add(skyCraneBeam);
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(3, 32),
    new THREE.MeshBasicMaterial({ color: 0xe8f2ff, fog: false }),
  );
  moon.position.set(-18, 22, -55);
  moon.lookAt(0, 2, 0);
  group.add(moon);
  const moonGlowTex = canvasTexture(128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(220,235,255,0.55)'); grad.addColorStop(1, 'rgba(220,235,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonGlowTex, transparent: true, depthWrite: false, fog: false }));
  moonGlow.scale.setScalar(20);
  moonGlow.position.copy(moon.position);
  group.add(moonGlow);
  const starCount = 300;
  const starPos = new Float32Array(starCount * 3);
  const sr = srand(77);
  for (let i = 0; i < starCount; i += 1) {
    const a = sr() * Math.PI * 2;
    const e = 0.15 + sr() * 1.2;
    const rad = 60 + sr() * 25;
    starPos[i * 3] = Math.cos(a) * Math.cos(e) * rad;
    starPos[i * 3 + 1] = Math.sin(e) * rad;
    starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * rad;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xd6e6ff, size: 0.35, transparent: true, opacity: 0.8, sizeAttenuation: false, fog: false }));
  group.add(stars);
  // Day sky: a sun disc and a few flat clouds, hidden at night. The moon,
  // stars and sun are all decor outside the playable bounds.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff6c9, fog: false }),
  );
  sun.position.set(18, 24, -55);
  sun.lookAt(0, 2, 0);
  group.add(sun);
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonGlowTex, transparent: true, depthWrite: false, fog: false, color: 0xfff2b0 }));
  sunGlow.scale.setScalar(16);
  sunGlow.position.copy(sun.position);
  group.add(sunGlow);
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
  for (const [cx, cy, cz, s] of [[-20, 26, -45, 6], [4, 30, -50, 8], [22, 24, -40, 5], [-2, 28, -60, 7]]) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), cloudMat);
    c.scale.set(s, s * 0.35, s * 0.5);
    c.position.set(cx, cy, cz);
    clouds.add(c);
  }
  group.add(clouds);
  // Mid container stack: two high, splitting Mid in two, with low flanks.
  box(2.4, 2.6, 2.4, 0, 1.3, -2, 'hairline');
  box(2.4, 1.2, 2.4, 0, 3.2, -2, 'hairline');
  box(3.4, 1.2, 1.4, -5.4, 0.6, -2, 'hairline');
  box(3.4, 1.2, 1.4, 5.4, 0.6, -2, 'hairline');
  // Long A: a container wall with a gap, and a crouch crate at the corner.
  box(1.2, 2.6, 6.0, -13, 1.3, -6, 'surface');
  box(1.6, 0.8, 1.6, -16.5, 0.4, -4.5, 'hairline');
  box(2.2, 1.1, 1.2, -10, 0.55, 6, 'hairline');
  // Short B: stacked containers make a boostable sightline over the site.
  box(1.6, 0.8, 1.6, 14, 0.4, -5, 'hairline');
  box(1.6, 0.8, 1.6, 14, 1.2, -5, 'hairline');
  box(2.4, 1.1, 1.2, 10, 0.55, 6, 'hairline');
  // Spawn cover and mid connectors.
  box(2.0, 1.0, 1.0, -6, 0.5, 8, 'hairline');
  box(2.0, 1.0, 1.0, 6, 0.5, 8, 'hairline');
  box(1.2, 2.2, 1.2, -4, 1.1, -8, 'surface');
  box(1.2, 2.2, 1.2, 4, 1.1, -8, 'surface');
  // Back lane: a low container row behind both sites, moved to the north
  // edge so the lane itself (z = -11.5) stays open for the third rotation.
  box(6.0, 1.2, 1.2, 0, 0.6, -13.0, 'surface');
  box(1.4, 1.0, 1.4, -8, 0.5, -12.2, 'hairline');
  box(1.4, 1.0, 1.4, 8, 0.5, -12.2, 'hairline');
  // Tidebreaker spawn cover: a low wall so the spawn is not peeked straight
  // down Mid from the north.
  box(6.0, 1.2, 0.6, 0, 0.6, 10.2, 'hairline');
  // ---- Verticality: climb stack + catwalk ----
  // Stepped crates (0.6 m rises, jumpable) lead up to a catwalk that runs
  // along the north wall above the sites, with a railing on its back edge.
  // Bots stay on the ground; the catwalk is a player perch that overlooks
  // both sites and is still hittable from below.
  box(1.2, 0.6, 1.2, 8, 0.3, -9.0, 'hairline');
  box(1.2, 1.2, 1.2, 8, 0.6, -10.2, 'hairline');
  box(1.2, 1.8, 1.2, 8, 0.9, -11.4, 'hairline');
  box(16, 0.2, 1.0, 0, 2.5, -13.1, 'surface'); // catwalk slab, top at 2.6
  box(16, 1.0, 0.08, 0, 3.1, -13.55, 'surface'); // back railing
  box(0.3, 2.5, 0.3, -7.5, 1.25, -13.1, 'surface'); // catwalk posts
  box(0.3, 2.5, 0.3, 7.5, 1.25, -13.1, 'surface');
  // ---- Site A: crane yard ----
  // A two-high container stack, a crane hook hanging over the site, and a
  // painted floor decal marking the yard.
  box(2.4, 1.2, 2.4, -19.5, 0.6, -10, 'hairline');
  box(2.4, 1.2, 2.4, -19.5, 1.8, -10, 'hairline');
  const hookCable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 8), pipeMat);
  hookCable.position.set(-14, 5.2, -12); prop(hookCable, false);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), metalMat);
  hook.position.set(-14, 3.3, -12); prop(hook, true);
  // ---- Site B: warehouse interior ----
  // A roof slab over B with columns, pallet stacks inside, warm interior
  // light spilling out of the doorway.
  box(9, 0.25, 7, 17, 4.3, -8, 'surface'); // roof
  box(0.4, 4.3, 0.4, 13.2, 2.15, -5.2, 'surface');
  box(0.4, 4.3, 0.4, 20.8, 2.15, -10.8, 'surface');
  function pallet(x, z, y) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x6b5a3e, roughness: 0.9, metalness: 0 }));
    m.position.set(x, y, z); prop(m, true);
  }
  pallet(19.2, -6.2, 0.08); pallet(19.2, -6.2, 0.4); pallet(19.2, -6.2, 0.72);
  box(1.1, 0.9, 1.1, 19.2, 1.25, -6.2, 'hairline');
  pallet(14.6, -10.6, 0.08); pallet(14.6, -10.6, 0.4);
  box(1.1, 0.9, 1.1, 14.6, 0.93, -10.6, 'hairline');
  // Dock office blocks: new corner fights on the west and east approaches.
  box(2.0, 2.4, 3.0, -19, 1.2, -2, 'surface');
  box(2.0, 2.4, 3.0, 19, 1.2, -2, 'surface');
  // Low wall between the sites: cover for a retake.
  box(4.0, 1.0, 1.0, 0, 0.5, -8, 'hairline');
  siteMarker(SITES.A, 'teal');
  siteMarker(SITES.B, 'ember');
  // Painted floor decals: a big letter on each site so the objective reads
  // from across the map, and hazard chevrons at both site entrances.
  function floorDecal(tex, x, z, w, d, rotY = 0) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2; m.rotation.z = rotY;
    m.position.set(x, 0.03, z);
    group.add(m);
    return m;
  }
  floorDecal(decalTexture('A', 'CRANE YARD', '#27c8e8', '#27c8e8'), -17, -8, 3.4, 3.4);
  floorDecal(decalTexture('B', 'WAREHOUSE', '#ff6b35', '#ff6b35'), 17, -8, 3.4, 3.4);
  // ox90_666 floor paint: the player's tag, big on the Mid floor where every
  // round crosses, and again on the spawn approach. The Mid paint is turned
  // 45° so it reads straight from the play camera's north-east view.
  const nameTex = nameTexture();
  floorDecal(nameTex, 0.5, 3, 9, 3.2, -Math.PI / 4);
  floorDecal(nameTex, 0, 8.5, 6, 2.1);
  const hzTex = hazardTexture();
  floorDecal(hzTex, -14, -4.6, 2.4, 1.2);
  floorDecal(hzTex, 14, -4.6, 2.4, 1.2);
  // Wet-puddle reflection patches: near-mirror metal that catches the site
  // and crane lights, so the rain-wet dock reads as wet.
  const puddleMat = new THREE.MeshStandardMaterial({ color: 0x16283a, roughness: 0.12, metalness: 0.95, transparent: true, opacity: 0.85 });
  function puddle(x, z, w, d, rotY) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), puddleMat);
    m.rotation.x = -Math.PI / 2; m.rotation.z = rotY;
    m.position.set(x, 0.025, z);
    group.add(m);
  }
  puddle(0, 4, 3.2, 1.8, 0.3); puddle(-10, -4, 2.6, 1.5, -0.5); puddle(10, 0, 2.8, 1.6, 0.9);
  puddle(-15, 6, 2.2, 1.4, 0.1); puddle(15, -11, 2.4, 1.4, -0.2);
  // Emissive light strips on the mid stack and the B containers: the dock's
  // working lights, glowing cyan and amber against the night.
  const stripCyan = new THREE.MeshStandardMaterial({ color: 0x06222b, emissive: new THREE.Color('#27c8e8'), emissiveIntensity: 2.4 });
  const stripAmber = new THREE.MeshStandardMaterial({ color: 0x2b1602, emissive: new THREE.Color('#ffb02e'), emissiveIntensity: 2.4 });
  function strip(mat, w, h, x, y, z, rotY) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), mat);
    m.position.set(x, y, z); m.rotation.y = rotY;
    group.add(m);
  }
  strip(stripCyan, 2.0, 0.12, 0, 2.0, -0.75, 0);
  strip(stripAmber, 1.6, 0.12, -19.5, 1.25, -8.75, 0);
  strip(stripCyan, 1.6, 0.12, 14, 0.85, -4.15, 0);
  // Buoys bobbing by the water gap, and a chain hanging from the crane beam.
  function buoy(x, z) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 10),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ember), roughness: 0.5, metalness: 0.1 }));
    m.position.set(x, 0.35, z); prop(m, true);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.05, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0xe9f2f7, roughness: 0.6 }));
    band.rotation.x = Math.PI / 2; band.position.set(x, 0.35, z); group.add(band);
  }
  buoy(-4, -13.4); buoy(4, -13.4);
  const chainMat = new THREE.MeshStandardMaterial({ color: 0x5a646e, roughness: 0.35, metalness: 0.9 });
  for (let i = 0; i < 5; i += 1) {
    const link = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 8, 14), chainMat);
    link.position.set(10, 6.5 - i * 0.26, -12);
    link.rotation.y = i % 2 ? Math.PI / 2 : 0;
    group.add(link);
  }

  // ---- Wall decor: posters, signs and stencils (flat, no collision) ----
  // North wall (behind the sites), facing south into the map.
  poster(['SITE', 'A'], '#0e3a44', '#e6f7fb', '#27c8e8', 2.2, 3.2, -17, 2.6, -13.95, 0);
  poster(['SITE', 'B'], '#4a2410', '#ffe9dc', '#ff6b35', 2.2, 3.2, 17, 2.6, -13.95, 0);
  poster(['DANGER', 'HIGH', 'VOLTAGE'], '#141c26', '#ffb02e', '#ff6b35', 2.0, 3.0, -6, 2.4, -13.95, 0);
  poster(['TIDE', 'BREAK'], '#0d1620', '#e9f2f7', '#ffb02e', 2.6, 3.8, 6, 2.8, -13.95, 0);
  // South wall (behind Tidebreaker spawn), facing north.
  poster(['NIGHT', 'DOCKS'], '#0d1620', '#e9f2f7', '#27c8e8', 3.0, 2.2, 0, 3.0, 13.95, Math.PI);
  poster(['KEEP', 'OUT'], '#33100a', '#ffd9c9', '#ff6b35', 1.8, 2.6, -12, 2.4, 13.95, Math.PI);
  poster(['DOCK', 'WATCH'], '#141c26', '#ffb02e', '#ff6b35', 2.0, 2.8, 12, 2.4, 13.95, Math.PI);
  // West / east walls.
  poster(['LONG', 'A'], '#0e3a44', '#e6f7fb', '#27c8e8', 2.0, 3.0, -21.95, 2.6, -6, Math.PI / 2);
  poster(['SHORT', 'B'], '#4a2410', '#ffe9dc', '#ff6b35', 2.0, 3.0, 21.95, 2.6, -6, -Math.PI / 2);
  poster(['MID'], '#0d1620', '#ffb02e', '#27c8e8', 1.6, 2.4, -21.95, 2.4, 6, Math.PI / 2);
  // ox90_666 wall posters: on the north wall beside both sites, on the east
  // wall facing Mid, and on the south wall behind spawn.
  poster(['ox90', '_666'], '#0d1620', '#ffb02e', '#27c8e8', 2.4, 3.6, -11, 2.6, -13.95, 0);
  poster(['ox90', '_666'], '#0d1620', '#ffb02e', '#27c8e8', 2.4, 3.6, 11, 2.6, -13.95, 0);
  poster(['ox90', '_666'], '#0d1620', '#ffb02e', '#27c8e8', 2.4, 3.6, 21.95, 2.6, 6, -Math.PI / 2);
  poster(['ox90', '_666'], '#0d1620', '#ffb02e', '#27c8e8', 2.4, 3.6, 6, 2.6, 13.95, Math.PI);

  // ---- Busy dock: cable runs, barrels, crates, lamps (edges/corners only,
  // so lanes and bot routes stay clear) ----
  function pipe(x, y, z, len, rotZ = 0, rotX = 0) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, len, 12), pipeMat);
    m.position.set(x, y, z); m.rotation.z = rotZ; m.rotation.x = rotX;
    prop(m);
  }
  pipe(0, 4.6, -13.9, 44, Math.PI / 2, 0); // north wall cable run (along X)
  pipe(0, 4.6, 13.9, 44, Math.PI / 2, 0); // south wall cable run (along X)
  pipe(-21.9, 4.4, 0, 28, 0, Math.PI / 2); // west wall cable run (along Z)
  pipe(21.9, 4.4, 0, 28, 0, Math.PI / 2); // east wall cable run (along Z)
  function barrel(x, z, mat) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 16), mat);
    m.position.set(x, 0.55, z);
    prop(m, true);
  }
  barrel(-20.5, 8, barrelTeal); barrel(-19.6, 8.6, barrelEmber); barrel(-20.5, -12.5, barrelEmber);
  barrel(20.5, 8, barrelEmber); barrel(19.6, 8.6, barrelTeal); barrel(20.5, -12.5, barrelTeal);
  barrel(-20.5, 2, barrelEmber); barrel(20.5, 2, barrelTeal);
  // Extra low crates tucked against walls.
  box(1.4, 0.7, 1.4, -19.5, 0.35, -8, 'hairline');
  box(1.4, 0.7, 1.4, 19.5, 0.35, -8, 'hairline');
  box(1.4, 0.7, 1.4, -19.5, 0.35, 12, 'hairline');
  box(1.4, 0.7, 1.4, 19.5, 0.35, 12, 'hairline');
  // Gantry crane over the north wall: two legs and a beam, with a floodlight.
  const legGeo = new THREE.CylinderGeometry(0.5, 0.6, 7, 12);
  const legL = new THREE.Mesh(legGeo, metalMat);
  legL.position.set(-20, 3.5, -12); prop(legL, true);
  const legR = new THREE.Mesh(legGeo, metalMat);
  legR.position.set(20, 3.5, -12); prop(legR, true);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(41, 0.8, 0.8), metalMat);
  beam.position.set(0, 6.9, -12); prop(beam, false);
  // Floodlight panel hung under the crane beam, over the north wall.
  const floodPanelMat = new THREE.MeshStandardMaterial({ color: 0x1a1408, emissive: new THREE.Color('#ffc46b'), emissiveIntensity: 2.2 });
  const floodPanel = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.0, 0.2),
    floodPanelMat,
  );
  floodPanel.position.set(0, 6.35, -11.55); group.add(floodPanel);
  // Hanging lamps: emissive shades over Mid and both sites.
  function lamp(x, y, z, color) {
    const shadeMesh = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.4, 12, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x222222, emissive: new THREE.Color(color), emissiveIntensity: 0.9, side: THREE.DoubleSide }));
    shadeMesh.position.set(x, y, z); group.add(shadeMesh);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color) }));
    bulb.position.set(x, y - 0.2, z); group.add(bulb);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 5 - y, 6), metalMat);
    cord.position.set(x, (5 + y) / 2, z); group.add(cord);
  }
  lamp(0, 3.6, -2, '#ffc46b'); lamp(-17, 3.6, -8, '#27c8e8'); lamp(17, 3.6, -8, '#ff6b35');
  // Sea mist drifting in the floodlights — cheap atmosphere, no gameplay effect.
  const dustCount = 260;
  const dustPos = new Float32Array(dustCount * 3);
  const dr = srand(99);
  for (let i = 0; i < dustCount; i += 1) {
    dustPos[i * 3] = (dr() - 0.5) * 42;
    dustPos[i * 3 + 1] = 0.4 + dr() * 4.2;
    dustPos[i * 3 + 2] = (dr() - 0.5) * 27;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0x9fc8e8, size: 0.06, transparent: true, opacity: 0.35, sizeAttenuation: true,
  }));
  group.add(dust);

  // Night light: cool moonlight key, cyan fill, and a warm sky gradient.
  // All lights are named so applyMode() can retune them for Day.
  const hemi = new THREE.HemisphereLight(new THREE.Color('#a8c4de'), new THREE.Color(PALETTE.canvas), 1.1);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(new THREE.Color('#8fa8c0'), 0.35);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(new THREE.Color('#d6e6ff'), 2.4);
  key.position.set(14, 18, 10);
  key.target.position.set(0, 0, -3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -26;
  key.shadow.camera.right = 26;
  key.shadow.camera.top = 20;
  key.shadow.camera.bottom = -20;
  key.shadow.camera.far = 60;
  key.shadow.bias = -0.0006;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(new THREE.Color(PALETTE.teal), 0.6);
  fill.position.set(-12, 10, 12);
  scene.add(fill);
  // Warm crane floodlight + cool site lights (3 point lights, modest cost).
  const craneLight = new THREE.PointLight(new THREE.Color('#ffc46b'), 30, 16, 1.8);
  craneLight.position.set(0, 4.5, -10);
  scene.add(craneLight);
  const siteALight = new THREE.PointLight(new THREE.Color(PALETTE.teal), 14, 10, 1.8);
  siteALight.position.set(-17, 3.2, -8);
  scene.add(siteALight);
  const siteBLight = new THREE.PointLight(new THREE.Color(PALETTE.ember), 14, 10, 1.8);
  siteBLight.position.set(17, 3.2, -8);
  scene.add(siteBLight);
  // Warm spill from inside the B warehouse doorway.
  const warehouseLight = new THREE.PointLight(new THREE.Color('#ff9a3d'), 10, 8, 1.8);
  warehouseLight.position.set(15, 2.6, -5.5);
  scene.add(warehouseLight);

  // ---- Modes: Night / Day, Rain on / off ----
  // Day is a different look, not just brighter: blue sky + sun, warmer
  // ground bounce, lighter fog, floodlights off, moon/stars hidden, duller
  // puddles. Rain off stops the falling streaks and dries the puddles out.
  const NIGHT = {
    bg: '#0d1620', fog: ['#0d1620', 30, 85],
    hemiSky: '#a8c4de', hemiGround: PALETTE.canvas, hemiInt: 1.1,
    amb: ['#8fa8c0', 0.35], keyColor: '#d6e6ff', keyInt: 2.4, keyPos: [14, 18, 10],
    fillInt: 0.6, craneInt: 30, floodEmissive: 2.2, siteInt: 14, warehouseInt: 10,
    stripInt: 2.4, waterColor: 0x9fc8e8, waterRough: 0.22,
    moonVisible: true, sunVisible: false,
  };
  const DAY = {
    bg: '#8fb8dd', fog: ['#a9c6de', 38, 120],
    hemiSky: '#d5e9f7', hemiGround: '#5d6f55', hemiInt: 1.5,
    amb: ['#ffffff', 0.55], keyColor: '#fff3cf', keyInt: 3.2, keyPos: [16, 24, 6],
    fillInt: 0.35, craneInt: 0, floodEmissive: 0.1, siteInt: 6, warehouseInt: 4,
    stripInt: 0.7, waterColor: 0x4d8fb8, waterRough: 0.15,
    moonVisible: false, sunVisible: true,
  };
  function applyMode(next) {
    mode = { time: next.time === 'day' ? 'day' : 'night', rain: next.rain !== false };
    const P = mode.time === 'day' ? DAY : NIGHT;
    scene.background = new THREE.Color(P.bg);
    scene.fog = new THREE.Fog(new THREE.Color(P.fog[0]), P.fog[1], P.fog[2]);
    hemi.color.set(P.hemiSky);
    hemi.groundColor.set(P.hemiGround);
    hemi.intensity = P.hemiInt;
    ambient.color.set(P.amb[0]);
    ambient.intensity = P.amb[1];
    key.color.set(P.keyColor);
    key.intensity = P.keyInt;
    key.position.set(P.keyPos[0], P.keyPos[1], P.keyPos[2]);
    fill.intensity = P.fillInt;
    craneLight.intensity = P.craneInt;
    floodPanelMat.emissiveIntensity = P.floodEmissive;
    siteALight.intensity = P.siteInt;
    siteBLight.intensity = P.siteInt;
    warehouseLight.intensity = P.warehouseInt;
    stripCyan.emissiveIntensity = P.stripInt;
    stripAmber.emissiveIntensity = P.stripInt;
    waterMat.color.set(P.waterColor);
    waterMat.roughness = P.waterRough;
    moon.visible = P.moonVisible;
    moonGlow.visible = P.moonVisible;
    stars.visible = P.moonVisible;
    sun.visible = P.sunVisible;
    sunGlow.visible = P.sunVisible;
    clouds.visible = P.sunVisible;
    dust.visible = mode.rain;
    puddleMat.roughness = mode.rain ? 0.12 : 0.5;
    puddleMat.opacity = mode.rain ? 0.85 : 0.4;
    return { ...mode };
  }

  // Per-frame ambience, cheap: rain falls and wraps, the harbour water
  // drifts, the crane floodlight hums with a faint flicker.
  const rainVel = 1.6;
  function update(dt, time) {
    if (mode.rain) {
      const pos = dustGeo.attributes.position;
      for (let i = 0; i < dustCount; i += 1) {
        let y = pos.getY(i) - rainVel * dt;
        if (y < 0.2) y = 4.6;
        pos.setY(i, y);
        pos.setX(i, pos.getX(i) + Math.sin(time * 0.7 + i) * dt * 0.12);
      }
      pos.needsUpdate = true;
    }
    waterTex.offset.x = (time * 0.015) % 1;
    waterTex.offset.y = (time * 0.008) % 1;
    if (mode.time === 'night') craneLight.intensity = 30 + Math.sin(time * 13) * 1.2 + Math.sin(time * 31) * 0.8;
  }

  applyMode(mode); // apply the starting mode (Night + Rain by default)
  return { colliders, shootables, group, update, applyMode, getMode: () => ({ ...mode }) };
}
