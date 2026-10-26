/* AALIYAH THE RAIDER — 3D third-person tomb raid. Core game loop, physics, combat, camera, cinematics. */
(function () {
  'use strict';
  const CFG = window.AALIYAH_CONFIG, AU = window.AALIYAH_AUDIO, MD = window.AALIYAH_MODELS, LVL = window.AALIYAH_LEVEL;
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rpick = a => a[Math.floor(Math.random() * a.length)];
  const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };
  const angDiff = (a, b) => ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  const STEP = 1 / 60, UP = new THREE.Vector3(0, 1, 0);
  const ASSIST = Object.assign({ invincible: true, autoJump: true, autoClimb: true, autoShoot: true, autoLever: true, guideArrow: true }, CFG.ASSIST || {});
  const TIMED = CFG.TIME_LIMIT > 0;
  const PH = { grav: 26, run: 6.8, walk: 2.8, push: 2.6, accel: 45, airAccel: 14, jump: 9.2, maxFall: 30, coyote: 0.12, buffer: 0.14, r: 0.3, h: 1.7 };
  const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (IS_TOUCH) document.body.classList.add('touch');

  /* ============================== RENDERER ============================== */
  const SHADOWS = CFG.SHADOWS === 'auto' ? !IS_TOUCH : !!CFG.SHADOWS;
  const renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: !IS_TOUCH, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CFG.MAX_DPR || 1.5));
  renderer.shadowMap.enabled = SHADOWS; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x6a2a6e, 28, 120);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 500);
  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x5a2a6a, 0.85); scene.add(hemi);
  const sunL = new THREE.DirectionalLight(0xffe0c0, 0.9); sunL.position.set(8, 18, 6); scene.add(sunL); scene.add(sunL.target);
  if (SHADOWS) {
    sunL.castShadow = true; sunL.shadow.mapSize.set(1024, 1024);
    Object.assign(sunL.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 });
    sunL.shadow.bias = -0.0015;
  }
  const rim = new THREE.DirectionalLight(0x9945ff, 0.35); rim.position.set(-6, 5, -10); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xfff0e0, 0.35); scene.add(fill); scene.add(fill.target);
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 75 : 62; camera.updateProjectionMatrix();
    document.body.classList.toggle('portrait', h > w);
  }
  addEventListener('resize', resize); resize();

  /* ================================ INPUT =============================== */
  const keys = {}, pressed = {}, held = { jump: false, shoot: false, action: false };
  const joy = { x: 0, y: 0, id: null, ox: 0, oy: 0 }, camDrag = { id: null, lx: 0, ly: 0 };
  const camIn = { dx: 0, dy: 0 };
  const KEY = { KeyW: 'fwd', ArrowUp: 'fwd', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    Space: 'jump', KeyJ: 'shoot', KeyF: 'action', KeyK: 'action', KeyE: 'camR', KeyQ: 'camL', ShiftLeft: 'walk', ShiftRight: 'walk', Enter: 'advance' };
  function press(k) { pressed[k] = true; }
  ['touchend', 'click', 'keydown', 'pointerup'].forEach(n => addEventListener(n, () => AU.unlock(), { passive: true, capture: true }));
  addEventListener('keydown', e => {
    if (e.code === 'KeyP' || (e.code === 'Escape' && !document.pointerLockElement)) { togglePause(); return; }
    if (e.code === 'KeyM') { toggleMute(); return; }
    const k = KEY[e.code]; if (!k) return;
    e.preventDefault();
    if (!e.repeat) { press(k); if (k === 'jump' || k === 'shoot' || k === 'action') press('advance'); }
    keys[k] = true;
    if (state === 'title' && (k === 'jump' || k === 'advance') && !e.repeat) startFromTitle(true);
  });
  addEventListener('keyup', e => { const k = KEY[e.code]; if (k) keys[k] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  // mouse: pointer lock (desktop) → look + click to shoot; otherwise drag to look
  const cv = $('game');
  let mouseDown = false, mouseShoot = false;
  cv.addEventListener('mousedown', e => {
    press('advance');
    if (state === 'play' && !paused && !IS_TOUCH) {
      if (document.pointerLockElement === cv) { mouseShoot = true; } else if (cv.requestPointerLock) { try { cv.requestPointerLock(); } catch (er) {} }
    }
    mouseDown = true;
  });
  addEventListener('mouseup', () => { mouseDown = false; mouseShoot = false; });
  addEventListener('mousemove', e => {
    if (document.pointerLockElement === cv || (mouseDown && !IS_TOUCH)) { camIn.dx += e.movementX; camIn.dy += e.movementY; }
  });

  // touch: left = floating joystick, right = camera drag, buttons = jump/shoot/action
  const joyEl = $('joy'), knobEl = $('joy-knob');
  const TCFG = CFG.TOUCH || {}, STICK_SENS = clamp(TCFG.stickSensitivity != null ? TCFG.stickSensitivity : 0.7, 0.2, 2),
        LOOK_SENS = 1.9 * clamp(TCFG.lookSensitivity != null ? TCFG.lookSensitivity : 0.55, 0.1, 2), JOY_R = 78;
  const btnTouch = {};
  function onTouchStart(e) {
    for (const t of e.changedTouches) {
      const el = document.elementFromPoint(t.clientX, t.clientY), btn = el && el.closest && el.closest('[data-btn]');
      if (btn) { btnTouch[t.identifier] = btn.dataset.btn; btn.classList.add('on'); press(btn.dataset.btn); press('advance'); e.preventDefault(); continue; }
      if (el && el.closest && el.closest('button, .overlay.show, #dialogue')) { press('advance'); continue; }
      if (state !== 'play' && state !== 'intro' && state !== 'outro') continue;
      press('advance');
      if (t.clientX < innerWidth * 0.45 && joy.id === null) {
        joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joy.x = joy.y = 0;
        joyEl.style.left = t.clientX + 'px'; joyEl.style.top = t.clientY + 'px'; joyEl.classList.add('on'); knobEl.style.transform = 'translate(-50%,-50%)';
      } else if (camDrag.id === null) { camDrag.id = t.identifier; camDrag.lx = t.clientX; camDrag.ly = t.clientY; }
      e.preventDefault();
    }
  }
  function onTouchMove(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) {
        const R = JOY_R; let dx = t.clientX - joy.ox, dy = t.clientY - joy.oy; const d = Math.hypot(dx, dy);
        if (d > R) { joy.ox += dx - dx / d * R; joy.oy += dy - dy / d * R; dx = dx / d * R; dy = dy / d * R; joyEl.style.left = joy.ox + 'px'; joyEl.style.top = joy.oy + 'px'; }
        joy.x = dx / R; joy.y = -dy / R;
        knobEl.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
      } else if (t.identifier === camDrag.id) {
        camIn.dx += (t.clientX - camDrag.lx) * LOOK_SENS; camIn.dy += (t.clientY - camDrag.ly) * LOOK_SENS; camDrag.lx = t.clientX; camDrag.ly = t.clientY;
      }
    }
    if (state === 'play') e.preventDefault();
  }
  function onTouchEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; joyEl.classList.remove('on'); }
      if (t.identifier === camDrag.id) camDrag.id = null;
      const b = btnTouch[t.identifier];
      if (b) { delete btnTouch[t.identifier]; if (!Object.values(btnTouch).includes(b)) document.querySelector('[data-btn="' + b + '"]').classList.remove('on'); }
    }
  }
  addEventListener('touchstart', onTouchStart, { passive: false });
  addEventListener('touchmove', onTouchMove, { passive: false });
  addEventListener('touchend', onTouchEnd); addEventListener('touchcancel', onTouchEnd);
  $('dialogue').addEventListener('mousedown', () => press('advance'));

  function readInput() {
    const btnHeld = b => Object.values(btnTouch).includes(b);
    held.jump = !!keys.jump || btnHeld('jump');
    held.shoot = !!keys.shoot || mouseShoot || btnHeld('shoot');
    held.action = !!keys.action || btnHeld('action');
    let ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), iy = (keys.fwd ? 1 : 0) - (keys.back ? 1 : 0);
    let m;
    if (joy.id !== null) {
      // deadzone + soft response curve so small thumb movements give gentle, precise control
      const raw = Math.min(1, Math.hypot(joy.x, joy.y)), dz = 0.2;
      if (raw < dz) { ix = iy = 0; m = 0; }
      else {
        const t = (raw - dz) / (1 - dz), mag = Math.min(1, Math.pow(t, 1.6) * (0.55 + STICK_SENS * 0.65));
        ix = joy.x / raw * mag; iy = joy.y / raw * mag; m = mag;
      }
    } else {
      m = Math.hypot(ix, iy); if (m > 1) { ix /= m; iy /= m; m = 1; }
      if (m < 0.15) { ix = iy = 0; m = 0; }
    }
    const walk = keys.walk;
    return { ix, iy, m, walk };
  }

  /* ================================ WORLD =============================== */
  let W = null, P = null, rig = null, gltf = null, teev = null, enemies = [], bolts = [], darts = [], coinMesh = null;
  let state = 'title', paused = false, stats = null, timeLeft = 0, respawn = null;
  const G = { t: 0, shakeT: 0, shakeMag: 0 };
  const cam = { yaw: 0, pitch: 0.3, dist: 5.2, lastManual: -99, pos: new THREE.Vector3(), look: new THREE.Vector3() };
  let worldGroup = null;
  const ray = new THREE.Raycaster();
  const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3();

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function clearWorld() {
    if (worldGroup) {
      scene.remove(worldGroup);
      worldGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
    worldGroup = new THREE.Group(); scene.add(worldGroup);
  }

  function buildWorld(seed) {
    clearWorld();
    const add = worldGroup;
    W = LVL.build(add, mulberry32(seed), { shadows: SHADOWS });
    scene.background = W.textures.sky;
    // coins (instanced)
    coinMesh = new THREE.InstancedMesh(MD.makeCoinGeo(), MD.coinMats(), W.coins.length);
    coinMesh.frustumCulled = false; add.add(coinMesh);
    W.coins.forEach(c => { c.taken = false; c.ph = Math.random() * 6; });
    W.totalCoins = W.coins.length;
    // clues: floating scrolls with glow
    W.clues.forEach(c => {
      const g = new THREE.Group(); g.position.set(c.x, c.y, c.z);
      const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.6, 10), MD.mat('scroll', { color: 0xf3e1b0, emissive: 0x554422 }));
      sc.rotation.z = Math.PI / 2; g.add(sc);
      [-0.33, 0.33].forEach(x => { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 10), MD.mat('scrollEnd', { color: 0xa86a35 })); e.rotation.z = Math.PI / 2; e.position.x = x; g.add(e); });
      const halo = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 24), new THREE.MeshBasicMaterial({ color: 0xffde3a, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
      g.add(halo); c.halo = halo;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 6, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffde3a, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
      beam.position.y = 2.5; g.add(beam);
      add.add(g); c.mesh = g; c.taken = false;
    });
    W.hearts.forEach(h => {
      const s = new THREE.Shape(); s.moveTo(0, -0.25); s.bezierCurveTo(-0.45, 0.05, -0.25, 0.35, 0, 0.15); s.bezierCurveTo(0.25, 0.35, 0.45, 0.05, 0, -0.25);
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false }), MD.mat('heart', { color: 0xff3b5c, emissive: 0x661020 }));
      m.position.set(h.x, h.y, h.z); add.add(m); h.mesh = m; h.taken = false;
    });
    // checkpoints: braziers
    W.checkpoints.forEach(k => {
      const g = new THREE.Group(); g.position.set(k.x, k.y, k.z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.1, 8), MD.mat('brazier', { color: 0x5b3a12 })); base.position.y = 0.55; g.add(base);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.22, 0.25, 10), MD.mat('bowl', { color: 0x8a4c22 })); bowl.position.y = 1.2; g.add(bowl);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 7), new THREE.MeshLambertMaterial({ color: 0xff7a1f, emissive: 0xff5a00 }));
      fl.position.y = 1.6; g.add(fl); add.add(g); k.flame = fl; k.lit = false;
    });
    // levers
    W.levers.forEach(l => {
      const g = new THREE.Group(); g.position.set(l.x, l.y, l.z);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.5), MD.mat('leverBase', { color: 0x5b3a12 })); base.position.y = 0.2; g.add(base);
      const piv = new THREE.Group(); piv.position.y = 0.4; piv.rotation.x = -0.7; g.add(piv);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6), MD.mat('iron', { color: 0x5a5f6e })); stick.position.y = 0.4; piv.add(stick);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshLambertMaterial({ color: 0xff4060, emissive: 0x551020 })); knob.position.y = 0.8; piv.add(knob);
      const mark = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 4), new THREE.MeshBasicMaterial({ color: 0xffde3a })); mark.rotation.x = Math.PI; mark.position.y = 1.7; g.add(mark);
      add.add(g); l.piv = piv; l.knob = knob; l.mark = mark; l.on = false;
    });
    W.solids.push({ min: { x: -1e3, y: -1e3, z: 1e3 }, max: { x: 1e3, y: 1e3, z: 1e3 + 1 }, kind: 'static', active: false }); // spare
    W.boulderState = { triggered: false, done: false, mesh: null };
    W.hurdles.forEach(h => { h.hurdle = true; });
    // enemies
    enemies = W.enemySpawns.map(s => {
      const R = s.type === 'goblin' ? MD.makeGoblin() : MD.makeBat();
      R.root.position.set(s.x, s.y, s.z); add.add(R.root);
      return { type: s.type, R, pos: R.root.position, home: new THREE.Vector3(s.x, s.y, s.z), hp: s.type === 'goblin' ? 3 : 1, alive: true,
               t: Math.random() * 6, vel: new THREE.Vector3(), hitT: 0, yaw: 0, attackCd: 0, dying: 0 };
    });
    // Teevincs
    teev = MD.makeTeevincs(); teev.root.position.set(W.teevincs.x, 0, W.teevincs.z); add.add(teev.root); teev.pose = 'wave';
    if (CFG.MODEL && CFG.MODEL.teevincs) loadGLTF(CFG.MODEL.teevincs, CFG.MODEL.teevincsScale || 1, 0, m => { teev.root.visible = false; m.root.position.copy(teev.root.position); add.add(m.root); teev.gltf = m; });
    // bolts + darts pools
    bolts = []; darts = [];
    const bGeo = new THREE.SphereGeometry(0.09, 6, 5);
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({ color: i % 2 ? 0x14f195 : 0xb47bff })); m.visible = false; add.add(m);
      bolts.push({ m, vel: new THREE.Vector3(), life: 0 });
    }
    const dGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.5, 5); dGeo.rotateZ(Math.PI / 2);
    for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(dGeo, MD.mat('dart', { color: 0x222222 })); m.visible = false; add.add(m); darts.push({ m, vx: 0, life: 0 }); }
    // aim reticle
    reticle = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.42, 20), new THREE.MeshBasicMaterial({ color: 0xff3b5c, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }));
    reticle.renderOrder = 10; reticle.visible = false; add.add(reticle);
    // coin fountain for outro
    fountain = new THREE.InstancedMesh(MD.makeCoinGeo(), MD.coinMats(), 90); fountain.frustumCulled = false; fountain.count = 0; add.add(fountain);
    fountainCoins = [];
    initParticles(add);
    buildGuide(add);
  }
  /* ------------- guide: arrow over Aaliyah's head + light beam on the next objective ------------- */
  let objectives = [], guideArrow = null, guideBeam = null;
  function buildGuide(add) {
    objectives = [];
    W.clues.forEach(c => objectives.push({ x: () => c.x, y: () => c.y - 0.9, z: c.z, done: () => c.taken }));
    W.levers.forEach(l => objectives.push({ x: () => l.x, y: () => l.y, z: l.z, done: () => l.on }));
    const b = W.block;
    // block: first guide her to the left side of it, then point at the plate so she pushes it there
    objectives.push({ x: () => P.pos.x < b.min.x - 0.1 && Math.abs(P.pos.z - (b.min.z + b.max.z) / 2) < 1.2 ? W.plate.x : b.min.x - 1.0,
                      y: () => 0, z: (b.min.z + b.max.z) / 2, done: () => !!b.locked });
    objectives.push({ x: () => 0, y: () => 0, z: -207, done: () => !W.door.active || !!W.door.opening });
    objectives.push({ x: () => W.teevincs.x, y: () => 0, z: W.teevincs.z, done: () => false });
    objectives.sort((p, q) => q.z - p.z);
    if (!ASSIST.guideArrow) return;
    guideArrow = $('waypoint');
    guideBeam = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 14, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffde3a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.position.y = 7; guideBeam.add(beam);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 24), new THREE.MeshBasicMaterial({ color: 0xffde3a, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; guideBeam.add(ring); guideBeam.ring = ring;
    add.add(guideBeam);
  }
  // doorways between rooms (all centred on x=0): the arrow leads through them instead of into walls
  const DOORWAYS = [-62.5, -96.5, -124.5, -128.2, -142.6, -158.5, -205.5];   // incl. both ends of the tile bridge
  function guideTarget() {
    const o = objectives.find(q => !q.done()); if (!o) return null;
    const pz = P.pos.z, tz = o.z;
    let door = null;
    if (tz < pz) { for (const d of DOORWAYS) if (d < pz - 0.3 && d > tz) { door = { x: 0, y: 0, z: d - 1.5 }; break; } }
    else { for (let i = DOORWAYS.length - 1; i >= 0; i--) { const d = DOORWAYS[i]; if (d > pz + 0.3 && d < tz) { door = { x: 0, y: 0, z: d + 1.5 }; break; } } }
    if (door && Math.abs(P.pos.x) > 1.2 && Math.abs(pz - door.z) < 1.6) door.z = pz - Math.sign(pz - door.z || 1) * 0.1; // line up with the opening
    return { o, t: door || { x: o.x(), y: o.y(), z: o.z } };
  }
  function updateGuide() {
    if (!guideArrow) return;
    const g = state === 'play' ? guideTarget() : null;
    guideBeam.visible = !!g; guideArrow.style.display = g ? '' : 'none';
    if (!g) return;
    const o = g.o, ox = g.t.x, oy = g.t.y, dx = ox - P.pos.x, dz = g.t.z - P.pos.z, d = Math.hypot(dx, dz);
    guideBeam.position.set(o.x(), o.y(), o.z); guideBeam.ring.scale.setScalar(1 + Math.sin(G.t * 4) * 0.15);
    // on-screen waypoint marker: over the target when visible, pinned to the screen edge when not
    tmpV.set(ox, oy + 2.2, g.t.z).project(camera);
    const behind = tmpV.z > 1; let sx = tmpV.x, sy = tmpV.y;
    if (behind) { sx = -sx; sy = -1; }
    const edge = Math.max(Math.abs(sx), Math.abs(sy)), m = 0.86, off = edge > m || behind;
    if (off) { const k = m / Math.max(edge, 1e-3); sx *= k; sy *= k; }
    const px = (sx * 0.5 + 0.5) * innerWidth, py = Math.max(110, Math.min(innerHeight - 40, (-sy * 0.5 + 0.5) * innerHeight));
    guideArrow.style.transform = 'translate(' + px.toFixed(0) + 'px,' + py.toFixed(0) + 'px)';
    guideArrow.classList.toggle('edge', off);
    guideArrow.querySelector('i').style.transform = off ? 'rotate(' + (Math.atan2(-sx, -sy) * 180 / Math.PI).toFixed(0) + 'deg)' : '';
    const dist = Math.round(Math.hypot(o.x() - P.pos.x, o.z - P.pos.z));
    if (guideArrow.__d !== dist) { guideArrow.__d = dist; guideArrow.querySelector('b').textContent = dist + 'm'; }
  }
  let reticle = null, fountain = null, fountainCoins = [];

  /* ------------------------------- GLTF ---------------------------------- */
  function loadGLTF(path, scale, yaw, done) {
    if (!THREE.GLTFLoader) return;
    new THREE.GLTFLoader().load(path, g => {
      const root = new THREE.Group(), model = g.scene; root.add(model);
      const bb = new THREE.Box3().setFromObject(model), h = bb.max.y - bb.min.y || 1;
      const s = 1.7 / h * scale; model.scale.setScalar(s); model.position.y = -bb.min.y * s; model.rotation.y = yaw || 0;
      model.traverse(o => { if (o.isMesh) o.castShadow = SHADOWS; });
      const mixer = new THREE.AnimationMixer(model), actions = {};
      g.animations.forEach(c => { actions[c.name.toLowerCase()] = mixer.clipAction(c); });
      done({ root, mixer, actions, current: null });
    }, undefined, err => console.warn('Model failed to load', path, err));
  }
  function gltfPose(m, pose, dt) {
    const map = { panic: 'idle', dead: 'hurt', mantle: 'climb' };
    const want = Object.keys(m.actions).find(n => n.includes(pose)) || Object.keys(m.actions).find(n => n.includes(map[pose] || 'idle')) || Object.keys(m.actions)[0];
    if (want && m.current !== want) {
      const a = m.actions[want]; a.reset().fadeIn(0.15).play();
      if (m.current) m.actions[m.current].fadeOut(0.15);
      m.current = want;
    }
    m.mixer.update(dt);
  }

  /* ============================= PARTICLES =============================== */
  const PMAX = 700; let pGeo, pPts, pPos, pCol, pData;
  function initParticles(parent) {
    pGeo = new THREE.BufferGeometry(); pPos = new Float32Array(PMAX * 3); pCol = new Float32Array(PMAX * 3);
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    pPts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, depthWrite: false }));
    pPts.frustumCulled = false; parent.add(pPts);
    pData = []; for (let i = 0; i < PMAX; i++) { pData.push({ life: 0, max: 0, vx: 0, vy: 0, vz: 0, g: 0 }); pPos[i * 3 + 1] = -999; }
  }
  let pNext = 0;
  const colorTmp = new THREE.Color();
  function burst(x, y, z, n, colors, speed, opts) {
    opts = opts || {};
    for (let i = 0; i < n; i++) {
      const k = pNext; pNext = (pNext + 1) % PMAX; const d = pData[k];
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, s = speed * (0.3 + Math.random() * 0.7);
      d.vx = Math.cos(a) * Math.cos(b) * s; d.vz = Math.sin(a) * Math.cos(b) * s; d.vy = Math.abs(Math.sin(b)) * s * (opts.up || 1) + (opts.lift || 0);
      d.life = 0; d.max = (opts.life || 0.7) * (0.6 + Math.random() * 0.6); d.g = opts.grav != null ? opts.grav : 9;
      pPos[k * 3] = x; pPos[k * 3 + 1] = y; pPos[k * 3 + 2] = z;
      colorTmp.set(rpick(colors)); pCol[k * 3] = colorTmp.r; pCol[k * 3 + 1] = colorTmp.g; pCol[k * 3 + 2] = colorTmp.b;
    }
  }
  function updateParticles(dt) {
    if (!pData) return;
    for (let i = 0; i < PMAX; i++) {
      const d = pData[i]; if (d.max <= 0) continue;
      d.life += dt; if (d.life >= d.max) { d.max = 0; pPos[i * 3 + 1] = -999; continue; }
      d.vy -= d.g * dt; pPos[i * 3] += d.vx * dt; pPos[i * 3 + 1] += d.vy * dt; pPos[i * 3 + 2] += d.vz * dt;
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
  }

  /* =========================== FLOATING TEXT ============================ */
  const floatEls = []; for (let i = 0; i < 8; i++) { const d = document.createElement('div'); d.className = 'float'; document.body.appendChild(d); floatEls.push({ el: d, t: 9, pos: new THREE.Vector3() }); }
  let floatNext = 0;
  function floatText(text, pos, color) {
    const f = floatEls[floatNext]; floatNext = (floatNext + 1) % floatEls.length;
    f.el.textContent = text; f.el.style.color = color || '#fff'; f.t = 0; f.pos.copy(pos);
  }
  function updateFloats(dt) {
    for (const f of floatEls) {
      if (f.t > 1.2) { f.el.style.opacity = 0; continue; }
      f.t += dt; f.pos.y += dt * 0.8;
      tmpV.copy(f.pos).project(camera);
      if (tmpV.z > 1) { f.el.style.opacity = 0; continue; }
      f.el.style.opacity = Math.max(0, 1 - f.t / 1.2);
      f.el.style.transform = 'translate(' + ((tmpV.x * 0.5 + 0.5) * innerWidth) + 'px,' + ((-tmpV.y * 0.5 + 0.5) * innerHeight) + 'px) translate(-50%,-50%) scale(' + (1 + Math.max(0, 0.3 - f.t)) + ')';
    }
  }

  /* ============================ TOAST / SLAM ============================ */
  const toastEl = $('toast'), slamEl = $('slam'); let toastTimer = 0, slamTimer = 0;
  function fmt(s) {
    return String(s).replace(/\{sol\}/g, P ? String(Math.round(P.sol * CFG.SOL_PER_FRAGMENT * 100) / 100) : '0')
      .replace(/\{clues\}/g, P ? P.clues : 0).replace(/\{time\}/g, fmtTime(stats ? stats.time : 0)).replace(/\{left\}/g, fmtTime(timeLeft));
  }
  function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function toast(msg, dur) { toastEl.textContent = fmt(msg); toastEl.classList.add('show'); toastTimer = dur || 2.6; }
  // toast + Aaliyah says it out loud (uses the recorded line when there is one)
  function toastSay(msg, dur) {
    toast(msg, dur);
    if (!DLG.active && AU.voiceOn()) AU.say(msg, 'aaliyah');
  }
  function slam(text) { slamEl.textContent = fmt(text); slamEl.classList.remove('go'); void slamEl.offsetWidth; slamEl.classList.add('go'); slamTimer = 1.8; shake(0.25, 0.4); }
  function shake(mag, dur) { G.shakeMag = Math.max(G.shakeMag, mag); G.shakeT = Math.max(G.shakeT, dur || 0.3); }

  /* ============================== DIALOGUE ============================== */
  const VCFG = CFG.VOICE || {};
  const DLG = { el: $('dialogue'), lines: [], i: -1, shown: 0, full: '', done: null, active: false, blip: 0, who: '' };
  const dlgName = $('dlg-name'), dlgText = $('dlg-text'), dlgPortrait = $('dlg-portrait'), dlgWrap = $('dlg-portrait-wrap');
  let teevPortrait = null;
  function startDialogue(lines, done) { DLG.lines = lines; DLG.i = -1; DLG.done = done; DLG.active = true; nextLine(); }
  function nextLine() {
    DLG.i++;
    if (DLG.i >= DLG.lines.length) { AU.stopVoice(); DLG.active = false; DLG.el.className = ''; const d = DLG.done; DLG.done = null; if (d) d(); return; }
    const ln = DLG.lines[DLG.i], who = ln.who || 'narrator';
    DLG.who = who; DLG.full = fmt(ln.text || ''); DLG.shown = 0; dlgText.textContent = '';
    dlgName.textContent = (CFG.NAMES && CFG.NAMES[who]) || '';
    DLG.el.className = 'show who-' + who;
    const src = who === 'aaliyah' ? CFG.PORTRAITS.aaliyah : who === 'teevincs' ? (CFG.PORTRAITS.teevincs || teevPortrait) : null;
    if (src) { dlgPortrait.src = src; dlgWrap.style.display = ''; } else dlgWrap.style.display = 'none';
    dlgWrap.classList.remove('shaky');
    if (ln.shake) { shake(0.2, 0.45); void dlgWrap.offsetWidth; dlgWrap.classList.add('shaky'); }
    if (ln.sfx) AU.sfx(ln.sfx);
    // speak the exact config text (that's the key for the recorded voice file)
    DLG.speed = CFG.TEXT_SPEED || 50; DLG.voiceDone = false; DLG.autoT = -1;
    const lineNo = DLG.i;
    AU.onLineStart = dur => { if (DLG.i === lineNo) DLG.speed = Math.max(18, DLG.full.length / Math.max(0.4, dur * 0.9)); };
    DLG.spoken = AU.say(ln.text || '', who, ln.voice, () => { if (DLG.i === lineNo) DLG.voiceDone = true; });
    if (!DLG.spoken) DLG.voiceDone = true;
    if (ln.slam) slam(ln.slam);
    if (ln.event) dialogueEvent(ln.event);
  }
  function updateDialogue(dt) {
    if (!DLG.active) return;
    if (pressed.advance) {
      if (DLG.shown < DLG.full.length) { DLG.shown = DLG.full.length; dlgText.textContent = DLG.full; }
      else { nextLine(); return; }
    }
    // auto-advance once the voice has finished (or after reading time when there's no voice)
    if (VCFG.autoAdvance !== false && DLG.shown >= DLG.full.length && DLG.voiceDone) {
      if (DLG.autoT < 0) DLG.autoT = DLG.spoken ? 0.45 : 0.9 + DLG.full.length * 0.03;
      DLG.autoT -= dt; if (DLG.autoT <= 0) { nextLine(); return; }
    }
    if (DLG.shown < DLG.full.length) {
      const before = Math.floor(DLG.shown); DLG.shown = Math.min(DLG.full.length, DLG.shown + dt * (DLG.speed || 50));
      const now = Math.floor(DLG.shown);
      if (now !== before) { dlgText.textContent = DLG.full.slice(0, now); if (!DLG.spoken && (DLG.blip++ % 2) === 0 && DLG.full[now - 1] !== ' ') AU.blip(DLG.who); }
    }
  }
  let tipping = false, tipT = 0;
  function dialogueEvent(ev) {
    if (ev === 'tip') { tipping = true; tipT = 0; AU.sfx('fanfare'); AU.music('birthday'); teev.pose = 'party'; }
  }

  /* ================================ HUD ================================= */
  const hud = { hearts: $('hud-hearts'), sol: $('hud-sol'), clues: $('hud-clues'), timer: $('hud-timer'), prog: $('hud-prog'), timerBox: $('hud-timer-box'), act: $('btn-action') };
  const hudCache = {};
  function setHud(k, v) { if (hudCache[k] !== v) { hudCache[k] = v; hud[k].textContent = v; } }
  function updateHUD() {
    setHud('hearts', '❤'.repeat(Math.max(0, P.hearts)) + '♡'.repeat(Math.max(0, CFG.START_HEARTS - P.hearts)));
    setHud('sol', String(P.sol));
    setHud('clues', P.clues + '/3');
    setHud('timer', fmtTime(TIMED ? timeLeft : stats.time));
    const low = TIMED && timeLeft < 30; if (hudCache.low !== low) { hudCache.low = low; hud.timerBox.classList.toggle('low', low); }
    const prog = clamp((W.start.z - P.pos.z) / (W.start.z - W.teevincs.z), 0, 1);
    const pw = Math.round(prog * 100) + '%'; if (hudCache.prog !== pw) { hudCache.prog = pw; hud.prog.style.width = pw; }
    const near = nearInteract() ? '1' : '0'; if (hudCache.near !== near) { hudCache.near = near; hud.act.classList.toggle('hot', near === '1'); }
  }

  /* ============================== GAME FLOW ============================= */
  const safeA = new THREE.Vector3(), safeB = new THREE.Vector3(); let safeT = 0;
  let introLines = null, introT = 0, outroT = 0, doorMsgCd = 0, plateMsgCd = 0, lowWarned = false, rumbleT = 0;
  function newPlayer() {
    return { pos: new THREE.Vector3(W.start.x, W.start.y, W.start.z), vel: new THREE.Vector3(), onGround: false, ground: null, facing: Math.PI,
             st: 'move', coyote: 0, jumpBuf: 0, jumping: false, inv: 0, hurtT: 0, hearts: CFG.START_HEARTS, sol: 0, clues: 0,
             shootCd: 0, gun: 0, shootT: 0, target: null, retargetT: 0, mantle: null, hang: null, climbW: null, pushing: false, animT: 0, speed: 0, hangHold: 0 };
  }
  function hideOverlays() { ['title', 'gameover', 'results', 'pause'].forEach(id => $(id).classList.remove('show')); }
  function startRun(withIntro) {
    buildWorld((Math.random() * 2 ** 31) | 0);
    P = newPlayer();
    if (!rig) setupPlayerModel();
    worldGroup.add(rig.root); if (gltf) worldGroup.add(gltf.root);
    stats = { time: 0, hits: 0, falls: 0, kills: 0 };
    timeLeft = CFG.TIME_LIMIT; lowWarned = false; safeA.set(W.start.x, W.start.y, W.start.z); safeB.copy(safeA);
    $('hud-timer-label').textContent = TIMED ? '🎂 BDAY IN' : '🎂 TIME';
    hud.hearts.style.display = ASSIST.invincible ? 'none' : ''; tipping = false; respawn = { x: W.start.x, y: W.start.y, z: W.start.z };
    hideOverlays(); paused = false; document.body.classList.add('ingame');
    cam.yaw = 0; cam.pitch = 0.3; for (const k in hudCache) delete hudCache[k];
    if (withIntro) {
      state = 'intro'; introT = 0; P.pos.z = W.start.z + 9; P.facing = Math.PI;
      cam.yaw = Math.PI - 0.6; cam.dist = 3.6; cam.pitch = 0.12;
      AU.music('intro');
      const lines = CFG.INTRO.slice();
      if (CFG.INTRO_RANDOM && CFG.INTRO_RANDOM.length) lines.splice(Math.min(4, lines.length - 2), 0, { who: 'aaliyah', text: rpick(CFG.INTRO_RANDOM) });
      introLines = lines; $('skip').classList.add('show');
    } else beginPlay();
    snapCamera();
  }
  function beginPlay() {
    state = 'play'; $('skip').classList.remove('show'); DLG.active = false; DLG.el.className = '';
    P.pos.set(W.start.x, W.start.y, W.start.z); P.vel.set(0, PH.jump * 0.9, 0); P.onGround = false; P.jumping = true; P.facing = Math.PI;
    cam.yaw = 0; cam.dist = 5.2; cam.pitch = 0.3; cam.lastManual = -99;
    AU.music('raid'); AU.sfx('jump'); AU.stopVoice(); bark('start'); slam(rpick(['LET\'S GOOO!', 'FIND TEEVINCS!', 'GO GO GO!']));
    if (!ASSIST.autoJump) {
      if (IS_TOUCH) toast('Left thumb: move · Right thumb: look · Hold SHOOT to blast', 3.5);
      else toast('WASD move · Mouse look (click) · SPACE jump · J / click shoot · F action', 3.5);
    }
  }
  function bark(kind, who) { const l = CFG.BARKS && CFG.BARKS[kind]; if (l && l.length) AU.bark(rpick(l), who); }
  function startFromTitle(withIntro) { removeTitleScene(); AU.unlock(); startRun(withIntro); }
  function gameOver(kind) {
    if (state !== 'play') return;
    state = 'gameover'; AU.music(null); AU.stopVoice(); AU.sfx('death'); shake(0.4, 0.5); P.st = 'dead';
    if (document.pointerLockElement) document.exitPointerLock();
    $('go-title').textContent = kind === 'time' ? CFG.TIMEOUT_TITLE : CFG.GAME_OVER_TITLE;
    $('go-quip').textContent = fmt(rpick(kind === 'time' ? CFG.TIMEOUT_QUIPS : CFG.GAME_OVER_QUIPS));
    $('go-stats').textContent = 'SOL: ' + P.sol + ' / ' + W.totalCoins + '   ·   CLUES: ' + P.clues + '/3';
    setTimeout(() => $('gameover').classList.add('show'), 900);
  }
  function startOutro() {
    state = 'outro'; outroT = 0; P.vel.set(0, 0, 0); P.st = 'move'; teev.pose = 'shock';
    if (document.pointerLockElement) document.exitPointerLock();
    AU.music(null); AU.stopVoice(); AU.sfx('fanfare'); shake(0.2, 0.4); $('skip').classList.add('show');
    burst(teev.root.position.x, 2, teev.root.position.z, 60, ['#ffde3a', '#14F195', '#9945FF', '#ff5e8a'], 6, { life: 1.6, grav: 4 });
    setTimeout(() => { if (state === 'outro') startDialogue(CFG.OUTRO, showResults); }, 900);
  }
  function showResults() {
    if (state === 'results') return;
    if (!tipping) dialogueEvent('tip');
    state = 'results'; $('skip').classList.remove('show');
    const pct = W.totalCoins ? P.sol / W.totalCoins : 1;
    const rank = CFG.RANKS.find(r => pct >= r.minSolPct && stats.time <= r.maxTime) || CFG.RANKS[CFG.RANKS.length - 1];
    let best = null;
    try { best = parseFloat(localStorage.getItem('aaliyah_best3d')); if (!best || stats.time < best) { localStorage.setItem('aaliyah_best3d', String(stats.time)); best = stats.time; } } catch (e) {}
    $('res-title').textContent = CFG.RESULTS_TITLE; $('res-rank').textContent = rank.title; $('res-desc').textContent = rank.desc;
    $('res-stats').innerHTML =
      '<div><b>' + fmtTime(stats.time) + '</b><span>RUN TIME</span></div>' +
      '<div><b>' + fmt('{sol}') + ' SOL</b><span>TIPPED (' + P.sol + '/' + W.totalCoins + ')</span></div>' +
      '<div><b>' + stats.kills + '</b><span>FUD BLASTED</span></div>' +
      '<div><b>' + stats.hits + '</b><span>OUCHIES</span></div>' +
      (best ? '<div><b>' + fmtTime(best) + '</b><span>BEST TIME</span></div>' : '');
    setTimeout(() => $('results').classList.add('show'), 1800);
  }
  function togglePause() {
    if (state !== 'play' && state !== 'intro' && state !== 'outro') return;
    paused = !paused; $('pause').classList.toggle('show', paused);
    if (paused && document.pointerLockElement) document.exitPointerLock();
    AU.sfx('pause'); if (paused) AU.suspend(); else AU.resume();
  }
  function toggleMute() { AU.unlock(); AU.setMuted(!AU.muted); $('btn-mute').textContent = AU.muted ? '🔇' : '🔊'; $('btn-mute2').textContent = AU.muted ? 'SOUND: OFF' : 'SOUND: ON'; }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (state === 'play' && !paused) togglePause(); AU.suspend(); } else if (!paused) AU.resume();
  });

  /* ============================== PHYSICS =============================== */
  const EPS = 1e-4;
  function pOverlap(s, px, py, pz) {
    const r = PH.r;
    return px - r < s.max.x - EPS && px + r > s.min.x + EPS && py < s.max.y - EPS && py + PH.h > s.min.y + EPS && pz - r < s.max.z - EPS && pz + r > s.min.z + EPS;
  }
  function boxBlocked(x, y, z, r, h, ignore) {
    for (const s of W.solids) {
      if (!s.active || s === ignore) continue;
      if (x - r < s.max.x && x + r > s.min.x && y < s.max.y && y + h > s.min.y && z - r < s.max.z && z + r > s.min.z) return true;
    }
    return false;
  }
  function groundAt(x, z, y) {
    let best = -99;
    for (const s of W.solids) {
      if (!s.active) continue;
      if (x > s.min.x && x < s.max.x && z > s.min.z && z < s.max.z && s.max.y <= y + 0.5 && s.max.y > best) best = s.max.y;
    }
    return best;
  }
  function moveAxis(axis, d) {
    if (!d) return null;
    const p = P.pos; p[axis] += d;
    let contact = null;
    for (const s of W.solids) {
      if (!s.active || !pOverlap(s, p.x, p.y, p.z)) continue;
      if (axis === 'y') {
        if (d > 0) { p.y = s.min.y - PH.h - EPS; P.vel.y = Math.min(0, P.vel.y); }
        else { p.y = s.max.y; P.vel.y = 0; P.onGround = true; P.ground = s; }
      } else {
        const step = s.max.y - p.y;
        if (P.onGround && step > 0 && step <= 0.38 && !boxBlocked(p.x, s.max.y + 0.01, p.z, PH.r - 0.02, PH.h - 0.02)) { p.y = s.max.y; continue; }
        if (d > 0) p[axis] = s.min[axis] - PH.r - EPS; else p[axis] = s.max[axis] + PH.r + EPS;
        contact = { s, axis, n: d > 0 ? -1 : 1 };
      }
    }
    return contact;
  }

  function startMantle(top, nx, nz, quick) {
    const to = new THREE.Vector3(P.pos.x - nx * 0.55, top, P.pos.z - nz * 0.55);
    if (boxBlocked(to.x, to.y + 0.02, to.z, PH.r - 0.03, PH.h - 0.05)) return false;
    P.st = 'mantle'; P.mantle = { from: P.pos.clone(), to, t: 0, dur: quick ? 0.28 : 0.55 };
    P.vel.set(0, 0, 0); P.facing = Math.atan2(-nx, -nz); P.hang = null; P.climbW = null;
    AU.sfx(quick ? 'jump' : 'lever');
    return true;
  }
  function tryLedge(c, wish) {
    const s = c.s; if (!s.active || s.kind === 'gate' || s.kind === 'door' || s.kind === 'block') return false;
    const nx = c.axis === 'x' ? c.n : 0, nz = c.axis === 'z' ? c.n : 0;
    const into = -(wish.x * nx + wish.z * nz);
    if (into < 0.35) return false;
    const top = s.max.y, diff = top - P.pos.y;
    if (s.climb && diff > 1.2) {
      P.st = 'climb'; P.climbW = { s, nx, nz }; P.vel.set(0, 0, 0); P.facing = Math.atan2(-nx, -nz); return true;
    }
    const spotX = P.pos.x - nx * 0.55, spotZ = P.pos.z - nz * 0.55;
    if (boxBlocked(spotX, top + 0.02, spotZ, PH.r - 0.03, PH.h - 0.05)) return false;
    if (P.onGround) {
      if (diff > 0.38 && diff <= 1.0) return startMantle(top, nx, nz, true);
      if (ASSIST.autoClimb && diff > 1.0 && diff <= 2.45) return startMantle(top, nx, nz, false);
      return false;
    }
    if (diff > 0.25 && diff <= 1.25) return startMantle(top, nx, nz, true);
    if (ASSIST.autoClimb && diff > 1.25 && diff <= 2.45) return startMantle(top, nx, nz, false);
    if (diff > 1.25 && diff <= 2.4 && P.vel.y < 6) {
      P.st = 'hang'; P.hang = { s, nx, nz, top }; P.vel.set(0, 0, 0); P.facing = Math.atan2(-nx, -nz);
      P.pos.y = top - 2.0; P.hangHold = 0; AU.sfx('stomp'); shake(0.05, 0.1);
      return true;
    }
    return false;
  }

  function hurt(src, dmg) {
    if (P.inv > 0 || state !== 'play') return;
    if (!ASSIST.invincible) P.hearts -= dmg || 1;
    stats.hits++; P.inv = ASSIST.invincible ? 1.0 : 1.3; P.hurtT = ASSIST.invincible ? 0.25 : 0.4;
    if (P.st === 'hang' || P.st === 'climb' || P.st === 'mantle') P.st = 'move';
    tmpV.set(P.pos.x - src.x, 0, P.pos.z - src.z); if (tmpV.lengthSq() < 0.01) tmpV.set(0, 0, 1); tmpV.normalize();
    const kb = ASSIST.invincible ? 3.2 : 5;
    P.vel.set(tmpV.x * kb, ASSIST.invincible ? 4.5 : 6, tmpV.z * kb); P.onGround = false; P.jumping = false;
    AU.sfx('hit'); shake(0.25, 0.3); bark('hurt');
    burst(P.pos.x, P.pos.y + 1.2, P.pos.z, 18, ['#ff4060', '#ffffff', '#ffcc3a'], 4);
    floatText(rpick(CFG.HURT), tmpV2.set(P.pos.x, P.pos.y + 2.2, P.pos.z), '#ff6b81');
    if (P.hearts <= 0) gameOver('dead');
  }
  function pitFall() {
    if (state !== 'play') return;
    if (!ASSIST.invincible) P.hearts--;
    stats.falls++; AU.sfx('hit'); shake(0.3, 0.3);
    burst(P.pos.x, -1.4, P.pos.z, 40, ['#ff5a1f', '#ffd23f', '#ffffff'], 6, { lift: 3 });
    if (P.hearts <= 0) { gameOver('dead'); return; }
    const rp = ASSIST.invincible ? safeB : respawn;   // easy mode: straight back to the last safe ground
    P.pos.set(rp.x, rp.y + 0.05, rp.z); P.vel.set(0, 0, 0); P.inv = 1.6; P.st = 'move'; P.hang = null; P.climbW = null;
    toastSay(rpick(CFG.PIT), 2);
    const B = W.boulderState;
    if (B.triggered && !B.done && !ASSIST.invincible) { B.triggered = false; if (B.mesh) { worldGroup.remove(B.mesh); B.mesh = null; } AU.setTempo(172); W.hurdles.forEach(h => { h.active = true; h.mesh.visible = true; }); }
  }

  /* ============================== PLAYER ================================ */
  const wish = new THREE.Vector3();
  function spikeAt(x, z) {
    for (const sp of W.spikes) if (x > sp.min.x - 0.3 && x < sp.max.x + 0.3 && z > sp.min.z - 0.3 && z < sp.max.z + 0.3) return true;
    return false;
  }
  function nearInteract() {
    if (!W) return null;
    for (const l of W.levers) if (!l.on && Math.hypot(l.x - P.pos.x, l.z - P.pos.z) < 1.7 && Math.abs(l.y - P.pos.y) < 1.2) return l;
    return null;
  }
  function updatePlayer(dt, inp) {
    const p = P;
    p.animT += dt; if (p.inv > 0) p.inv -= dt; if (p.hurtT > 0) p.hurtT -= dt; p.shootCd -= dt; p.retargetT -= dt;
    // camera-relative wish direction
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    wish.set(fx * inp.iy + rx * inp.ix, 0, fz * inp.iy + rz * inp.ix);
    if (pressed.jump) p.jumpBuf = PH.buffer; else p.jumpBuf -= dt;
    if (p.onGround) p.coyote = PH.coyote; else p.coyote -= dt;

    // ---- interaction (levers)
    if (pressed.action || ASSIST.autoLever) {
      const l = nearInteract();
      if (l) {
        l.on = true; AU.sfx('lever'); shake(0.1, 0.2);
        const n = W.levers.filter(q => q.on).length;
        floatText(fmt(CFG.LEVER).replace('{n}', n), tmpV2.set(l.x, l.y + 2, l.z), '#ffde3a');
        burst(l.x, l.y + 1, l.z, 16, ['#ffde3a', '#ffffff'], 3);
        if (n === W.levers.length) openGate(W.gate1, CFG.GATE_OPEN || 'Gate open!');
      }
    }

    if (p.st === 'mantle') {
      const m = p.mantle; m.t += dt / m.dur; const t = Math.min(1, m.t);
      const up = Math.min(1, t / 0.6), fw = Math.max(0, (t - 0.45) / 0.55);
      p.pos.set(m.from.x + (m.to.x - m.from.x) * fw, m.from.y + (m.to.y - m.from.y) * (1 - Math.pow(1 - up, 2)), m.from.z + (m.to.z - m.from.z) * fw);
      if (t >= 1) { p.st = 'move'; p.onGround = true; p.vel.set(0, 0, 0); p.pos.copy(m.to); }
      return;
    }
    if (p.st === 'hang') {
      const h = p.hang, s = h.s;
      if (!s.active) { p.st = 'move'; return; }
      const tx = h.nz ? 1 : 0, tz = h.nx ? 1 : 0;
      const along = wish.x * tx + wish.z * tz, into = -(wish.x * h.nx + wish.z * h.nz);
      // shimmy
      if (Math.abs(along) > 0.3) {
        const nxp = p.pos.x + tx * along * 1.6 * dt, nzp = p.pos.z + tz * along * 1.6 * dt;
        const inX = !tx || (nxp > s.min.x + 0.1 && nxp < s.max.x - 0.1), inZ = !tz || (nzp > s.min.z + 0.1 && nzp < s.max.z - 0.1);
        if (inX && inZ) { p.pos.x = nxp; p.pos.z = nzp; }
      }
      p.hangHold = into > 0.6 ? p.hangHold + dt : 0;
      if (p.jumpBuf > 0 || p.hangHold > 0.3) { p.jumpBuf = 0; if (!startMantle(h.top, h.nx, h.nz, false)) { p.st = 'move'; } }
      else if (into < -0.6 || pressed.action) { p.st = 'move'; p.hang = null; p.pos.x += h.nx * 0.12; p.pos.z += h.nz * 0.12; p.vel.set(h.nx * 1.5, 0, h.nz * 1.5); }
      return;
    }
    if (p.st === 'climb') {
      const c = p.climbW, s = c.s, into = -(wish.x * c.nx + wish.z * c.nz);
      p.vel.set(0, (into > 0.3 ? 1 : into < -0.3 ? -1 : 0) * 2.6, 0);
      p.pos.y += p.vel.y * dt;
      const tx = c.nz ? 1 : 0, tz = c.nx ? 1 : 0, along = wish.x * tx + wish.z * tz;
      if (Math.abs(along) > 0.3 && Math.abs(into) < 0.5) { p.pos.x += tx * along * 1.5 * dt; p.pos.z += tz * along * 1.5 * dt; }
      const stillOn = (tx ? p.pos.x > s.min.x - 0.1 && p.pos.x < s.max.x + 0.1 : true) && (tz ? p.pos.z > s.min.z - 0.1 && p.pos.z < s.max.z + 0.1 : true);
      if (!stillOn) { p.st = 'move'; return; }
      if (p.pos.y + 1.9 >= s.max.y) { p.pos.y = s.max.y - 1.9; if (!startMantle(s.max.y, c.nx, c.nz, false)) p.st = 'move'; return; }
      if (p.jumpBuf > 0) { p.jumpBuf = 0; p.st = 'move'; p.vel.set(c.nx * 4, 7, c.nz * 4); p.facing = Math.atan2(c.nx, c.nz); AU.sfx('jump'); return; }
      const gnd = groundAt(p.pos.x, p.pos.z, p.pos.y);
      if (p.pos.y <= gnd + 0.01) { p.pos.y = gnd; p.st = 'move'; }
      return;
    }

    // ---- normal movement
    const control = p.hurtT <= 0;
    const maxS = p.pushing ? PH.push : inp.walk ? PH.walk : PH.run;
    // wish already carries the analog magnitude (0..1), so a half-pushed stick = half speed
    const tvx = control ? wish.x * maxS : 0, tvz = control ? wish.z * maxS : 0;
    const acc = (p.onGround ? (IS_TOUCH ? PH.accel * 0.6 : PH.accel) : PH.airAccel) * dt;
    const dvx = tvx - p.vel.x, dvz = tvz - p.vel.z, dl = Math.hypot(dvx, dvz);
    if (control || p.onGround) { if (dl <= acc) { p.vel.x = tvx; p.vel.z = tvz; } else { p.vel.x += dvx / dl * acc; p.vel.z += dvz / dl * acc; } }
    p.speed = Math.hypot(p.vel.x, p.vel.z);
    // facing
    const tgtD = p.target && p.target.alive ? Math.hypot(p.target.pos.x - p.pos.x, p.target.pos.z - p.pos.z) : 99;
    const manualShoot = held.shoot || pressed.shoot, autoFire = ASSIST.autoShoot && tgtD < 14;
    const shooting = (manualShoot || autoFire) && control;
    if (shooting && p.target && (manualShoot || inp.m < 0.1)) p.facing = lerpAngle(p.facing, Math.atan2(p.target.pos.x - p.pos.x, p.target.pos.z - p.pos.z), Math.min(1, dt * 30));
    else if (inp.m > 0.1 && control) p.facing = lerpAngle(p.facing, Math.atan2(wish.x, wish.z), Math.min(1, dt * (IS_TOUCH ? 9 : 14)));
    // jump
    if (ASSIST.autoJump && p.onGround && control && p.speed > 2.2 && inp.m > 0.3 && p.jumpBuf <= 0) {
      const dx = p.vel.x / p.speed, dz = p.vel.z / p.speed, ax = p.pos.x + dx * 0.75, az = p.pos.z + dz * 0.75;
      if (groundAt(ax, az, p.pos.y + 0.1) < p.pos.y - 0.8 || spikeAt(ax, az)) {
        outer: for (let d = 1.6; d <= 4.6; d += 0.5) for (const side of [0, 0.6, -0.6]) {
          const lx = p.pos.x + dx * d - dz * side, lz = p.pos.z + dz * d + dx * side;
          const g = groundAt(lx, lz, p.pos.y + 0.6);
          if (g > p.pos.y - 0.7 && !spikeAt(lx, lz)) { p.jumpBuf = PH.buffer; p.autoJumped = true; break outer; }
        }
      }
    }
    if (p.jumpBuf > 0 && p.coyote > 0 && control) {
      p.vel.y = PH.jump; p.jumpBuf = 0; p.coyote = 0; p.onGround = false; p.jumping = true; AU.sfx('jump');
      burst(p.pos.x, p.pos.y + 0.05, p.pos.z, 8, ['#f3d9a4', '#ffffff'], 2, { grav: 2, life: 0.4 });
    }
    if (p.jumping && p.vel.y > 2 && !held.jump && !p.autoJumped) { p.vel.y *= 0.55; p.jumping = false; }
    if (p.onGround && p.vel.y <= 0) p.autoJumped = false;
    if (p.vel.y <= 0) p.jumping = false;
    p.vel.y = Math.max(p.vel.y - PH.grav * dt, -PH.maxFall);

    // move horizontally (x then z), collect contacts
    p.pushing = false;
    const wasGround = p.onGround;
    let cx = moveAxis('x', p.vel.x * dt);
    if (cx && cx.s.kind === 'block' && wasGround && Math.abs(wish.x) > 0.5 && Math.sign(wish.x) === -cx.n) {
      const blk = cx.s, before = blk.min.x;
      pushBlock(blk, -cx.n * Math.max(Math.abs(p.vel.x), PH.push * 0.5) * dt);
      if (blk.min.x !== before) moveAxis('x', blk.min.x - before);
      p.pushing = true; cx = null;
    }
    const cz = moveAxis('z', p.vel.z * dt);
    // vertical
    p.onGround = false; p.ground = null;
    moveAxis('y', p.vel.y * dt);
    if (cx) { p.vel.x = 0; }
    if (cz) { p.vel.z = 0; }
    const c = cx || cz;
    if (c && control && inp.m > 0.3) tryLedge(c, wish);
    if (p.onGround && p.ground && p.ground.kind === 'static' && p.st === 'move' && !spikeAt(p.pos.x, p.pos.z)) {
      safeT -= dt; if (safeT <= 0) { safeT = 0.35; safeB.copy(safeA); safeA.copy(p.pos); }
    }
    // fell off something while running: allow a quick grab of the ledge we came from? (keep simple)

    // ---- shooting
    if (pressed.shoot || p.retargetT <= 0 || (p.target && !p.target.alive)) { p.retargetT = 0.15; p.target = findTarget(held.shoot || pressed.shoot || ASSIST.autoShoot); }
    if (shooting && p.st === 'move' && p.shootCd <= 0) fireBolt();
    p.shootT = shooting ? 0.25 : Math.max(0, p.shootT - dt);
  }
  function pushBlock(b, d) {
    if (b.locked) return;
    const nx = clamp(b.min.x + d, b.railMin, b.railMax - (b.max.x - b.min.x));
    const dd = nx - b.min.x; if (!dd) return;
    // check collisions with other solids
    const tmp = { min: { x: b.min.x + dd, y: b.min.y, z: b.min.z }, max: { x: b.max.x + dd, y: b.max.y, z: b.max.z } };
    for (const s of W.solids) {
      if (s === b || !s.active) continue;
      if (tmp.min.x < s.max.x && tmp.max.x > s.min.x && tmp.min.y + 0.05 < s.max.y && tmp.max.y > s.min.y + 0.05 && tmp.min.z < s.max.z && tmp.max.z > s.min.z) return;
    }
    b.min.x += dd; b.max.x += dd; b.scrape = (b.scrape || 0) + Math.abs(dd);
    if (b.scrape > 0.7) { b.scrape = 0; AU.sfx('rumble'); burst(b.min.x + 0.7, 0.1, b.min.z + 0.7, 5, ['#c27e45', '#f3d9a4'], 1.5, { grav: 2 }); }
  }
  function openGate(g, msg) {
    if (!g || g.opening) return;
    g.opening = true; AU.sfx('gate'); shake(0.2, 0.6); toastSay(msg, 2.6);
  }

  /* ============================== COMBAT ================================ */
  // Aim assist: holding SHOOT locks onto the best enemy in ANY direction (closest, preferring what's
  // in front), keeps that lock while it's valid, and bolts home in on it. No manual aiming needed.
  function canSee(e, d) {
    if (d < 4) return true;
    tmpV.set(P.pos.x, P.pos.y + 1.3, P.pos.z);
    tmpV2.set(e.pos.x - P.pos.x, e.pos.y + (e.type === 'goblin' ? 1.15 : 0) - P.pos.y - 1.3, e.pos.z - P.pos.z).normalize();
    ray.set(tmpV, tmpV2); ray.far = d; return ray.intersectObjects(W.rayMeshes, false).length === 0;
  }
  function findTarget(shooting) {
    const range = shooting ? 22 : 16, cone = shooting ? Math.PI : 1.6;
    const cur = P.target;
    if (cur && cur.alive) {
      const d = Math.hypot(cur.pos.x - P.pos.x, cur.pos.z - P.pos.z);
      if (d < range + 2 && Math.abs(cur.pos.y - P.pos.y) < 7 && canSee(cur, d)) {
        // keep the lock unless something is right in our face
        let closer = null;
        for (const e of enemies) if (e.alive && e !== cur && Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < Math.min(3.5, d * 0.5)) closer = e;
        if (!closer) return cur;
      }
    }
    let best = null, bd = 1e9;
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz);
      if (d > range || Math.abs(e.pos.y - P.pos.y) > 7) continue;
      const ref = P.speed > 0.5 ? P.facing : cam.yaw + Math.PI;
      const a = Math.abs(angDiff(ref, Math.atan2(dx, dz)));
      if (a > cone) continue;
      if (!canSee(e, d)) continue;
      const score = d + a * 2.5; if (score < bd) { bd = score; best = e; }
    }
    return best;
  }
  function fireBolt() {
    P.shootCd = 0.15; P.gun = 1 - P.gun;
    const b = bolts.find(q => q.life <= 0); if (!b) return;
    const side = P.gun ? 1 : -1, f = P.facing;
    b.m.position.set(P.pos.x + Math.sin(f) * 0.5 + Math.cos(f) * 0.2 * side, P.pos.y + 1.3, P.pos.z + Math.cos(f) * 0.5 - Math.sin(f) * 0.2 * side);
    b.target = P.target && P.target.alive ? P.target : null;
    if (b.target) tmpV.set(b.target.pos.x, b.target.pos.y + (b.target.type === 'goblin' ? 1.05 : 0), b.target.pos.z).sub(b.m.position).normalize();
    else tmpV.set(Math.sin(f), 0, Math.cos(f));
    b.vel.copy(tmpV).multiplyScalar(30); b.life = 1.0; b.m.visible = true;
    AU.sfx('whip');
  }
  function killEnemy(e) {
    e.alive = false; e.dying = 0.35; stats.kills++;
    const c = e.type === 'goblin' ? ['#5fcf4a', '#2f7d32', '#ffffff', '#14F195'] : ['#6d2cb0', '#e94b3c', '#ffffff'];
    burst(e.pos.x, e.pos.y + 0.7, e.pos.z, 30, c, 6);
    floatText(rpick(e.type === 'goblin' ? ['-FUD!', 'BONK!', 'YEET!', 'FUD REKT'] : ['UN-RUGGED!', 'BYE BAT!', 'YEET!']), tmpV2.set(e.pos.x, e.pos.y + 1.8, e.pos.z), '#ffffff');
    AU.sfx('stomp'); shake(0.1, 0.15); if (Math.random() < 0.5) bark('kill');
    if (Math.random() < 0.6) { W.coins.push({ x: e.pos.x, y: Math.max(e.pos.y, groundAt(e.pos.x, e.pos.z, e.pos.y + 1)) + 0.8, z: e.pos.z, taken: false, ph: 0 }); W.totalCoins++; growCoins(); }
  }
  function growCoins() {
    if (W.coins.length <= coinMesh.count && coinMesh.instanceMatrix.count >= W.coins.length) return;
    const nm = new THREE.InstancedMesh(coinMesh.geometry, coinMesh.material, W.coins.length + 8); nm.frustumCulled = false;
    worldGroup.remove(coinMesh); coinMesh = nm; worldGroup.add(nm);
  }
  function updateBolts(dt) {
    for (const b of bolts) {
      if (b.life <= 0) continue;
      b.life -= dt;
      if (b.target && b.target.alive) {
        const t = b.target; tmpV.set(t.pos.x, t.pos.y + (t.type === 'goblin' ? 1.05 : 0), t.pos.z).sub(b.m.position).normalize().multiplyScalar(30);
        b.vel.lerp(tmpV, Math.min(1, dt * 16));
      }
      b.m.position.addScaledVector(b.vel, dt);
      const p = b.m.position; let dead = b.life <= 0;
      for (const e of enemies) {
        if (!e.alive) continue;
        const cy = e.type === 'goblin' ? e.pos.y + 0.85 : e.pos.y, rr = e.type === 'goblin' ? 0.85 : 0.7;
        if ((p.x - e.pos.x) ** 2 + (p.y - cy) ** 2 + (p.z - e.pos.z) ** 2 < rr * rr) {
          e.hp--; e.hitT = 0.15; dead = true;
          burst(p.x, p.y, p.z, 8, ['#14F195', '#ffffff'], 3, { life: 0.3 });
          if (e.hp <= 0) killEnemy(e); else { AU.sfx('hit'); tmpV.copy(b.vel).normalize(); e.vel.x += tmpV.x * 3; e.vel.z += tmpV.z * 3; }
          break;
        }
      }
      if (!dead) for (const s of W.solids) {
        if (s.active && p.x > s.min.x && p.x < s.max.x && p.y > s.min.y && p.y < s.max.y && p.z > s.min.z && p.z < s.max.z) {
          dead = true; burst(p.x, p.y, p.z, 5, ['#14F195', '#b47bff'], 2, { life: 0.25 }); break;
        }
      }
      if (dead) { b.life = 0; b.m.visible = false; }
    }
  }

  /* ============================== ENTITIES ============================== */
  function updateEnemies(dt) {
    const playing = state === 'play';
    for (const e of enemies) {
      e.t += dt;
      if (!e.alive) {
        if (e.dying > 0) { e.dying -= dt; const s = Math.max(0.01, e.dying / 0.35); e.R.root.scale.set(1 + (1 - s), s, 1 + (1 - s)); if (e.dying <= 0) e.R.root.visible = false; }
        continue;
      }
      const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, d = Math.hypot(dx, dz);
      if (d > 45) continue;
      if (e.hitT > 0) { e.hitT -= dt; const s = 1 + e.hitT * 2; e.R.root.scale.set(s, 1 / s, s); } else e.R.root.scale.set(1, 1, 1);
      e.attackCd -= dt;
      if (e.type === 'goblin') {
        let moving = false;
        if (playing && d < 13 && Math.abs(P.pos.y - e.pos.y) < 2.5 && P.st !== 'dead') {
          const sp = 2.6, mx = dx / d * sp * dt, mz = dz / d * sp * dt;
          const nx = e.pos.x + mx + e.vel.x * dt, nz = e.pos.z + mz + e.vel.z * dt;
          const g = groundAt(nx, nz, e.pos.y + 0.4);
          if (g > e.pos.y - 0.6 && g < e.pos.y + 0.45 && !boxBlocked(nx, g + 0.4, nz, 0.35, 0.8)) { e.pos.x = nx; e.pos.z = nz; e.pos.y = g; moving = true; }
          e.yaw = lerpAngle(e.yaw, Math.atan2(dx, dz), Math.min(1, dt * 8));
          if (d < 0.95 && Math.abs(P.pos.y - e.pos.y) < 1.3) { hurt(e.pos); e.attackCd = 1; }
        } else { e.yaw += Math.sin(e.t * 0.7) * dt * 0.8; }
        e.vel.multiplyScalar(Math.max(0, 1 - dt * 6));
        e.R.root.rotation.y = e.yaw;
        MD.animateGoblin(e.R, e.t, moving);
      } else {
        let tx, ty, tz;
        if (playing && d < 12 && P.st !== 'dead') {
          const sw = Math.sin(e.t * 2.4);
          tx = P.pos.x + Math.cos(e.t * 1.7) * 1.5 - e.pos.x; tz = P.pos.z + Math.sin(e.t * 1.7) * 1.5 - e.pos.z; ty = (P.pos.y + 1.3 + sw * 1.2) - e.pos.y;
          if (e.attackCd > 0) { tx = -tx; tz = -tz; ty = 2; }
          const l = Math.hypot(tx, ty, tz) || 1; tx = tx / l * 4.6; ty = ty / l * 4.6; tz = tz / l * 4.6;
        } else {
          tx = (e.home.x - e.pos.x) * 1.2 + Math.cos(e.t) * 1.2; ty = (e.home.y - e.pos.y) * 1.2 + Math.sin(e.t * 2) * 0.8; tz = (e.home.z - e.pos.z) * 1.2 + Math.sin(e.t * 0.9) * 1.2;
        }
        const k = Math.min(1, dt * 2.5);
        e.vel.x += (tx - e.vel.x) * k; e.vel.y += (ty - e.vel.y) * k; e.vel.z += (tz - e.vel.z) * k;
        e.pos.addScaledVector(e.vel, dt);
        e.R.root.rotation.y = Math.atan2(e.vel.x, e.vel.z);
        MD.animateBat(e.R, e.t);
        if (playing && e.attackCd <= 0 && Math.hypot(dx, dz) < 0.7 && Math.abs(e.pos.y - (P.pos.y + 1)) < 1) { hurt(e.pos); e.attackCd = 1.4; }
      }
    }
  }

  function updateWorld(dt) {
    const p = P, playing = state === 'play', t = G.t;
    // coins
    const s = tmpS;
    for (let i = 0; i < W.coins.length; i++) {
      const c = W.coins[i];
      if (c.taken) { s.set(0, 0, 0); }
      else {
        s.set(1, 1, 1);
        if (playing && (c.x - p.pos.x) ** 2 + (c.z - p.pos.z) ** 2 < 0.55 && c.y > p.pos.y - 0.3 && c.y < p.pos.y + PH.h + 0.3) {
          c.taken = true; p.sol++; AU.sfx('coin'); burst(c.x, c.y, c.z, 10, ['#14F195', '#9945FF', '#ffffff'], 2.5, { grav: 0, life: 0.4 });
          if (p.sol % 5 === 0) floatText('+' + p.sol + ' SOL', tmpV2.set(c.x, c.y + 0.6, c.z), '#14F195');
          s.set(0, 0, 0);
        }
      }
      tmpQ.setFromAxisAngle(UP, t * 3 + c.ph);
      tmpV.set(c.x, c.y + Math.sin(t * 3 + c.ph) * 0.08, c.z);
      tmpM.compose(tmpV, tmpQ, s); coinMesh.setMatrixAt(i, tmpM);
    }
    coinMesh.count = W.coins.length; coinMesh.instanceMatrix.needsUpdate = true;
    // clues
    for (const c of W.clues) {
      if (c.taken) continue;
      c.mesh.rotation.y = t * 1.5; c.mesh.position.y = c.y + Math.sin(t * 2) * 0.12; c.halo.rotation.z = t;
      if (playing && Math.hypot(c.x - p.pos.x, c.z - p.pos.z) < 0.9 && Math.abs(c.y - (p.pos.y + 0.9)) < 1.3) {
        c.taken = true; c.mesh.visible = false; p.clues++; AU.sfx('clue'); shake(0.15, 0.25);
        burst(c.x, c.y, c.z, 40, ['#ffde3a', '#ffffff', '#14F195'], 5, { grav: 3 });
        floatText('CLUE ' + p.clues + '/3!', tmpV2.set(c.x, c.y + 0.8, c.z), '#ffde3a');
        const clueTxt = CFG.CLUES[(p.clues - 1) % CFG.CLUES.length];
        toast(clueTxt + (p.clues >= 3 ? '  —  ' + CFG.ALL_CLUES : ''), 4.5);
        AU.say(clueTxt, 'aaliyah', null, p.clues >= 3 ? () => AU.say(CFG.ALL_CLUES, 'aaliyah') : null);
        W.sockets[p.clues - 1].material.color.set(0xffde3a); W.sockets[p.clues - 1].material.emissive = new THREE.Color(0xaa7700);
      }
    }
    for (const h of W.hearts) {
      if (h.taken) continue; h.mesh.rotation.y = t * 2;
      if (playing && Math.hypot(h.x - p.pos.x, h.z - p.pos.z) < 0.9 && Math.abs(h.y - (p.pos.y + 0.9)) < 1.3) {
        h.taken = true; h.mesh.visible = false; p.hearts = Math.min(CFG.START_HEARTS, p.hearts + 1); AU.sfx('heart'); floatText('+1 HEART', tmpV2.set(h.x, h.y + 0.6, h.z), '#ff6b81');
      }
    }
    // checkpoints
    for (const k of W.checkpoints) {
      k.flame.scale.set(1, 1 + Math.sin(t * 13 + k.z) * 0.15, 1);
      if (!k.lit && playing && p.pos.z < k.z + 0.5 && p.st === 'move' && p.onGround) {
        k.lit = true; respawn = { x: k.x + 1.2 * Math.sign(-k.x || 1), y: k.y, z: k.z };
        k.flame.material.color.set(0x14f195); k.flame.material.emissive.set(0x9945ff); k.flame.scale.setScalar(1.4);
        if (k.z < W.start.z - 2) { AU.sfx('checkpoint'); const ct = rpick(CFG.CHECKPOINT); AU.bark(ct); floatText(ct, tmpV2.set(k.x, 2.4, k.z), '#ffde3a'); }
        burst(k.x, 1.8, k.z, 20, ['#14F195', '#9945FF'], 2.5, { grav: -2 });
      }
    }
    for (const f of W.flames) f.scale.y = 1 + Math.sin(t * 15 + f.position.x * 3 + f.position.z) * 0.18;
    // section hints
    for (const sct of W.sections) if (!sct.seen && playing && p.pos.z < sct.z) { sct.seen = true; if (CFG.HINTS[sct.id]) toastSay(CFG.HINTS[sct.id], 3.6); }
    // lava scroll
    W.textures.lava.offset.y = (t * 0.03) % 1; W.textures.lava.offset.x = Math.sin(t * 0.3) * 0.05;
    // levers
    for (const l of W.levers) { l.piv.rotation.x += ((l.on ? 0.7 : -0.7) - l.piv.rotation.x) * Math.min(1, dt * 10); l.mark.visible = !l.on; l.mark.position.y = 1.7 + Math.sin(t * 4) * 0.12; l.mark.rotation.y = t * 2; if (l.on) l.knob.material.color.set(0x14f195); }
    // gates + door
    for (const g of [W.gate1, W.gate2]) if (g && g.opening && g.active) {
      const d = 2.6 * dt; g.min.y += d; g.max.y += d; g.mesh.position.y += d; if (g.min.y >= 4.3) g.active = false;
    }
    if (W.door.opening && W.door.active) { const d = 1.4 * dt; W.door.max.y -= d; W.door.mesh.position.y -= d; shake(0.05, 0.05); if (W.door.max.y <= 0.05) W.door.active = false; }
    // block / plate
    const b = W.block; b.mesh.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
    const bcx = (b.min.x + b.max.x) / 2;
    if (!b.locked && Math.abs(bcx - W.plate.x) < 0.3) {
      b.locked = true; const off = W.plate.x - bcx; b.min.x += off; b.max.x += off; W.plate.mesh.material.color.set(0x14f195);
      W.plate.mesh.position.y = 0.01; openGate(W.gate2, CFG.PLATE); burst(W.plate.x, 1, W.plate.z, 30, ['#14F195', '#ffde3a'], 4);
    }
    plateMsgCd -= dt;
    if (playing && !b.locked && plateMsgCd <= 0 && Math.abs(p.pos.x - W.plate.x) < 0.75 && Math.abs(p.pos.z - W.plate.z) < 0.75 && p.pos.y < 0.3) {
      plateMsgCd = 3; toast('Too light! It needs something heavier... like that block.', 2.6);
    }
    // collapsing tiles
    for (const tl of W.tiles) {
      if (tl.state === 0 && p.ground === tl) { tl.state = 1; tl.t = 1.2; AU.sfx('rumble'); }
      else if (tl.state === 1) { tl.t -= dt; tl.mesh.position.x = tl.home.x + (Math.random() - 0.5) * 0.08; if (tl.t <= 0) { tl.state = 2; tl.active = false; tl.vy = 0; } }
      else if (tl.state === 2) { tl.vy += 20 * dt; tl.mesh.position.y -= tl.vy * dt; if (tl.mesh.position.y < -4) { tl.state = 3; tl.t = 3.5; tl.mesh.visible = false; } }
      else if (tl.state === 3) { tl.t -= dt; if (tl.t <= 0) { tl.state = 0; tl.active = true; tl.mesh.visible = true; tl.mesh.position.set(tl.home.x, -0.25, tl.home.z); } }
    }
    // timed spikes
    for (const sp of W.spikes) {
      const up = sp.static || ((t + sp.phase) % sp.period) < sp.period * 0.5;
      if (!sp.static) {
        sp.group.position.y += ((up ? 0 : -0.58) - sp.group.position.y) * Math.min(1, dt * (up ? 25 : 8));
        if (up && !sp.up) AU.sfx('whip');
      }
      sp.up = up;
      if (playing && up && sp.group.position.y > -0.25 && p.pos.x > sp.min.x - 0.2 && p.pos.x < sp.max.x + 0.2 && p.pos.z > sp.min.z - 0.15 && p.pos.z < sp.max.z + 0.15 && p.pos.y < 0.45) {
        if (P.inv <= 0) hurt(tmpV2.set(p.pos.x, 0, p.pos.z + 1)); P.vel.y = 7.5; P.onGround = false;
      }
    }
    // blades
    for (const bl of W.blades) {
      const a = Math.sin(t * bl.speed + bl.phase) * 1.15; bl.piv.rotation.z = a;
      const bx = Math.sin(a) * bl.len, by = 6 - Math.cos(a) * bl.len;
      if (playing && Math.abs(p.pos.z - bl.z) < 0.55 && Math.hypot(p.pos.x - bx, (p.pos.y + 0.9) - by) < 1.15) {
        if (P.inv <= 0) { hurt(tmpV2.set(bx, 0, bl.z - 1)); P.vel.x += Math.cos(a) * Math.sign(Math.cos(t * bl.speed + bl.phase)) * 4; }
      }
    }
    // darts
    for (const em of W.dartEmitters) {
      em.t -= dt;
      if (em.t <= 0 && Math.abs(p.pos.z - em.z) < 16) {
        em.t = em.period; const d = darts.find(q => q.life <= 0);
        if (d) { d.m.position.set(em.x, em.y, em.z); d.vx = em.dir * 11; d.life = 0.6; d.m.visible = true; if (Math.abs(p.pos.z - em.z) < 6) AU.sfx('whip'); }
      }
    }
    for (const d of darts) {
      if (d.life <= 0) continue; d.life -= dt; d.m.position.x += d.vx * dt;
      const q = d.m.position;
      if (playing && Math.abs(q.x - p.pos.x) < 0.4 && Math.abs(q.z - p.pos.z) < 0.4 && q.y > p.pos.y && q.y < p.pos.y + PH.h) { hurt(tmpV2.set(q.x - d.vx, 0, q.z)); d.life = 0; }
      if (d.life <= 0) d.m.visible = false;
    }
    // balloons
    if (W.balloons) for (const bb of W.balloons) bb.m.position.y = bb.y + Math.sin(t * 1.5 + bb.ph) * 0.2;
    // door proximity
    doorMsgCd -= dt;
    if (playing && W.door.active && !W.door.opening && Math.abs(p.pos.x) < 2.5 && p.pos.z < -205 && p.pos.z > -210.5) {
      if (p.clues >= 3) { W.door.opening = true; AU.sfx('door'); shake(0.3, 1.4); toastSay(CFG.DOOR_OPEN, 2.6); burst(0, 2, -207.6, 50, ['#ffde3a', '#14F195', '#ffffff'], 6); }
      else if (doorMsgCd <= 0) { doorMsgCd = 5; toastSay(CFG.DOOR_LOCKED, 3); AU.sfx('lever'); }
    }
    // Teevincs
    if (playing && Math.hypot(p.pos.x - W.teevincs.x, p.pos.z - W.teevincs.z) < 2.3) startOutro();
    // boulder
    updateBoulder(dt);
    if (playing && TIMED && timeLeft < 30 && !lowWarned) { lowWarned = true; toast(CFG.LOW_TIME, 2.4); AU.setTempo(190); }
  }

  function updateBoulder(dt) {
    const B = W.boulderState, cfg = W.boulder, p = P;
    if (state !== 'play') return;
    if (!B.triggered && !B.done && p.pos.z < cfg.triggerZ && p.pos.z > cfg.pitZ0) {
      B.triggered = true;
      const geo = new THREE.SphereGeometry(1.9, 18, 14);
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: MD.canvasTex(256, 128, g => {
        g.fillStyle = '#8b7560'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#a58c73';
        for (let i = 0; i < 30; i++) { g.beginPath(); g.arc((i * 47) % 256, (i * 29) % 128, 8 + i % 10, 0, 7); g.fill(); }
        g.strokeStyle = '#5c4a3a'; g.lineWidth = 5; g.beginPath(); g.moveTo(10, 20); g.lineTo(60, 60); g.lineTo(40, 110); g.moveTo(150, 10); g.lineTo(190, 70); g.stroke();
        g.fillStyle = '#c4161c'; g.font = 'bold 44px Bungee, Impact, sans-serif'; g.textAlign = 'center'; g.fillText('FUD', 128, 80);
      }) }));
      m.castShadow = SHADOWS; m.position.set(0, 9, cfg.startZ); worldGroup.add(m);
      B.mesh = m; B.v = 1.5; B.vy = 0; B.falling = true; B.pit = false;
      slam(CFG.CHASE_START); AU.setTempo(205); rumbleT = 0; AU.stopVoice(); bark('boulder');
    }
    if (!B.triggered || B.done || !B.mesh) return;
    const m = B.mesh, r = 1.9;
    if (B.falling) { B.vy -= 30 * dt; m.position.y += B.vy * dt; if (m.position.y <= r) { m.position.y = r; B.falling = false; AU.sfx('crash'); shake(0.6, 0.6); burst(0, 0.3, m.position.z, 40, ['#8a4c22', '#c27e45', '#f3d9a4'], 6); } }
    else if (!B.pit) {
      B.v = Math.min(B.v + 1.6 * dt, 6.2); m.position.z -= B.v * dt; m.rotation.x -= B.v * dt / r;
      if (m.position.z < cfg.pitZ0 - 0.8) B.pit = true;
    } else { B.vy -= 30 * dt; m.position.y += B.vy * dt; m.position.z -= B.v * 0.5 * dt; if (m.position.y < -4) { B.done = true; worldGroup.remove(m); B.mesh = null; AU.sfx('crash'); shake(0.7, 0.8); toastSay(CFG.CHASE_END, 2.4); AU.setTempo(172); burst(0, -0.5, cfg.pitZ0 - 1.5, 60, ['#ff5a1f', '#ffd23f', '#8a4c22'], 8, { lift: 4 }); return; } }
    rumbleT -= dt; if (rumbleT <= 0) { rumbleT = 0.42; AU.sfx('rumble'); }
    if (!B.falling) shake(0.06, 0.05);
    // smash hurdles
    for (const h of W.hurdles) if (h.active && m.position.z - r < h.max.z && m.position.z > h.min.z - r) { h.active = false; h.mesh.visible = false; burst(0, 0.5, h.min.z, 30, ['#c27e45', '#8a4c22', '#f3d9a4'], 6); AU.sfx('crash'); }
    // hit player
    const dy = (p.pos.y + 0.9) - m.position.y, dz = p.pos.z - m.position.z, dx = p.pos.x - m.position.x;
    if (dx * dx + dy * dy + dz * dz < (r + 0.35) ** 2) {
      if (P.inv <= 0) { hurt(tmpV2.set(m.position.x, 0, m.position.z + 3)); B.v = 1.5; }
      if (!B.pit && p.pos.z > m.position.z - r - 0.6) p.pos.z = m.position.z - r - 0.6;
    }
  }

  /* =============================== CAMERA =============================== */
  function snapCamera() { updateCamera(1, true); }
  function updateCamera(dt, snap) {
    if (!P) return;
    const manual = Math.abs(camIn.dx) + Math.abs(camIn.dy) > 0;
    if (state === 'play') {
      if (manual) { cam.yaw -= camIn.dx * 0.0042; cam.pitch = clamp(cam.pitch + camIn.dy * 0.003, -0.25, 1.15); cam.lastManual = G.t; }
      if (keys.camL) { cam.yaw += dt * 2.2; cam.lastManual = G.t; }
      if (keys.camR) { cam.yaw -= dt * 2.2; cam.lastManual = G.t; }
      if (held.shoot && P.target && P.target.alive && G.t - cam.lastManual > 0.6) cam.yaw = lerpAngle(cam.yaw, P.facing + Math.PI, Math.min(1, dt * 3));
      // auto-follow behind the player while running forward-ish
      if (G.t - cam.lastManual > 0.7 && P.speed > 1.5 && (P.st === 'move' || P.st === 'mantle')) {
        const behind = P.facing + Math.PI, d = Math.abs(angDiff(cam.yaw, behind));
        if (d < 2.4) cam.yaw = lerpAngle(cam.yaw, behind, Math.min(1, dt * 2.4));
      }
      if (P.st === 'hang' || P.st === 'climb') cam.pitch += (0.15 - cam.pitch) * Math.min(1, dt * 2);
      cam.dist += (5.2 - cam.dist) * Math.min(1, dt * 3);
    } else if (state === 'intro') {
      cam.yaw = Math.PI - 0.6 + Math.min(1.2, introT * 0.06); cam.dist = 3.4; cam.pitch = 0.1;
    } else if (state === 'outro' || state === 'results') {
      cam.yaw = lerpAngle(cam.yaw, Math.PI / 2 + 0.35 + Math.sin(G.t * 0.2) * 0.2, Math.min(1, dt * 2)); cam.dist += (5.5 - cam.dist) * Math.min(1, dt * 2); cam.pitch += (0.18 - cam.pitch) * Math.min(1, dt * 2);
    }
    camIn.dx = camIn.dy = 0;
    const tgt = tmpV;
    if (state === 'outro' || state === 'results') tgt.set((P.pos.x + W.teevincs.x) / 2, 1.3, (P.pos.z + W.teevincs.z) / 2);
    else tgt.set(P.pos.x, P.pos.y + (state === 'intro' ? 1.35 : 1.5), P.pos.z);
    cam.look.lerp(tgt, snap ? 1 : Math.min(1, dt * 14));
    const cp = Math.cos(cam.pitch), dir = tmpV2.set(Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp);
    let dist = cam.dist;
    ray.set(cam.look, dir); ray.far = dist + 0.3;
    const hits = ray.intersectObjects(W.rayMeshes, false);
    if (hits.length) dist = Math.max(0.9, hits[0].distance - 0.35);
    const want = new THREE.Vector3().copy(cam.look).addScaledVector(dir, dist);
    if (snap) cam.pos.copy(want); else cam.pos.lerp(want, Math.min(1, dt * 12));
    camera.position.copy(cam.pos);
    if (G.shakeT > 0) camera.position.add(tmpV2.set((Math.random() - 0.5) * G.shakeMag, (Math.random() - 0.5) * G.shakeMag, (Math.random() - 0.5) * G.shakeMag));
    camera.lookAt(cam.look);
    fill.position.copy(camera.position); fill.target.position.copy(cam.look);
    if (SHADOWS) { sunL.position.set(P.pos.x + 8, P.pos.y + 18, P.pos.z + 6); sunL.target.position.set(P.pos.x, P.pos.y, P.pos.z); }
  }

  /* ============================= PLAYER MODEL ============================ */
  let blob = null;
  function setupPlayerModel() {
    rig = MD.makeAaliyah();
    blob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; rig.blob = blob;
    if (CFG.MODEL && CFG.MODEL.aaliyah) loadGLTF(CFG.MODEL.aaliyah, CFG.MODEL.aaliyahScale || 1, CFG.MODEL.aaliyahYaw || 0, m => { gltf = m; rig.root.visible = false; if (worldGroup) worldGroup.add(m.root); });
  }
  function playerPose() {
    if (state === 'intro') return P.pos.z > W.start.z + 0.05 ? 'run' : 'panic';
    if (state === 'outro' || state === 'results') return tipping ? 'celebrate' : (Math.abs(P.pos.z - (W.teevincs.z + 1.8)) > 0.05 ? 'run' : 'idle');
    if (state === 'gameover') return 'dead';
    if (P.hurtT > 0) return 'hurt';
    if (P.st === 'hang') return 'hang';
    if (P.st === 'mantle' || P.st === 'climb') return 'climb';
    if (!P.onGround) return P.vel.y > 0 ? 'jump' : 'fall';
    if (P.speed > 0.4) return 'run';
    return 'idle';
  }
  function updatePlayerModel(dt) {
    const pose = playerPose(), root = (gltf ? gltf.root : rig.root);
    root.position.copy(P.pos); root.rotation.y = P.facing;
    const vis = !(state === 'play' && P.inv > 0 && Math.floor(P.inv * 14) % 2 === 0);
    if (gltf) { gltf.root.visible = vis; gltfPose(gltf, P.shootT > 0 && pose === 'idle' ? 'shoot' : pose, dt); }
    else { rig.root.visible = vis; MD.animateAaliyah(rig, pose, P.animT, dt, { speed: P.speed, shooting: P.shootT > 0 }); }
    if (!blob.parent && worldGroup) worldGroup.add(blob);
    const gy = groundAt(P.pos.x, P.pos.z, P.pos.y + 0.05);
    blob.visible = !SHADOWS && gy > -50; blob.position.set(P.pos.x, gy + 0.02, P.pos.z);
    const hgt = P.pos.y - gy; blob.scale.setScalar(clamp(1 - hgt * 0.15, 0.4, 1));
    // reticle
    if (reticle) {
      const tg = state === 'play' && P.target && P.target.alive ? P.target : null;
      reticle.visible = !!tg;
      if (tg) { reticle.position.set(tg.pos.x, tg.pos.y + (tg.type === 'goblin' ? 0.8 : 0), tg.pos.z); reticle.lookAt(camera.position); reticle.rotation.z = G.t * 2; reticle.material.color.set(held.shoot ? 0xff3b5c : 0xffde3a); }
    }
    updateGuide();
    // Teevincs
    teev.root.rotation.y = 0;
    MD.animateTeevincs(teev, teev.pose, G.t, dt);
    if (teev.gltf) gltfPose(teev.gltf, teev.pose === 'party' ? 'celebrate' : 'idle', dt);
  }

  /* ================================ UPDATE ================================ */
  function update(dt, inp) {
    G.t += dt;
    if (G.shakeT > 0) { G.shakeT -= dt; if (G.shakeT <= 0) G.shakeMag = 0; }
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) toastEl.classList.remove('show'); }
    if (slamTimer > 0) { slamTimer -= dt; if (slamTimer <= 0) slamEl.classList.remove('go'); }
    if (!W) return;
    if (state === 'intro') {
      introT += dt; P.animT += dt;
      if (P.pos.z > W.start.z) { P.pos.z = Math.max(W.start.z, P.pos.z - 6 * dt); P.speed = 6; if (P.pos.z <= W.start.z) { shake(0.12, 0.2); burst(P.pos.x, 0.1, P.pos.z, 14, ['#f3d9a4', '#ffffff'], 3, { grav: 3 }); } }
      else { P.speed = 0; if (!DLG.active && introLines) { const l = introLines; introLines = null; startDialogue(l, beginPlay); } }
      updateDialogue(dt);
      updateWorld(dt);
    } else if (state === 'play') {
      stats.time += dt; timeLeft -= dt;
      updatePlayer(dt, inp);
      if (state === 'play') { updateEnemies(dt); updateBolts(dt); updateWorld(dt); }
      if (state === 'play' && P.pos.y < W.killY) pitFall();
      if (state === 'play' && TIMED && timeLeft <= 0) gameOver('time');
    } else if (state === 'outro' || state === 'results') {
      outroT += dt; P.animT += dt;
      const tz = W.teevincs.z + 1.8, tx = W.teevincs.x;
      const dz = tz - P.pos.z, dx = tx - P.pos.x, d = Math.hypot(dx, dz);
      if (d > 0.05) { const st = Math.min(d, 3.5 * dt); P.pos.x += dx / d * st; P.pos.z += dz / d * st; P.speed = 3.5; P.facing = Math.atan2(dx, dz); }
      else { P.speed = 0; P.facing = lerpAngle(P.facing, Math.PI, Math.min(1, dt * 6)); }
      P.pos.y = Math.max(0, P.pos.y - dt * 4);
      updateDialogue(dt);
      updateEnemies(dt); updateWorld(dt);
      if (tipping) updateFountain(dt);
    } else if (state === 'gameover') { updateEnemies(dt); }
    updateParticles(dt);
  }
  function updateFountain(dt) {
    tipT += dt;
    if (tipT < 4 && fountainCoins.length < 90 && Math.random() < 0.9) {
      const a = (Math.random() - 0.5) * 1.2;
      fountainCoins.push({ x: P.pos.x, y: P.pos.y + 1.5, z: P.pos.z, vx: Math.sin(a) * 2, vy: 7 + Math.random() * 4, vz: -2.2 - Math.random() * 2, r: Math.random() * 6, life: 3 });
      if (Math.random() < 0.3) AU.sfx('tip');
    }
    if (Math.random() < 0.7) burst(W.teevincs.x + (Math.random() - 0.5) * 10, 7, W.teevincs.z + (Math.random() - 0.5) * 6, 3, ['#ffde3a', '#14F195', '#9945FF', '#ff5e8a', '#00C2FF'], 1, { grav: 1.5, life: 3.5 });
    let n = 0;
    for (const c of fountainCoins) {
      c.life -= dt; if (c.life <= 0) continue;
      c.vy -= 14 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.r += dt * 10;
      if (c.y < 0.15) { c.y = 0.15; c.vy *= -0.4; c.vx *= 0.6; c.vz *= 0.6; }
      tmpQ.setFromEuler(new THREE.Euler(c.r, c.r * 0.7, 0)); tmpV.set(c.x, c.y, c.z);
      tmpM.compose(tmpV, tmpQ, tmpS.set(0.7, 0.7, 0.7)); fountain.setMatrixAt(n++, tmpM);
    }
    fountain.count = n; fountain.instanceMatrix.needsUpdate = true;
  }

  /* ================================= LOOP ================================= */
  let last = performance.now(), acc = 0, lastCine = null;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const inp = readInput();
    if (!paused && state !== 'title') {
      acc += dt; let n = 0;
      while (acc >= STEP && n < 6) { update(STEP, inp); acc -= STEP; n++; for (const k in pressed) pressed[k] = false; }
      if (n >= 6) acc = 0;
      if (W && P) { updatePlayerModel(dt); updateCamera(dt); updateFloats(dt); if (state === 'play') updateHUD(); }
    } else { acc = 0; for (const k in pressed) pressed[k] = false; }
    if (state === 'title') titleSpin(dt);
    const cine = state === 'intro' || state === 'outro' || state === 'results';
    if (cine !== lastCine) { lastCine = cine; document.body.classList.toggle('cine', cine); }
    renderer.render(scene, camera);
  }

  /* ================================ TITLE ================================= */
  let titleRig = null;
  function titleSpin(dt) {
    G.t += dt;
    if (!titleRig) {
      scene.background = new THREE.Color(0x1b0b3a);
      titleRig = MD.makeAaliyah(); scene.add(titleRig.root);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.4, 24), MD.mat('ped', { color: 0x9945ff })); ped.position.y = -0.2; scene.add(ped); titleRig.ped = ped;
      camera.position.set(0, 1.3, 4); camera.lookAt(0, 1, 0);
    }
    titleRig.root.rotation.y = Math.sin(G.t * 0.6) * 0.35 - 0.2;
    MD.animateAaliyah(titleRig, 'idle', G.t, dt, {});
    const wide = innerWidth > innerHeight, ox = wide ? 1.15 * innerWidth / innerHeight * 0.85 : 0, oy = wide ? 0 : -0.55;
    camera.position.set(ox, 1.15 + oy, 3.3); camera.lookAt(ox, 0.95 + oy, 0);
    fill.position.set(0.5, 2, 4); fill.target.position.set(0, 1, 0); fill.intensity = 0.8;
  }
  function removeTitleScene() { fill.intensity = 0.35; if (titleRig) { scene.remove(titleRig.root); scene.remove(titleRig.ped); titleRig = null; } }

  /* ================================= BOOT ================================= */
  function boot() {
    // placeholder Teevincs portrait rendered from the 3D model
    try {
      const rt = new THREE.WebGLRenderTarget(256, 256), sc = new THREE.Scene(), tv = MD.makeTeevincs();
      sc.background = new THREE.Color(0x9945ff); sc.add(new THREE.HemisphereLight(0xffffff, 0x6644aa, 1.1)); sc.add(tv.root);
      const cm = new THREE.PerspectiveCamera(30, 1, 0.1, 20); cm.position.set(0, 1.75, 1.6); cm.lookAt(0, 1.68, 0);
      renderer.setRenderTarget(rt); renderer.render(sc, cm); renderer.setRenderTarget(null);
      const px = new Uint8Array(256 * 256 * 4); renderer.readRenderTargetPixels(rt, 0, 0, 256, 256, px);
      const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), id = g.createImageData(256, 256);
      for (let y = 0; y < 256; y++) id.data.set(px.subarray((255 - y) * 1024, (256 - y) * 1024), y * 1024);
      g.putImageData(id, 0, 0); teevPortrait = c.toDataURL();
    } catch (e) { teevPortrait = null; }
    $('title-h1').innerHTML = CFG.TITLE + '<span>' + CFG.TITLE_SUB + '</span>';
    $('title-tag').textContent = CFG.TAGLINE; $('title-portrait').src = CFG.PORTRAITS.aaliyah;
    document.title = CFG.TITLE + ' ' + CFG.TITLE_SUB;
    $('btn-mute').textContent = AU.muted ? '🔇' : '🔊'; $('btn-mute2').textContent = AU.muted ? 'SOUND: OFF' : 'SOUND: ON';
    const go = intro => () => startFromTitle(intro);
    $('btn-start').onclick = go(true); $('btn-quick').onclick = go(false);
    $('btn-retry').onclick = () => { AU.unlock(); startRun(false); };
    $('btn-again').onclick = () => { AU.unlock(); startRun(!!CFG.INTRO_ON_REPLAY); };
    $('btn-resume').onclick = () => togglePause();
    $('btn-restart').onclick = () => { paused = false; AU.resume(); startRun(false); };
    $('btn-pause').onclick = e => { e.stopPropagation(); togglePause(); };
    $('btn-mute').onclick = e => { e.stopPropagation(); toggleMute(); };
    $('btn-mute2').onclick = () => toggleMute();
    $('skip').onclick = e => {
      e.stopPropagation();
      AU.stopVoice();
      if (state === 'intro') { introLines = null; DLG.done = null; DLG.active = false; beginPlay(); }
      else if (state === 'outro') { DLG.active = false; DLG.done = null; DLG.el.className = ''; showResults(); }
    };
    AU.loadVoices().then(() => AU.preloadVoices(CFG.INTRO.map(l => [l.who || 'narrator', l.text])
      .concat((CFG.INTRO_RANDOM || []).map(t => ['aaliyah', t])).concat(CFG.OUTRO.map(l => [l.who || 'narrator', l.text]))));
    requestAnimationFrame(frame);
    // test/debug hook: deterministic simulation without rendering
    const sim = (k, n, press) => {
      for (const key in keys) keys[key] = false; Object.assign(keys, k);
      for (let i = 0; i < n; i++) {
        const inp = readInput();
        if (i === 0 && press !== false) for (const kk in k) if (k[kk]) pressed[kk] = true;
        update(STEP, inp); for (const kk in pressed) pressed[kk] = false;
      }
      for (const key in keys) keys[key] = false;
    };
    window.__aaliyah = { get objective() { return objectives.find(q => !q.done()); }, guideTarget, get state() { return state; }, get P() { return P; }, get W() { return W; }, get enemies() { return enemies; }, cam, startRun, sim };
  }
  boot();
})();
