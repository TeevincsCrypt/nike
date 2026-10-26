/* Procedural pixel art: enemies, boss, Teevincs, backgrounds, props.
   Everything is drawn at low resolution into small canvases and scaled up with nearest-neighbour
   so it sits next to Aaliyah's pixel sprites. Frames are cached. */
(function () {
  'use strict';
  const ART = {};
  const cache = {};
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
  ART.mk = mk;
  function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); }
  // white silhouette version of a frame, for hit flashes
  function flashOf(src) {
    const [c, g] = mk(src.width, src.height);
    g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; R(g, 0, 0, c.width, c.height, '#fff');
    return c;
  }
  function frame(key, w, h, draw) {
    if (!cache[key]) { const [c, g] = mk(w, h); draw(g); cache[key] = c; cache[key + ':f'] = flashOf(c); }
    return cache[key];
  }
  ART.flash = key => cache[key + ':f'];

  /* ------------------------------ JEETER -------------------------------- */
  // hooded paper-hands grunt. pose: walk0..3, wind, hit, punch, down
  ART.jeeter = function (pose) {
    return frame('jeeter:' + pose, 30, 46, g => {
      const hood = '#3b3f4a', hoodD = '#252830', pants = '#1d2029', shoe = '#0e0f13', paper = '#f2f0e6', eye = '#ff2a2a';
      let lx = 0, rx = 0, arm = 0, lean = 0, down = pose === 'down';
      if (pose.startsWith('walk')) { const k = +pose.slice(4); lx = [2, 0, -2, 0][k]; rx = -lx; }
      if (pose === 'wind') { arm = -3; lean = -1; }
      if (pose === 'punch') { arm = 7; lean = 2; }
      if (pose === 'hit') { lean = -3; }
      if (down) {
        R(g, 2, 38, 26, 6, hoodD); R(g, 4, 36, 10, 4, hood); R(g, 20, 40, 8, 4, pants); R(g, 6, 38, 2, 2, eye);
        return;
      }
      // legs
      R(g, 10 + lx, 30, 4, 12, pants); R(g, 17 + rx, 30, 4, 12, pants);
      R(g, 9 + lx, 42, 6, 3, shoe); R(g, 16 + rx, 42, 6, 3, shoe);
      // body (hoodie), hunched
      R(g, 8 + lean, 16, 15, 16, hood); R(g, 8 + lean, 16, 3, 16, hoodD); R(g, 13 + lean, 22, 5, 3, hoodD);
      // hood + shadowed face + red eyes
      R(g, 9 + lean, 5, 13, 12, hood); R(g, 11 + lean, 8, 9, 8, '#0b0c10'); R(g, 13 + lean, 11, 2, 1, eye); R(g, 17 + lean, 11, 2, 1, eye);
      R(g, 9 + lean, 5, 13, 2, hoodD);
      // back arm + paper hand
      R(g, 6 + lean, 18, 3, 9, hoodD); R(g, 5 + lean, 26, 4, 4, paper);
      // front arm + paper hand (attack reach)
      R(g, 20 + lean, 18, 3 + Math.max(0, arm), 4, hood); R(g, 22 + lean + arm, 18, 5, 5, paper); R(g, 23 + lean + arm, 19, 3, 1, '#c9c4b0');
    });
  };

  /* ---------------------------- RUG PULLER ------------------------------ */
  // trench-coat thief swinging a rolled rug. pose: walk0..3, wind, swing, hit, down
  ART.rugger = function (pose) {
    return frame('rugger:' + pose, 40, 52, g => {
      const coat = '#4a3426', coatD = '#2e1f16', skin = '#b88a6a', hat = '#1a1512', rug = '#a3242c', rugD = '#6b1218', gold = '#d9a441';
      let lx = 0, rx = 0, rugA = 0, lean = 0;
      if (pose.startsWith('walk')) { const k = +pose.slice(4); lx = [2, 0, -2, 0][k]; rx = -lx; }
      if (pose === 'wind') { rugA = -1; lean = -2; }
      if (pose === 'swing') { rugA = 1; lean = 3; }
      if (pose === 'hit') lean = -3;
      if (pose === 'down') { R(g, 4, 44, 30, 6, coatD); R(g, 6, 42, 8, 4, skin); R(g, 26, 40, 12, 4, rug); return; }
      R(g, 13 + lx, 36, 4, 13, '#1b1714'); R(g, 21 + rx, 36, 4, 13, '#1b1714');
      R(g, 12 + lx, 49, 6, 3, '#0c0a09'); R(g, 20 + rx, 49, 6, 3, '#0c0a09');
      // long coat
      R(g, 10 + lean, 16, 18, 24, coat); R(g, 10 + lean, 16, 4, 24, coatD); R(g, 18 + lean, 18, 1, 20, coatD);
      R(g, 17 + lean, 20, 2, 2, gold); R(g, 17 + lean, 26, 2, 2, gold);
      // head, flat cap, grin
      R(g, 13 + lean, 6, 11, 11, skin); R(g, 12 + lean, 4, 14, 4, hat); R(g, 22 + lean, 6, 5, 2, hat);
      R(g, 20 + lean, 10, 2, 2, '#111'); R(g, 17 + lean, 14, 6, 1, '#4a1d14');
      // rolled rug club
      if (rugA < 0) { R(g, 2, 2, 7, 22, rug); R(g, 2, 2, 7, 3, rugD); R(g, 3, 8, 5, 1, gold); R(g, 3, 16, 5, 1, gold); R(g, 7, 18, 6, 4, skin); }
      else if (rugA > 0) { R(g, 26, 18, 14, 7, rug); R(g, 36, 18, 4, 7, rugD); R(g, 29, 19, 1, 5, gold); R(g, 33, 19, 1, 5, gold); R(g, 24 + lean, 19, 4, 4, skin); }
      else { R(g, 27 + lean, 10, 6, 24, rug); R(g, 27 + lean, 10, 6, 3, rugD); R(g, 28 + lean, 16, 4, 1, gold); R(g, 28 + lean, 26, 4, 1, gold); R(g, 25 + lean, 22, 4, 4, skin); }
    });
  };

  /* ----------------------------- MEV BOT -------------------------------- */
  // flying sandwich drone. pose: fly0, fly1, charge, hit
  ART.mev = function (pose) {
    return frame('mev:' + pose, 34, 26, g => {
      const metal = '#5a6070', dark = '#2a2e38', bun = '#c8913f', bunD = '#8f5f22', lettuce = '#5bbd3a', tomato = '#d8312a', eye = pose === 'charge' ? '#fff' : '#ff3030';
      const r = pose === 'fly1' ? 1 : 0;
      // rotors
      R(g, 2 + r * 2, 1, 10, 2, '#8c93a3'); R(g, 22 - r * 2, 1, 10, 2, '#8c93a3'); R(g, 6, 3, 2, 3, dark); R(g, 26, 3, 2, 3, dark);
      // sandwich body
      R(g, 4, 6, 26, 5, bun); R(g, 6, 5, 22, 1, bun); R(g, 4, 10, 26, 1, bunD);
      R(g, 3, 11, 28, 2, lettuce); R(g, 4, 13, 26, 2, tomato);
      R(g, 4, 15, 26, 4, bun); R(g, 4, 18, 26, 1, bunD);
      for (let i = 0; i < 4; i++) R(g, 9 + i * 5, 7, 1, 1, '#f3e1b0');
      // metal frame + eye
      R(g, 12, 19, 10, 5, metal); R(g, 12, 23, 10, 1, dark); R(g, 15, 20, 4, 3, eye);
      if (pose === 'charge') { R(g, 14, 19, 6, 5, '#ff8080'); R(g, 16, 21, 2, 1, '#fff'); }
    });
  };

  /* ----------------------------- BUNDLER -------------------------------- */
  // heavy in a gas mask with a shield of bundled coins. pose: walk0..3, bash, hit, down, broken (no shield)
  ART.bundler = function (pose) {
    return frame('bundler:' + pose, 46, 54, g => {
      const suit = '#4b5240', suitD = '#2c3126', mask = '#1a1c1e', lens = '#7fe8ff', coin = '#d9a441', coinD = '#8a6414', purple = '#8f4dff';
      let lx = 0, rx = 0, sh = 0, lean = 0;
      const shield = pose !== 'broken' && !pose.endsWith('_ns');
      const p = pose.replace('_ns', '');
      if (p.startsWith('walk')) { const k = +p.slice(4); lx = [2, 0, -2, 0][k]; rx = -lx; }
      if (p === 'bash') { sh = 5; lean = 3; }
      if (p === 'hit') lean = -3;
      if (p === 'down') { R(g, 4, 46, 36, 7, suitD); R(g, 6, 43, 12, 6, mask); R(g, 9, 45, 3, 2, lens); return; }
      R(g, 13 + lx, 38, 7, 13, suitD); R(g, 24 + rx, 38, 7, 13, suitD); R(g, 12 + lx, 50, 9, 4, '#111'); R(g, 23 + rx, 50, 9, 4, '#111');
      R(g, 10 + lean, 16, 24, 24, suit); R(g, 10 + lean, 16, 5, 24, suitD); R(g, 10 + lean, 30, 24, 3, '#3a2a1a');
      R(g, 14 + lean, 4, 15, 14, mask); R(g, 16 + lean, 8, 4, 4, lens); R(g, 23 + lean, 8, 4, 4, lens); R(g, 19 + lean, 13, 6, 5, '#333');
      R(g, 20 + lean, 16, 4, 2, '#555');
      if (shield) {
        const sx = 28 + sh + lean;
        R(g, sx, 10, 12, 34, coinD);
        for (let i = 0; i < 8; i++) { R(g, sx + 1, 11 + i * 4, 10, 3, i % 2 ? coin : '#f2c35c'); R(g, sx + 4, 12 + i * 4, 4, 1, i % 3 ? coinD : purple); }
        R(g, sx - 3, 24, 4, 5, suit);
      } else { R(g, 32 + lean, 20, 6, 5, suit); R(g, 37 + lean, 20, 4, 5, '#b88a6a'); }
    });
  };

  /* ------------------------------- THE DEV ------------------------------- */
  // hooded boss with a laptop-glow face and a rug cape. pose: idle0/1, wind, dash, slam, cast, hit, down
  ART.dev = function (pose) {
    return frame('dev:' + pose, 70, 84, g => {
      const hood = '#17141f', hoodL = '#2a2438', glow = '#9b5cff', glowL = '#d8c2ff', rug = '#8e1b24', rugL = '#c8333d', gold = '#e3b14a', skin = '#c99a7a';
      let lean = 0, arm = 0, cape = 0, bob = 0;
      if (pose === 'idle1') bob = 1;
      if (pose === 'wind') { lean = -3; arm = -1; }
      if (pose === 'dash') { lean = 6; cape = 6; }
      if (pose === 'slam') { arm = 2; bob = 3; }
      if (pose === 'cast') { arm = 3; }
      if (pose === 'hit') lean = -5;
      if (pose === 'down') {
        R(g, 6, 70, 58, 12, rug); R(g, 6, 70, 58, 2, rugL); R(g, 10, 64, 30, 12, hood); R(g, 14, 66, 12, 8, glow); return;
      }
      // rug cape
      R(g, 12 - cape, 22 + bob, 30, 54, rug); R(g, 12 - cape, 22 + bob, 30, 3, rugL);
      for (let i = 0; i < 5; i++) R(g, 14 - cape, 30 + i * 9 + bob, 26, 1, gold);
      for (let i = 0; i < 6; i++) R(g, 13 - cape + i * 5, 76 + bob, 2, 4, gold);
      // legs
      R(g, 28, 60, 7, 22, hood); R(g, 40, 60, 7, 22, hood); R(g, 26, 80, 10, 4, '#000'); R(g, 39, 80, 10, 4, '#000');
      // body
      R(g, 22 + lean, 24 + bob, 30, 40, hood); R(g, 22 + lean, 24 + bob, 6, 40, hoodL);
      R(g, 31 + lean, 36 + bob, 12, 6, hoodL); R(g, 32 + lean, 37 + bob, 10, 4, glow); // chest "DEV" plate
      // hood + glowing screen face
      R(g, 25 + lean, 4 + bob, 26, 24, hood); R(g, 25 + lean, 4 + bob, 26, 4, hoodL);
      R(g, 29 + lean, 10 + bob, 18, 14, glow); R(g, 31 + lean, 12 + bob, 14, 10, glowL);
      R(g, 33 + lean, 15 + bob, 3, 2, '#2a0b4a'); R(g, 40 + lean, 15 + bob, 3, 2, '#2a0b4a'); R(g, 34 + lean, 19 + bob, 8, 1, '#2a0b4a');
      // arms
      if (arm === 2) { R(g, 46 + lean, 4 + bob, 6, 26, hood); R(g, 44 + lean, 0 + bob, 10, 7, skin); R(g, 18 + lean, 4 + bob, 6, 26, hood); R(g, 16 + lean, 0 + bob, 10, 7, skin); }
      else if (arm === 3) { R(g, 50 + lean, 30 + bob, 16, 6, hood); R(g, 64 + lean, 28 + bob, 6, 9, skin); R(g, 62 + lean, 22 + bob, 8, 4, glow); }
      else { R(g, 50 + lean + (arm < 0 ? -4 : 0), 28 + bob, 7, 24, hood); R(g, 50 + lean + (arm < 0 ? -4 : 0), 50 + bob, 7, 6, skin); R(g, 18 + lean, 28 + bob, 7, 24, hood); }
    });
  };

  /* ------------------------------ TEEVINCS ------------------------------- */
  // hooded trader at a desk of monitors. pose: idle0/1, hype0/1, type
  ART.teevincs = function (pose) {
    return frame('tee:' + pose, 64, 56, g => {
      const hood = '#5b2fb0', hoodD = '#3a1d78', skin = '#a8714f', desk = '#2b2523', deskL = '#3d3532', screen = '#0b1a12';
      const hype = pose.startsWith('hype'), up = pose === 'hype1';
      // monitors
      [[2, 4], [22, 0], [42, 4]].forEach(([x, y], i) => {
        R(g, x, y, 20, 14, '#1a1a1a'); R(g, x + 1, y + 1, 18, 12, screen);
        for (let k = 0; k < 6; k++) { const hgt = hype ? 2 + k * 1.6 : 2 + ((k * 7 + i * 3) % 5); R(g, x + 2 + k * 3, y + 12 - hgt, 2, hgt, hype || (k + i) % 3 ? '#19e68c' : '#ff3a3a'); }
        R(g, x + 9, y + 14, 2, 3, '#1a1a1a');
      });
      // chair back
      R(g, 22, 28, 20, 20, '#141414');
      // body
      R(g, 24, 30 - (up ? 3 : 0), 16, 16, hood); R(g, 24, 30 - (up ? 3 : 0), 3, 16, hoodD);
      // head (hood up, screen glow on face)
      R(g, 26, 20 - (up ? 3 : 0), 12, 12, hood); R(g, 28, 23 - (up ? 3 : 0), 8, 8, skin); R(g, 28, 23 - (up ? 3 : 0), 8, 2, '#2a1a10');
      R(g, 29, 26 - (up ? 3 : 0), 2, 1, '#111'); R(g, 33, 26 - (up ? 3 : 0), 2, 1, '#111');
      if (hype) { R(g, 30, 29 - (up ? 3 : 0), 4, 2, '#3a0d0d'); R(g, 18, 12 + (up ? -4 : 0), 5, 14, hood); R(g, 41, 12 + (up ? -4 : 0), 5, 14, hood); R(g, 18, 9 + (up ? -4 : 0), 5, 4, skin); R(g, 41, 9 + (up ? -4 : 0), 5, 4, skin); }
      else { R(g, 20, 38, 8, 4, hood); R(g, 36, 38, 8, 4, hood); R(g, 22 + (pose === 'type' ? 1 : 0), 41, 5, 2, skin); R(g, 37, 41 - (pose === 'type' ? 1 : 0), 5, 2, skin); }
      // desk
      R(g, 0, 43, 64, 5, deskL); R(g, 0, 48, 64, 8, desk); R(g, 20, 42, 24, 2, '#555'); // keyboard
    });
  };

  /* ------------------------------ PORTRAITS ------------------------------ */
  ART.portrait = function (who) {
    const [c, g] = mk(48, 48);
    if (who === 'teevincs') {
      R(g, 0, 0, 48, 48, '#0b1a12');
      for (let i = 0; i < 10; i++) R(g, 2 + i * 5, 30 - (i * 3) % 14, 3, 18, i % 3 ? '#19e68c55' : '#ff3a3a55');
      R(g, 10, 10, 28, 38, '#5b2fb0'); R(g, 14, 14, 20, 22, '#a8714f'); R(g, 14, 14, 20, 5, '#2a1a10');
      R(g, 17, 23, 4, 2, '#111'); R(g, 27, 23, 4, 2, '#111'); R(g, 21, 31, 6, 1, '#4a1d14'); R(g, 10, 36, 28, 12, '#3a1d78');
    } else if (who === 'dev') {
      R(g, 0, 0, 48, 48, '#120d1a'); R(g, 6, 4, 36, 44, '#17141f'); R(g, 12, 12, 24, 20, '#9b5cff'); R(g, 15, 15, 18, 14, '#d8c2ff');
      R(g, 18, 19, 4, 3, '#2a0b4a'); R(g, 27, 19, 4, 3, '#2a0b4a'); R(g, 19, 25, 11, 1, '#2a0b4a'); R(g, 0, 40, 48, 8, '#8e1b24');
    }
    return c.toDataURL();
  };

  /* --------------------------------- FX ---------------------------------- */
  ART.solCoin = (function () {
    const [c, g] = mk(12, 12);
    R(g, 3, 0, 6, 1, '#14f195'); R(g, 1, 1, 10, 10, '#14f195'); R(g, 0, 3, 12, 6, '#14f195'); R(g, 3, 11, 6, 1, '#9945ff');
    R(g, 1, 6, 10, 5, '#9945ff'); R(g, 2, 2, 8, 8, '#1a0b2e');
    R(g, 4, 3, 5, 1, '#14f195'); R(g, 3, 5, 5, 1, '#7bf0c4'); R(g, 4, 7, 5, 1, '#b47bff');
    return c;
  })();

  /* ------------------------------ BACKGROUNDS ----------------------------- */
  // Each zone: sky (fixed), far (0.15 parallax), mid (0.45 parallax). Tiles are 320x180, drawn 2x.
  function noise(g, w, h, n, cols, a) { for (let i = 0; i < n; i++) { g.globalAlpha = (a || 0.2) * Math.random(); g.fillStyle = cols[i % cols.length]; g.fillRect(Math.random() * w | 0, Math.random() * h | 0, 1, 1); } g.globalAlpha = 1; }
  ART.backgrounds = function () {
    const B = {};
    // ---- night sky with a market-chart aurora
    const [sky, s] = mk(320, 180);
    const grd = s.createLinearGradient(0, 0, 0, 180); grd.addColorStop(0, '#05060c'); grd.addColorStop(0.55, '#140c1c'); grd.addColorStop(1, '#3a1214');
    s.fillStyle = grd; s.fillRect(0, 0, 320, 180);
    for (let i = 0; i < 70; i++) R(s, Math.random() * 320, Math.random() * 100, 1, 1, Math.random() < 0.2 ? '#ffffff' : '#7d7790');
    R(s, 250, 22, 14, 14, '#d9d2c3'); R(s, 248, 24, 18, 10, '#d9d2c3'); R(s, 254, 26, 4, 4, '#b9b1a1'); R(s, 259, 31, 3, 2, '#b9b1a1');
    // candlestick chart across the sky, faint
    let y = 70;
    for (let x = 6; x < 320; x += 9) {
      const up = Math.random() < 0.45, len = 4 + Math.random() * 14; s.globalAlpha = 0.28;
      R(s, x + 2, y - len - 4, 1, len + 8, up ? '#19e68c' : '#ff3a3a'); R(s, x, y - len, 5, len, up ? '#19e68c' : '#ff3a3a');
      y += up ? -len * 0.5 : len * 0.6; y = Math.max(30, Math.min(110, y));
    }
    s.globalAlpha = 1; B.sky = sky;
    // ---- far: ruined skyline + smoke
    const [far, f] = mk(320, 180);
    for (let x = 0; x < 320; x += 6 + (x * 7) % 11) {
      const h = 30 + ((x * 13) % 60), w = 10 + (x * 3) % 14; R(f, x, 150 - h, w, h + 30, '#0d0b12');
      if ((x * 5) % 3 === 0) R(f, x + 2, 150 - h - 6, 2, 6, '#0d0b12');
      for (let wy = 150 - h + 4; wy < 145; wy += 6) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (Math.random() < 0.12) R(f, wx, wy, 1, 2, Math.random() < 0.5 ? '#ff7a2a' : '#3a2a1a');
    }
    f.globalAlpha = 0.25; for (let i = 0; i < 12; i++) { f.fillStyle = '#2a2026'; f.beginPath(); f.arc(Math.random() * 320, 120 + Math.random() * 40, 14 + Math.random() * 20, 0, 7); f.fill(); } f.globalAlpha = 1;
    B.far = far;
    // ---- trenches mid: dirt wall, planks, barbed wire, sandbags
    const [mid, m] = mk(320, 180);
    R(m, 0, 92, 320, 88, '#24180f');
    for (let x = 0; x < 320; x += 16) { R(m, x, 96, 14, 70, '#3a2817'); R(m, x, 96, 14, 2, '#4d3720'); R(m, x + 13, 96, 1, 70, '#1a1109'); }
    R(m, 0, 92, 320, 6, '#1a1109');
    for (let x = 0; x < 320; x += 40) { R(m, x + 6, 62, 2, 34, '#2b2015'); R(m, x + 30, 66, 2, 30, '#2b2015'); }
    m.strokeStyle = '#6c6c74'; m.lineWidth = 1; m.beginPath();
    for (let x = 0; x <= 320; x += 2) m.lineTo(x, 70 + Math.sin(x * 0.4) * 3); m.stroke();
    for (let x = 0; x < 320; x += 5) R(m, x, 69 + Math.sin(x * 0.4) * 3, 1, 3, '#8a8a92');
    for (let x = 0; x < 320; x += 22) { R(m, x, 84, 20, 9, '#5d5238'); R(m, x + 1, 84, 18, 2, '#776a4a'); R(m, x + 10, 76, 20, 9, '#544a32'); R(m, x + 11, 76, 18, 2, '#6c5f42'); }
    noise(m, 320, 180, 900, ['#000', '#4d3720'], 0.25); B.trenches = mid;
    // ---- bunker mid: concrete, pipes, hazard stripes, chart monitors
    const [bk, b] = mk(320, 180);
    R(b, 0, 0, 320, 180, '#1b1d22');
    for (let x = 0; x < 320; x += 40) { R(b, x, 0, 38, 180, '#23262c'); R(b, x + 38, 0, 2, 180, '#101115'); }
    R(b, 0, 30, 320, 6, '#3a3f47'); R(b, 0, 36, 320, 2, '#0e0f12'); R(b, 0, 50, 320, 4, '#4a2a2a');
    for (let x = 0; x < 320; x += 80) {
      R(b, x + 10, 70, 44, 28, '#0b0c0e'); R(b, x + 12, 72, 40, 24, '#06140d');
      let yy = 88; for (let k = 0; k < 9; k++) { const up = (k * 7 + x) % 3 !== 0; const len = 2 + (k * 5 + x) % 7; R(b, x + 14 + k * 4, (up ? yy - len : yy), 3, len, up ? '#19e68c' : '#ff3a3a'); yy += up ? -2 : 2; }
      R(b, x + 60, 60, 8, 8, '#55181a'); R(b, x + 62, 62, 4, 4, '#ff2a2a');
    }
    for (let x = 0; x < 320; x += 8) R(b, x, 150, 4, 8, '#d1a81c'), R(b, x + 4, 150, 4, 8, '#111');
    noise(b, 320, 180, 700, ['#000', '#3a3f47'], 0.3); B.bunker = bk;
    // ---- liquidity pool mid: cave with glowing pool
    const [pl, p] = mk(320, 180);
    R(p, 0, 0, 320, 180, '#0c0812');
    for (let x = 0; x < 320; x += 12) { const h = 20 + (x * 17) % 40; R(p, x, 0, 12, h, '#160f1f'); R(p, x + 4, h, 4, 6, '#160f1f'); }
    const pg = p.createLinearGradient(0, 120, 0, 160); pg.addColorStop(0, '#5b2fb0'); pg.addColorStop(1, '#14f195');
    p.fillStyle = pg; p.globalAlpha = 0.35; p.fillRect(0, 120, 320, 40); p.globalAlpha = 1;
    for (let i = 0; i < 40; i++) R(p, Math.random() * 320, 122 + Math.random() * 36, 2, 1, '#b8ffe0');
    noise(p, 320, 180, 500, ['#000', '#2a1d3a'], 0.3); B.pool = pl;
    // ---- HQ: dim room with screens
    const [hq, h] = mk(320, 180);
    R(h, 0, 0, 320, 180, '#1d1a22'); for (let x = 0; x < 320; x += 20) R(h, x, 0, 18, 180, '#24202a');
    R(h, 0, 120, 320, 4, '#2e2934'); R(h, 0, 150, 320, 30, '#16141a');
    for (let x = 0; x < 320; x += 40) { R(h, x + 6, 70, 28, 20, '#0a0a0c'); R(h, x + 7, 71, 26, 18, '#0b1a12'); for (let k = 0; k < 6; k++) R(h, x + 9 + k * 4, 86 - (k * 3 + x) % 12, 2, (k * 3 + x) % 12 + 2, k % 3 ? '#19e68c' : '#ff3a3a'); }
    for (let x = 10; x < 320; x += 80) { R(h, x, 20, 40, 30, '#120f16'); R(h, x + 2, 22, 36, 26, '#3a1d78'); R(h, x + 8, 30, 24, 3, '#9945ff'); R(h, x + 8, 36, 16, 3, '#14f195'); }
    noise(h, 320, 180, 500, ['#000', '#3a3540'], 0.25);
    B.hq = hq;
    // ---- ground strips (tileable, 64x40)
    const ground = (top, body, line) => { const [c, gg] = mk(64, 40); R(gg, 0, 0, 64, 40, body); R(gg, 0, 0, 64, 3, top); for (let i = 0; i < 6; i++) R(gg, (i * 23) % 64, 8 + (i * 11) % 28, 6, 1, line); noise(gg, 64, 40, 160, ['#000', top], 0.35); return c; };
    B.groundTrenches = ground('#5a4127', '#2b1d10', '#1a1109');
    B.groundBunker = ground('#6d737d', '#2a2d33', '#16181c');
    B.groundPool = ground('#4b2f7a', '#1a1124', '#0c0812');
    B.groundHq = ground('#3a3540', '#1c1a20', '#0c0b0e');
    return B;
  };

  /* -------------------------------- PROPS -------------------------------- */
  ART.barrel = function (t) {
    const k = Math.floor(t * 12) % 6;
    return frame('barrel:' + k, 24, 48, g => {
      // oil drum
      R(g, 4, 26, 16, 22, '#3a3f2a'); R(g, 4, 26, 4, 22, '#4d5338'); R(g, 4, 30, 16, 2, '#22251a'); R(g, 4, 40, 16, 2, '#22251a'); R(g, 3, 25, 18, 2, '#2a2d1e');
      // flames: layered tongues that flicker per frame
      const sway = [0, 1, 0, -1, 1, -1][k], hgt = [0, 2, 1, 3, 1, 2][k];
      const tongue = (cx, base, w, h, col) => { for (let y = 0; y < h; y++) { const ww = Math.max(1, Math.round(w * (1 - y / h) * (y < 2 ? 0.8 : 1))); R(g, cx - ww / 2 + Math.round(sway * y / h * 2), base - y, ww, 1, col); } };
      tongue(12, 26, 14, 14 + hgt, '#c8281a'); tongue(9, 26, 7, 10 + (k % 3), '#ff5a1a'); tongue(15, 26, 7, 11 + ((k + 1) % 3), '#ff5a1a');
      tongue(12, 26, 9, 10 + hgt, '#ff9a2a'); tongue(12, 26, 5, 6 + (k % 2), '#ffe08a');
      if (k % 2) R(g, 6 + k, 6 - hgt, 1, 1, '#ffb84a'); else R(g, 16 - k, 4, 1, 1, '#ff7a2a');
    });
  };
  ART.sandbags = function (w) {
    return frame('bags:' + w, w, 24, g => {
      for (let row = 0; row < 3; row++) for (let x = (row % 2) * 8 - 8; x < w; x += 16) {
        R(g, x + 1, 16 - row * 8, 15, 8, '#6a5b3e'); R(g, x + 2, 16 - row * 8, 13, 2, '#86744f'); R(g, x + 1, 23 - row * 8, 15, 1, '#3e3423');
      }
    });
  };
  ART.crate = function (w, h) {
    return frame('crate:' + w + 'x' + h, w, h, g => {
      R(g, 0, 0, w, h, '#4a3a26'); R(g, 1, 1, w - 2, h - 2, '#6a5236'); R(g, 0, 0, w, 2, '#86684a');
      g.strokeStyle = '#3a2a18'; g.lineWidth = 2; g.beginPath(); g.moveTo(2, 2); g.lineTo(w - 2, h - 2); g.moveTo(w - 2, 2); g.lineTo(2, h - 2); g.stroke();
      R(g, w / 2 - 6, h / 2 - 3, 12, 6, '#1a0b2e'); R(g, w / 2 - 4, h / 2 - 1, 8, 2, '#14f195');
    });
  };

  window.AALIYAH_ART = ART;
})();
