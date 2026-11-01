// Shared constants, rendering setup, materials, game state and small helpers.
// Every js/ file is a plain script; they share these globals and load in the order listed in index.html.
'use strict';
// ---------------------------------------------------------------- multiplayer mode
// ?host=CODE or ?join=CODE in the URL. Everyone in a room seeds the random generator with the room
// code, so the world (passenger looks, names, bag colours…) is built identically on every computer.
const NETQ = new URLSearchParams(location.search);
const NET = {
  mode: NETQ.get('host') ? 'host' : NETQ.get('join') ? 'client' : 'solo',
  room: (NETQ.get('host') || NETQ.get('join') || '').toUpperCase(),
  name: (NETQ.get('name') || 'Pilot').slice(0, 16),
  events: [], remotes: [], quiet: false,
};
if (NET.room) {
  let h = 1779033703 ^ NET.room.length;
  for (const ch of NET.room) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = h << 13 | h >>> 19; }
  let a = h >>> 0;
  Math.random = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const isClient = () => NET.mode === 'client';
const isHost = () => NET.mode === 'host';
// the host tells everyone about one-off things that happen (messages, explosions…)
const netEvent = (...e) => { if (isHost()) NET.events.push(e); };
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const D2R = Math.PI / 180;

// Plane geometry, in the plane's local frame (meters). Cabin floor is y=0, nose points -z.
// The outside is the plane modelled in Blender (models/plane.glb), scaled up PLANE_SCALE times: a boxy fuselage
// with straight walls, a door on each side just behind the cockpit, three big windows down each side (a row of
// seats beside each, one either side of the aisle), a low wing with an engine on each side, and a tail that
// sweeps up over the cargo ramp (a hole in its underside).
//   cockpit | galley (the exit doors) | cabin (3 rows) | cargo bay + lav | ramp
// The sizes below were measured off the model at 20x; K turns them into the size the plane is now.
// CHAR shrinks every person a little, so the plane, seats, doors and vehicles are roomy enough for them
const CHAR = 0.85, EYE = 1.42, TOTAL = 300;
const PLANE_SCALE = 13, K = PLANE_SCALE / 20;
const HULL_X = 2.67 * K, W = 2.49 * K;                           // the outside skin, and the inside of the wall
const wallX = () => W;                                           // (the walls go straight up)
const NOSE = -9 * K, BULK = -6 * K, REAR = 8.95 * K;
// the model's holes: an exit door each side, and three windows each side (z from, z to; and how high)
const DOOR_Z0 = -5.76 * K, DOOR_Z1 = -3.44 * K, DOOR_SILL = 0.2 * K, DOOR_TOP = 2.84 * K;
const WINDOWS = [[-2.88, -1.44], [-0.96, 0.48], [0.88, 2.48]].map(w => w.map(z => z * K)), WIN_Y0 = 1.48 * K, WIN_Y1 = 2.6 * K;
// the model's own fittings: the bathroom (two walls and a toilet, open to the aisle) on the right just behind the
// cabin, the fire extinguisher holder and the two food dispensers on the cockpit wall, and the cargo ramp button
const BATH = { x0: 0.48, z0: 2.21, z1: 3.5, toilet: { x: 1.1, z: 2.8 } };
const EXT_HOLDER = { x: 1.07, y: 1.05, z: -3.72 }, DISPENSER = { x: -1.07, y: 1.2, z: -3.6 }, RAMP_BUTTON = { x: 1.52, y: 1.45, z: 4.87 };
const GALLEY = DOOR_Z1 + 0.15, CARGO = BATH.z0;                  // the cabin runs past the windows, up to the bathroom; then the cargo bay
// how wide (half) and how tall the inside is along the plane: the nose and tail taper in
const HULL_TAB = [[-13.4, 0, 0], [-12.6, 1.39, 1.07], [-11.8, 1.71, 1.41], [-11, 1.93, 1.63], [-10.2, 2.12, 1.82], [-9.4, 2.27, 2.13],
  [-9, 2.33, 2.2], [-8.6, 2.37, 2.5], [-8.2, 2.42, 2.8], [-7.8, 2.49, 3.05], [-7.4, 2.54, 3.25], [-7, 2.57, 3.37], [-6.6, 2.6, 3.47],
  [-6.2, 2.6, 3.53], [-5.8, 2.6, 3.55], [5, 2.6, 3.55], [5.8, 2.54, 3.55], [7, 2.42, 3.55], [8.6, 2.24, 3.54], [10.2, 2.03, 3.53],
  [11.8, 1.82, 3.51], [13.4, 1.6, 3.47], [15, 1.36, 3.42], [16.6, 1.14, 3.36], [18.2, 0.85, 3.31], [19.8, 0.58, 3.28], [21, 0.37, 3.25], [21.4, 0, 3.25]]
  .map(r => r.map(v => v * K));
function hullTab(z, k) {
  const T = HULL_TAB;
  if (z <= T[0][0]) return T[0][k];
  for (let i = 1; i < T.length; i++) if (z <= T[i][0]) { const a = T[i - 1], b = T[i], f = (z - a[0]) / (b[0] - a[0]); return a[k] + (b[k] - a[k]) * f; }
  return T[T.length - 1][k];
}
// (the table is the skin; the model's walls and roof have some thickness, so the inside is a little smaller)
const WALL_T = 0.07, ROOF_T = 0.1;
const hullHW = z => Math.max(0, hullTab(z, 1) - WALL_T), ceilAt = z => Math.max(0, hullTab(z, 2) - ROOF_T);
const ROOT = HULL_X, WING_IN = 20 * K, WING_OUT = 25.6 * K, FUEL_X = 19.23 * K, BBQ_X = 16 * K;   // big wings: room for a barbecue
// the engines sit on the wings, sticking out well in front of them
const ENG_X = 8.43 * K, ENG_Y = -0.36 * K, ENG_Z0 = -9.94 * K, ENG_Z1 = -0.96 * K, ENG_R = 2.1 * K, PROP_Z = -9.06 * K;
const ENG_Z = (ENG_Z0 + ENG_Z1) / 2;
// the cargo ramp fills the hole under the tail: closed, it slopes up along it; open, it reaches the tarmac
const GROUND = -4.2 * K;                                         // tarmac height under the parked plane (the propellers just clear it)
const RAMP_LEN = 6.92 * K, RAMP_SHUT = Math.PI / 2 - Math.atan2(1.0, 6.85), RAMP_OPEN = Math.PI / 2 + Math.asin(-GROUND / RAMP_LEN);
const RAMP_W0 = 1.5 * K, RAMP_W1 = 0.9 * K;                      // half-width at the hinge and at the far end
const RAMP_ANG = RAMP_OPEN - Math.PI / 2, RAMP_SLOPE = Math.tan(RAMP_ANG), RAMP_RUN = RAMP_LEN * Math.cos(RAMP_ANG);
// how far out from the middle you can stand on the open ramp (it narrows like the tail it closes)
const rampHW = z => RAMP_W0 - 0.15 + (RAMP_W1 - RAMP_W0) * clamp((z - REAR) / RAMP_RUN, 0, 1);
const RAMP_FOOT = { x: 0, z: REAR + RAMP_RUN + 1.2 };
// a row of seats by each window, one seat either side of the aisle
const ROWS = WINDOWS.map(w => (w[0] + w[1]) / 2 - 0.05), SEAT_X = [-(W - 0.42), W - 0.42];
const le = x => -6.6 * K + (x - 6 * K) * 0.19;      // wing leading edge z at |x|
const te = x => 3.6 * K - (x - 6 * K) * 0.135;     // wing trailing edge z at |x|
// the wing's top surface: it tilts up towards the tips, and dips a little towards the leading edge
const wingY = (x, z) => { const ax = Math.abs(x), f = clamp((te(ax) - z) / (te(ax) - le(ax)), 0, 1); return 0.0377 * ax - (0.205 + 0.05 * f * f) * K; };
const FUEL_Z = 0;                                                // (the model's own fuel pipe, on top of each wing)
const CPT = { x: -0.97 * K, z: -7.3 * K, y: 0 };                 // the captain's seat
// airport layout (the parked plane sits at the origin)
// the terminal sits well back from the plane, so you need the vehicles to get between them
const TERM = { x0: -20, x1: 20, z0: 85, z1: 101 }, TERM_DOOR = { x: 0, z: 83.5 };
const BELT_X = 12, BELT_START = 92, BELT_END = 73.4, BELT_Y = GROUND + 0.75;
const sideName = s => s === 'L' ? 'LEFT' : 'RIGHT';
const sideWord = s => s === 'L' ? 'left' : 'right';

// touch screens (iPads, phones) get on-screen controls instead of the mouse
let TOUCH = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 1 && /Macintosh|iPad|iPhone/.test(navigator.userAgent));
if (TOUCH) document.documentElement.classList.add('touch');
let selfUnlock = false;   // (the game letting go of the mouse itself, as opposed to you pressing Esc)
const unlock = () => { try { if (document.pointerLockElement) { selfUnlock = true; document.exitPointerLock(); } } catch (e) {} };

// ---------------------------------------------------------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, TOUCH ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
const SKY_A = new THREE.Color(0x6fb4ee), SKY_B = new THREE.Color(0xf0a060), SKY_STORM = new THREE.Color(0x3c4452);
scene.background = SKY_A.clone();
scene.fog = new THREE.Fog(SKY_A.clone(), 400, 2600);

const plane = new THREE.Group();
scene.add(plane);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 6000);
camera.rotation.order = 'YXZ';
plane.add(camera);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const hemi = new THREE.HemisphereLight(0xdfefff, 0x445566, 0.75);
scene.add(hemi);
scene.add(new THREE.AmbientLight(0xffffff, 0.25));
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(80, 150, 60);
scene.add(sun);
const cabinLights = [];
for (const z of [-7.3, -2.5, 2.5, 9]) {
  const l = new THREE.PointLight(0xfff1dd, 0.5, 16);
  l.position.set(0, Math.min(2.8, ceilAt(z) - 0.4), z);
  plane.add(l); cabinLights.push(l);
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.userData = { canvas: c };
  return t;
}
const PTEX = canvasTex(64, 64, (g) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
});
const emojiCache = {};
function emojiMat(e, onTop) {
  const k = e + (onTop ? '!' : '');
  if (!emojiCache[k]) {
    const tex = canvasTex(64, 64, g => { g.font = '50px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 32, 36); });
    emojiCache[k] = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: !onTop, depthWrite: false });
  }
  return emojiCache[k];
}
// a flat sign with text painted on it
function textPlane(w, h, text, bg, fg, parent, x, y, z, ry = 0, font = 'bold 60px sans-serif') {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
    map: canvasTex(512, Math.round(512 * h / w), (g, cw, ch) => {
      g.fillStyle = bg; g.fillRect(0, 0, cw, ch);
      g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, cw / 2, ch / 2 + 3);
    }),
  }));
  m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m;
}

// ---------------------------------------------------------------- particles (world space)
class Particles {
  constructor(n, blending) {
    this.list = []; this.i = 0;
    for (let k = 0; k < n; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: PTEX, transparent: true, depthWrite: false, blending }));
      s.visible = false; scene.add(s);
      this.list.push({ s, life: 0, max: 1, vel: new THREE.Vector3(), size: 1, grow: 1, a: 1 });
    }
  }
  emit(pos, vel, color, size, life, grow, alpha = 1) {
    const p = this.list[this.i++ % this.list.length];
    p.s.position.copy(pos); p.vel.copy(vel);
    p.s.material.color.set(color);
    Object.assign(p, { size, grow, max: life, life, a: alpha });
    p.s.visible = true;
  }
  update(dt) {
    for (const p of this.list) {
      if (!p.s.visible) continue;
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; continue; }
      p.s.position.addScaledVector(p.vel, dt);
      const k = 1 - p.life / p.max, sc = p.size * (1 + k * p.grow);
      p.s.scale.set(sc, sc, 1);
      p.s.material.opacity = p.a * (1 - k);
    }
  }
}
const fireFx = new Particles(300, THREE.AdditiveBlending);
const smokeFx = new Particles(400, THREE.NormalBlending);
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
// emit at a plane-local position with a plane-local velocity
function emitLocal(fx, x, y, z, vx, vy, vz, color, size, life, grow, alpha) {
  plane.localToWorld(tmpV.set(x, y, z));
  tmpV2.set(vx, vy, vz).applyQuaternion(plane.quaternion);
  fx.emit(tmpV, tmpV2, color, size, life, grow, alpha);
}

// world-space debris: things that fell off or out of the plane
const falling = [];
function toDebris(obj, vel, life = 8) {
  plane.updateMatrixWorld(true);
  scene.attach(obj);
  falling.push({ m: obj, vel, spin: new THREE.Vector3(rand(-3, 3), rand(-3, 3), rand(-5, 5)), t: 0, life });
}

// ---------------------------------------------------------------- materials & mesh helpers
const std = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .6 }, o));
const M = {
  hull: std(0xf4f6f9, { roughness: .45, metalness: .15 }),
  hull2: std(0xf4f6f9, { roughness: .45, metalness: .15, side: THREE.DoubleSide }),
  belly: std(0x8fa3b8, { roughness: .5, metalness: .2 }),
  lining: std(0xece6da, { roughness: .85, side: THREE.BackSide }),
  ceiling: std(0xf6f3ec, { roughness: .9, side: THREE.BackSide }),
  wall: std(0xe4e1da, { roughness: .8, side: THREE.DoubleSide }),
  stripe: std(0x1f4fa8, { roughness: .4 }),
  stripeRed: std(0xd8342c, { roughness: .4 }),
  carpet: std(0x3a4252, { roughness: 1 }),
  runner: std(0x7a2f3a, { roughness: 1 }),
  seat: std(0x2b4c8c, { roughness: .9 }),
  white: std(0xf2f2f2, { roughness: .7 }),
  bin: std(0xdcdfe4, { roughness: .6 }),
  window: new THREE.MeshBasicMaterial({ color: 0xaad8ff }),
  frame: std(0x8b919a, { roughness: .5 }),
  wing: std(0xdfe3e8, { roughness: .45, metalness: .35, side: THREE.DoubleSide }),
  grey: std(0x9aa3ad, { roughness: .5, metalness: .5, side: THREE.DoubleSide }),
  olive: std(0x7d8a6a, { roughness: .7, metalness: .3, side: THREE.DoubleSide }),
  dark: std(0x1a2230, { roughness: .4, metalness: .5 }),
  panel: std(0x2a323e, { roughness: .5, metalness: .4 }),
  red: std(0xd8342c, { roughness: .5 }),
  yellow: std(0xf2c230, { roughness: .5 }),
  steel: std(0xc6ccd4, { roughness: .3, metalness: .8 }),
  wood: std(0x9a7448, { roughness: .9 }),
  porcelain: std(0xfafafa, { roughness: .25 }),
  lavWall: std(0xd6dde6, { roughness: .6, side: THREE.DoubleSide }),
  mirror: new THREE.MeshBasicMaterial({ color: 0xbfd8e8 }),
  lamp: new THREE.MeshBasicMaterial({ color: 0xfff3d6 }),
  glass: std(0x9fd4ff, { transparent: true, opacity: .22, side: THREE.DoubleSide, depthWrite: false }),
  termGlass: std(0x8fc4e8, { transparent: true, opacity: .3, roughness: .1, metalness: .6, depthWrite: false }),
  hit: new THREE.MeshBasicMaterial({ visible: false }),
};
// a panel full of little switches and lights
M.switches = new THREE.MeshStandardMaterial({ roughness: .5, map: canvasTex(256, 128, (g, w, h) => {
  g.fillStyle = '#232a35'; g.fillRect(0, 0, w, h);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
    const x = 18 + c * 30, y = 18 + r * 30;
    g.fillStyle = '#3a4352'; g.fillRect(x - 10, y - 10, 20, 20);
    g.fillStyle = pick(['#ddd', '#ddd', '#f5c518', '#e33']); g.fillRect(x - 3, y - 8, 6, 12);
    if (Math.random() < .4) { g.fillStyle = pick(['#3f6', '#fa3', '#39f']); g.beginPath(); g.arc(x + 8, y + 8, 3, 0, 7); g.fill(); }
  }
}) });
function box(w, h, d, mat, x, y, z, parent = plane) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); parent.add(m); return m;
}
function cyl(rt, rb, h, mat, x, y, z, parent = plane, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z); parent.add(m); return m;
}

// interactable things: anything the crosshair can target
const targets = [];
const STATIONS = {};
function station(id, name, area, mesh, extra = {}) {
  mesh.userData.station = id;
  targets.push(mesh);
  STATIONS[id] = Object.assign({ id, name, area, mesh }, extra);
}

// ---------------------------------------------------------------- game state
const S = {
  running: false, paused: false, over: false, view: 'first', phase: 'airport', t: 0, dist: 0, integrity: 100, seatbelt: false, flying: false, driving: null,
  toT: 0, toSpeed: 0, liftoff: false, alt: 0, pitch: 0, fuel: 100, tankerT: 0,
  turb: 0, flash: 0, shake: 0, roll: 0, gust: 0, gustT: 0,
  needs: { calm: 90, hunger: 85, bored: 85, comfort: 85 },
  faults: [], nextFault: 28, firstFault: true, nextStorm: 45, stormOn: false,
  nextCall: 18, nextStroll: 15, cd: {}, press: false, drop: false, act: false, jump: false, holdKey: null, holdT: 0, holdLock: false, held: null,
  beltSpawnT: 0.5, beltLoadT: 0,
  alarmT: 0, complainT: 12, hudT: 0, lowHapT: 0, fixed: 0, falls: 0, ejected: 0, lostBags: 0, uid: 0,
};
// yaw/pitch are where you look (and aim); face is which way your body points; mvx/mvz is how fast you're walking
const P = { x: 0, y: GROUND, z: TERM.z0 + 4.5, vy: 0, yaw: 0, pitch: -0.02, face: 0, mvx: 0, mvz: 0, falling: false, fallT: 0, vz: 0, vx: 0, walkT: 0 };
// turn angle a toward b by at most step (the short way round)
const turnToward = (a, b, step) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + clamp(d, -step, step); };
const PW = { x: 0, y: 0, vx: 0, vy: 0 };   // the plane's position in the sky (steering moves it)
const inAir = () => S.phase === 'flight' || S.phase === 'landing';
// you (on this computer) as someone who can carry things; remote players have the same shape
const LOCAL = { isLocal: true, name: NET.name, pose: P, get held() { return S.held; }, set held(v) { S.held = v; } };
// is anyone at the controls, and whose keys are steering?
const piloted = () => S.flying || !!S.pilotRP;
const pilotKeys = () => S.flying ? keys : S.pilotRP ? S.pilotRP.keys : {};
const happiness = () => (S.needs.calm * 1.3 + S.needs.hunger + S.needs.bored + S.needs.comfort) / 4.3;

function say(text, kind = '') {
  if (NET.quiet) return;
  netEvent('say', text, kind);
  sayLocal(text, kind);
}
function sayLocal(text, kind = '') {
  const d = document.createElement('div');
  d.className = 'msg ' + kind; d.textContent = text;
  $('toast').appendChild(d);
  while ($('toast').children.length > 4) $('toast').firstChild.remove();
  setTimeout(() => d.remove(), 5000);
}

// ---------------------------------------------------------------- audio
let AC = null, OUT = null, droneGain = null, windGain = null, droneOsc = null;
const VOLUME = 2.5;   // everything goes through one master volume (and a limiter, so loud bits don't crackle)
function initAudio() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const limit = AC.createDynamicsCompressor(); limit.threshold.value = -10; limit.knee.value = 6; limit.ratio.value = 12;
    OUT = AC.createGain(); OUT.gain.value = VOLUME; OUT.connect(limit).connect(AC.destination);
    droneOsc = AC.createOscillator(); droneGain = AC.createGain();
    const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
    droneOsc.type = 'sawtooth'; droneOsc.frequency.value = 30; droneGain.gain.value = 0.02;
    droneOsc.connect(f).connect(droneGain).connect(OUT); droneOsc.start();
    const buf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const noise = AC.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.6;
    windGain = AC.createGain(); windGain.gain.value = 0.0;
    noise.connect(bp).connect(windGain).connect(OUT); noise.start();
  } catch (e) { AC = null; }
}
function beep(freq, dur = 0.12, type = 'square', vol = 0.05) {
  if (!AC) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
  o.connect(g).connect(OUT); o.start(); o.stop(AC.currentTime + dur);
}
// cartoon sound effects
function sweep(f0, f1, dur, type = 'sine', vol = 0.06) {
  if (!AC) return;
  const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(OUT); o.start(); o.stop(t + dur);
}
const slideWhistle = up => sweep(up ? 500 : 1400, up ? 1500 : 400, 0.6);
const boing = () => { sweep(120, 520, 0.25, 'triangle', 0.08); setTimeout(() => sweep(520, 200, 0.2, 'triangle', 0.05), 220); };
const quack = () => { sweep(700, 380, 0.12, 'sawtooth', 0.04); setTimeout(() => sweep(650, 360, 0.12, 'sawtooth', 0.04), 140); };
const chime = () => { beep(660, .15, 'sine', .08); setTimeout(() => beep(990, .25, 'sine', .08), 120); };
