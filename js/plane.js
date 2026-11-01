// The airplane: fuselage, cockpit, cabin, lavatories, cargo bay, wings and engines,
// plus the things that can break off it.
'use strict';
const engines = {}, wings = {}, doors = {}, lavDoors = {}, segments = [], seats = [], beltSigns = [], navLights = [];
const hole = { seg: null, side: null };
let ramp, gear, movieTex;

// the in-flight movie: a little animated cartoon on the cabin screen
let movieT = 0, movieDrawT = 0;
function drawMovie(g, w, h) {
  if (movieT <= 0) {
    g.fillStyle = '#10161f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#5a6a80'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.fillText('✈ FLIGHT 404', w / 2, h / 2 - 6);
    g.font = '14px sans-serif'; g.fillText('Please keep your seatbelt fastened', w / 2, h / 2 + 18);
    return;
  }
  const t = performance.now() / 1000;
  const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#ff9a5a'); sky.addColorStop(1, '#ffd98a');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffef9a'; g.beginPath(); g.arc(w * 0.75, h * 0.45, 22, 0, 7); g.fill();
  g.fillStyle = '#3d6b3d';
  for (let i = 0; i < 6; i++) { const x = ((i * 70 - t * 30) % (w + 80) + w + 80) % (w + 80) - 40; g.beginPath(); g.moveTo(x - 50, h); g.lineTo(x, h - 50); g.lineTo(x + 50, h); g.fill(); }
  g.font = '40px serif'; g.textAlign = 'center'; g.fillText('🐕', 60 + Math.sin(t * 2) * 30, h - 18 - Math.abs(Math.sin(t * 6)) * 18);
  g.fillText('🎈', w * 0.4, 50 + Math.sin(t) * 10);
}

// glass and paint for the plane model (see dressPlane below)
const PLANE_MAT = {
  skin: std(0xffffff, { vertexColors: true, roughness: .45, metalness: .15 }),
  lining: std(0xffffff, { vertexColors: true, roughness: .85, side: THREE.BackSide }),
  glass: std(0xbfe4ff, { transparent: true, opacity: .25, roughness: .05, metalness: .3, side: THREE.DoubleSide, depthWrite: false }),
  windscreen: std(0x7fb0d8, { transparent: true, opacity: .35, roughness: .05, metalness: .4, side: THREE.DoubleSide, depthWrite: false }),
};

// One ring of the cabin wall, round one of the model's windows. Each side panel (its piece of the outer
// skin, once the plane model has loaded, and the glass in its window) is kept together in `meshes` so the
// whole thing rips away at once.
const SEG_Y0 = 0, SEG_Y1 = 3.1;
function hullSegment(z0, z1, [w0, w1]) {
  const seg = { z0, z1, z: (z0 + z1) / 2, sides: {} };
  const wz = (w0 + w1) / 2, ww = w1 - w0, wy = (WIN_Y0 + WIN_Y1) / 2, wh = WIN_Y1 - WIN_Y0;
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1, wx = s * HULL_X;
    // the window is a real hole in the model's skin: glazed, with a frame round it on the inside
    const fx = wx - s * 0.04, t = 0.06;
    const glass = box(0.02, wh, ww, PLANE_MAT.glass, wx - s * 0.01, wy, wz); glass.renderOrder = 2;
    seg.sides[side] = { open: false, patched: false, meshes: [glass,
      box(0.06, t, ww + 2 * t, M.frame, fx, WIN_Y1 + t / 2, wz), box(0.06, t, ww + 2 * t, M.frame, fx, WIN_Y0 - t / 2, wz),
      box(0.06, wh, t, M.frame, fx, wy, w0 - t / 2), box(0.06, wh, t, M.frame, fx, wy, w1 + t / 2),
      box(0.03, rand(0.05, 0.3), ww, M.white, wx - s * 0.09, WIN_Y1 - 0.1, wz),   // window shade, part pulled down
    ] };
  }
  segments.push(seg);
}

// A walk-in lavatory with a door, toilet, sink and mirror.
// 'L' is the front lav (left of the front galley), 'R' the rear lav (right side of the cargo bay).
function lavRoom(side) {
  const front = side === 'L', s = front ? -1 : 1;
  const z0 = front ? LAV_Z0 : CARGO + 0.25, z1 = front ? GALLEY - 0.1 : CARGO + 2.0;
  const dz0 = z0 + (front ? 0.6 : 0.5), dz1 = dz0 + 0.8;
  const wx = s * 0.95, outer = s * Math.min(hullHW(z0), hullHW(z1)), mid = (wx + outer) / 2, width = Math.abs(outer - wx);
  const area = front ? 'Front lavatory' : 'Rear lavatory', Name = front ? 'Front' : 'Rear';
  box(0.08, 2.3, dz0 - z0, M.lavWall, wx, 1.15, (z0 + dz0) / 2);
  box(0.08, 2.3, z1 - dz1, M.lavWall, wx, 1.15, (dz1 + z1) / 2);
  box(0.08, 0.2, dz1 - dz0, M.lavWall, wx, 2.2, (dz0 + dz1) / 2);
  box(width, 2.3, 0.08, M.lavWall, mid, 1.15, z1);
  box(width, 2.3, 0.08, M.lavWall, mid, 1.15, z0);
  box(width, 0.06, z1 - z0, M.lavWall, mid, 2.32, (z0 + z1) / 2);
  box(0.4, 0.03, 0.4, M.lamp, mid, 2.28, (z0 + z1) / 2);
  // toilet against the outer wall
  const tx = outer - s * 0.6, tz = (dz0 + dz1) / 2;
  const bowl = box(0.42, 0.4, 0.5, M.porcelain, tx, 0.2, tz);
  box(0.44, 0.05, 0.5, M.white, tx, 0.43, tz);
  box(0.18, 0.5, 0.42, M.porcelain, tx + s * 0.3, 0.6, tz);
  station('lav' + side, Name + ' lavatory toilet', area, bowl);
  // sink and mirror on the end wall
  const sz = front ? z0 + 0.25 : z1 - 0.25, mz = front ? z0 + 0.06 : z1 - 0.06;
  box(0.6, 0.08, 0.4, M.white, mid, 0.85, sz);
  cyl(0.14, 0.1, 0.1, M.steel, mid, 0.88, sz);
  box(0.5, 0.5, 0.02, M.mirror, mid, 1.45, mz);
  const valve = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 16), M.red);
  valve.position.set(mid, 0.6, sz); valve.rotation.x = Math.PI / 2; plane.add(valve);
  station('valve' + side, Name + ' lav water valve', area, box(0.4, 0.3, 0.4, M.hit, mid, 0.6, sz));
  // the door, hinged at dz0
  const hinge = new THREE.Group(); hinge.position.set(wx, 0, dz0); plane.add(hinge);
  const door = box(0.06, 2.0, 0.8, M.lavWall, 0, 1.0, 0.4, hinge);
  textPlane(0.3, 0.18, 'WC', '#2f6db5', '#fff', hinge, -s * 0.035, 1.6, 0.4, -s * Math.PI / 2, 'bold 70px sans-serif');
  box(0.08, 0.04, 0.12, M.steel, -s * 0.05, 1.0, 0.7, hinge);
  lavDoors[side] = { hinge, open: 0, target: 0, x: wx, z0: dz0, z1: dz1, swing: front ? 1.5 : -1.5 };
  station('lavdoor' + side, Name + ' lavatory door', front ? 'Front galley' : 'Cargo bay', door, { lavDoor: side });
}

(function buildPlane() {
  // the cabin walls, in rings, one round each window
  const ringEnds = [DOOR_Z1 + 0.15, ...WINDOWS.slice(1).map((w, i) => (WINDOWS[i][1] + w[0]) / 2), WINDOWS[2][1] + 0.4];
  WINDOWS.forEach((w, i) => hullSegment(ringEnds[i], ringEnds[i + 1], w));
  // the floor, following the walls as the nose and tail narrow
  const fl = new THREE.Shape(), zs = [];
  for (let z = NOSE - 0.6; z < REAR; z += 0.25) zs.push(z);
  zs.push(REAR);
  zs.forEach((z, i) => i ? fl.lineTo(hullHW(z) + 0.04, z) : fl.moveTo(hullHW(z) + 0.04, z));
  for (let i = zs.length - 1; i >= 0; i--) fl.lineTo(-hullHW(zs[i]) - 0.04, zs[i]);
  const floorGeo = new THREE.ExtrudeGeometry(fl, { depth: 0.2, bevelEnabled: false, curveSegments: 1 });
  floorGeo.rotateX(Math.PI / 2);
  plane.add(new THREE.Mesh(floorGeo, M.carpet));
  box(1.0, 0.012, CARGO - GALLEY, M.runner, 0, 0.006, (GALLEY + CARGO) / 2);
  for (const z of [DOOR_Z0 + 0.05, DOOR_Z1 - 0.05]) box(2 * W - 0.6, 0.014, 0.08, M.yellow, 0, 0.007, z);   // exit door markings

  // the cockpit bulkhead, with a wide gap in it, just behind the model's own partition walls
  const bh = hullHW(BULK) + 0.05, bt = ceilAt(BULK) + 0.05, gap = 1.0;
  for (const s of [-1, 1]) box(bh - gap, bt, 0.06, M.wall, s * (bh + gap) / 2, bt / 2, BULK + 0.02);
  box(2 * gap, bt - 2.6, 0.06, M.wall, 0, (bt + 2.6) / 2, BULK + 0.02);

  // the cargo ramp, hinged at the floor: shut, it's the underside of the tail
  const pivot = new THREE.Group(); pivot.position.set(0, 0, REAR); plane.add(pivot);
  const rampW = y => RAMP_W0 + (RAMP_W1 - RAMP_W0) * y / RAMP_LEN;
  const plate = (mat, z0, z1) => {
    const sh = new THREE.Shape();
    sh.moveTo(-RAMP_W0, 0); sh.lineTo(RAMP_W0, 0); sh.lineTo(RAMP_W1, RAMP_LEN); sh.lineTo(-RAMP_W1, RAMP_LEN); sh.lineTo(-RAMP_W0, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0, bevelEnabled: false }); g.translate(0, 0, z0);
    const m = new THREE.Mesh(g, mat); pivot.add(m); return m;
  };
  // painted like the fuselage on the outside, bare metal treads on the inside, yellow edges
  plate(M.hull, 0.08, 0.16); plate(M.olive, 0, 0.08);
  for (let y = 0.3; y < RAMP_LEN - 0.2; y += 0.52) box(2 * rampW(y) - 0.3, 0.05, 0.08, M.dark, 0, y, -0.02, pivot);
  box(2 * RAMP_W1, 0.12, 0.12, M.yellow, 0, RAMP_LEN - 0.06, -0.02, pivot);
  for (const s of [-1, 1]) {
    const e = box(0.08, RAMP_LEN, 0.25, M.yellow, s * ((RAMP_W0 + RAMP_W1) / 2 - 0.05), RAMP_LEN / 2, -0.05, pivot);
    e.rotation.z = s * Math.atan((RAMP_W0 - RAMP_W1) / RAMP_LEN);
  }
  box(2 * RAMP_W0 - 0.5, 0.3, 0.02, M.stripe, 0, 0.6, 0.165, pivot);
  ramp = { pivot, open: 1, target: 1 };

  // landing gear (retracted after takeoff): a nose wheel and two main wheels under the belly
  gear = new THREE.Group(); plane.add(gear);
  const wy = GROUND + 0.42;
  for (const [x, z, top] of [[0, -8.6, -2.1], [-1.7, 1.6, -1.9], [1.7, 1.6, -1.9]]) {
    box(0.16, top - wy, 0.16, M.grey, x, (top + wy) / 2, z, gear);
    cyl(0.42, 0.42, 0.32, M.dark, x, wy, z, gear).rotation.z = Math.PI / 2;
    cyl(0.18, 0.18, 0.34, M.steel, x, wy, z, gear).rotation.z = Math.PI / 2;
  }

  // ---- cockpit, in the nose. The model brings the instrument panel, the two yokes and the pedestal
  // between the seats (painted when it loads); here go the dials and switches on them, the seats (up on
  // a step, so the pilots can see out over the nose) and the things you can use.
  const CK = CPT.z, CY = CPT.y, PX = Math.abs(CPT.x), DASH_Z = -8.6;
  const dialTex = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#1b2430'; g.fillRect(0, 0, w, h);
    // two screens, a row of round dials, and rows of little coloured buttons
    for (const [x, c] of [[24, '#39f'], [150, '#2a6']]) {
      g.fillStyle = '#0b1118'; g.fillRect(x - 6, 18, 118, 96);
      const sky = g.createLinearGradient(0, 24, 0, 108); sky.addColorStop(0, c); sky.addColorStop(1, '#a6713a');
      g.fillStyle = sky; g.fillRect(x, 24, 106, 84); g.fillStyle = '#fff'; g.fillRect(x, 65, 106, 2);
    }
    for (let i = 0; i < 4; i++) {
      const x = 316 + (i % 2) * 96, y = 46 + Math.floor(i / 2) * 84;
      g.fillStyle = '#0b1118'; g.beginPath(); g.arc(x, y, 34, 0, 7); g.fill();
      g.strokeStyle = '#8cf'; g.lineWidth = 4; g.beginPath(); g.arc(x, y, 30, 0, 7); g.stroke();
      g.strokeStyle = '#fd4'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(i * 1.7) * 24, y - Math.sin(i * 2.3) * 24); g.stroke();
    }
    const cols = ['#e33', '#fc2', '#2c4', '#29f', '#eee'];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 12; i++) { g.fillStyle = cols[(r * 5 + i * 3) % 5]; g.fillRect(24 + i * 23, 140 + r * 34, 15, 20); }
    for (let i = 0; i < 6; i++) { g.fillStyle = '#556'; g.beginPath(); g.arc(320 + i * 30, 214, 10, 0, 7); g.fill(); g.fillStyle = '#ddd'; g.fillRect(318 + i * 30, 204, 4, 10); }
  });
  for (const s of [-1, 1]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshBasicMaterial({ map: dialTex }));
    face.position.set(s * 1.07, 1.24, DASH_Z + 0.012); plane.add(face);
    // pilot seats on their steps
    box(0.8, CY, 1.0, M.dark, s * PX, CY / 2, CK + 0.1);
    box(0.62, 0.16, 0.62, M.seat, s * PX, CY + 0.45, CK);
    box(0.62, 0.95, 0.14, M.seat, s * PX, CY + 0.98, CK + 0.35);
    box(0.4, 0.22, 0.16, M.seat, s * PX, CY + 1.58, CK + 0.37);
    box(0.1, 0.4, 0.1, M.steel, s * PX, CY + 0.2, CK);
    // side consoles
    box(0.4, 0.8, 1.2, M.panel, s * 2.0, 0.4, CK);
    box(0.36, 0.02, 1.1, M.switches, s * 2.0, 0.81, CK);
  }
  station('yoke', 'Captain\'s seat & yoke', 'Cockpit', box(1.2, 0.8, 0.7, M.hit, CPT.x, 1.8, -8.1));
  // throttles and switches on top of the model's pedestal
  const PED_Y = 1.58;
  box(0.44, 0.02, 1.2, M.switches, 0, PED_Y + 0.01, -7.85);
  for (const [x, c] of [[-0.12, M.white], [0.0, M.white], [0.12, M.red]]) { box(0.04, 0.28, 0.04, M.steel, x, PED_Y + 0.14, -8.25); box(0.08, 0.06, 0.08, c, x, PED_Y + 0.28, -8.25); }
  const ped = box(0.6, 0.6, 1.5, M.hit, 0, PED_Y - 0.1, -7.9);
  station('pedestal', 'Engine & fuel controls', 'Cockpit', ped);
  box(0.08, 0.06, 0.28, M.dark, 1.95, 0.86, CK + 0.3); box(0.02, 0.02, 0.4, M.dark, 1.97, 0.83, CK + 0.55);
  station('pa', 'PA handset', 'Cockpit', box(0.4, 0.3, 0.5, M.hit, 1.95, 0.9, CK + 0.3), { service: 'pa' });
  box(0.2, 0.04, 0.26, M.yellow, -1.95, 0.84, CK + 0.35); box(0.04, 0.1, 0.04, M.white, -1.95, 0.9, CK + 0.35);
  station('belt', 'Seatbelt sign switch', 'Cockpit', box(0.4, 0.3, 0.5, M.hit, -1.95, 0.9, CK + 0.35), { service: 'belt' });
  // overhead panel, up against the ceiling
  const oy = ceilAt(CK + 0.4);
  const over = box(1.3, 0.3, 1.0, M.panel, 0, oy - 0.15, CK + 0.4);
  const overFace = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.95), M.switches);
  overFace.rotation.x = Math.PI / 2; overFace.position.set(0, oy - 0.31, CK + 0.4); plane.add(overFace);
  station('overhead', 'Overhead panel', 'Cockpit', over);

  // ---- front galley & front lav
  // (the blanket closet is behind the right exit door, across from the front lav behind the left one)
  const CLZ = LAV_Z0 + 0.75;
  const closet = box(0.5, 2.1, 1.2, M.bin, W - 0.3, 1.05, CLZ);
  for (const z of [CLZ - 0.3, CLZ + 0.3]) box(0.02, 0.2, 0.05, M.steel, W - 0.56, 1.1, z);
  box(0.02, 2.0, 0.02, M.dark, W - 0.56, 1.05, CLZ);
  station('blankets', 'Blanket closet', 'Front galley', closet, { service: 'blankets' });
  box(0.4, 0.1, 0.12, M.steel, 1.5, 0.75, BULK + 0.12);
  const ext = cyl(0.1, 0.1, 0.55, M.red, 1.5, 1.05, BULK + 0.2);
  cyl(0.04, 0.04, 0.1, M.dark, 1.5, 1.38, BULK + 0.2);
  textPlane(0.4, 0.14, 'FIRE', '#c22', '#fff', plane, 1.5, 1.5, BULK + 0.06, 0, 'bold 80px sans-serif');
  station('extinguisher', 'Fire extinguisher', 'Front galley', ext);
  lavRoom('L');

  // ---- cargo bay (in the tail, narrowing towards the ramp) & rear lav
  const cart = box(0.5, 1.0, 0.8, M.steel, -1.7, 0.5, CARGO + 0.8);
  for (let i = 0; i < 3; i++) box(0.02, 0.02, 0.6, M.dark, -1.44, 0.3 + i * 0.3, CARGO + 0.8);
  station('meals', 'Meal cart', 'Cargo bay', cart, { service: 'meals' });
  const TBZ = CARGO + 1.9, tw = -(hullHW(TBZ) - 0.2);
  box(0.4, 0.05, 1.3, M.steel, tw, 0.95, TBZ);                           // tool shelf
  station('toolbox', 'Toolbox', 'Cargo bay', box(0.5, 0.3, 0.3, M.red, tw + 0.05, 1.13, TBZ));
  box(0.4, 0.04, 0.12, M.steel, tw + 0.05, 1.3, TBZ);
  const RCZ = REAR - 0.6, rx = hullHW(RCZ);
  station('ramp', 'Cargo ramp controls', 'Cargo bay', box(0.15, 0.6, 0.45, M.yellow, rx - 0.08, 1.5, RCZ));
  box(0.17, 0.12, 0.12, M.red, rx - 0.17, 1.65, RCZ);
  // a cargo net along the left wall (the wall closes in, so the net follows it)
  const netAt = z => -(hullHW(z) - 0.1), NZ = TBZ + 0.9;
  for (let i = 0; i < 3; i++) { const z = NZ + i * 0.75; box(0.02, 1.6, 0.02, M.dark, netAt(z), 1.2, z); }
  for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++) {
    const za = NZ + i * 0.75, zb = za + 0.75, xa = netAt(za), xb = netAt(zb);
    const b = box(0.02, 0.02, Math.hypot(xb - xa, 0.75), M.dark, (xa + xb) / 2, 0.6 + j * 0.4, (za + zb) / 2);
    b.rotation.y = Math.atan2(xb - xa, 0.75);
  }
  lavRoom('R');

  // ---- cabin: overhead bins, lights, seats, movie screen
  const binZ = (GALLEY + CARGO) / 2, binL = CARGO - GALLEY - 0.4, BIN_Y = 2.9;
  for (const s of [-1, 1]) {
    const bx = s * (W - 0.42);
    // (up above the big windows)
    box(0.8, 0.45, binL, M.bin, bx, BIN_Y, binZ);
    for (let z = GALLEY + 0.4; z <= CARGO - 0.3; z += 1.6) { box(0.01, 0.42, 0.02, M.frame, bx - s * 0.405, BIN_Y, z); box(0.012, 0.04, 0.3, M.dark, bx - s * 0.41, BIN_Y + 0.1, z + 0.8); }
    box(0.35, 0.03, binL, M.lamp, s * (W - 0.72), BIN_Y - 0.24, binZ);
    for (const z of ROWS) beltSigns.push(box(0.1, 0.05, 0.16, M.dark, s * (W - 0.6), BIN_Y - 0.26, z - 0.4));
  }
  box(0.3, 0.02, binL, M.lamp, 0, ceilAt(0) - 0.04, binZ);                  // ceiling light strip
  ROWS.forEach((z, ri) => SEAT_X.forEach((x, i) => {
    box(0.06, 0.3, 0.06, M.steel, x - 0.2, 0.15, z); box(0.06, 0.3, 0.06, M.steel, x + 0.2, 0.15, z);
    box(0.6, 0.15, 0.55, M.seat, x, 0.38, z);
    box(0.6, 0.85, 0.12, M.seat, x, 0.9, z + 0.3).rotation.x = 0.08;
    box(0.5, 0.2, 0.135, M.white, x, 1.25, z + 0.33);
    box(0.06, 0.06, 0.45, M.dark, x + (i % 2 ? 0.31 : -0.31), 0.6, z + 0.03);
    seats.push({ x, z, label: (ri + 1) + 'ABCD'[i], row: ri + 1, occupant: null });
  }));
  movieTex = canvasTex(256, 144, drawMovie);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), new THREE.MeshBasicMaterial({ map: movieTex }));
  screen.position.set(0, 2.45, GALLEY + 0.25); plane.add(screen);
  box(1.7, 1.0, 0.05, M.dark, 0, 2.45, GALLEY + 0.22);
  box(0.06, ceilAt(GALLEY) - 2.95, 0.06, M.dark, 0, (ceilAt(GALLEY) + 2.95) / 2, GALLEY + 0.22);
  station('movie', 'Cabin movie screen', 'Front of cabin', screen, { service: 'movie' });

  // ---- exit doors, in the model's door holes over the wing roots (swing outward and forward on a hinge)
  const DW = DOOR_Z1 - DOOR_Z0, DH = DOOR_TOP - 0.2;
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1, hx = s * HULL_X;
    const hinge = new THREE.Group(); hinge.position.set(hx, 0, DOOR_Z0); plane.add(hinge);
    const panel = box(0.08, DH, DW, M.hull2, 0, 0.2 + DH / 2, DW / 2, hinge);
    box(0.1, 0.5, 0.4, M.window, 0, 1.9, DW / 2, hinge);
    box(0.14, 0.06, 0.3, M.red, -s * 0.08, 1.1, DW - 0.4, hinge);
    textPlane(0.6, 0.15, 'EXIT', '#c22', '#fff', hinge, -s * 0.05, 2.45, DW / 2, -s * Math.PI / 2, 'bold 70px sans-serif');
    doors[side] = { hinge, open: 0, target: 0 };
    station('door' + side, (side === 'L' ? 'Left' : 'Right') + ' exit door', 'Front galley', panel, { door: side });
  }
  // hitbox that gets moved to wherever the hull rips open
  station('hole', 'Hole in the wall', 'Cabin', box(0.5, 2.0, 1.6, M.hit, 0, -50, 0));

  // ---- wings (the model's), the bits on them, and the engines slung underneath
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1, Side = side === 'L' ? 'Left' : 'Right';
    const wx = ROOT + 0.85;
    box(1.6, 0.02, DW, M.dark, s * wx, wingY(wx, (DOOR_Z0 + DOOR_Z1) / 2) + 0.012, (DOOR_Z0 + DOOR_Z1) / 2);   // painted walkway outside the door
    const panel = new THREE.Group();                                      // the outer wing: it can break off
    plane.add(panel);
    const tipZ = (le(WING_OUT) + te(WING_OUT)) / 2;
    const nav = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: side === 'L' ? 0xff3030 : 0x30ff60 }));
    nav.position.set(s * (WING_OUT + 0.05), wingY(WING_OUT, tipZ) + 0.05, le(WING_OUT) + 0.4); panel.add(nav);
    const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    strobe.position.set(s * (WING_OUT + 0.05), wingY(WING_OUT, tipZ) + 0.05, te(WING_OUT) - 0.3); panel.add(strobe); navLights.push({ m: strobe, blink: 1.0 });
    const inZ = (le(WING_IN) + te(WING_IN)) / 2;
    const patch = box(0.6, 0.6, te(WING_IN) - le(WING_IN) - 0.1, M.grey, s * WING_IN, wingY(WING_IN, inZ) - 0.2, inZ);
    patch.visible = false;
    wings[side] = { panel, patch, attached: true };
    station('tip' + side, Side + ' wing tip', Side + ' wing', box(1.2, 1.0, te(WING_IN) - le(WING_IN) - 0.2, M.hit, s * (WING_IN - 0.4), wingY(WING_IN, inZ) + 0.4, inZ));
    const fy = wingY(FUEL_X, FUEL_Z);
    cyl(0.22, 0.22, 0.1, M.yellow, s * FUEL_X, fy + 0.03, FUEL_Z);
    station('fuel' + side, Side + ' fuel line', Side + ' wing', box(0.9, 0.6, 0.9, M.hit, s * FUEL_X, fy + 0.25, FUEL_Z));

    // the engine: the model's nacelle and propeller get put in here when it loads
    const eng = new THREE.Group();
    eng.position.set(s * ENG_X, ENG_Y, ENG_Z); plane.add(eng);
    const nac = box(ENG_R * 1.7, ENG_R * 1.7, ENG_Z1 - ENG_Z0, M.hit, 0, 0, 0, eng);
    const prop = new THREE.Group(); prop.position.z = PROP_Z - ENG_Z; eng.add(prop);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.1, 32), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    disc.position.z = PROP_Z - ENG_Z - 0.05; eng.add(disc);
    // the service hatch over the recess in the top of the model's engine (on the side towards the cabin):
    // it swings open when the engine breaks, showing the works inside
    const inb = -s, HR = 2.04, A0 = 20 * D2R, A1 = 60 * D2R, HZ0 = -6.47 - ENG_Z, HZ1 = -4.55 - ENG_Z;
    const hinge = new THREE.Group(); hinge.position.set(inb * HR * Math.sin(A0), HR * Math.cos(A0), (HZ0 + HZ1) / 2); eng.add(hinge);
    const dx = inb * HR * (Math.sin(A1) - Math.sin(A0)), dy = HR * (Math.cos(A1) - Math.cos(A0)), chord = Math.hypot(dx, dy);
    const lid = box(0.06, chord, HZ1 - HZ0, M.hull, dx / 2, dy / 2, 0, hinge); lid.rotation.z = Math.atan2(-dx, dy);
    box(0.05, 0.08, 0.3, M.dark, dx * 0.85, dy * 0.85, 0, hinge);                     // handle
    const works = new THREE.Group(); eng.add(works);                                    // what's under it
    const mid = (A0 + A1) / 2, wr = 1.45, kx = inb * wr * Math.sin(mid), ky = wr * Math.cos(mid);
    for (let i = 0; i < 4; i++) cyl(0.16, 0.16, 0.35, M.steel, kx, ky, HZ0 + 0.35 + i * 0.4, works).rotation.z = Math.PI / 2 - inb * mid;
    cyl(0.05, 0.05, HZ1 - HZ0 - 0.2, M.red, kx + inb * 0.25, ky + 0.1, (HZ0 + HZ1) / 2, works).rotation.x = Math.PI / 2;
    cyl(0.05, 0.05, HZ1 - HZ0 - 0.2, M.yellow, kx - inb * 0.1, ky + 0.3, (HZ0 + HZ1) / 2, works).rotation.x = Math.PI / 2;
    engines[side] = { group: eng, prop, disc, spin: 10, state: 'ok', acc: 0, leak: false, hatch: { hinge, open: 0, way: inb } };
    station('eng' + side, Side + ' engine', Side + ' wing', nac);
  }

  // ---- a barbecue on the left wing (the airline calls it "premium outdoor dining")
  const bz = (le(BBQ_X) + te(BBQ_X)) / 2 - 0.6;
  const g = new THREE.Group(); g.position.set(-BBQ_X, wingY(BBQ_X, bz), bz); plane.add(g);
  const red = std(0xc0262e, { roughness: .35, metalness: .3, side: THREE.DoubleSide }), steel = std(0x9aa3ad, { metalness: .7, roughness: .3 });
  // kettle grill: a bowl, an open lid, three legs and a grate
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), red); bowl.position.y = 0.95; g.add(bowl);
  const lidHinge = new THREE.Group(); lidHinge.position.set(0, 0.95, 0.45); lidHinge.rotation.x = -1.2; g.add(lidHinge);
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), red); lid.position.z = -0.45; lidHinge.add(lid);
  cyl(0.04, 0.04, 0.1, M.dark, 0, 0.47, -0.45, lidHinge);
  for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; const l = cyl(0.025, 0.025, 0.95, steel, Math.sin(a) * 0.3, 0.45, Math.cos(a) * 0.3, g); l.rotation.set(Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25); }
  const coals = cyl(0.36, 0.36, 0.04, new THREE.MeshBasicMaterial({ color: 0xff5a1a }), 0, 0.82, 0, g);
  cyl(0.42, 0.42, 0.015, M.dark, 0, 0.95, 0, g);
  const food = [];
  const brown = std(0x5a3418), sausage = std(0xb0502a);
  for (const [fx, fz] of [[-0.18, -0.12], [0.16, -0.15], [0.02, 0.17]]) food.push(cyl(0.11, 0.11, 0.05, brown, fx, 0.985, fz, g));
  for (const fz of [-0.02, 0.06]) { const sg = cyl(0.035, 0.035, 0.3, sausage, 0.05, 0.985, fz, g); sg.rotation.z = Math.PI / 2; food.push(sg); }
  // a little table with sauces and plates, a cooler, and a patio umbrella
  box(0.9, 0.05, 0.55, std(0xd9a066), 1.05, 0.78, 0, g);
  for (const [lx, lz] of [[0.65, -0.22], [1.45, -0.22], [0.65, 0.22], [1.45, 0.22]]) box(0.04, 0.78, 0.04, M.dark, lx, 0.39, lz, g);
  cyl(0.04, 0.045, 0.2, M.red, 0.85, 0.9, -0.1, g); cyl(0.04, 0.045, 0.2, M.yellow, 0.95, 0.9, -0.1, g);
  for (let i = 0; i < 4; i++) cyl(0.13, 0.11, 0.012, M.white, 1.25, 0.81 + i * 0.013, 0.05, g);
  box(0.6, 0.4, 0.4, std(0x2a7fd4), -1.0, 0.2, 0.3, g); box(0.62, 0.06, 0.42, M.white, -1.0, 0.43, 0.3, g);
  cyl(0.03, 0.03, 2.4, M.dark, 1.05, 1.2, 0.55, g);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.45, 12, 1, true), std(0xffd34a, { side: THREE.DoubleSide })); shade.position.set(1.05, 2.3, 0.55); g.add(shade);
  textPlane(0.9, 0.22, 'WING BBQ', '#c0262e', '#fff', g, -1.0, 0.22, 0.09, Math.PI, 'bold 80px sans-serif');
  const hit = box(1.2, 1.4, 1.2, M.hit, 0, 0.7, 0, g);
  station('bbq', 'Barbecue', 'Left wing', hit, { service: 'bbq' });
  window.bbq = { g, food, coals, lid: lidHinge, x: -BBQ_X, y: g.position.y, z: g.position.z };
})();

// ---------------------------------------------------------------- damage
const SPIN = { ok: 28, fire: 12, fail: 0, dead: 0 };
function setEngine(side, state) { engines[side].state = state; }
function detachPanel(side) {
  const w = wings[side];
  if (!w.attached) return;
  w.attached = false;
  plane.updateMatrixWorld(true);
  const m = w.panel.clone();
  m.applyMatrix4(plane.matrixWorld);
  scene.add(m);
  w.panel.visible = false;
  const s = side === 'L' ? -1 : 1;
  falling.push({ m, vel: new THREE.Vector3(s * 8, 6, 40), spin: new THREE.Vector3(rand(-3, 3), rand(-3, 3), rand(-5, 5)), t: 0, life: 8 });
  for (let i = 0; i < 30; i++) emitLocal(smokeFx, s * WING_IN, 1, 1, rand(-6, 6), rand(-4, 8), rand(10, 40), 0x777777, 1.5, 1.5, 3, 0.8);
  S.flash = 0.4; S.shake = 1; jerk(1);
  beep(90, 0.6, 'sawtooth', 0.12);
}
function explode(side) {
  netEvent('explode', side);
  const s = side === 'L' ? -1 : 1;
  for (let i = 0; i < 70; i++) emitLocal(fireFx, s * ENG_X, ENG_Y + 0.6, ENG_Z, rand(-12, 12), rand(-6, 14), rand(-8, 30), pick([0xffaa22, 0xff5511, 0xffee88]), rand(1, 2.5), rand(.4, 1), 2);
  for (let i = 0; i < 40; i++) emitLocal(smokeFx, s * ENG_X, ENG_Y + 0.6, ENG_Z, rand(-6, 6), rand(0, 8), rand(10, 40), 0x333333, 2, 2, 3, .8);
  S.flash = 0.9; S.shake = 1.5; jerk(1.5);
  beep(70, 1.0, 'sawtooth', 0.15);
}
function breakableWalls() {
  const out = [];
  for (const seg of segments) if (seg.z > GALLEY - 1.5) for (const side of ['L', 'R']) if (!seg.sides[side].open && !seg.sides[side].patched) out.push([seg, side]);
  return out;
}
function breachHull(seg, side) {
  if (!seg) [seg, side] = pick(breakableWalls());
  const sd = seg.sides[side], s = side === 'L' ? -1 : 1;
  sd.open = true;
  // the skin, lining, stripes, window, frame and shade all go together
  for (const m of sd.meshes) toDebris(m, new THREE.Vector3(s * rand(5, 12), rand(2, 8), rand(25, 45)));
  hole.seg = seg; hole.side = side;
  STATIONS.hole.mesh.position.set(s * (W - 0.2), 1.2, seg.z);
  for (let i = 0; i < 30; i++) emitLocal(smokeFx, s * W, rand(0.3, 2.3), seg.z + rand(-0.8, 0.8), s * rand(4, 10), rand(-2, 2), rand(5, 20), 0xcccccc, 0.8, 1.2, 3, 0.8);
  S.flash = 0.5; S.shake = 1.4; jerk(1.3);
  beep(110, 0.8, 'sawtooth', 0.14);
}
function patchHole() {
  if (!hole.seg) return;
  const seg = hole.seg, sd = seg.sides[hole.side];
  box(0.05, SEG_Y1 - SEG_Y0, seg.z1 - seg.z0, M.grey, (hole.side === 'L' ? -1 : 1) * (HULL_X - 0.03), (SEG_Y0 + SEG_Y1) / 2, seg.z);
  sd.open = false; sd.patched = true;
  hole.seg = null; hole.side = null;
  STATIONS.hole.mesh.position.y = -50;
}

// ---------------------------------------------------------------- the outside: the plane modelled in Blender
// models/plane.glb is half a plane (the left half: one wing, the body cut down the middle) with both
// engines, nose towards -z. Here it's mirrored into a whole plane, scaled up 20x and lifted so its cabin
// floor sits at y=0. It has real holes for the exit doors, the windows, the windscreen and the cargo ramp.
// Its skin is cut up into a loose panel round each window (so a breach can rip it off) and the outer wings
// (so they can break off). The inside of the skin is drawn too, in cabin colours, so it doubles as the
// cabin's walls and ceiling; the cockpit's instrument panel, yokes and pedestal get painted.
const PLANE_SCALE = 20, PLANE_FLOOR = -0.02, PLANE_SHIFT = 0.6;
const PC = {
  white: new THREE.Color(0xf4f6f9), belly: new THREE.Color(0x8fa3b8), blue: new THREE.Color(0x1f4fa8), red: new THREE.Color(0xd8342c),
  wing: new THREE.Color(0xdfe3e8), glass: new THREE.Color(0x1d2c44), lining: new THREE.Color(0xece6da), ceiling: new THREE.Color(0xf6f3ec),
  dash: new THREE.Color(0x2b3138), glare: new THREE.Color(0x15181c), panel: new THREE.Color(0x3a414a), yoke: new THREE.Color(0x1a1c20),
};
const STRIPE = [0.95, 1.3, 1.36, 1.42], BELLY_Y = -1.4;               // paint lines: blue and red stripes, grey belly
const toGame = new THREE.Matrix4().makeTranslation(0, -PLANE_FLOOR * PLANE_SCALE, PLANE_SHIFT * PLANE_SCALE).multiply(new THREE.Matrix4().makeScale(PLANE_SCALE, PLANE_SCALE, PLANE_SCALE));
const RAMP_Z1 = REAR + RAMP_LEN * Math.cos(Math.PI / 2 - RAMP_SHUT);

// cut every triangle that crosses any of the planes <axis> = v (for each v in vs) into pieces that don't,
// keeping which way they face. Each triangle is sliced into slabs in one go, so long thin ones don't multiply.
function splitTris(tris, axis, vs, only) {
  const out = [], k = 'xyz'[axis], E = 1e-6, cuts = (Array.isArray(vs) ? [...vs] : [vs]).sort((a, b) => a - b);
  const cutAt = (p, q, v) => {
    const f = (v - p[k]) / (q[k] - p[k]), m = p.clone().lerp(q, f);
    if (p.nrm && q.nrm) m.nrm = p.nrm.clone().lerp(q.nrm, f).normalize();
    return m;
  };
  const fan = P => { for (let i = 1; i + 1 < P.length; i++) out.push([P[0], P[i], P[i + 1]]); };
  for (const t of tris) {
    const lo = Math.min(t[0][k], t[1][k], t[2][k]), hi = Math.max(t[0][k], t[1][k], t[2][k]);
    const mine = cuts.filter(v => v > lo + E && v < hi - E);
    if (!mine.length || (only && !only(t))) { out.push(t); continue; }
    let P = [t[0], t[1], t[2]];
    for (const v of mine) {
      // the part below this plane is done; carry on slicing the part above it
      const below = [], above = [];
      for (let i = 0; i < P.length; i++) {
        const p = P[i], q = P[(i + 1) % P.length], dp = p[k] - v, dq = q[k] - v;
        if (dp <= 0) below.push(p);
        if (dp >= 0) above.push(p);
        if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) { const m = cutAt(p, q, v); below.push(m); above.push(m); }
      }
      if (below.length > 2) fan(below);
      P = above;
      if (P.length < 3) break;
    }
    if (P.length > 2) fan(P);
  }
  return out;
}
const triInfo = t => {
  t.c = new THREE.Vector3().add(t[0]).add(t[1]).add(t[2]).divideScalar(3);
  t.n = new THREE.Vector3().subVectors(t[1], t[0]).cross(new THREE.Vector3().subVectors(t[2], t[0])).normalize();
  return t;
};
function triMesh(list, mat, colorOf) {
  const n = list.length * 9, pos = new Float32Array(n), col = new Float32Array(n), nor = list[0] && list[0].vn ? new Float32Array(n) : null;
  let o = 0;
  for (const t of list) {
    const c = colorOf(t);
    for (let k = 0; k < 3; k++, o += 3) {
      const v = t[k]; pos[o] = v.x; pos[o + 1] = v.y; pos[o + 2] = v.z;
      col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
      if (nor) { const m = t.vn[k]; nor[o] = m.x; nor[o + 1] = m.y; nor[o + 2] = m.z; }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (nor) g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); else g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}
// smooth shading across gently curving skin, but crisp edges where it folds sharply (wing edges, fin tips)
function smoothNormals(tris) {
  const key = v => Math.round(v.x * 500) + ',' + Math.round(v.y * 500) + ',' + Math.round(v.z * 500), at = new Map();
  for (const t of tris) {
    const area = new THREE.Vector3().subVectors(t[1], t[0]).cross(new THREE.Vector3().subVectors(t[2], t[0])).length();
    for (const v of t) { const k = key(v); if (!at.has(k)) at.set(k, []); at.get(k).push([t.n, area]); }
  }
  if (tris.filter(t => t[0].nrm).length > tris.length / 2) {
    // the model brought its own normals: use those (turned round along with any face that was)
    // (and any normal pointing the opposite way to its face, from a muddled bit of the model, is turned round too;
    // but not on the thin slivers the cutting leaves, whose own facing is too rough to go by)
    for (const t of tris) {
      const big = new THREE.Vector3().subVectors(t[1], t[0]).cross(new THREE.Vector3().subVectors(t[2], t[0])).length() > 2e-3;
      t.vn = t.map(v => !v.nrm ? t.n : big && v.nrm.dot(t.n) < -0.2 ? v.nrm.clone().negate() : v.nrm);
    }
    return;
  }
  for (const t of tris) t.vn = t.map(v => {
    const n = new THREE.Vector3();
    for (const [fn, a] of at.get(key(v))) if (fn.dot(t.n) > 0.6) n.addScaledVector(fn, a);
    return n.lengthSq() > 0 ? n.normalize() : t.n.clone();
  });
}
// a stand-in plane, built out of boxes, for when the model can't load (e.g. opened straight from a file)
function boxyPlaneTris() {
  const tris = [], prism = (pts) => {
    // pts: the 8 corners of a box-like shape; each face is wound to face away from its middle
    const mid = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(8);
    for (const f of [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]) for (const [a, b, c] of [[f[0], f[1], f[2]], [f[0], f[2], f[3]]]) {
      const t = [pts[a].clone(), pts[b].clone(), pts[c].clone()];
      triInfo(t);
      if (t.n.dot(t.c.clone().sub(mid)) < 0) t.reverse();
      tris.push(t);
    }
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const boxP = (x0, x1, y0, y1, z0, z1, y0b = y0, y1b = y1, hw1) => {
    const h1 = hw1 === undefined ? x1 : hw1;
    prism([V(x0, y0, z0), V(x1, y0, z0), V(x1, y1, z0), V(x0, y1, z0), V(-h1, y0b, z1), V(h1, y0b, z1), V(h1, y1b, z1), V(-h1, y1b, z1)]);
  };
  boxP(-1.7, 1.7, -1.6, 1.7, -11.4, -6, -1.95, 3.72, HULL_X);         // nose
  boxP(-HULL_X, HULL_X, -1.95, 3.72, -6, 6);                          // cabin
  boxP(-HULL_X, HULL_X, -1.95, 3.72, 6, REAR, 0, 3.66, 1.7);           // towards the tail
  boxP(-1.7, 1.7, 0, 3.66, REAR, 21, 1.6, 3.4, 0.6);                   // tail
  for (const s of [-1, 1]) {
    const x0 = s * HULL_X, x1 = s * WING_OUT, y0 = wingY(HULL_X, 0), y1 = wingY(WING_OUT, 1);
    prism([V(x0, y0 - 0.6, le(HULL_X)), V(x0, y0 - 0.6, te(HULL_X)), V(x0, y0, te(HULL_X)), V(x0, y0, le(HULL_X)),
      V(x1, y1 - 0.25, le(WING_OUT)), V(x1, y1 - 0.25, te(WING_OUT)), V(x1, y1, te(WING_OUT)), V(x1, y1, le(WING_OUT))]);
    prism([V(s * 1.5, 3, 19.2), V(s * 1.5, 3, 24.2), V(s * 1.5, 3.2, 24.2), V(s * 1.5, 3.2, 19.2), V(s * 8, 3, 19.2), V(s * 8, 3, 24.2), V(s * 8, 3.2, 24.2), V(s * 8, 3.2, 19.2)]);
    prism([V(s * 7.8, 1.5, 19.4), V(s * 7.8, 1.5, 24.3), V(s * 7.8, 7, 24.3), V(s * 7.8, 7, 19.4), V(s * 7.9, 1.5, 19.4), V(s * 7.9, 1.5, 24.3), V(s * 7.9, 7, 24.3), V(s * 7.9, 7, 19.4)]);
  }
  return tris;
}

// glass in the cockpit's windows: down both sides (above the panel) and the windscreen over the top,
// just inside the skin all round the model's holes there
function glazeCockpit() {
  const pos = [], quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  const top = z => ceilAt(z) + 0.05, hw = z => hullHW(z) + 0.05, Z0 = -10, Z1 = -6.16;
  for (let za = Z0; za < Z1 - 1e-6; za += 0.2) {
    const zb = Math.min(za + 0.2, Z1);
    for (const s of [-1, 1]) quad([s * hw(za), WIN_Y0, za], [s * hw(zb), WIN_Y0, zb], [s * hw(zb), top(zb), zb], [s * hw(za), top(za), za]);
    if (zb > -8.9 && za < -7.5) quad([-hw(za), top(za), za], [hw(za), top(za), za], [hw(zb), top(zb), zb], [-hw(zb), top(zb), zb]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, PLANE_MAT.windscreen); m.renderOrder = 2; plane.add(m);
}

function dressPlane(scene) {
  let tris = [];
  const engineParts = [];
  if (scene) {
    scene.updateMatrixWorld(true);
    scene.traverse(o => {
      if (!o.isMesh) return;
      const m = new THREE.Matrix4().multiplyMatrices(toGame, o.matrixWorld);
      if (o.name !== 'Cube') { if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals(); engineParts.push({ o, m }); return; }   // (Cube.001 and on are propeller blades)
      // (read corner by corner: toNonIndexed() garbles interleaved files)
      const g = o.geometry, pos = g.attributes.position, nor = g.attributes.normal, idx = g.index, n = idx ? idx.count : pos.count;
      const nm = new THREE.Matrix3().getNormalMatrix(m);
      let body = [];
      // (the model's own smooth normals come along, so the curves shade smoothly)
      for (let i = 0; i < n; i += 3) body.push([0, 1, 2].map(k => {
        const j = idx ? idx.getX(i + k) : i + k, v = new THREE.Vector3().fromBufferAttribute(pos, j).applyMatrix4(m);
        if (nor) { v.nrm = new THREE.Vector3().fromBufferAttribute(nor, j).applyMatrix3(nm); v.nrm.lengthSq() > 1e-12 ? v.nrm.normalize() : (v.nrm = null); }
        return v;
      }));
      if (m.determinant() < 0) body.forEach(t => t.reverse());       // (a mirroring transform turns faces round)
      // keep the half the model has and mirror it for the other side, so both sides match exactly
      body = splitTris(body, 0, 0).map(triInfo);
      const half = Math.sign(body.reduce((a, t) => a + t.c.x, 0)) || 1;
      body = body.filter(t => t.c.x * half > 1e-4 && !(Math.abs(t.c.x) < 0.02 && Math.abs(t.n.x) > 0.9));
      for (const t of [...body]) body.push([t[2], t[1], t[0]].map(p => { const v = new THREE.Vector3(-p.x, p.y, p.z); if (p.nrm) v.nrm = new THREE.Vector3(-p.nrm.x, p.nrm.y, p.nrm.z); return v; }));
      tris.push(...body);
    });
  }
  if (!tris.length) tris = boxyPlaneTris();
  tris.forEach(triInfo);
  // the model's own cabin floor goes: the game lays its carpet there
  tris = tris.filter(t => !(Math.abs(t.n.y) > 0.9 && Math.abs(t.c.y) < 0.05 && Math.abs(t.c.x) < HULL_X - 0.05 && t.c.z > NOSE - 1 && t.c.z < REAR));
  // cut along every line where the skin gets split up or painted
  const side = t => Math.abs(t[0].x) > HULL_X - 0.3 || Math.abs(t[1].x) > HULL_X - 0.3 || Math.abs(t[2].x) > HULL_X - 0.3;
  tris = splitTris(tris, 2, [...new Set(segments.flatMap(sg => [sg.z0, sg.z1]))], side);
  tris = splitTris(tris, 1, [SEG_Y0 + 0.01, SEG_Y1], side);
  // clean straight edges for the paint: the stripes along the sides and the grey belly
  const flankTri = t => t.some(v => Math.abs(v.x) > 0.6 && Math.abs(v.x) < HULL_X + 0.2) && t[0].z > -12.5 && t[0].z < 17.5;
  tris = splitTris(tris, 1, [STRIPE[0], STRIPE[1], STRIPE[2], STRIPE[3]], flankTri);
  tris = splitTris(tris, 1, BELLY_Y, t => t.some(v => Math.abs(v.x) < HULL_X + 0.2));
  tris = splitTris(tris, 0, [-WING_IN, WING_IN]);
  tris.forEach(triInfo);
  smoothNormals(tris);

  // the cockpit's furniture from the model: the instrument panel, the yokes and the pedestal (and the
  // partition walls behind the seats)
  // (every corner well inside the hull: the skin's own corners are out on the hull)
  const cockpitPart = t => t.every(v => v.z > -10.6 && v.z < -5.9 && Math.abs(v.x) < hullHW(v.z) - 0.08 && v.y > 0.1 && v.y < Math.min(v.z < -8.5 ? 2.0 : 3.0, ceilAt(v.z) - 0.08));
  const parts = { main: [], segs: segments.map(() => ({ L: [], R: [] })), wingL: [], wingR: [], cockpit: [] };
  for (const t of tris) {
    const c = t.c, n = t.n, ax = Math.abs(c.x), wall = ax > HULL_X - 0.15 && Math.abs(n.x) > 0.7;
    if (n.y < -0.5 && c.z > REAR && c.z < RAMP_Z1 && ax < RAMP_W0 + 0.15) continue;           // the ramp opening
    if (ax > WING_IN && c.z < 12) { parts[c.x < 0 ? 'wingL' : 'wingR'].push(t); continue; }
    if (cockpitPart(t)) { parts.cockpit.push(t); continue; }
    const si = wall && c.y > SEG_Y0 && c.y < SEG_Y1 ? segments.findIndex(sg => c.z > sg.z0 && c.z < sg.z1) : -1;
    if (si >= 0) parts.segs[si][c.x < 0 ? 'L' : 'R'].push(t);
    else parts.main.push(t);
  }
  const body = t => Math.abs(t.c.x) <= HULL_X + 0.15 && t.c.z < 21.2;
  const fin = t => t.c.z > 16 && t.c.y > 3.45 && Math.abs(t.c.x) < 0.4;
  const paint = t => {
    const c = t.c, n = t.n;
    if (fin(t)) return PC.blue;                                   // the tail fin
    if (!body(t)) return PC.wing;                                 // wings, tailplane
    if (c.y < BELLY_Y) return PC.belly;
    const flank = Math.abs(n.x) > 0.6 && n.y > -0.5 && c.z > -9.6 && c.z < 17;
    if (flank && c.y > STRIPE[0] && c.y < STRIPE[1]) return PC.blue;        // the stripes down each side, under the windows
    if (flank && c.y > STRIPE[2] && c.y < STRIPE[3]) return PC.red;
    return PC.white;
  };
  const inside = t => t.n.y > 0.7 || t.c.y > 3.3 ? PC.ceiling : PC.lining;
  const cockpitPaint = t => {
    const c = t.c;
    if (c.z > -6.3) return PC.lining;                             // the partition walls
    if (c.z < -8.55) return t.n.y > 0.7 ? PC.glare : PC.dash;     // the instrument panel, black on top
    if (Math.abs(c.x) < 0.35) return PC.panel;                    // the pedestal between the seats
    return PC.yoke;
  };
  const skin = (list, parent) => {
    const out = [];
    if (!list.length) return out;
    const m = triMesh(list, PLANE_MAT.skin, paint); parent.add(m); out.push(m);
    const inner = list.filter(body);
    if (inner.length) { const l = triMesh(inner, PLANE_MAT.lining, inside); parent.add(l); out.push(l); }
    return out;
  };
  skin(parts.main, plane);
  parts.segs.forEach((sg, i) => { for (const s of ['L', 'R']) segments[i].sides[s].meshes.push(...skin(sg[s], plane)); });
  if (parts.cockpit.length) plane.add(triMesh(parts.cockpit, PLANE_MAT.skin, cockpitPaint));
  for (const s of ['L', 'R']) skin(parts['wing' + s], wings[s].panel);
  glazeCockpit();
  // the tail fin gets the flight number
  const finBox = new THREE.Box3();
  for (const t of tris) if (fin(t) && Math.abs(t.n.x) > 0.9) for (const v of t) finBox.expandByPoint(v);
  if (finBox.isEmpty()) finBox.set(new THREE.Vector3(-0.1, 3.4, 17), new THREE.Vector3(0.1, 7, 20.3));
  for (const s of [-1, 1]) textPlane(2.6, 1.3, '404', '#1f4fa8', '#ffd34a', plane, s * (finBox.max.x + 0.03), (finBox.min.y + finBox.max.y) / 2 + 0.2, (finBox.min.z + finBox.max.z) / 2 + 0.3, s * Math.PI / 2, 'bold 200px sans-serif');
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  beacon.position.set(0, finBox.max.y + 0.1, (finBox.min.z + finBox.max.z) / 2); plane.add(beacon); navLights.push({ m: beacon, blink: 1.3 });

  // engines and propellers: each goes into its engine group, so it shakes, burns and spins with it
  const blades = { L: [], R: [] };
  for (const { o, m } of engineParts) {
    const c = new THREE.Box3().setFromBufferAttribute(o.geometry.attributes.position).getCenter(new THREE.Vector3()).applyMatrix4(m);
    const s = c.x < 0 ? 'L' : 'R', e = engines[s], blade = /^cube/i.test(o.name);
    const mesh = new THREE.Mesh(o.geometry, blade ? M.dark : M.hull);
    (blade ? blades[s] : []).push({ mesh, m, c });
    if (!blade) { e.group.updateMatrix(); mesh.applyMatrix4(e.group.matrix.clone().invert().multiply(m)); e.group.add(mesh); }
  }
  for (const s of ['L', 'R']) {
    const e = engines[s];
    if (!blades[s].length) continue;
    // spin the propeller round the middle of its blades
    const hub = blades[s].reduce((a, b) => a.add(b.c), new THREE.Vector3()).divideScalar(blades[s].length);
    e.group.updateMatrix();
    const hubLocal = hub.clone().applyMatrix4(e.group.matrix.clone().invert());
    e.prop.position.copy(hubLocal); e.disc.position.set(hubLocal.x, hubLocal.y, hubLocal.z - 0.05);
    e.prop.updateMatrix();
    const toProp = new THREE.Matrix4().multiplyMatrices(e.group.matrix, e.prop.matrix).invert();
    for (const b of blades[s]) { b.mesh.applyMatrix4(toProp.clone().multiply(b.m)); e.prop.add(b.mesh); }
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 16), M.red);
    spinner.rotation.x = -Math.PI / 2; spinner.position.z = -0.3; e.prop.add(spinner);
  }
  if (!engineParts.length) for (const s of ['L', 'R']) {
    // stand-in engines too
    const e = engines[s], nac = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.5, ENG_Z1 - ENG_Z0, 24), M.hull);
    nac.rotation.x = Math.PI / 2; e.group.add(nac);
    for (let i = 0; i < 2; i++) { const arm = new THREE.Group(); arm.rotation.z = i * Math.PI; e.prop.add(arm); box(0.3, 1.9, 0.06, M.dark, 0, 1.0, 0, arm).rotation.y = 0.35; }
  }
}
