// Skydiving: fall (or jump) out of the plane in flight and you really fall, all the way down to the sea,
// while the plane flies on without you. There's always an island somewhere below: steer for it (WASD), open
// your parachute (Space; it opens by itself if you leave it too late), and land on it. On the island you can
// walk about; E waves down a pickup back to the plane. Miss, and it's a splash and a soggy ride home.
// It all happens in the world (the sea and islands), not in the plane, so P.sky keeps world coordinates.
'use strict';
const SKY = { chute: null };
const _sw = new THREE.Vector3();
// a parachute canopy over your head (you see its edge when you look up)
(function () {
  const g = new THREE.Group(), cols = [0xff3b3b, 0xffffff, 0x2f7bff, 0xffd400];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(2.6, 6, 6, i * Math.PI / 4, Math.PI / 4, 0, Math.PI / 2.6), std(cols[i % 4], { side: THREE.DoubleSide, roughness: .8 }));
    g.add(m);
  }
  g.position.y = 3.2; g.visible = false; camera.add(g); SKY.chute = g;
})();
const islandTop = (it, x, z) => {
  const d = Math.hypot(x - it.o.position.x, z - it.o.position.z), r = it.r;
  if (d > r * 1.15) return null;
  return SEA_Y + Math.max(1.5, d < r ? r * 0.8 * (1 - d / r) : 0);
};
function islandAt(x, z) { for (const it of scenery) if (it.kind === 'island') { const y = islandTop(it, x, z); if (y !== null) return { it, y }; } return null; }

// out you go: from here on you fall in the world
function startSkydive() {
  plane.updateMatrixWorld(true);
  _sw.set(P.x, P.y, P.z).applyMatrix4(plane.matrixWorld);
  // (a quick fall: a moment's whoosh and you're most of the way down already)
  P.sky = { x: _sw.x, y: Math.min(_sw.y, SEA_Y + 130), z: _sw.z, vx: 0, vy: -30, vz: 0, chute: false, island: null, t: 0, splashT: 0 };
  $('flash').style.opacity = 0.6; sweep(900, 200, 0.6, 'sine', 0.06);
  P.falling = false; $('fade').style.opacity = 0;
  if (ME) { ME.rag = null; ME.g.visible = false; }
  // make sure there's an island in reach, a little ahead and to one side of where you'd land
  let best = null, bd = 1e9;
  for (const it of scenery) if (it.kind === 'island') { const d = Math.hypot(it.o.position.x - _sw.x, it.o.position.z - _sw.z); if (d < bd) { bd = d; best = it; } }
  if (best && bd > best.r + 25) best.o.position.set(_sw.x + rand(-1, 1) * (best.r * 0.5 + 25), SEA_Y, _sw.z - best.r * 0.6 - rand(15, 35));
  if (best) best.hold = true;   // (it drifts back behind the plane with you; don't let it be recycled ahead)
  say('🪂 You fell out of the plane! Steer for an island (WASD) and open your parachute (Space)!', 'bad');
}
function endSkydive(msg, kind) {
  P.sky = null; SKY.chute.visible = false;
  for (const it of scenery) it.hold = false;
  Object.assign(P, { x: 0, y: 0, z: GALLEY - 0.6, vx: 0, vy: 0, vz: 0, mvx: 0, mvz: 0, yaw: Math.PI, pitch: 0, falling: false, launched: false });
  P.face = Math.PI;
  if (ME) ME.rag = null;
  if (msg) say(msg, kind);
}
function updateSkydive(dt) {
  const s = P.sky, ws = S.ws || 0;
  s.t += dt;
  if (!inAir() || S.over) return endSkydive();
  // the sea and the islands slide past as the plane flies on; so do you
  s.z += ws * dt;
  const fwd = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0), side = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  if (s.island) {
    // standing on an island: walk about on it (it carries you along with it)
    const it = s.island, sp = keys.shift ? 5 : 2.6;
    s.ox += (fx * fwd + rx * side) * sp * dt; s.oz += (fz * fwd + rz * side) * sp * dt;
    const d = Math.hypot(s.ox, s.oz), lim = it.r * 1.1; if (d > lim) { s.ox *= lim / d; s.oz *= lim / d; }
    s.x = it.o.position.x + s.ox; s.z = it.o.position.z + s.oz; s.y = islandTop(it, s.x, s.z) ?? SEA_Y + 1.5;
    if (S.press) { S.press = false; return endSkydive('🛶 A seaplane spotted you waving and flew you back to the plane. What an adventure!', 'good'); }
  } else if (s.splashT > 0) {
    s.splashT -= dt; s.y = SEA_Y - 0.6;
    if (s.splashT <= 0) { endSkydive(); respawn(); return; }
    return syncSkydive();
  } else {
    // falling: fast until the parachute opens, then gently; steer with WASD either way
    if (S.jump && !s.chute) { s.chute = true; sweep(300, 120, 0.4, 'sawtooth', 0.05); say('🪂 Parachute open! Steer for the island.', 'good'); }
    S.jump = false;
    if (!s.chute && s.y < SEA_Y + 35) { s.chute = true; say('🪂 Your parachute opened by itself. Phew!'); }
    const term = s.chute ? -9 : -60, steer = s.chute ? 11 : 16;
    s.vy += (term - s.vy) * Math.min(1, dt * (s.chute ? 2 : 0.35)) - (s.chute ? 0 : 9.8 * dt * 0.2);
    s.vx += ((fx * fwd + rx * side) * steer - s.vx) * Math.min(1, dt * 1.5);
    s.vz += ((fz * fwd + rz * side) * steer - s.vz) * Math.min(1, dt * 1.5);
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    // down at the bottom: an island, or the sea
    const isl = islandAt(s.x, s.z);
    if (isl && s.y <= isl.y) {
      s.island = isl.it; isl.it.hold = true; s.ox = s.x - isl.it.o.position.x; s.oz = s.z - isl.it.o.position.z; s.y = isl.y; s.chute = false;
      beep(300, .15, 'triangle', .06); setTimeout(() => chime(), 200);
      say('🏝 You landed on an island! Have a look around, then press E to wave for a pickup.', 'good');
    } else if (s.y <= SEA_Y) {
      s.splashT = 1.6;
      for (let i = 0; i < 40; i++) emitLocal(smokeFx, P.x, P.y + 0.5, P.z, rand(-5, 5), rand(3, 10), rand(-5, 5), 0xddeeff, 0.8, 1.2, 2, 0.8);
      beep(200, .5, 'sawtooth', .08);
      say('💦 SPLASH! You missed the island.', 'bad');
    }
  }
  SKY.chute.visible = s.chute;
  syncSkydive();
}
// back into the plane's own coordinates, so the camera (and everyone else) knows where you are
function syncSkydive() {
  plane.updateMatrixWorld(true);
  _sw.set(P.sky.x, P.sky.y, P.sky.z); plane.worldToLocal(_sw);
  P.x = _sw.x; P.y = _sw.y; P.z = _sw.z; P.vy = 0; P.falling = false;
}
function skyCam(shake) {
  camera.position.set(P.x + rand(-shake, shake), P.y + EYE, P.z);
  camera.rotation.set(P.pitch, P.yaw, 0);
}
