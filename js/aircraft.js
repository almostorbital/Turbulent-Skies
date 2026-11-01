// The other aircraft, both copies of the plane model: the tanker that comes to refuel you when fuel runs
// low (it hovers over the left wing and lowers a hose to the fuel pipe), and the mini plane in the luggage,
// which you can take out of the big plane in flight and fly alongside it.
'use strict';
const MINI_SCALE = 1.0;

// a plainly painted copy of the plane model, centred on its middle (mirrored into a whole plane if the
// file is only half of one)
function modelCopy(scene, scale, color) {
  const paint = std(color, { roughness: .5, metalness: .2, side: THREE.DoubleSide }), dark = std(0x222222);
  const g = new THREE.Group(), c = scene.clone(true);
  c.traverse(o => { if (o.isMesh) o.material = /^cube\./i.test(o.name) ? dark : paint; });
  g.add(c);
  const b = new THREE.Box3().setFromObject(c);
  if (b.min.x > -0.05 || b.max.x < 0.05) { const m = c.clone(true); m.scale.x = -1; g.add(m); }
  g.scale.setScalar(scale);
  g.position.set(0, -PLANE_FLOOR * scale, 0.37 * scale);
  const wrap = new THREE.Group(); wrap.add(g);
  return wrap;
}
// (models.js calls this once the plane model has loaded)
function aircraftModels(scene) {
  if (!scene) return;
  TANKER.g.add(modelCopy(scene, PLANE_SCALE, 0x6e7f5c));
  textPlane(3, 0.8, 'TANKER', '#6e7f5c', '#fff', TANKER.g, -HULL_X - 0.05, 1.2, 0, -Math.PI / 2, 'bold 90px sans-serif');
  for (const it of items) if (it.type === BAGS.miniplane) miniModel(it, scene);
  BAGS.miniplane.scene = scene;
}
function miniModel(it, scene) {
  const ud = it.g.userData;
  if (ud.model) return;
  ud.model = modelCopy(scene, MINI_SCALE, 0xffc83d); it.g.add(ud.model);
  if (ud.standIn) ud.standIn.visible = false;
}

// ---------------------------------------------------------------- the tanker
const TANKER = { g: new THREE.Group(), k: 0, leave: 0, pump: 0 };
plane.add(TANKER.g); TANKER.g.visible = false;
const hoseMat = std(0x222222, { roughness: .7 });
TANKER.hose = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 8), hoseMat); plane.add(TANKER.hose); TANKER.hose.visible = false;
TANKER.nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.1, 0.35, 10), M.yellow); plane.add(TANKER.nozzle); TANKER.nozzle.visible = false;
const TANKER_Y = 9.5;                       // how far above the wing it hovers
function tankerPump() { TANKER.pump = 5; }
const _ht = new THREE.Vector3(), _he = new THREE.Vector3();
// it comes up from behind while the refuel job's on (or it's pumping), and flies off ahead when done
function updateTanker(dt) {
  const want = inAir() && (S.faults.some(f => f.id === 'refuel') || TANKER.pump > 0);
  if (want) { TANKER.leave = 0; TANKER.k = Math.min(1, TANKER.k + dt / 7); }
  else if (TANKER.k > 0) { TANKER.leave += dt; if (TANKER.leave > 7) TANKER.k = 0; }
  TANKER.pump = Math.max(0, TANKER.pump - dt);
  const on = TANKER.k > 0;
  TANKER.g.visible = on;
  if (!on) { TANKER.hose.visible = TANKER.nozzle.visible = false; return; }
  const e = 1 - Math.pow(1 - TANKER.k, 3), L = TANKER.leave;
  TANKER.g.position.set(-FUEL_X + Math.sin(S.t * 0.7) * 0.3, TANKER_Y + (1 - e) * 25 + L * L * 1.5 + Math.sin(S.t * 1.1) * 0.25, FUEL_Z + (1 - e) * 160 - L * L * 9);
  // the hose hangs from its belly; it's plugged into the fuel pipe while it pumps
  const ready = e > 0.97 && !L;
  TANKER.hose.visible = TANKER.nozzle.visible = ready;
  if (!ready) return;
  _ht.copy(TANKER.g.position); _ht.y -= 2.0;
  const pipe = _he.set(-FUEL_X, wingY(FUEL_X, FUEL_Z) + 0.3, FUEL_Z);
  if (!TANKER.pump) pipe.set(-FUEL_X + Math.sin(S.t * 1.7) * 0.4, pipe.y + 1.3, FUEL_Z + Math.cos(S.t * 1.3) * 0.4);   // (dangling, within reach)
  TANKER.hose.position.copy(_ht).add(pipe).multiplyScalar(0.5);
  TANKER.hose.scale.y = _ht.distanceTo(pipe);
  TANKER.hose.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _ht.clone().sub(pipe).normalize());
  TANKER.nozzle.position.copy(pipe); TANKER.nozzle.quaternion.copy(TANKER.hose.quaternion);
}

// ---------------------------------------------------------------- the mini plane
// E on it (in flight): you climb aboard and fly it beside the big plane. W faster, S slower, the mouse
// steers; E again (near the big plane) lands you back in its cargo bay. The host moves the item to
// wherever its pilot says it is, so everyone sees it.
function startMini(it) {
  if (P.mini) return;
  if (!inAir()) return say('✈ The mini plane only flies once we\'re in the air. Bring it along!');
  GRAB.hands = [null, null]; GRAB.mode = null; keys.grab = false;
  const s = P.x < 0 ? -1 : 1;
  P.mini = { it, x: s * (HULL_X + 7), y: 1.5, z: P.z, yaw: P.yaw, pitch: 0, v: 8, bank: 0 };
  P.yaw = 0; P.pitch = 0;
  if (isClient()) netSend({ t: 'mini', i: items.indexOf(it), on: 1 }); else miniTaken(it, LOCAL);
  say('✈ You\'re flying the mini plane! Mouse to steer · W faster · S slower · E to land back in the big plane.', 'good');
  sweep(300, 700, 0.5, 'sawtooth', 0.04);
}
// (host) an item someone is flying: it's theirs until they land
function miniTaken(it, who) { if (it.state === 'ride') freeSlot(it); it.state = 'mini'; it.pilot = who; }
function miniLanded(it) {
  Object.assign(it, { state: 'free', x: 0.5, y: 0, z: CARGO + 1.6, vx: 0, vy: 0, vz: 0, pilot: null });
  it.g.position.set(it.x, it.y, it.z); it.g.rotation.set(0, 0, 0);
}
function endMini(crashed) {
  const m = P.mini; if (!m) return;
  P.mini = null;
  if (isClient()) netSend({ t: 'mini', i: items.indexOf(m.it), on: 0 }); else miniLanded(m.it);
  Object.assign(P, { x: -0.4, y: 0, z: CARGO + 1.4, vy: 0, vx: 0, vz: 0, mvx: 0, mvz: 0, falling: false, yaw: Math.PI, pitch: 0 }); P.face = Math.PI;
  if (ME) ME.rag = null;
  say(crashed ? '💦 SPLASH! The mini plane fished you out and flew you home. Somehow.' : '✈ Landed back in the cargo bay. Nice flying!', crashed ? 'bad' : 'good');
}
const _mv = new THREE.Vector3();
function updateMini(dt) {
  const m = P.mini;
  if (!inAir() || S.over) return endMini();
  if (S.press) {
    S.press = false;
    if (Math.hypot(m.x, m.y, m.z) < 26) return endMini();
    say('✈ Fly closer to the big plane to land in it.');
  }
  // steering: your look direction; the arrow keys turn too
  P.yaw += ((keys.arrowleft || keys.a ? 1 : 0) - (keys.arrowright || keys.d ? 1 : 0)) * 1.4 * dt;
  P.pitch = clamp(P.pitch + ((keys.arrowup ? 1 : 0) - (keys.arrowdown ? 1 : 0)) * 1.2 * dt, -0.9, 0.9);
  const turn = Math.atan2(Math.sin(P.yaw - m.yaw), Math.cos(P.yaw - m.yaw));
  m.yaw += turn * Math.min(1, dt * 3); m.pitch += (P.pitch - m.pitch) * Math.min(1, dt * 3);
  m.bank += (clamp(-turn * 1.5, -0.8, 0.8) - m.bank) * Math.min(1, dt * 4);
  // (speeds are against the big plane: 0 keeps pace with it)
  m.v += ((keys.w || keys.shift ? 26 : keys.s ? -5 : 7) - m.v) * Math.min(1, dt * 1.2);
  _mv.set(-Math.sin(m.yaw) * Math.cos(m.pitch), Math.sin(m.pitch), -Math.cos(m.yaw) * Math.cos(m.pitch));
  m.x += _mv.x * m.v * dt; m.y += _mv.y * m.v * dt; m.z += _mv.z * m.v * dt;
  // don't wander off, and don't fly into the big plane (it shoves you back out to the side)
  const d = Math.hypot(m.x, m.y, m.z);
  if (d > 90) { const k = (d - 90) * dt * 2 / d; m.x -= m.x * k; m.y -= m.y * k; m.z -= m.z * k; if (S.t - (m.farT || -9) > 4) { m.farT = S.t; say('✈ Too far from the big plane! Come back!'); } }
  if (Math.abs(m.x) < HULL_X + 1 && m.y > -2.6 && m.y < 4.2 && m.z > NOSE - 5 && m.z < REAR + 10) m.x += (m.x < 0 ? -1 : 1) * dt * 6;
  if (m.y < SEA_Y - PW.y + 1.5) { splash(m); return endMini(true); }
  P.x = m.x; P.y = m.y - 0.15; P.z = m.z; P.vy = 0; P.falling = false; P.face = m.yaw;
  placeMini(m.it, m.x, m.y, m.z, m.yaw, m.pitch, m.bank);
}
function placeMini(it, x, y, z, yaw, pitch, bank) {
  if (it.g.parent !== plane) { plane.add(it.g); const f = falling.findIndex(f => f.m === it.g); if (f >= 0) falling.splice(f, 1); }
  it.g.visible = true;
  it.x = x; it.y = y + 0.15; it.z = z;   // (just under its rider's seat)
  it.g.position.set(it.x, it.y, it.z); it.g.rotation.set(pitch, yaw, bank, 'YXZ');
}
function splash(m) { for (let i = 0; i < 40; i++) emitLocal(smokeFx, m.x, m.y, m.z, rand(-4, 4), rand(2, 9), rand(-4, 4), 0xddeeff, 0.8, 1.2, 2, 0.8); beep(200, .4, 'sawtooth', .08); }
// (host) mini planes flown by other players go where they say
function hostMinis() {
  for (const it of items) {
    if (it.state !== 'mini') continue;
    const w = it.pilot;
    if (!w || (!w.isLocal && !NET.remotes.includes(w))) { miniLanded(it); continue; }
    if (w.isLocal) continue;   // (your own: updateMini places it)
    placeMini(it, w.pose.x, w.pose.y + 0.15, w.pose.z, w.pose.face ?? w.pose.yaw, 0, 0);
  }
}
// the chase camera behind the mini plane
function miniCam(shake) {
  const m = P.mini;
  camera.position.set(m.x + Math.sin(m.yaw) * 5 + rand(-shake, shake), m.y + 1.6, m.z + Math.cos(m.yaw) * 5);
  camera.lookAt(plane.localToWorld(tmpV.set(m.x - Math.sin(m.yaw) * 4, m.y + Math.sin(m.pitch) * 4, m.z - Math.cos(m.yaw) * 4)));
}
