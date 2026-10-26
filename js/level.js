/* Tomb level builder. One linear tomb, 7 sections, built from axis-aligned boxes.
   Player runs toward -Z. Each run randomizes enemy spots, coin lines, trap timings,
   which side the lever ledge / clue platform is on, and the crumbling bridge layout.

   Section layout (z ranges):
     1 Courtyard      8 .. -30   jump a lava gap, vault, first goblins
     2 Climb Hall   -30 .. -62   ledge grab + pull-up, vine wall, clue #1
     3 Trap Hall    -62 .. -96   timed spikes, swinging blades, dart wall
     4 Lever Room   -96 .. -125  2 levers open the gate, clue #2 on a ledge
     5 Lava Bridge -125 .. -159  crumbling tiles, clue #3, push-block puzzle
     6 Boulder Run -159 .. -205  RUN.
     7 Bday Chamber -205 .. -232 3-clue door, Teevincs
*/
(function () {
  'use strict';
  const MD = window.AALIYAH_MODELS;
  const tex = MD.canvasTex;

  function noise(g, w, h, n, a, cols) {
    for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.globalAlpha = a * Math.random(); g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.globalAlpha = 1;
  }
  function makeTextures() {
    const T = {};
    T.wall = tex(256, 256, (g, w, h) => {
      g.fillStyle = '#b8743e'; g.fillRect(0, 0, w, h);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
        const off = r % 2 ? 42 : 0, x = c * 85 + off, y = r * 64;
        g.fillStyle = ['#cf8c52', '#c88449', '#d6965a', '#c27e45'][(r * 3 + c) % 4];
        g.fillRect(x + 3, y + 3, 79, 58); g.fillRect(x + 3 - 256, y + 3, 79, 58);
        g.fillStyle = 'rgba(255,230,180,0.25)'; g.fillRect(x + 3, y + 3, 79, 4); g.fillRect(x + 3 - 256, y + 3, 79, 4);
      }
      noise(g, w, h, 900, 0.35, ['#7a4520', '#e8b37a']);
    });
    T.floor = tex(256, 256, (g, w, h) => {
      g.fillStyle = '#7d5236'; g.fillRect(0, 0, w, h);
      [[0, 0], [128, 0], [0, 128], [128, 128]].forEach(([x, y], i) => {
        g.fillStyle = ['#b98552', '#ad7a48', '#c08c58', '#a87444'][i]; g.fillRect(x + 4, y + 4, 120, 120);
        g.fillStyle = 'rgba(255,230,180,0.18)'; g.fillRect(x + 4, y + 4, 120, 5);
      });
      g.strokeStyle = 'rgba(60,30,10,0.5)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(30, 60); g.lineTo(60, 80); g.lineTo(70, 110); g.moveTo(170, 150); g.lineTo(200, 170); g.stroke();
      noise(g, w, h, 900, 0.35, ['#5b3a12', '#e8b37a']);
      g.fillStyle = 'rgba(20,241,149,0.5)'; for (let i = 0; i < 40; i++) g.fillRect((i * 53) % 256, (i % 2 ? 0 : 124) + (i * 7) % 6, 6, 3);
    });
    T.vine = tex(256, 256, (g, w, h) => {
      g.drawImage(T.wall.image, 0, 0);
      g.strokeStyle = '#1f7a35'; g.lineWidth = 7;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(32 + i * 64, 0); g.bezierCurveTo(10 + i * 64, 80, 60 + i * 64, 170, 32 + i * 64, 256); g.stroke(); }
      g.fillStyle = '#3fd15c';
      for (let i = 0; i < 70; i++) { g.beginPath(); g.ellipse((i * 37) % 256, (i * 71) % 256, 9, 5, i, 0, 7); g.fill(); }
    });
    T.bars = tex(128, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = '#4a4f5e';
      for (let i = 0; i < 5; i++) g.fillRect(6 + i * 26, 0, 10, 128);
      g.fillRect(0, 20, 128, 10); g.fillRect(0, 98, 128, 10);
      g.fillStyle = '#9aa3b8'; for (let i = 0; i < 5; i++) g.fillRect(8 + i * 26, 0, 3, 128);
      g.fillStyle = '#ffcc3a'; for (let i = 0; i < 5; i++) { g.fillRect(4 + i * 26, 18, 14, 4); }
    });
    T.door = tex(256, 256, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#ffd75a'); grd.addColorStop(1, '#b8860b');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#7a5410'; g.lineWidth = 10; g.strokeRect(10, 10, w - 20, h - 20); g.beginPath(); g.moveTo(128, 10); g.lineTo(128, 246); g.stroke();
      g.drawImage(MD.solTex.image, 68, 70, 120, 120);
    });
    T.lava = tex(256, 256, (g, w, h) => {
      g.fillStyle = '#d6301a'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = i % 3 ? '#ff7a1f' : '#ffd23f'; g.globalAlpha = 0.7;
        g.beginPath(); g.ellipse((i * 67) % 256, (i * 41) % 256, 12 + (i % 5) * 6, 6 + (i % 3) * 4, i, 0, 7); g.fill();
      }
      g.globalAlpha = 1;
    });
    T.lava.wrapS = T.lava.wrapT = THREE.RepeatWrapping; T.lava.repeat.set(8, 90);
    T.glyphs = [
      tex(256, 256, g => { glyphBg(g); g.drawImage(MD.solTex.image, 64, 40, 128, 128); glyphText(g, 'WAGMI'); }),
      tex(256, 256, g => { glyphBg(g); cake(g); glyphText(g, 'HBD T'); }),
      tex(256, 256, g => { glyphBg(g); hat(g); glyphText(g, 'gm'); }),
      tex(256, 256, g => { glyphBg(g); g.font = 'bold 110px Bungee, Impact, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#4a2a10'; g.fillText('🚫', 128, 140); glyphText(g, 'NO FUD'); })
    ];
    T.banner = tex(512, 96, (g, w, h) => {
      const txt = 'HAPPY BIRTHDAY TEEVINCS';
      g.clearRect(0, 0, w, h);
      for (let i = 0; i < txt.length; i++) {
        const x = 10 + i * (492 / txt.length);
        g.fillStyle = ['#9945FF', '#14F195', '#ff5e8a', '#00C2FF', '#ffde3a'][i % 5];
        g.beginPath(); g.moveTo(x, 8); g.lineTo(x + 20, 8); g.lineTo(x + 10, 88); g.closePath(); g.fill();
        g.fillStyle = '#fff'; g.font = '18px Bungee, Impact, sans-serif'; g.textAlign = 'center'; g.fillText(txt[i], x + 10, 36);
      }
    });
    T.sun = tex(256, 256, (g) => {
      const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#14F195'); grd.addColorStop(0.5, '#00C2FF'); grd.addColorStop(1, '#9945FF');
      g.fillStyle = grd; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill();
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 7; i++) g.fillRect(0, 140 + i * 17, 256, 3 + i * 1.4);
    });
    T.sky = tex(4, 256, (g) => {
      const grd = g.createLinearGradient(0, 0, 0, 256);
      grd.addColorStop(0, '#12052a'); grd.addColorStop(0.45, '#4d1a72'); grd.addColorStop(0.75, '#c2407f'); grd.addColorStop(1, '#ff9a5c');
      g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
    });
    return T;
  }
  function glyphBg(g) { g.fillStyle = '#c99a62'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#7a4a22'; g.lineWidth = 10; g.strokeRect(8, 8, 240, 240); }
  function glyphText(g, t) { g.fillStyle = '#4a2a10'; g.font = '34px Bungee, Impact, sans-serif'; g.textAlign = 'center'; g.fillText(t, 128, 222); }
  function cake(g) {
    g.fillStyle = '#4a2a10'; g.fillRect(60, 100, 136, 70); g.fillRect(80, 70, 96, 30);
    for (let i = 0; i < 4; i++) { g.fillRect(90 + i * 25, 40, 6, 30); g.beginPath(); g.ellipse(93 + i * 25, 32, 6, 9, 0, 0, 7); g.fill(); }
  }
  function hat(g) {
    g.fillStyle = '#4a2a10'; g.beginPath(); g.ellipse(128, 150, 100, 22, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(75, 150); g.quadraticCurveTo(70, 60, 100, 60); g.quadraticCurveTo(128, 80, 156, 60); g.quadraticCurveTo(186, 60, 181, 150); g.fill();
  }

  /* ------------------------------------------------------------------ */
  function boxGeo(w, h, d, tile) {
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, S = 1 / (tile || 2);
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] * S, uv.getY(i) * dims[f][1] * S); }
    return g;
  }

  function build(scene, rng, opts) {
    const T = makeTextures();
    [T.wall, T.floor, T.vine].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
    const wallM = new THREE.MeshLambertMaterial({ map: T.wall }), floorM = new THREE.MeshLambertMaterial({ map: T.floor }),
          vineM = new THREE.MeshLambertMaterial({ map: T.vine }),
          barsM = new THREE.MeshLambertMaterial({ map: T.bars, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }),
          doorM = new THREE.MeshLambertMaterial({ map: T.door, emissive: 0x332200 });
    const stoneMats = [wallM, wallM, floorM, wallM, wallM, wallM];
    const shadows = !!opts.shadows;

    const W = { solids: [], rayMeshes: [], coins: [], clues: [], hearts: [], checkpoints: [], enemySpawns: [], spikes: [], blades: [],
                darts: [], dartEmitters: [], levers: [], tiles: [], sections: [], flames: [], textures: T,
                gate1: null, gate2: null, block: null, plate: null, door: null, boulder: null, teevincs: null, start: null, killY: -1.2 };
    const rand = (a, b) => a + rng() * (b - a);
    const chance = p => rng() < p;

    // B(x0,x1,y0,y1,z0,z1,opts): an axis-aligned solid
    function B(x0, x1, y0, y1, z0, z1, o) {
      o = o || {};
      const min = { x: Math.min(x0, x1), y: Math.min(y0, y1), z: Math.min(z0, z1) }, max = { x: Math.max(x0, x1), y: Math.max(y0, y1), z: Math.max(z0, z1) };
      const w = max.x - min.x, h = max.y - min.y, d = max.z - min.z;
      let m = o.mat || (o.climb ? vineM : stoneMats);
      const mesh = new THREE.Mesh(boxGeo(w, h, d, o.tile), m);
      mesh.position.set((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
      mesh.receiveShadow = shadows; mesh.castShadow = shadows && !o.noCast;
      scene.add(mesh);
      const s = { min, max, mesh, climb: !!o.climb, kind: o.kind || 'static', active: true };
      if (!o.noSolid) W.solids.push(s);
      if (!o.noRay && s.kind === 'static') W.rayMeshes.push(mesh);
      return s;
    }
    const coinLine = (x0, y0, z0, x1, y1, z1, n) => {
      for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : i / (n - 1); if (chance(0.92)) W.coins.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, z: z0 + (z1 - z0) * t }); }
    };
    const coinArc = (x, y, z0, z1, n, hgt) => {
      for (let i = 0; i < n; i++) { const t = i / (n - 1); W.coins.push({ x, y: y + Math.sin(t * Math.PI) * hgt, z: z0 + (z1 - z0) * t }); }
    };
    const torch = (x, y, z, rotY) => {
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY || 0;
      const hold = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.25), MD.mat('torchHold', { color: 0x3a2410 })); hold.position.z = 0.1; g.add(hold);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 6), MD.mat('flame', { color: 0xff9a2a, emissive: 0xff6a00, emissiveIntensity: 1 }));
      fl.position.set(0, 0.36, 0.2); g.add(fl); scene.add(g); W.flames.push(fl);
    };
    const glyph = (x, y, z, rotY, i) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshLambertMaterial({ map: T.glyphs[i % T.glyphs.length] }));
      p.position.set(x, y, z); p.rotation.y = rotY; scene.add(p);
    };
    const column = (x, z, h, broken) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, h, 10), wallM); c.position.set(x, h / 2, z); c.castShadow = shadows; scene.add(c);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 1.2), wallM); cap.position.set(x, h + 0.15, z); scene.add(cap);
      if (broken) cap.rotation.z = 0.3;
      W.solids.push({ min: { x: x - 0.45, y: 0, z: z - 0.45 }, max: { x: x + 0.45, y: h + 0.3, z: z + 0.45 }, mesh: c, kind: 'static', active: true });
      W.rayMeshes.push(c);
    };
    const checkpoint = (x, z, y) => W.checkpoints.push({ x, y: y || 0, z, lit: false });
    const section = (id, zStart) => W.sections.push({ id, z: zStart, seen: false });
    const walls = (x0, x1, z0, z1, h) => { B(x0 - 1, x0, -2, h, z0, z1); B(x1, x1 + 1, -2, h, z0, z1); };

    /* ======================= 1. COURTYARD ======================= */
    section('courtyard', 6);
    W.start = { x: 0, y: 0, z: 4 };
    B(-8, 8, -2, 5, 8, 9);
    walls(-7, 7, 8, -30, 5);
    B(-7, 7, -2, 0, 8, -12);
    B(-7, 7, -2, 0, -15.5, -30);
    B(-2.2, 2.2, 0, 0.9, -20.5, -21.8);
    checkpoint(-4.5, 5);
    coinLine(0, 0.8, 1, 0, 0.8, -9, 6);
    coinArc(0, 1.0, -11, -16.5, 5, 1.6);
    coinLine(0, 1.6, -20.6, 0, 1.6, -21.6, 2);
    [[-4, -25], [3.5, -27.5], [0, -24]].forEach((p, i) => { if (i < 2 || chance(0.5)) W.enemySpawns.push({ type: 'goblin', x: p[0] + rand(-1, 1), y: 0, z: p[1] }); });
    column(-5, -4, 4, false); column(5, -4, 3, true); column(-5, -18, 4.5, false); column(5, -18, 2.5, true);
    torch(-6.95, 2.4, -8, Math.PI / 2); torch(6.95, 2.4, -8, -Math.PI / 2);
    glyph(-6.98, 2.2, -26, Math.PI / 2, 0); glyph(6.98, 2.2, -26, -Math.PI / 2, 2);

    /* ======================= 2. CLIMB HALL ======================= */
    section('climb', -31);
    walls(-7, 7, -30, -62, 6);
    B(-7, 7, -2, 0, -30, -62);
    checkpoint(-5, -32);
    const flip2 = chance(0.5) ? -1 : 1;
    B(flip2 * -6, flip2 * -2, 0, 2, -40, -44);            // step block (grab + pull up)
    B(-7, 7, 0, 4, -46, -56);                             // upper terrace
    B(flip2 * 3, flip2 * 7, 0, 4, -45.5, -46, { climb: true }); // vine wall (alt route)
    W.clues.push({ x: flip2 * -5.6, y: 4.9, z: -54.5 });
    B(flip2 * -4.5, flip2 * -3.5, 4, 5.4, -53, -56);      // little pillar near clue
    coinLine(flip2 * -4, 2.8, -40.5, flip2 * -4, 2.8, -43.5, 3);
    coinLine(-3, 4.8, -48, 4, 4.8, -48, 6);
    coinArc(0, 1, -56.5, -61, 4, 1.5);
    W.enemySpawns.push({ type: 'bat', x: rand(-2, 2), y: 6.5, z: -51 });
    W.enemySpawns.push({ type: 'goblin', x: flip2 * 4, y: 0, z: -36 });
    torch(-6.95, 2.4, -36, Math.PI / 2); torch(6.95, 2.4, -36, -Math.PI / 2);
    glyph(0, 2.6, -45.98, 0, 1);
    glyph(-6.98, 5.6, -52, Math.PI / 2, 3);

    /* ======================= 3. TRAP HALL ======================= */
    section('traps', -63);
    B(-8, -3, -2, 6, -62, -63); B(3, 8, -2, 6, -62, -63);
    walls(-3, 3, -63, -96, 6);
    B(-3, 3, -2, 0, -63, -96);
    checkpoint(-2, -64);
    // timed spikes
    const spikeGeo = new THREE.ConeGeometry(0.11, 0.6, 5);
    const spikeMat = MD.mat('spike', { color: 0xc9ced9 });
    function spikeField(x0, x1, z0, z1, period, phase) {
      const g = new THREE.Group(), base = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.05, Math.abs(z1 - z0)), MD.mat('spikeBase', { color: 0x3a2a2a }));
      base.position.set((x0 + x1) / 2, 0.02, (z0 + z1) / 2); scene.add(base);
      const pts = [];
      for (let x = x0 + 0.25; x < x1; x += 0.5) for (let z = Math.max(z0, z1) - 0.25; z > Math.min(z0, z1); z -= 0.5) pts.push([x, z]);
      const im = new THREE.InstancedMesh(spikeGeo, spikeMat, pts.length), m4x = new THREE.Matrix4();
      pts.forEach(([x, z], i) => { m4x.makeTranslation(x, 0.3, z); im.setMatrixAt(i, m4x); });
      im.frustumCulled = false; g.add(im);
      scene.add(g);
      W.spikes.push({ min: { x: x0, z: Math.min(z0, z1) }, max: { x: x1, z: Math.max(z0, z1) }, group: g, period, phase, up: true });
    }
    spikeField(-3, 3, -66, -69, 2.6, rand(0, 2));
    // swinging blades
    function blade(z, speed, phase) {
      const piv = new THREE.Group(); piv.position.set(0, 6, z);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 4.4, 0.08), MD.mat('iron', { color: 0x5a5f6e })); arm.position.y = -2.2; piv.add(arm);
      const bl = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.06, 20, 1, false, 0, Math.PI), MD.mat('blade', { color: 0xe8edf7, emissive: 0x222233 }));
      bl.rotation.x = Math.PI / 2; bl.rotation.y = Math.PI / 2; bl.position.y = -4.4; piv.add(bl);
      bl.castShadow = shadows;
      scene.add(piv);
      W.blades.push({ piv, z, speed, phase, len: 4.6 });
    }
    blade(-73.5, rand(1.9, 2.4), rand(0, 6));
    blade(-79.5, rand(2.1, 2.6), rand(0, 6));
    // dart wall
    [-85, -87.5].forEach((z, i) => {
      const side = i % 2 ? 1 : -1;
      const em = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.5), MD.mat('dartEm', { color: 0x4a2a10 }));
      em.position.set(side * 2.9, 1.0, z); scene.add(em);
      W.dartEmitters.push({ x: side * 2.8, y: 1.0, z, dir: -side, period: rand(1.3, 1.7), t: rand(0, 1.5) });
    });
    // static spike strip (jump it)
    spikeField(-3, 3, -91, -92.6, 0, 0);
    W.spikes[W.spikes.length - 1].static = true;
    coinLine(0, 0.8, -64.5, 0, 0.8, -65.5, 2);
    coinLine(0, 0.8, -70.5, 0, 0.8, -71.5, 2);
    coinLine(0, 0.8, -76.5, 0, 0.8, -77, 2);
    coinArc(0, 0.9, -90.4, -93.2, 4, 1.4);
    W.enemySpawns.push({ type: 'bat', x: 0, y: 3, z: -83 });
    torch(-2.95, 2.6, -70, Math.PI / 2); torch(2.95, 2.6, -77, -Math.PI / 2); torch(-2.95, 2.6, -89, Math.PI / 2);
    glyph(2.98, 2.4, -66, -Math.PI / 2, 3);

    /* ======================= 4. LEVER ROOM ======================= */
    section('levers', -97);
    const m4 = chance(0.5) ? -1 : 1;
    B(-10, -3, -2, 6, -96, -97); B(3, 10, -2, 6, -96, -97);
    walls(-9, 9, -97, -125, 6);
    B(-9, 9, -2, 0, -96, -125);
    checkpoint(-2.5, -98);
    B(-10, -1.5, -2, 6, -124, -125); B(1.5, 10, -2, 6, -124, -125);
    W.gate1 = B(-1.5, 1.5, 0, 5, -124.2, -124.8, { kind: 'gate', mat: barsM, tile: 1.5 });
    W.gate1.y0 = 0;
    B(m4 * 9, m4 * 5, 0, 3, -108, -118);                   // lever ledge
    B(m4 * 5, m4 * 3.5, 0, 1.5, -111.5, -114);             // step
    W.levers.push({ x: m4 * -7, y: 0, z: -105, rotY: 0 });
    W.levers.push({ x: m4 * 7, y: 3, z: -110, rotY: 0 });
    W.clues.push({ x: m4 * 7.4, y: 3.9, z: -116.5 });
    coinLine(m4 * -6, 0.8, -100, m4 * 6, 0.8, -100, 7);
    coinLine(m4 * 4.2, 2.3, -112.2, m4 * 4.2, 2.3, -113.4, 2);
    coinLine(m4 * 6, 3.8, -111.5, m4 * 6, 3.8, -115, 3);
    W.enemySpawns.push({ type: 'goblin', x: m4 * -4, y: 0, z: -114 });
    W.enemySpawns.push({ type: 'goblin', x: m4 * 2, y: 0, z: -119 });
    if (chance(0.6)) W.enemySpawns.push({ type: 'bat', x: 0, y: 4, z: -108 });
    W.hearts.push({ x: m4 * -7.5, y: 0.9, z: -121.5 });
    column(m4 * -3, -103, 5, false); column(m4 * -3, -118, 5, false);
    torch(-8.95, 2.6, -104, Math.PI / 2); torch(8.95, 2.6, -104, -Math.PI / 2);
    glyph(-5, 2.6, -123.98, 0, 0); glyph(5, 2.6, -123.98, 0, 2);

    /* ======================= 5. LAVA BRIDGE + BLOCK ======================= */
    section('bridge', -126);
    walls(-7, 7, -125, -159, 6);
    B(-7, 7, -2, 0, -125, -128.4);
    checkpoint(-5, -126);
    const zig = chance(0.5) ? 1 : -1;
    const clueSide = chance(0.5) ? 1 : -1;
    for (let i = 0; i < 6; i++) {
      const z = -129.5 - i * 2.2, x = (i % 2 ? 1 : -1) * zig * rand(0.6, 1.3);
      const s = B(x - 0.8, x + 0.8, -0.5, 0, z + 0.8, z - 0.8, { kind: 'tile', tile: 1.6 });
      s.home = { x, z }; s.state = 0; s.t = 0; s.y0min = s.min.y; s.y0max = s.max.y;
      W.tiles.push(s);
      if (i % 2 === 0) W.coins.push({ x, y: 0.9, z });
    }
    B(clueSide * 7, clueSide * 4.6, -2, 0, -133, -137);
    W.clues.push({ x: clueSide * 5.8, y: 0.9, z: -135 });
    B(-7, 7, -2, 0, -142.4, -159);
    checkpoint(5, -143.5);
    // push block puzzle
    B(-8, -1.5, -2, 6, -158, -159); B(1.5, 8, -2, 6, -158, -159);
    W.gate2 = B(-1.5, 1.5, 0, 5, -158.2, -158.8, { kind: 'gate', mat: barsM, tile: 1.5 });
    W.gate2.y0 = 0;
    const blockMesh = new THREE.Mesh(boxGeo(1.4, 1.4, 1.4, 1.4), new THREE.MeshLambertMaterial({ map: T.glyphs[0] }));
    scene.add(blockMesh); blockMesh.castShadow = shadows;
    W.block = { min: { x: -3.2, y: 0, z: -152.7 }, max: { x: -1.8, y: 1.4, z: -151.3 }, mesh: blockMesh, kind: 'block', active: true, railMin: -5.8, railMax: 4.7 };
    W.solids.push(W.block);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.03, 1.6), MD.mat('rail', { color: 0x5b3a12 })); rail.position.set(-0.55, 0.015, -152); scene.add(rail);
    const plateM = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.5), MD.mat('plate', { color: 0xffcc3a, emissive: 0x332200 }));
    plateM.position.set(4, 0.04, -152); scene.add(plateM);
    W.plate = { x: 4, z: -152, mesh: plateM, pressed: false };
    coinLine(-5.5, 0.8, -145, 5.5, 0.8, -145, 7);
    W.enemySpawns.push({ type: 'goblin', x: 3, y: 0, z: -149 });
    if (chance(0.5)) W.enemySpawns.push({ type: 'bat', x: 0, y: 4, z: -135 });
    torch(-6.95, 2.6, -146, Math.PI / 2); torch(6.95, 2.6, -146, -Math.PI / 2);
    glyph(-5, 2.6, -157.98, 0, 1); glyph(5, 2.6, -157.98, 0, 3);

    /* ======================= 6. BOULDER RUN ======================= */
    section('boulder', -160);
    walls(-2.5, 2.5, -159, -205, 7);
    B(-2.5, 2.5, -2, 0, -159, -192);
    B(-2.5, 2.5, -2, 0, -195.2, -205);
    checkpoint(-1.8, -160);
    W.hurdles = [B(-2.5, 2.5, 0, 0.75, -171, -171.7), B(-2.5, 2.5, 0, 0.75, -181, -181.7)];
    spikeField(-2.5, 2.5, -186, -187.2, 0, 0); W.spikes[W.spikes.length - 1].static = true;
    W.boulder = { triggerZ: -167, startZ: -160.8, pitZ0: -192, pitZ1: -195.2, endZ: -205 };
    coinLine(0, 0.8, -165, 0, 0.8, -169, 4);
    coinArc(0, 1.2, -170.3, -172.4, 3, 0.8);
    coinLine(0, 0.8, -175, 0, 0.8, -179, 4);
    coinArc(0, 1.0, -191.5, -195.7, 5, 1.6);
    for (let z = -166; z > -204; z -= 9) { torch(-2.45, 3, z, Math.PI / 2); torch(2.45, 3, z - 4.5, -Math.PI / 2); }

    /* ======================= 7. BIRTHDAY CHAMBER ======================= */
    section('final', -206);
    B(-10, -2.5, -2, 7, -205, -206); B(2.5, 10, -2, 7, -205, -206);
    walls(-9, 9, -206, -233, 7);
    B(-9, 9, -2, 0, -205, -233); B(-10, 10, -2, 7, -233, -234);
    checkpoint(-2, -206.5);
    B(-10, -1.5, -2, 7, -208, -209); B(1.5, 10, -2, 7, -208, -209);
    W.door = B(-1.5, 1.5, 0, 4.2, -208.2, -208.8, { kind: 'door', mat: doorM, tile: 3 });
    W.door.y0 = 0;
    // clue sockets above the door
    W.sockets = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshLambertMaterial({ color: 0x3a2410 }));
      s.position.set(-0.8 + i * 0.8, 4.8, -207.9); scene.add(s); W.sockets.push(s);
    }
    W.teevincs = { x: 0, y: 0, z: -224 };
    // cake table
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.9, 14), MD.mat('table', { color: 0x9945ff }));
    table.position.set(-2.2, 0.45, -224.5); scene.add(table);
    W.solids.push({ min: { x: -2.9, y: 0, z: -225.2 }, max: { x: -1.5, y: 0.9, z: -223.8 }, mesh: table, kind: 'static', active: true });
    const cakeM = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.38, 16), MD.mat('cake', { color: 0xff9ec7 }));
    cakeM.position.set(-2.2, 1.09, -224.5); scene.add(cakeM);
    const ic = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.07, 16), MD.mat('icing', { color: 0xffffff })); ic.position.set(-2.2, 1.3, -224.5); scene.add(ic);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2, c = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 5), MD.mat('candle', { color: 0x14f195 }));
      c.position.set(-2.2 + Math.cos(a) * 0.22, 1.42, -224.5 + Math.sin(a) * 0.22); scene.add(c);
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 5), MD.mat('flame', { color: 0xff9a2a, emissive: 0xff6a00, emissiveIntensity: 1 }));
      f.position.set(c.position.x, 1.56, c.position.z); scene.add(f); W.flames.push(f);
    }
    // banner + balloons
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.9), new THREE.MeshBasicMaterial({ map: T.banner, transparent: true, side: THREE.DoubleSide }));
    ban.position.set(0, 5.2, -228); scene.add(ban);
    W.balloons = [];
    [[-5, 0x9945ff], [-4, 0x14f195], [-6, 0xff5e8a], [4.5, 0x00c2ff], [5.5, 0xffde3a], [6.2, 0x9945ff], [-3, 0xff5e8a], [3.2, 0x14f195]].forEach(([x, c], i) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.25 }));
      b.scale.y = 1.2; b.position.set(x, 3 + (i % 3) * 0.6, -226 + (i % 2) * 2); scene.add(b); W.balloons.push({ m: b, y: b.position.y, ph: i });
    });
    for (let i = 0; i < 4; i++) glyph(-8.98, 2.6, -212 - i * 5, Math.PI / 2, i), glyph(8.98, 2.6, -212 - i * 5, -Math.PI / 2, i + 1);
    torch(-8.95, 3, -215, Math.PI / 2); torch(8.95, 3, -215, -Math.PI / 2); torch(-8.95, 3, -226, Math.PI / 2); torch(8.95, 3, -226, -Math.PI / 2);

    /* ======================= LAVA + SCENERY ======================= */
    const lava = new THREE.Mesh(new THREE.PlaneGeometry(22, 250), new THREE.MeshBasicMaterial({ map: T.lava }));
    lava.rotation.x = -Math.PI / 2; lava.position.set(0, -1.6, -112); scene.add(lava); W.lava = lava;
    const pyrM = new THREE.MeshLambertMaterial({ color: 0x5a2a6a, flatShading: true });
    [[-60, -60, 40], [70, -120, 55], [-80, -170, 50], [55, -20, 30], [-50, -240, 45], [80, -230, 60], [0, -300, 70]].forEach(([x, z, h]) => {
      const p = new THREE.Mesh(new THREE.ConeGeometry(h, h * 0.9, 4), pyrM); p.position.set(x, h * 0.45 - 4, z); p.rotation.y = Math.PI / 4; scene.add(p);
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), MD.mat('sand', { color: 0x6a3550 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -2.2, -120); scene.add(ground);
    const sun = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshBasicMaterial({ map: T.sun, transparent: true, fog: false }));
    sun.position.set(25, 30, -330); scene.add(sun); W.sun = sun;

    return W;
  }

  window.AALIYAH_LEVEL = { build };
})();
