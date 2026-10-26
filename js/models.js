/* Low-poly procedural 3D models + procedural animation for Aaliyah, Teevincs and enemies.
   Units are meters. Every model faces +Z, with its origin at the feet. */
(function () {
  'use strict';
  const M = {};
  const C = { skin: 0xf6c49a, skinD: 0xe0a576, hair: 0xf7dc96, hairD: 0xd9b36a, hat: 0xc8873f, hatD: 0x6e4220,
              boot: 0x7d4a22, gold: 0xffcc3a, iris: 0xffae1a, purple: 0x9945ff, green: 0x14f195, dark: 0x1c1a20 };
  M.COLORS = C;

  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 2; return t;
  }
  M.canvasTex = canvasTex;
  const cowTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#fbfbf5'; g.fillRect(0, 0, w, h); g.fillStyle = '#1c1a20';
    [[20, 30, 16, 11], [80, 20, 13, 9], [60, 75, 20, 13], [110, 95, 12, 16], [18, 100, 10, 8], [100, 55, 7, 6]].forEach(([x, y, a, b]) => {
      g.beginPath(); g.ellipse(x, y, a, b, 0.6, 0, 7); g.fill();
    });
  });
  cowTex.wrapS = cowTex.wrapT = THREE.RepeatWrapping;
  const mats = {};
  function mat(key, opts) {
    if (!mats[key]) mats[key] = new THREE.MeshLambertMaterial(opts);
    return mats[key];
  }
  M.mat = mat;
  const skin = mat('skin', { color: C.skin }), hair = mat('hair', { color: C.hair }), hairD = mat('hairD', { color: C.hairD }),
        cow = mat('cow', { map: cowTex }), hatM = mat('hat', { color: C.hat }), hatD = mat('hatD', { color: C.hatD }),
        boot = mat('boot', { color: C.boot }), gold = mat('gold', { color: C.gold, emissive: 0x553300 }),
        dark = mat('dark', { color: C.dark }), horn = mat('horn', { color: 0xf4ead2 }), pink = mat('pink', { color: 0xf59fa8 }),
        glow = mat('glow', { color: C.green, emissive: C.green, emissiveIntensity: 0.8 });

  function mesh(geo, m, x, y, z, parent) { const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); if (parent) parent.add(o); return o; }
  function pivot(parent, x, y, z) { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; }
  const cyl = (rt, rb, h, seg) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg || 8); g.translate(0, -h / 2, 0); return g; };
  const sph = (r, ws, hs) => new THREE.SphereGeometry(r, ws || 10, hs || 8);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  function castAll(o) { o.traverse(c => { if (c.isMesh) { c.castShadow = true; } }); }

  /* ================================ AALIYAH ================================ */
  M.makeAaliyah = function () {
    const root = new THREE.Group(), body = pivot(root, 0, 0, 0), R = { root, body, kind: 'aaliyah' };
    root.userData.scale = 0.93;
    body.scale.setScalar(0.93);
    // legs (cow-print boots)
    ['L', 'R'].forEach((s, i) => {
      const x = i ? -0.1 : 0.1;
      const hip = pivot(body, x, 0.86, 0);
      mesh(cyl(0.088, 0.07, 0.43), skin, 0, 0, 0, hip);
      const knee = pivot(hip, 0, -0.43, 0);
      mesh(cyl(0.07, 0.06, 0.16), skin, 0, 0, 0, knee);
      mesh(cyl(0.078, 0.084, 0.24), cow, 0, -0.12, 0, knee);
      mesh(box(0.13, 0.07, 0.22), boot, 0, -0.39, 0.035, knee);
      R['hip' + s] = hip; R['knee' + s] = knee;
    });
    // hips / torso
    const torso = pivot(body, 0, 0.86, 0); R.torso = torso;
    mesh(box(0.37, 0.18, 0.23), cow, 0, 0.05, 0, torso);
    mesh(cyl(0.13, 0.155, 0.24), skin, 0, 0.37, 0, torso);
    const top = mesh(new THREE.SphereGeometry(0.19, 12, 8), cow, 0, 0.45, 0.02, torso); top.scale.set(1.0, 0.55, 0.72);
    mesh(cyl(0.06, 0.06, 0.09), skin, 0, 0.64, 0, torso);
    const collar = mesh(new THREE.TorusGeometry(0.065, 0.018, 6, 14), dark, 0, 0.585, 0, torso); collar.rotation.x = Math.PI / 2;
    mesh(sph(0.042, 10, 8), gold, 0, 0.545, 0.08, torso);
    // tail
    const tail = pivot(torso, 0, 0.06, -0.12); R.tail = tail;
    mesh(cyl(0.024, 0.018, 0.34), cow, 0, 0, 0, tail).rotation.x = -2.3;
    const tailTip = pivot(tail, 0, 0.2, -0.24); R.tailTip = tailTip;
    mesh(cyl(0.018, 0.015, 0.24), cow, 0, 0, 0, tailTip).rotation.x = -2.8;
    mesh(sph(0.055, 7, 6), boot, 0, 0.22, -0.07, tailTip);
    // arms (detached cow-print sleeves like the artwork)
    ['L', 'R'].forEach((s, i) => {
      const x = i ? -0.235 : 0.235;
      const sh = pivot(torso, x, 0.52, 0);
      mesh(sph(0.065, 8, 6), skin, 0, 0, 0, sh);
      mesh(cyl(0.055, 0.048, 0.26), skin, 0, 0, 0, sh);
      const el = pivot(sh, 0, -0.26, 0);
      mesh(cyl(0.062, 0.07, 0.22), cow, 0, 0, 0, el);
      mesh(sph(0.045, 7, 6), skin, 0, -0.24, 0, el);
      const gun = pivot(el, 0, -0.27, 0.035);
      mesh(box(0.05, 0.17, 0.08), dark, 0, -0.02, 0, gun);
      mesh(box(0.045, 0.06, 0.06), glow, 0, -0.12, 0, gun);
      R['sh' + s] = sh; R['el' + s] = el; R['gun' + s] = gun;
    });
    // head
    const head = pivot(torso, 0, 0.8, 0.01); R.head = head;
    mesh(sph(0.165, 16, 14), skin, 0, 0, 0, head).scale.set(1, 1.03, 0.98);
    [0.064, -0.064].forEach(x => {
      const e = mesh(sph(0.038, 10, 8), mat('eyeWhite', { color: 0xffffff, emissive: 0x333333 }), x, 0.0, 0.142, head); e.scale.set(0.95, 1.25, 0.45);
      const ir = mesh(sph(0.03, 10, 8), mat('iris', { color: C.iris, emissive: 0x663300 }), x, -0.004, 0.156, head); ir.scale.set(0.9, 1.25, 0.35);
      const pu = mesh(sph(0.014, 6, 5), dark, x, -0.004, 0.164, head); pu.scale.set(1, 1.3, 0.3);
      mesh(sph(0.008, 4, 4), mat('white', { color: 0xffffff, emissive: 0x888888 }), x + 0.012, 0.018, 0.168, head);
      const lash = mesh(box(0.075, 0.014, 0.02), dark, x, 0.046, 0.15, head); lash.rotation.z = x > 0 ? -0.15 : 0.15;
    });
    [0.095, -0.095].forEach(x => { const b = mesh(sph(0.03, 6, 4), mat('blush', { color: 0xff8fa0 }), x, -0.05, 0.13, head); b.scale.set(1, 0.5, 0.4); });
    const mouth = mesh(sph(0.018, 6, 4), mat('mouth', { color: 0x9a3030 }), 0, -0.088, 0.152, head); mouth.scale.set(1.5, 0.7, 0.5); R.mouth = mouth;
    // hair: golden-cream, long and voluminous (it's what you see in third person)
    const cap = mesh(new THREE.SphereGeometry(0.182, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), hair, 0, 0.012, -0.01, head);
    cap.rotation.x = -0.3;
    for (let i = -3; i <= 3; i++) {
      const b = mesh(new THREE.ConeGeometry(0.045, 0.15, 5), hair, i * 0.042, 0.07, 0.135, head);
      b.rotation.x = Math.PI + 0.4; b.rotation.z = i * 0.12;
    }
    const back = pivot(head, 0, 0.03, -0.1); R.hairBack = back;
    const bh = mesh(cyl(0.2, 0.17, 0.78, 10), hair, 0, 0, 0, back); bh.scale.set(1.15, 1, 0.5);
    const bh2 = mesh(new THREE.ConeGeometry(0.17, 0.26, 10), hairD, 0, -0.9, 0, back); bh2.rotation.x = Math.PI; bh2.scale.set(1.15, 1, 0.5);
    [0.15, -0.15].forEach(x => { const l = mesh(cyl(0.05, 0.03, 0.5, 6), hair, x, 0.0, 0.06, head); l.rotation.z = x > 0 ? -0.1 : 0.1; });
    // cow ears + horns
    [1, -1].forEach(s => {
      const ear = mesh(sph(0.08, 8, 6), hairD, s * 0.205, 0.035, -0.01, head); ear.scale.set(1, 0.42, 0.55); ear.rotation.z = s * -0.4;
      const ei = mesh(sph(0.055, 6, 5), pink, s * 0.215, 0.035, 0.018, head); ei.scale.set(1, 0.35, 0.3); ei.rotation.z = s * -0.4;
      const h = mesh(new THREE.ConeGeometry(0.035, 0.15, 6), horn, s * 0.13, 0.21, 0, head); h.rotation.z = s * -0.6;
      R['ear' + (s > 0 ? 'L' : 'R')] = ear;
    });
    // cowboy hat
    const hatG = pivot(head, 0, 0.155, -0.01); hatG.rotation.x = -0.14; R.hat = hatG;
    const brim = mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.03, 20), hatM, 0, 0, 0, hatG); brim.scale.set(1, 1, 0.88);
    mesh(new THREE.CylinderGeometry(0.16, 0.185, 0.19, 14), hatM, 0, 0.105, 0, hatG);
    mesh(new THREE.CylinderGeometry(0.188, 0.188, 0.045, 14), hatD, 0, 0.035, 0, hatG);
    mesh(box(0.06, 0.035, 0.25), hatD, 0, 0.2, 0, hatG).rotation.x = 0.1;
    castAll(root);
    R.a = {}; // smoothed angles
    return R;
  };

  // Smoothly drive a joint angle
  function sj(R, key, obj, axis, target, k) {
    const id = key + axis;
    if (R.a[id] === undefined) R.a[id] = target;
    R.a[id] += (target - R.a[id]) * k;
    obj.rotation[axis] = R.a[id];
  }

  // pose: idle run jump fall hang climb hurt celebrate panic dead ; shooting: bool (upper-body overlay)
  M.animateAaliyah = function (R, pose, t, dt, opts) {
    opts = opts || {};
    const k = Math.min(1, dt * 14);
    let hipL = 0, hipR = 0, kneeL = 0, kneeR = 0, shL = 0.1, shR = 0.1, shLz = 0.12, shRz = -0.12, elL = -0.2, elR = -0.2,
        lean = 0, bob = 0, headX = 0, tail = Math.sin(t * 4) * 0.4, hairX = 0.1, shake = 0;
    const speed = opts.speed || 0;
    switch (pose) {
      case 'idle': bob = Math.sin(t * 2.4) * 0.008; shL = shR = 0.08 + Math.sin(t * 2.4) * 0.03; headX = Math.sin(t * 1.3) * 0.04; break;
      case 'run': {
        const s = t * (6 + speed * 0.9), a = Math.min(1, speed / 6);
        hipL = Math.sin(s) * 0.95 * a; hipR = -hipL;
        kneeL = Math.max(0, Math.sin(s + 1.6)) * 1.3 * a + 0.1; kneeR = Math.max(0, Math.sin(s + 1.6 + Math.PI)) * 1.3 * a + 0.1;
        shL = -hipL * 0.8; shR = -hipR * 0.8; elL = elR = -1.0 * a - 0.2;
        bob = Math.abs(Math.sin(s)) * 0.06 * a; lean = 0.18 * a; hairX = 0.35 + Math.sin(s * 2) * 0.08; tail = Math.sin(s) * 0.5;
        break;
      }
      case 'jump': hipL = -0.9; kneeL = 1.3; hipR = 0.3; kneeR = 0.5; shL = shR = -2.4; shLz = 0.5; shRz = -0.5; elL = elR = -0.3; hairX = -0.1; lean = 0.1; break;
      case 'fall': hipL = -0.3; hipR = 0.2; kneeL = 0.6; kneeR = 0.3; shL = shR = -2.7; shLz = 0.7; shRz = -0.7; elL = elR = -0.2; hairX = -0.4; break;
      case 'hang': {
        const sw = Math.sin(t * 2.2) * 0.08;
        shL = shR = -3.0; shLz = 0.12; shRz = -0.12; elL = elR = -0.15; hipL = 0.1 + sw; hipR = -0.05 + sw; kneeL = 0.3; kneeR = 0.2; headX = -0.25; hairX = 0.05; lean = -0.05;
        break;
      }
      case 'climb': { const c = Math.sin(t * 12); shL = -2.6 + c * 0.3; shR = -2.6 - c * 0.3; elL = elR = -0.8; hipL = -1.2 - c * 0.3; hipR = -0.5 + c * 0.3; kneeL = 1.6; kneeR = 1.2; lean = 0.35; break; }
      case 'hurt': lean = -0.35; shL = shR = -2.2; shLz = 0.9; shRz = -0.9; hipL = -0.5; kneeL = 0.6; headX = -0.4; break;
      case 'celebrate': {
        const c = Math.sin(t * 13); bob = Math.abs(Math.sin(t * 6.5)) * 0.35;
        shL = -2.9 + c * 0.25; shR = -2.9 - c * 0.25; shLz = 0.4; shRz = -0.4; elL = elR = -0.3; hipL = -0.5; hipR = 0.2; kneeL = 0.9; kneeR = 0.5; hairX = -0.2; tail = c;
        break;
      }
      case 'panic': {
        shake = 0.015; shL = -2.8 + Math.sin(t * 25) * 0.6; shR = -2.6 + Math.cos(t * 23) * 0.6; shLz = 0.5; shRz = -0.5; elL = elR = -0.9;
        bob = Math.abs(Math.sin(t * 10)) * 0.04; headX = Math.sin(t * 17) * 0.15; tail = Math.sin(t * 20);
        break;
      }
      case 'dead': lean = -1.4; bob = 0; shL = shR = -2.8; shLz = 1.2; shRz = -1.2; break;
    }
    if (opts.shooting && pose !== 'hang' && pose !== 'climb') {
      shL = shR = -1.55 + (opts.aimPitch || 0); shLz = -0.12; shRz = 0.12; elL = elR = 0; lean *= 0.4;
    }
    sj(R, 'hipL', R.hipL, 'x', hipL, k); sj(R, 'hipR', R.hipR, 'x', hipR, k);
    sj(R, 'kneeL', R.kneeL, 'x', kneeL, k); sj(R, 'kneeR', R.kneeR, 'x', kneeR, k);
    sj(R, 'shL', R.shL, 'x', shL, k); sj(R, 'shR', R.shR, 'x', shR, k);
    sj(R, 'shL', R.shL, 'z', shLz, k); sj(R, 'shR', R.shR, 'z', shRz, k);
    sj(R, 'elL', R.elL, 'x', elL, k); sj(R, 'elR', R.elR, 'x', elR, k);
    sj(R, 'body', R.body, 'x', lean, k * 0.7);
    sj(R, 'head', R.head, 'x', headX, k);
    sj(R, 'hairB', R.hairBack, 'x', hairX, k * 0.5);
    sj(R, 'tail', R.tail, 'x', tail * 0.4, k * 0.5); sj(R, 'tailz', R.tail, 'z', tail * 0.5, k * 0.5);
    R.earL.rotation.z = -0.4 + Math.sin(t * 3) * 0.12; R.earR.rotation.z = 0.4 - Math.sin(t * 3 + 1) * 0.12;
    R.body.position.y = bob; R.body.position.x = shake ? (Math.random() - 0.5) * shake * 2 : 0;
    R.mouth.scale.y = (pose === 'run' || pose === 'idle') ? 0.5 : 1.2;
  };

  /* ================================ TEEVINCS =============================== */
  M.makeTeevincs = function () {
    const root = new THREE.Group(), body = pivot(root, 0, 0, 0), R = { root, body, kind: 'teevincs', a: {} };
    const hood = mat('hoodie', { color: 0x7b3fe4 }), jeans = mat('jeans', { color: 0x2a3c78 }), shoe = mat('shoe', { color: 0xf5f5f5 }),
          tskin = mat('tskin', { color: 0xc98f65 }), thair = mat('thair', { color: 0x2a1d14 });
    ['L', 'R'].forEach((s, i) => {
      const hip = pivot(body, i ? -0.1 : 0.1, 0.9, 0);
      mesh(cyl(0.08, 0.07, 0.45), jeans, 0, 0, 0, hip);
      const knee = pivot(hip, 0, -0.45, 0);
      mesh(cyl(0.07, 0.065, 0.38), jeans, 0, 0, 0, knee);
      mesh(box(0.12, 0.08, 0.22), shoe, 0, -0.41, 0.04, knee);
      R['hip' + s] = hip; R['knee' + s] = knee;
    });
    const torso = pivot(body, 0, 0.9, 0); R.torso = torso;
    mesh(box(0.42, 0.62, 0.26), hood, 0, 0.3, 0, torso);
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: canvasTex(64, 64, (g) => {
      g.fillStyle = '#7b3fe4'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#14F195'; g.font = 'bold 52px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('T', 32, 34);
    }) }));
    logo.position.set(0, 0.36, 0.132); torso.add(logo);
    mesh(box(0.3, 0.12, 0.22), hood, 0, 0.66, -0.06, torso);
    ['L', 'R'].forEach((s, i) => {
      const sh = pivot(torso, i ? -0.26 : 0.26, 0.55, 0);
      mesh(cyl(0.065, 0.06, 0.3), hood, 0, 0, 0, sh);
      const el = pivot(sh, 0, -0.3, 0);
      mesh(cyl(0.06, 0.055, 0.24), hood, 0, 0, 0, el);
      mesh(sph(0.05, 6, 5), tskin, 0, -0.27, 0, el);
      R['sh' + s] = sh; R['el' + s] = el;
    });
    const head = pivot(torso, 0, 0.84, 0); R.head = head;
    mesh(sph(0.15, 12, 10), tskin, 0, 0, 0, head);
    mesh(new THREE.SphereGeometry(0.157, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), thair, 0, 0.01, -0.01, head);
    const shades = mesh(box(0.26, 0.055, 0.03), dark, 0, 0.02, 0.14, head);
    mesh(box(0.03, 0.02, 0.2), dark, 0.13, 0.03, 0.04, head); mesh(box(0.03, 0.02, 0.2), dark, -0.13, 0.03, 0.04, head);
    mesh(box(0.04, 0.012, 0.01), mat('white', { color: 0xffffff, emissive: 0x666666 }), 0.06, 0.035, 0.158, head);
    R.shades = shades;
    const mouth = mesh(sph(0.025, 6, 4), mat('mouth', { color: 0x9a3030 }), 0, -0.07, 0.135, head); mouth.scale.set(1.4, 0.6, 0.5); R.mouth = mouth;
    const ph = pivot(head, 0.02, 0.13, 0); ph.rotation.z = -0.25; R.hat = ph;
    const cone = mesh(new THREE.ConeGeometry(0.1, 0.3, 10), mat('partyhat', { map: canvasTex(64, 64, g => {
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#14F195' : '#9945FF'; g.fillRect(0, i * 8, 64, 8); }
    }) }), 0, 0.15, 0, ph);
    mesh(sph(0.04, 6, 5), gold, 0, 0.31, 0, ph);
    castAll(root);
    return R;
  };
  M.animateTeevincs = function (R, pose, t, dt) {
    const k = Math.min(1, dt * 10);
    let shL = 0.1, shR = 0.1, shLz = 0.1, shRz = -0.1, elL = -0.2, elR = -0.2, hipL = 0, hipR = 0, kneeL = 0, kneeR = 0, bob = Math.sin(t * 2) * 0.01;
    if (pose === 'wave') { shR = -2.8; shRz = -0.4 + Math.sin(t * 9) * 0.4; }
    if (pose === 'shock') { shL = shR = -2.6; shLz = 0.6; shRz = -0.6; bob = Math.abs(Math.sin(t * 9)) * 0.12; R.mouth.scale.y = 1.6; }
    if (pose === 'party') {
      const c = Math.sin(t * 12); bob = Math.abs(Math.sin(t * 6)) * 0.3;
      shL = -2.8 + c * 0.4; shR = -2.8 - c * 0.4; shLz = 0.4; shRz = -0.4; hipL = c * 0.5; hipR = -c * 0.5; kneeL = 0.4; kneeR = 0.4;
      R.mouth.scale.y = 1.4; R.hat.rotation.z = -0.25 + c * 0.25;
    }
    sj(R, 'shL', R.shL, 'x', shL, k); sj(R, 'shR', R.shR, 'x', shR, k); sj(R, 'shLz', R.shL, 'z', shLz, k); sj(R, 'shRz', R.shR, 'z', shRz, k);
    sj(R, 'elL', R.elL, 'x', elL, k); sj(R, 'elR', R.elR, 'x', elR, k);
    sj(R, 'hipL', R.hipL, 'x', hipL, k); sj(R, 'hipR', R.hipR, 'x', hipR, k); sj(R, 'kneeL', R.kneeL, 'x', kneeL, k); sj(R, 'kneeR', R.kneeR, 'x', kneeR, k);
    R.body.position.y = bob;
  };

  /* ================================ ENEMIES ================================ */
  const signTex = (txt, bg, fg) => canvasTex(128, 64, g => {
    g.fillStyle = bg; g.fillRect(0, 0, 128, 64); g.strokeStyle = '#6b3f1c'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 58);
    g.fillStyle = fg; g.font = 'bold 40px Bungee, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 64, 35);
  });
  M.makeGoblin = function () {
    const root = new THREE.Group(), body = pivot(root, 0, 0, 0), R = { root, body, kind: 'goblin' };
    const gm = mat('gob', { color: 0x5fcf4a }), gd = mat('gobD', { color: 0x2f7d32 });
    R.legL = pivot(body, 0.14, 0.35, 0); mesh(cyl(0.07, 0.06, 0.35), gd, 0, 0, 0, R.legL);
    R.legR = pivot(body, -0.14, 0.35, 0); mesh(cyl(0.07, 0.06, 0.35), gd, 0, 0, 0, R.legR);
    const b = mesh(sph(0.42, 12, 10), gm, 0, 0.72, 0, body); b.scale.set(1, 0.9, 0.9);
    [1, -1].forEach(s => {
      const h = mesh(new THREE.ConeGeometry(0.08, 0.35, 6), gd, s * 0.25, 1.12, 0, body); h.rotation.z = s * -0.5;
      const e = mesh(sph(0.09, 8, 6), mat('white', { color: 0xffffff, emissive: 0x666666 }), s * 0.14, 0.82, 0.34, body);
      mesh(sph(0.045, 6, 5), mat('redEye', { color: 0xff2020, emissive: 0xaa0000 }), s * 0.14, 0.82, 0.42, body);
      const brow = mesh(box(0.16, 0.035, 0.04), dark, s * 0.14, 0.94, 0.37, body); brow.rotation.z = s * 0.4;
      const arm = pivot(body, s * 0.4, 0.75, 0); mesh(cyl(0.055, 0.05, 0.35), gm, 0, 0, 0, arm); arm.rotation.z = s * 0.4;
      R['arm' + (s > 0 ? 'L' : 'R')] = arm; void e;
    });
    mesh(new THREE.ConeGeometry(0.04, 0.09, 4), mat('white', { color: 0xffffff, emissive: 0x666666 }), 0.08, 0.58, 0.38, body).rotation.x = Math.PI;
    mesh(new THREE.ConeGeometry(0.04, 0.09, 4), mat('white', { color: 0xffffff, emissive: 0x666666 }), -0.08, 0.58, 0.38, body).rotation.x = Math.PI;
    // FUD sign
    const sign = pivot(body, -0.3, 1.3, 0.05); R.sign = sign;
    mesh(cyl(0.02, 0.02, 0.5), mat('stick', { color: 0x6b3f1c }), 0, 0, 0, sign);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshBasicMaterial({ map: signTex('FUD', '#fff1d0', '#d4141c'), side: THREE.DoubleSide }));
    pl.position.set(0, 0.18, 0); sign.add(pl);
    castAll(root);
    return R;
  };
  M.animateGoblin = function (R, t, moving) {
    const s = moving ? Math.sin(t * 12) : 0;
    R.legL.rotation.x = s * 0.7; R.legR.rotation.x = -s * 0.7;
    R.armL.rotation.x = -s * 0.6 - 0.3; R.armR.rotation.x = s * 0.6 - 0.3;
    R.body.position.y = Math.abs(s) * 0.05; R.sign.rotation.z = Math.sin(t * 5) * 0.15;
  };
  M.makeBat = function () {
    const root = new THREE.Group(), body = pivot(root, 0, 0, 0), R = { root, body, kind: 'bat' };
    const bm = mat('bat', { color: 0x6d2cb0 }), wm = new THREE.MeshLambertMaterial({ color: 0x4b1d7a, side: THREE.DoubleSide });
    mesh(sph(0.22, 10, 8), bm, 0, 0, 0, body);
    [1, -1].forEach(s => {
      mesh(new THREE.ConeGeometry(0.06, 0.16, 4), bm, s * 0.11, 0.22, 0, body);
      mesh(sph(0.04, 6, 4), mat('redEye', { color: 0xff2020, emissive: 0xaa0000 }), s * 0.08, 0.05, 0.19, body);
      const w = pivot(body, s * 0.15, 0.02, 0);
      const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(0.55, 0.2); shape.lineTo(0.45, -0.05); shape.lineTo(0.3, 0.02); shape.lineTo(0.2, -0.12); shape.lineTo(0, -0.1);
      const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape), wm); wing.rotation.x = -Math.PI / 2; wing.scale.x = s; w.add(wing);
      R['wing' + (s > 0 ? 'L' : 'R')] = w;
    });
    const rug = mesh(box(0.34, 0.02, 0.22), mat('rug', { map: canvasTex(64, 32, g => { g.fillStyle = '#e94b3c'; g.fillRect(0, 0, 64, 32); g.fillStyle = '#ffd23f'; g.fillRect(0, 10, 64, 4); g.fillRect(0, 20, 64, 3); }) }), 0, -0.3, 0, body);
    R.rug = rug;
    castAll(root);
    return R;
  };
  M.animateBat = function (R, t) {
    const f = Math.sin(t * 22) * 0.9;
    R.wingL.rotation.z = f; R.wingR.rotation.z = -f; R.rug.rotation.z = Math.sin(t * 4) * 0.2;
  };

  /* ================================ PICKUPS ================================ */
  M.solTex = canvasTex(128, 128, (g) => {
    const grd = g.createLinearGradient(0, 128, 128, 0); grd.addColorStop(0, '#9945FF'); grd.addColorStop(1, '#14F195');
    g.fillStyle = '#111'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = grd; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
    g.fillStyle = '#16082c'; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.fill();
    const L = 30, Rr = 98, h = 13, sk = 14; g.fillStyle = grd;
    [[38, 0], [58, 1], [78, 0]].forEach(([y, mid]) => {
      g.beginPath();
      if (mid) { g.moveTo(L, y); g.lineTo(Rr - sk, y); g.lineTo(Rr, y + h); g.lineTo(L + sk, y + h); }
      else { g.moveTo(L + sk, y); g.lineTo(Rr, y); g.lineTo(Rr - sk, y + h); g.lineTo(L, y + h); }
      g.closePath(); g.fill();
    });
  });
  M.makeCoinGeo = () => { const g = new THREE.CylinderGeometry(0.28, 0.28, 0.06, 18); g.rotateX(Math.PI / 2); return g; };
  M.coinMats = () => [new THREE.MeshLambertMaterial({ color: 0x14f195, emissive: 0x0a5a3a }),
                      new THREE.MeshBasicMaterial({ map: M.solTex }), new THREE.MeshBasicMaterial({ map: M.solTex })];

  window.AALIYAH_MODELS = M;
})();
