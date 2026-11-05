// The sky world seen in flight: ocean, islands, clouds and storm cells.
'use strict';
const oceanTex = canvasTex(256, 256, g => {
  g.fillStyle = '#1f6f9f'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${Math.random() < .5 ? '120,190,230' : '15,70,110'},${rand(.15, .4)})`;
    g.fillRect(rand(0, 256), rand(0, 256), rand(10, 40), rand(2, 4));
  }
});
oceanTex.wrapS = oceanTex.wrapT = THREE.RepeatWrapping; oceanTex.repeat.set(30, 30);
const ocean = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshLambertMaterial({ map: oceanTex }));
const SEA_Y = -400;                                              // (how far below the plane's cruising height)
ocean.rotation.x = -Math.PI / 2; ocean.position.y = SEA_Y;
scene.add(ocean);

const sphere = new THREE.SphereGeometry(1, 12, 10);
const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
const stormMat = new THREE.MeshLambertMaterial({ color: 0x3b4150, transparent: true, opacity: 0.95 });
function makePuff(mat, count, size) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(sphere, mat);
    const r = size * rand(0.5, 1);
    m.scale.set(r, r * 0.7, r);
    m.position.set(rand(-size, size) * 1.3, rand(-size, size) * 0.3, rand(-size, size) * 0.8);
    g.add(m);
  }
  return g;
}
// somewhere around the plane, but never right on top of it
function clearSpot() {
  let x, y;
  do { x = rand(-700, 700); y = rand(-300, 250); } while (Math.abs(x) < 90 && Math.abs(y) < 60);
  return [PW.x + x, PW.y + y];
}
const scenery = [];
for (let i = 0; i < 34; i++) {
  const o = makePuff(cloudMat, 6, rand(15, 35));
  const [x, y] = clearSpot(); o.position.set(x, y, rand(-2500, 200)); o.visible = false;
  scene.add(o); scenery.push({ o, kind: 'cloud' });
}
for (let i = 0; i < 14; i++) {
  const g = new THREE.Group(), r = rand(40, 120);
  const sand = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.15, r * 1.25, 3, 18), new THREE.MeshLambertMaterial({ color: 0xe6d29a }));
  const hill = new THREE.Mesh(new THREE.ConeGeometry(r, r * 0.8, 18), new THREE.MeshLambertMaterial({ color: 0x3f8f45 }));
  hill.position.y = r * 0.4; g.add(sand, hill);
  g.position.set(rand(-1500, 1500), -400, rand(-3000, 200)); g.visible = false;
  scene.add(g); scenery.push({ o: g, kind: 'island', r });
}
function scrollScenery(worldSpeed, dt) {
  for (const it of scenery) {
    it.o.position.z += worldSpeed * dt;
    if (it.o.position.z > 400 && !it.hold) {   // (not the island someone's standing on)
      if (it.kind === 'cloud') { const [x, y] = clearSpot(); it.o.position.set(x, y, rand(-2800, -2400)); }
      else it.o.position.set(PW.x + rand(-1500, 1500), -400, rand(-3200, -2800));
    }
    // clouds never pass through the cabin
    if (it.kind === 'cloud') it.o.visible = Math.abs(it.o.position.x - PW.x) > 45 || Math.abs(it.o.position.y - PW.y) > 30 || Math.abs(it.o.position.z) > 60;
  }
}

// a storm cell: a dark mass you can fly into (or steer around)
const STORM_RX = 115, STORM_RY = 70, STORM_RZ = 330;
const storm = new THREE.Group();
for (let i = 0; i < 46; i++) {
  const p = makePuff(stormMat, 5, rand(18, 38));
  let x, y, z;
  do { x = rand(-1, 1); y = rand(-1, 1); z = rand(-1, 1); } while (x * x + y * y + z * z > 1);
  p.position.set(x * STORM_RX, y * STORM_RY, z * STORM_RZ);
  storm.add(p);
}
storm.visible = false;
scene.add(storm);
function stormInfo() {
  if (!S.stormOn) return null;
  const dx = storm.position.x - PW.x, dy = storm.position.y - PW.y, z = storm.position.z;
  const lateral = Math.hypot(dx / STORM_RX, dy / STORM_RY);
  return { dx, dy, z, lateral, inside: Math.abs(z) < STORM_RZ && lateral < 1 };
}

// ---------------------------------------------------------------- day and night
// The sun goes round once every DAY_LEN seconds: day, a golden sunset, a starry night, then sunrise.
// (S.clock: 0 midnight · 0.25 sunrise · 0.5 noon · 0.75 sunset. The host keeps everyone's clock in step.)
const DAY_LEN = 300;
const DAY = { light: 1, twilight: 0 };
const SKY_NIGHT = new THREE.Color(0x0a1226), SKY_DAWN = new THREE.Color(0xf08a5a);
const OCEAN_DAY = new THREE.Color(0xffffff), OCEAN_NIGHT = new THREE.Color(0x2a3550);
const CLOUD_DAY = new THREE.Color(0xffffff), CLOUD_NIGHT = new THREE.Color(0x4a5470);
const SUN_DAY = new THREE.Color(0xffffff), SUN_DUSK = new THREE.Color(0xffb070), MOON = new THREE.Color(0x8fa6d8);
const stars = (() => {
  const pos = [];
  for (let i = 0; i < 900; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = 3000, h = Math.abs(u) * 0.95 + 0.05;   // (the upper half of the sky)
    pos.push(Math.cos(a) * Math.sqrt(1 - h * h) * r, h * r, Math.sin(a) * Math.sqrt(1 - h * h) * r);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  scene.add(p); return p;
})();
const _camW = new THREE.Vector3();
// sets the sky colour (before storms and the rest are added on top) and the light
function updateDayNight(dt, base) {
  if (!isClient()) S.clock = (S.clock + dt / DAY_LEN) % 1;
  const h = Math.sin((S.clock - 0.25) * Math.PI * 2);            // how high the sun is: 1 noon, -1 midnight
  DAY.light = clamp(h * 1.6 + 0.35, 0, 1);
  DAY.twilight = clamp(1 - Math.abs(h) * 3.2, 0, 1);
  base.copy(SKY_NIGHT).lerp(SKY_A, DAY.light).lerp(SKY_DAWN, DAY.twilight * 0.55);
  sun.color.copy(DAY.light > 0.15 ? SUN_DAY : MOON).lerp(SUN_DUSK, DAY.twilight * 0.7);
  sun.position.set(Math.cos(S.clock * Math.PI * 2 - Math.PI / 2) * 160, Math.max(30, Math.abs(h) * 150), 60);
  ocean.material.color.copy(OCEAN_NIGHT).lerp(OCEAN_DAY, DAY.light);
  cloudMat.color.copy(CLOUD_NIGHT).lerp(CLOUD_DAY, DAY.light).lerp(SUN_DUSK, DAY.twilight * 0.6);
  camera.getWorldPosition(_camW); stars.position.copy(_camW);
  stars.material.opacity = clamp(1 - DAY.light * 1.6, 0, 1);
  stars.visible = stars.material.opacity > 0.01;
}

// ---------------------------------------------------------------- cosy nights
// At night the cabin goes warm and dim: amber lights, little reading lamps over the seats, glowing dots
// down the aisle, and a blanket over every sleepy passenger's lap.
let NIGHT = 0;   // 0 day … 1 night (eased in and out)
const LAMP_DAY = new THREE.Color(0xfff3d6), LAMP_NIGHT = new THREE.Color(0xc98a4a);
const CABIN_DAY = new THREE.Color(0xfff1dd), CABIN_NIGHT = new THREE.Color(0xffa055);
const COSY = { lamps: [], glowM: new THREE.MeshBasicMaterial({ color: 0x000000 }), aisleM: new THREE.MeshBasicMaterial({ color: 0x000000 }), blankets: [] };
(function buildCosy() {
  const lampY = WIN_Y1 + 0.24 - 0.18 - 0.06;   // (just under the overhead bins)
  const COLS = [0x9c3d3d, 0x3d5f9c, 0x6d4c96, 0x3f8059, 0xb87a3a, 0x8c3d6a];
  seats.forEach((st, i) => {
    const s = Math.sign(st.x), lx = st.x - s * 0.12, lz = st.z - 0.15;
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 12), COSY.glowM);
    glow.position.set(lx, lampY, lz); plane.add(glow);
    const l = new THREE.PointLight(0xffbd73, 0, 2.6, 1.6); l.position.set(lx, lampY - 0.08, lz); plane.add(l);
    COSY.lamps.push(l);
    // a blanket over the lap, folded down over the knees
    const m = std(COLS[i % COLS.length], { roughness: 1 }), b = new THREE.Group();
    box(0.52, 0.04, 0.42, m, 0, 0.69, -0.19, b);
    box(0.52, 0.39, 0.04, m, 0, 0.515, -0.42, b);
    box(0.54, 0.03, 0.08, std(0xf3ead8, { roughness: 1 }), 0, 0.715, 0, b);   // (the turned-down edge)
    b.position.set(st.x, 0, st.z); b.visible = false; plane.add(b);
    COSY.blankets.push({ g: b, seat: st });
  });
  for (let z = GALLEY + 0.3; z < CARGO - 0.2; z += 0.55) for (const s of [-1, 1]) box(0.05, 0.015, 0.1, COSY.aisleM, s * 0.42, 0.01, z);
})();
const _cosy = new THREE.Color();
function updateCosy(dt, dark) {
  NIGHT += (clamp((1 - DAY.light) * 1.5 - 0.25, 0, 1) - NIGHT) * Math.min(1, dt * 0.5);
  const on = dark ? 0 : NIGHT;
  for (const l of COSY.lamps) l.intensity = on * 1.1;
  COSY.glowM.color.setHex(0x2a2a2a).lerp(_cosy.setHex(0xffd9a0), on);
  COSY.aisleM.color.setHex(0x2a2a2a).lerp(_cosy.setHex(0xffa040), on);
  for (const b of COSY.blankets) { const p = b.seat.occupant; b.g.visible = NIGHT > 0.5 && !!p && p.state === 'seated' && !p.calling; }
}

// ---------------------------------------------------------------- rain
// Now and then it rains for a while (and always near a storm). Streaks fly past the windows in flight,
// fall straight down at the airport, and patter on the roof.
const RAIN_N = 1500, RAIN_BOX = 18;
const RAIN = (() => {
  const pos = new Float32Array(RAIN_N * 6), drops = [];
  for (let i = 0; i < RAIN_N; i++) drops.push({ x: (Math.random() * 2 - 1) * RAIN_BOX, y: (Math.random() * 2 - 1) * RAIN_BOX, z: (Math.random() * 2 - 1) * RAIN_BOX });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xb8c8dc, transparent: true, opacity: 0.55, depthWrite: false }));
  lines.frustumCulled = false; lines.visible = false; plane.add(lines);
  return { lines, pos, drops, amt: 0, said: false };
})();
const _rc = new THREE.Vector3();
function updateRain(dt, stormNear) {
  if (!isClient() && S.running && S.phase !== 'landing') {
    S.rainT = (S.rainT ?? 40) - dt;
    if (S.rainT <= 0) { S.rainOn = !S.rainOn; S.rainT = S.rainOn ? 30 + Math.random() * 30 : 40 + Math.random() * 40; }
  }
  if (S.rainOn && !RAIN.said) say('🌧 It\'s started to rain.');
  RAIN.said = !!S.rainOn;
  const want = Math.max(S.rainOn ? 1 : 0, stormNear);
  RAIN.amt += (want - RAIN.amt) * Math.min(1, dt * 0.4);
  const n = Math.floor(RAIN_N * RAIN.amt);
  RAIN.lines.visible = n > 10 && camera.parent === plane;
  if (!RAIN.lines.visible) return;
  // (in the air the rain flies past the plane; on the ground it falls)
  const air = S.phase !== 'airport', vx = air ? 0 : 0.6, vy = air ? -10 : -11, vz = air ? 55 : 0.4, L = air ? 0.025 : 0.07;
  _rc.copy(camera.position);
  const p = RAIN.pos, B = RAIN_BOX;
  for (let i = 0; i < n; i++) {
    const d = RAIN.drops[i];
    d.x += vx * dt; d.y += vy * dt; d.z += vz * dt;
    if (d.y < _rc.y - B || (!air && d.y < GROUND)) { d.y = _rc.y + B * Math.random(); d.x = _rc.x + (Math.random() * 2 - 1) * B; d.z = _rc.z + (Math.random() * 2 - 1) * B; }
    if (d.z > _rc.z + B) { d.z -= 2 * B; d.x = _rc.x + (Math.random() * 2 - 1) * B; d.y = _rc.y + (Math.random() * 2 - 1) * B; }
    if (d.x - _rc.x > B) d.x -= 2 * B; else if (_rc.x - d.x > B) d.x += 2 * B;
    if (d.y - _rc.y > B) d.y -= 2 * B;
    if (_rc.z - d.z > B) d.z += 2 * B;
    const k = i * 6;
    if ((insideHull(d.x, d.z) && d.y > -0.4 && d.y < ceilAt(d.z) + 0.5) || (!air && d.x > TERM.x0 && d.x < TERM.x1 && d.z > TERM.z0 && d.z < TERM.z1)) { p[k] = p[k + 3] = d.x; p[k + 1] = p[k + 4] = d.y; p[k + 2] = p[k + 5] = d.z; continue; }   // (not in the cabin, or the terminal)
    p[k] = d.x; p[k + 1] = d.y; p[k + 2] = d.z;
    p[k + 3] = d.x - vx * L; p[k + 4] = d.y - vy * L; p[k + 5] = d.z - vz * L;
  }
  RAIN.lines.geometry.setDrawRange(0, n * 2);
  RAIN.lines.geometry.attributes.position.needsUpdate = true;
}
