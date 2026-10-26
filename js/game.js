/* AALIYAH: INTO THE TRENCHES — 2D side-scrolling brawler.
   Aaliyah fights through the Solana trenches to deliver SOL to Teevincs so he can trench. */
(function () {
  'use strict';
  const CFG = window.AALIYAH_CONFIG, AU = window.AALIYAH_AUDIO, ART = window.AALIYAH_ART, LV = window.AALIYAH_LEVEL;
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rpick = a => a[Math.floor(Math.random() * a.length)];
  const GY = LV.GROUND, STEP = 1 / 60, GRAV = 1900;
  const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (IS_TOUCH) document.body.classList.add('touch');

  /* =============================== CANVAS =============================== */
  const cv = $('game'), g = cv.getContext('2d');
  let VW = 640, VH = 360, SC = 1;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, CFG.MAX_DPR || 2), w = innerWidth, h = innerHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px';
    SC = cv.height / 360; VW = cv.width / SC; VH = 360;
    if (VW < 560) { SC = cv.width / 560; VW = 560; VH = cv.height / SC; }
    document.body.classList.toggle('portrait', h > w);
  }
  addEventListener('resize', resize); resize();

  /* ================================ INPUT =============================== */
  const BTN = ['left', 'right', 'down', 'jump', 'attack', 'block', 'blast'];
  const keys = {}, touch = {}, input = {}, pressed = {};
  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'down', KeyS: 'down',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyJ: 'attack', KeyX: 'attack', KeyK: 'block', KeyC: 'block', ShiftLeft: 'block',
    KeyL: 'blast', KeyV: 'blast', Enter: 'advance' };
  ['touchend', 'click', 'keydown', 'pointerup'].forEach(n => addEventListener(n, () => AU.unlock(), { passive: true, capture: true }));
  addEventListener('keydown', e => {
    if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
    if (e.code === 'KeyM') { toggleMute(); return; }
    const k = KEYMAP[e.code]; if (!k) return;
    e.preventDefault(); keys[k] = true;
    if (!e.repeat) { pressed[k] = true; if (k === 'jump' || k === 'attack') pressed.advance = true; }
    if (state === 'title' && (k === 'jump' || k === 'advance' || k === 'attack') && !e.repeat && assetsReady) startGame(true);
  });
  addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  const touchEl = $('touch');
  function readTouches(e) {
    const set = {};
    for (const t of e.touches) {
      const el = document.elementFromPoint(t.clientX, t.clientY), b = el && el.closest && el.closest('[data-btn]');
      if (b) set[b.dataset.btn] = true;
    }
    for (const k of BTN) {
      if (set[k] && !touch[k]) { pressed[k] = true; if (k === 'jump' || k === 'attack') pressed.advance = true; }
      touch[k] = !!set[k];
      const el = touchEl.querySelector('[data-btn="' + k + '"]'); if (el) el.classList.toggle('on', touch[k]);
    }
  }
  ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(n => addEventListener(n, e => {
    if (e.target.closest && e.target.closest('#touch')) e.preventDefault();
    readTouches(e);
  }, { passive: false }));
  cv.addEventListener('pointerdown', () => { pressed.advance = true; });
  $('dialogue').addEventListener('pointerdown', e => { e.preventDefault(); pressed.advance = true; });
  function pollInput() { for (const k of BTN) input[k] = !!(keys[k] || touch[k]); }

  /* =============================== ASSETS =============================== */
  let atlas = null, meta = null, shieldImg = null, BG = null, assetsReady = false;
  const portraits = {};
  function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
  Promise.all([loadImg(CFG.SPRITES.atlas), fetch(CFG.SPRITES.meta).then(r => r.json()), loadImg(CFG.SPRITES.shield).catch(() => null)])
    .then(([a, m, s]) => { atlas = a; meta = m; shieldImg = s; assetsReady = true; $('btn-start').disabled = false; $('btn-start').textContent = '▶ ENTER THE TRENCHES'; })
    .catch(err => { $('btn-start').textContent = 'Failed to load sprites'; console.error(err); });

  /* ============================== STATE ================================= */
  let state = 'title', paused = false;
  const W = { t: 0, camX: 0, shake: 0, freeze: 0, lock: null, waves: [], waveIdx: 0, active: null, spawnQ: [], waveEnemies: [], enemies: [], shots: [], parts: [], coins: [],
              boss: null, zoneId: null, goT: 0, pickups: [], stats: null, pump: 0, sendT: 0, outroWalk: 0 };
  let P = null;
  function newPlayer() {
    return { x: LV.START_X, y: GY, vx: 0, vy: 0, face: 1, onGround: true, onPlat: false, st: 'idle', t: 0, animT: 0, hp: CFG.PLAYER_HP, sol: CFG.START_SOL || 0,
             meter: 0, inv: 0, stage: 0, queued: false, hitSet: new Set(), blockT: 0, coyote: 0, jumpBuf: 0, lastSafeX: LV.START_X, landT: 0, dropT: 0,
             shieldFlash: 0, w: 30, h: 82, vyPrev: 0 };
  }

  /* ============================ TOAST / SLAM ============================ */
  const toastEl = $('toast'), slamEl = $('slam'), bannerEl = $('banner'); let toastT = 0, slamT = 0;
  function fmt(s) { return String(s).replace(/\{sol\}/g, P ? P.sol.toFixed(1) : '0').replace(/\{time\}/g, fmtTime(W.stats ? W.stats.time : 0)); }
  function fmtTime(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function toast(msg, dur) { toastEl.textContent = fmt(msg); toastEl.classList.add('show'); toastT = dur || 2.6; }
  function say(text, who) { if (text && !DLG.active && AU.voiceOn()) AU.say(text, who || 'aaliyah'); }
  function toastSay(msg, dur) { toast(msg, dur); say(msg); }
  function slam(text) { slamEl.textContent = fmt(text); slamEl.classList.remove('go'); void slamEl.offsetWidth; slamEl.classList.add('go'); slamT = 1.9; shake(8); }
  function banner(text) { bannerEl.textContent = text; bannerEl.classList.remove('go'); void bannerEl.offsetWidth; bannerEl.classList.add('go'); }
  function shake(m) { W.shake = Math.max(W.shake, m); }
  function bark(kind) { const l = CFG.BARKS && CFG.BARKS[kind]; if (l && l.length) AU.bark(rpick(l), 'aaliyah'); }

  /* ============================== DIALOGUE ============================== */
  const VC = CFG.VOICE || {};
  const DLG = { el: $('dialogue'), lines: [], i: -1, shown: 0, full: '', done: null, active: false, blip: 0, who: '', speed: 48 };
  const dlgName = $('dlg-name'), dlgText = $('dlg-text'), dlgPortrait = $('dlg-portrait'), dlgWrap = $('dlg-portrait-wrap');
  function startDialogue(lines, done) { DLG.lines = lines; DLG.i = -1; DLG.done = done; DLG.active = true; nextLine(); }
  function nextLine() {
    DLG.i++;
    if (DLG.i >= DLG.lines.length) { AU.stopVoice(); DLG.active = false; DLG.el.className = ''; const d = DLG.done; DLG.done = null; if (d) d(); return; }
    const ln = DLG.lines[DLG.i], who = ln.who || 'narrator';
    DLG.who = who; DLG.full = fmt(ln.text || ''); DLG.shown = 0; dlgText.textContent = '';
    dlgName.textContent = (CFG.NAMES && CFG.NAMES[who]) || '';
    DLG.el.className = 'show who-' + who;
    const src = (CFG.PORTRAITS && CFG.PORTRAITS[who]) || portraits[who];
    if (src) { dlgPortrait.src = src; dlgWrap.style.display = ''; } else dlgWrap.style.display = 'none';
    dlgWrap.classList.remove('shaky');
    if (ln.shake) { shake(6); void dlgWrap.offsetWidth; dlgWrap.classList.add('shaky'); }
    if (ln.sfx) AU.sfx(ln.sfx);
    DLG.speed = 48; DLG.voiceDone = false; DLG.autoT = -1;
    const no = DLG.i;
    AU.onLineStart = dur => { if (DLG.i === no) DLG.speed = Math.max(18, DLG.full.length / Math.max(0.4, dur * 0.9)); };
    DLG.spoken = AU.say(ln.text || '', who, ln.voice, () => { if (DLG.i === no) DLG.voiceDone = true; });
    if (!DLG.spoken) DLG.voiceDone = true;
    if (ln.slam) slam(ln.slam);
    if (ln.event) dialogueEvent(ln.event);
  }
  function updateDialogue(dt) {
    if (!DLG.active) return;
    if (pressed.advance) {
      if (DLG.shown < DLG.full.length) { DLG.shown = DLG.full.length; dlgText.textContent = DLG.full; } else { nextLine(); return; }
    }
    if (VC.autoAdvance !== false && DLG.shown >= DLG.full.length && DLG.voiceDone) {
      if (DLG.autoT < 0) DLG.autoT = DLG.spoken ? 0.5 : 1.0 + DLG.full.length * 0.03;
      DLG.autoT -= dt; if (DLG.autoT <= 0) { nextLine(); return; }
    }
    if (DLG.shown < DLG.full.length) {
      const b = Math.floor(DLG.shown); DLG.shown = Math.min(DLG.full.length, DLG.shown + dt * DLG.speed);
      const n = Math.floor(DLG.shown);
      if (n !== b) { dlgText.textContent = DLG.full.slice(0, n); if (!DLG.spoken && (DLG.blip++ % 2) === 0) AU.blip(DLG.who); }
    }
  }
  function dialogueEvent(ev) {
    if (ev === 'send') { W.sendT = 2.5; AU.sfx('send'); }
    if (ev === 'pump') { W.pump = 0.01; AU.music('outro'); AU.sfx('boom'); }
  }

  /* ============================== PARTICLES ============================= */
  function part(o) { if (W.parts.length < 500) W.parts.push(Object.assign({ life: 0, max: 0.5, grav: 0, size: 2 }, o)); }
  function sparks(x, y, n, cols, sp, o) {
    for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), s = rnd(0.3, 1) * sp; part(Object.assign({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color: rpick(cols), max: rnd(0.2, 0.55), grav: 600, size: rnd(1.5, 3.5) }, o || {})); }
  }
  function popText(x, y, text, color, size) { part({ x, y, vx: 0, vy: -40, text, color: color || '#fff', size: size || 14, max: 1.1, kind: 'text' }); }
  function dropSol(x, y, amt, spread) {
    let left = Math.round(amt * 10) / 10;
    while (left > 0.05) { const a = Math.min(left, 1); left = Math.round((left - a) * 10) / 10; W.coins.push({ x, y: y - 20, vx: rnd(-1, 1) * (spread || 160), vy: rnd(-420, -220), amt: a, t: 0, life: 10 }); }
  }

  /* =============================== WORLD ================================ */
  function inPit(x) { for (const [a, b] of LV.pits) if (x > a && x < b) return true; return false; }
  function platTop(p) { return p.y != null ? p.y : GY - p.h; }
  function platformLanding(x, prevY, y) {
    for (const p of LV.platforms) { const top = platTop(p); if (x > p.x - 4 && x < p.x + p.w + 4 && prevY <= top + 1 && y >= top) return top; }
    return null;
  }
  function zoneAt(x) { return LV.zones.find(z => x >= z.x0 && x < z.x1) || LV.zones[LV.zones.length - 1]; }
  function bounds() { return W.lock ? W.lock : [20, LV.END_X]; }
  const ov = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  /* =============================== ENEMIES ============================== */
  const DEF = {
    jeeter: { hp: 34, w: 30, h: 80, speed: 100, reach: 54, wind: 0.42, active: 0.12, recover: 0.75, dmg: 9, knock: 200, sol: [1, 2], art: ART.jeeter },
    rugger: { hp: 55, w: 34, h: 92, speed: 118, reach: 78, wind: 0.55, active: 0.14, recover: 0.95, dmg: 15, knock: 330, sol: [2, 3.5], steal: 1.5, art: ART.rugger },
    mev: { hp: 26, w: 56, h: 40, flying: true, speed: 140, sol: [1.5, 2.5], art: ART.mev },
    bundler: { hp: 80, w: 46, h: 98, speed: 62, reach: 66, wind: 0.65, active: 0.15, recover: 1.05, dmg: 17, knock: 380, sol: [3, 4.5], shield: 45, art: ART.bundler }
  };
  function spawnEnemy(type, side) {
    const d = DEF[type], lb = bounds();
    const x = side === 'L' ? Math.max(lb[0] - 30, W.camX - 50) : Math.min(lb[1] + 30, W.camX + VW + 50);
    const e = { type, d, x, y: d.flying ? GY - 170 : GY, vx: 0, vy: 0, hp: d.hp, face: side === 'L' ? 1 : -1, st: 'enter', t: 0, cd: rnd(0.4, 1.0),
                flash: 0, alive: true, anim: rnd(0, 3), shield: d.shield || 0, cycle: 0, stolen: 0, fade: 1, onGround: !d.flying, turnT: 0 };
    W.enemies.push(e); return e;
  }
  function enemyBox(e) { return e.d.flying ? { x: e.x - e.d.w / 2, y: e.y - 6, w: e.d.w, h: e.d.h } : { x: e.x - e.d.w / 2, y: e.y - e.d.h, w: e.d.w, h: e.d.h }; }
  function playerBox() { const h = P.st === 'crouch' ? 54 : P.st === 'down' ? 26 : P.h; return { x: P.x - P.w / 2, y: P.y - h, w: P.w, h }; }

  function hitEnemy(e, dmg, dir, heavy, kind) {
    if (!e.alive) return;
    const fromFront = Math.sign(P.x - e.x) === e.face;
    if (e.type === 'bundler' && e.shield > 0 && fromFront && kind !== 'blast') {
      if (heavy) {
        e.shield -= dmg; shake(4); AU.sfx('clang'); sparks(e.x + e.face * 26, e.y - 50, 10, ['#f2c35c', '#fff'], 260);
        if (e.shield <= 0) { AU.sfx('hitHeavy'); popText(e.x, e.y - 112, 'SHIELD BROKEN', '#f2c35c', 10); sparks(e.x + e.face * 26, e.y - 50, 30, ['#d9a441', '#8f4dff', '#fff'], 360); e.st = 'hurt'; e.t = 0.7; }
      } else { AU.sfx('clang'); sparks(e.x + e.face * 26, e.y - 50, 6, ['#f2c35c', '#fff'], 200); P.vx = -dir * 160; }
      W.freeze = Math.max(W.freeze, 0.04); return;
    }
    if (e.type === 'bundler' && kind === 'blast' && e.shield > 0) { e.shield = 0; popText(e.x, e.y - 112, 'SHIELD BROKEN', '#f2c35c', 10); }
    e.flash = 0.12; W.freeze = Math.max(W.freeze, heavy ? 0.09 : 0.05); shake(heavy ? 7 : 3);
    AU.sfx(heavy ? 'hitHeavy' : 'hit');
    sparks(e.x - dir * e.d.w * 0.3, e.y - (e.d.flying ? -10 : e.d.h * 0.55), heavy ? 18 : 10, ['#ffd27a', '#ff7a2a', '#fff'], heavy ? 380 : 260);
    P.meter = Math.min(CFG.BLAST_COST, P.meter + (heavy ? 7 : 4));
    if (e.type === 'dev') { bossHit(e, dmg, heavy, kind); return; }
    e.hp -= dmg;
    e.vx = dir * (heavy ? 420 : 170); if (!e.d.flying && heavy) { e.vy = -300; e.onGround = false; }
    if (e.d.flying) e.vy = heavy ? 220 : 90;
    e.st = 'hurt'; e.t = heavy ? 0.5 : 0.28;
    if (e.hp <= 0) killEnemy(e, dir);
  }
  function killEnemy(e, dir) {
    e.alive = false; e.st = 'dead'; e.t = 0; e.vx = dir * 260; e.vy = e.d.flying ? 0 : -260; W.stats.kos++;
    AU.sfx('enemyDie'); sparks(e.x, e.y - (e.d.flying ? -10 : e.d.h / 2), 20, ['#ffd27a', '#ff3a3a', '#555'], 300);
    dropSol(e.x, e.d.flying ? e.y + 20 : e.y - e.d.h / 2, rnd(e.d.sol[0], e.d.sol[1]) + (e.stolen || 0), 140);
    if (Math.random() < 0.45) bark('kill');
  }

  function updateEnemy(e, dt) {
    e.t -= dt; e.anim += dt; if (e.flash > 0) e.flash -= dt;
    const d = e.d, dx = P.x - e.x, adx = Math.abs(dx), pDown = P.st === 'down' || P.st === 'getup';
    if (e.st === 'dead') {
      e.vy += GRAV * dt; e.x += e.vx * dt; e.vx *= 0.92; e.y = Math.min(GY, e.y + e.vy * dt);
      e.fade -= dt * 0.7; return;
    }
    if (d.flying) { updateMev(e, dt, dx, pDown); return; }
    if (!e.onGround) { e.vy += GRAV * dt; e.y += e.vy * dt; if (e.y >= GY && !inPit(e.x)) { e.y = GY; e.vy = 0; e.onGround = true; } }
    if (e.y > GY + 200) { e.alive = false; e.st = 'dead'; e.fade = 0; W.stats.kos++; dropSol(clamp(e.x, W.camX + 40, W.camX + VW - 40), GY - 60, rnd(d.sol[0], d.sol[1]) + e.stolen, 80); return; }
    const nx = e.x + e.vx * dt; if (!inPit(nx) || !e.onGround || e.st === 'hurt') e.x = nx; e.vx *= Math.pow(0.0008, dt);
    if (e.onGround && inPit(e.x)) e.onGround = false;
    const turnTo = Math.sign(dx) || e.face;
    switch (e.st) {
      case 'enter': case 'chase': {
        if (e.type === 'bundler') { if (turnTo !== e.face) { e.turnT += dt; if (e.turnT > 0.8) { e.face = turnTo; e.turnT = 0; } } else e.turnT = 0; }
        else e.face = turnTo;
        if (e.type === 'rugger' && e.stolen > 0) { e.face = -turnTo; e.x -= Math.sign(dx) * d.speed * 1.35 * dt; break; }
        if (adx > d.reach * 0.8) { const mx = e.x + Math.sign(dx) * d.speed * dt; if (!inPit(mx) && !inPit(mx + Math.sign(dx) * 20)) e.x = mx; e.st = 'chase'; }
        e.cd -= dt;
        if (adx <= d.reach && e.cd <= 0 && !pDown && Math.abs(P.y - e.y) < 60 && e.face === turnTo) { e.st = 'wind'; e.t = d.wind; }
        break;
      }
      case 'wind': if (e.t <= 0) { e.st = 'atk'; e.t = d.active; e.hitDone = false; AU.sfx(e.type === 'jeeter' ? 'swing' : 'swingHeavy'); e.vx = e.face * 140; } break;
      case 'atk':
        if (!e.hitDone) {
          const hb = { x: e.face > 0 ? e.x : e.x - d.reach - 6, y: e.y - d.h * 0.8, w: d.reach + 6, h: d.h * 0.6 };
          if (ov(hb, playerBox())) {
            e.hitDone = true;
            const r = damagePlayer(d.dmg, e.x, { knock: d.knock });
            if (r === 'parry') { e.st = 'hurt'; e.t = 1.0; e.vx = -e.face * 260; popText(e.x, e.y - d.h - 10, 'PARRY', '#7fe8ff', 10); break; }
            if (r === 'hit' && e.type === 'rugger' && P.sol > 0.5) {
              const s = Math.round(Math.min(P.sol, d.steal) * 10) / 10; P.sol -= s; e.stolen += s; AU.sfx('steal'); popText(P.x, P.y - 104, '-' + s.toFixed(1) + ' SOL STOLEN', '#ff5a5a', 9); bark('steal');
            }
          }
        }
        if (e.t <= 0) { e.st = 'rec'; e.t = d.recover; }
        break;
      case 'rec': if (e.t <= 0) { e.st = 'chase'; e.cd = rnd(0.2, 0.7); } break;
      case 'hurt': if (e.t <= 0 && e.onGround) { e.st = 'chase'; e.cd = rnd(0.25, 0.6); } break;
    }
    if (e.stolen > 0 && (e.x < W.camX - 80 || e.x > W.camX + VW + 80)) { e.alive = false; e.st = 'dead'; e.fade = 0; popText(P.x, P.y - 110, 'He got away with ' + e.stolen.toFixed(1) + ' SOL', '#ff5a5a', 8); }
  }
  function updateMev(e, dt, dx, pDown) {
    if (!e.side) e.side = e.x < P.x ? -1 : 1;
    let tx = P.x + e.side * 210, ty = GY - 165 + Math.sin(e.anim * 2) * 12;
    if (e.st === 'dive') { tx = P.x + e.side * 44; ty = GY - 70; if (e.t <= 0) { e.st = 'chase'; e.cd = 1.4; } }
    if (e.st === 'hurt' && e.t <= 0) e.st = 'chase';
    const lb = bounds(); tx = clamp(tx, lb[0] + 30, lb[1] - 30);
    if (e.st !== 'hurt') { e.vx += ((tx - e.x) * 2.2 - e.vx) * Math.min(1, dt * 3); e.vy += ((ty - e.y) * 2.6 - e.vy) * Math.min(1, dt * 3); }
    e.x += e.vx * dt; e.y += e.vy * dt; e.face = dx > 0 ? 1 : -1;
    if (e.st === 'chase' || e.st === 'enter') {
      e.st = 'chase'; e.cd -= dt;
      if (e.cd <= 0 && !pDown) { e.cycle++; if (e.cycle % 3 === 0) { e.st = 'dive'; e.t = 1.7; AU.sfx('dash'); } else { e.st = 'charge'; e.t = 0.6; AU.sfx('alarm'); } }
    } else if (e.st === 'charge' && e.t <= 0) {
      const sx = e.x + e.face * 6, sy = e.y + 16, tx2 = P.x, ty2 = P.y - 56, l = Math.hypot(tx2 - sx, ty2 - sy) || 1;
      W.shots.push({ x: sx, y: sy, vx: (tx2 - sx) / l * 330, vy: (ty2 - sy) / l * 330, dmg: 10, owner: 'enemy', kind: 'bolt', life: 3 });
      AU.sfx('shoot'); e.st = 'chase'; e.cd = rnd(1.5, 2.2);
    }
    if (e.st === 'dive' && ov(enemyBox(e), playerBox())) {
      const r = damagePlayer(8, e.x, { knock: 160 });
      if (r !== 'hit') { e.st = 'hurt'; e.t = 0.7; e.vy = -200; } else { e.st = 'chase'; e.cd = 1.6; }
    }
  }

  /* ================================ BOSS ================================ */
  function spawnBoss() {
    const d = { hp: 640, w: 70, h: 150, sol: [0, 0] };
    const e = { type: 'dev', d, x: LV.boss.spawnX, y: GY, vx: 0, vy: 0, hp: d.hp, face: -1, st: 'intro', t: 99, flash: 0, alive: true, anim: 0, fade: 1, heavyHits: 0, phase: 1, onGround: true, contactCd: 0 };
    W.enemies.push(e); W.boss = e; return e;
  }
  function bossHit(e, dmg, heavy, kind) {
    e.hp -= dmg * (e.st === 'stagger' ? 1.25 : 1);
    if (heavy || kind === 'blast') { e.heavyHits++; if ((e.heavyHits >= 3 || kind === 'blast') && e.st !== 'dash' && e.st !== 'leap') { e.heavyHits = 0; e.st = 'stagger'; e.t = 1.1; e.vx = -e.face * 160; } }
    if (e.phase === 1 && e.hp < e.d.hp * 0.55 && e.hp > 0) { e.phase = 2; e.st = 'summon'; e.t = 1.0; popText(e.x, e.y - 170, 'PHASE 2', '#9b5cff', 12); AU.sfx('boom'); shake(10); }
    if (e.hp <= 0) {
      e.alive = false; e.st = 'dead'; W.stats.kos++; AU.sfx('boom'); shake(16); W.freeze = 0.3;
      sparks(e.x, e.y - 80, 60, ['#9b5cff', '#d8c2ff', '#ff3a3a', '#fff'], 500);
      for (const o of W.enemies) if (o !== e && o.alive) killEnemy(o, 1);
      W.shots = W.shots.filter(s => s.owner !== 'enemy');
      W.bossDeadT = 0.9;
    }
  }
  function updateBoss(e, dt) {
    e.t -= dt; e.anim += dt; if (e.flash > 0) e.flash -= dt;
    if (e.st === 'dead') { e.fade = Math.max(0.4, e.fade - dt * 0.4); return; }
    if (e.st === 'intro') return;
    const dx = P.x - e.x, lb = W.lock || LV.boss.arena;
    if (!e.onGround) { e.vy += GRAV * dt; e.y += e.vy * dt; if (e.y >= GY) { e.y = GY; e.vy = 0; e.onGround = true; if (e.st === 'leap') bossSlam(e); } }
    e.x = clamp(e.x + e.vx * dt, lb[0] + 40, lb[1] - 40); if (e.st !== 'dash') e.vx *= Math.pow(0.002, dt);
    e.contactCd -= dt;
    if (e.st !== 'stagger' && e.contactCd <= 0 && ov(enemyBox(e), playerBox())) {
      e.contactCd = 0.8; const r = damagePlayer(e.st === 'dash' ? 20 : 8, e.x, { knock: e.st === 'dash' ? 420 : 260 });
      if (r === 'parry' && e.st === 'dash') { e.st = 'stagger'; e.t = 1.4; e.vx = -e.vx * 0.3; popText(e.x, e.y - 170, 'PARRY', '#7fe8ff', 12); }
    }
    switch (e.st) {
      case 'idle':
        e.face = Math.sign(dx) || e.face;
        if (Math.abs(dx) > 130) e.x += Math.sign(dx) * 70 * dt;
        if (e.t <= 0) {
          const opts = ['dashWind', 'cast', 'leapWind']; if (e.phase === 2 && !W.enemies.some(o => o.alive && o.type !== 'dev')) opts.push('summon');
          e.st = rpick(opts); e.t = { dashWind: 0.75, cast: 0.9, leapWind: 0.5, summon: 1.0 }[e.st];
          if (e.st === 'dashWind') AU.sfx('alarm');
          if (e.st === 'cast') { AU.sfx('candle'); for (let i = 0; i < (e.phase === 2 ? 6 : 4); i++) W.shots.push({ x: clamp(P.x + (i === 0 ? 0 : rnd(-180, 180)), lb[0] + 20, lb[1] - 20), y: -40, vx: 0, vy: 0, warn: 0.8 + i * 0.14, dmg: 12, owner: 'enemy', kind: 'candle', life: 5 }); }
        }
        break;
      case 'dashWind': e.face = Math.sign(dx) || e.face; if (e.t <= 0) { e.st = 'dash'; e.t = 1.6; e.vx = e.face * (e.phase === 2 ? 620 : 520); AU.sfx('dash'); } break;
      case 'dash':
        if (Math.random() < 0.6) part({ x: e.x - e.face * 30, y: e.y - rnd(10, 120), vx: -e.face * 60, vy: 0, color: '#8e1b24', size: 4, max: 0.4 });
        if (e.x <= lb[0] + 42 || e.x >= lb[1] - 42 || e.t <= 0) { e.vx = 0; e.st = 'idle'; e.t = rnd(0.7, 1.1); shake(6); AU.sfx('land'); }
        break;
      case 'cast': if (e.t <= 0) { e.st = 'idle'; e.t = rnd(1.0, 1.4); } break;
      case 'leapWind': if (e.t <= 0) { e.st = 'leap'; e.onGround = false; e.vy = -820; e.vx = clamp(dx * 1.3, -480, 480); AU.sfx('jump'); } break;
      case 'summon': if (e.t <= 0) { spawnEnemy('jeeter', 'L'); spawnEnemy('jeeter', 'R'); AU.sfx('alarm'); e.st = 'idle'; e.t = 1.2; } break;
      case 'stagger': if (e.t <= 0) { e.st = 'idle'; e.t = 0.6; } break;
    }
  }
  function bossSlam(e) {
    AU.sfx('slam'); shake(12); e.st = 'idle'; e.t = rnd(1.0, 1.4); e.vx = 0;
    sparks(e.x, GY - 4, 30, ['#9b5cff', '#5b2fb0', '#ffd27a'], 300);
    [-1, 1].forEach(dir => W.shots.push({ x: e.x + dir * 40, y: GY - 14, vx: dir * 420, vy: 0, dmg: 14, owner: 'enemy', kind: 'wave', life: 1.6 }));
  }

  /* =============================== PLAYER =============================== */
  function damagePlayer(dmg, srcX, o) {
    o = o || {};
    if (state !== 'play' || P.inv > 0 || P.st === 'down' || P.st === 'getup') return 'none';
    const facingSrc = Math.sign(srcX - P.x) === P.face || Math.abs(srcX - P.x) < 4;
    if (P.st === 'block' && facingSrc && !o.unblockable) {
      if (P.blockT < 0.22) {
        AU.sfx('parry'); W.freeze = 0.12; shake(5); P.meter = Math.min(CFG.BLAST_COST, P.meter + 18); W.stats.parries++;
        sparks(P.x + P.face * 26, P.y - 50, 18, ['#7fe8ff', '#ffffff', '#3aa0ff'], 320); P.shieldFlash = 0.35; return 'parry';
      }
      AU.sfx('block'); P.vx = -P.face * (o.knock || 200) * 0.4; P.meter = Math.min(CFG.BLAST_COST, P.meter + 3); sparks(P.x + P.face * 24, P.y - 50, 8, ['#7fe8ff', '#fff'], 200); P.shieldFlash = 0.2;
      if (Math.random() < 0.2) bark('block');
      return 'block';
    }
    P.hp -= dmg; W.stats.dmg += dmg; AU.sfx('hurt'); shake(7); W.freeze = Math.max(W.freeze, 0.07);
    sparks(P.x, P.y - 50, 14, ['#ff4a4a', '#ffd27a', '#fff'], 280);
    const dir = Math.sign(P.x - srcX) || -P.face;
    if (P.hp <= 0) { knockdown(dir); return 'hit'; }
    P.st = 'hurt'; P.t = 0.36; P.vx = dir * (o.knock || 200); P.vy = -220; P.onGround = false; P.inv = 0.55; P.stage = 0;
    if (Math.random() < 0.3) bark('hurt');
    return 'hit';
  }
  function knockdown(dir) {
    P.st = 'down'; P.t = 1.35; P.hp = 0; P.vx = dir * 300; P.vy = -300; P.onGround = false; W.stats.knockdowns++;
    AU.sfx('knockdown'); shake(12); W.freeze = 0.18;
    const loss = Math.round(P.sol * (CFG.KNOCKDOWN_SOL_LOSS || 0.15) * 10) / 10;
    if (loss > 0) { P.sol -= loss; dropSol(P.x, P.y - 40, loss, 220); popText(P.x, P.y - 110, '-' + loss.toFixed(1) + ' SOL', '#ff5a5a', 10); }
    toast('KNOCKED DOWN — grab your SOL back', 2.2);
  }
  function nearestEnemy(range) {
    let best = null, bd = range;
    for (const e of W.enemies) { if (!e.alive || e.st === 'intro') continue; const d = Math.abs(e.x - P.x); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  const ATK = [
    { dur: 0.28, a0: 0.06, a1: 0.15, dmg: 11, reach: 66, h: 60, push: 120, frame: ['block', 1] },
    { dur: 0.30, a0: 0.06, a1: 0.16, dmg: 13, reach: 70, h: 62, push: 140, frame: ['block', 2] },
    { dur: 0.46, a0: 0.12, a1: 0.26, dmg: 22, reach: 86, h: 74, push: 330, heavy: true, frame: ['run', 1] }
  ];
  function startAttack(stage) {
    const t = nearestEnemy(200); if (t) P.face = Math.sign(t.x - P.x) || P.face;
    P.st = 'attack'; P.stage = stage; P.t = 0; P.queued = false; P.hitSet = new Set();
    AU.sfx(ATK[stage].heavy ? 'swingHeavy' : 'swing');
  }
  function attackHits(box, dmg, heavy, kind) {
    for (const e of W.enemies) {
      if (!e.alive || e.st === 'intro' || P.hitSet.has(e)) continue;
      if (ov(box, enemyBox(e))) { P.hitSet.add(e); hitEnemy(e, dmg, P.face, heavy, kind); }
    }
  }
  function updatePlayer(dt) {
    const p = P; p.animT += dt; if (p.inv > 0) p.inv -= dt; if (p.shieldFlash > 0) p.shieldFlash -= dt; if (p.landT > 0) p.landT -= dt; if (p.dropT > 0) p.dropT -= dt;
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (pressed.jump) p.jumpBuf = 0.13; else p.jumpBuf -= dt;
    if (p.onGround) p.coyote = 0.1; else p.coyote -= dt;
    switch (p.st) {
      case 'down': p.t -= dt; if (p.t <= 0 && p.onGround) { p.st = 'getup'; p.t = 0.75; AU.sfx('getup'); } break;
      case 'getup': p.t -= dt; if (p.t <= 0) { p.st = 'idle'; p.hp = CFG.PLAYER_HP; p.inv = 2.0; toastSay(rpick(CFG.KNOCKDOWN), 2); } break;
      case 'hurt': p.t -= dt; if (p.t <= 0 && p.onGround) p.st = 'idle'; break;
      case 'attack': {
        const a = ATK[p.stage]; p.t += dt;
        if (p.t < a.a0 + 0.05 && p.onGround) p.vx = p.face * a.push;
        if (p.t >= a.a0 && p.t <= a.a1) attackHits({ x: p.face > 0 ? p.x - 6 : p.x - a.reach + 6, y: p.y - 76, w: a.reach, h: a.h }, a.dmg, !!a.heavy, 'melee');
        if (pressed.attack && p.t > 0.07 && p.stage < 2) p.queued = true;
        if (p.t >= a.dur * (p.queued ? 0.72 : 1)) { if (p.queued) startAttack(p.stage + 1); else { p.st = 'idle'; p.stage = 0; } }
        else if (p.t > a.a1 && (pressed.jump || pressed.block)) { p.st = 'idle'; p.stage = 0; }
        break;
      }
      case 'airatk':
        p.t += dt;
        attackHits({ x: p.face > 0 ? p.x - 6 : p.x - 66, y: p.y - 64, w: 72, h: 82 }, 14, false, 'melee');
        if (p.onGround || p.t > 0.45) { p.st = 'idle'; if (p.onGround) { shake(3); sparks(p.x + p.face * 20, GY, 8, ['#ff7a2a', '#ffd27a'], 200); } }
        break;
      case 'blast':
        p.t += dt;
        if (!p.blasted && p.t > 0.2) {
          p.blasted = true; AU.sfx('blast'); shake(8); W.stats.blasts++;
          W.shots.push({ x: p.x + p.face * 40, y: p.y - 52, vx: p.face * 560, vy: 0, dmg: 42, owner: 'player', kind: 'blast', life: 1.4, hit: new Set() });
        }
        if (p.t > 0.48) p.st = 'idle';
        break;
    }
    const free = p.st === 'idle' || p.st === 'walk' || p.st === 'run' || p.st === 'jump' || p.st === 'crouch' || p.st === 'block';
    if (free) {
      if (input.block && p.onGround) { if (p.st !== 'block') { p.st = 'block'; p.blockT = 0; } p.blockT += dt; if (dir) p.face = dir; p.vx *= Math.pow(0.0005, dt); }
      else {
        if (p.st === 'block') p.st = 'idle';
        if (input.down && p.onGround && !pressed.jump) { p.st = 'crouch'; p.vx *= Math.pow(0.0005, dt); if (dir) p.face = dir; }
        else {
          p.vx += (dir * 235 - p.vx) * Math.min(1, dt * (p.onGround ? 14 : 6));
          if (dir) p.face = dir;
          p.st = !p.onGround ? 'jump' : Math.abs(p.vx) > 150 ? 'run' : Math.abs(p.vx) > 20 ? 'walk' : 'idle';
        }
        if (p.jumpBuf > 0 && p.coyote > 0) {
          if (input.down && p.onPlat) { p.dropT = 0.25; p.jumpBuf = 0; }
          else { p.vy = -660; p.onGround = false; p.coyote = 0; p.jumpBuf = 0; p.jumping = true; p.st = 'jump'; AU.sfx('jump'); sparks(p.x, p.y, 6, ['#8a7a5a'], 90, { grav: 200 }); }
        }
        if (pressed.attack) { if (p.onGround) startAttack(0); else { p.st = 'airatk'; p.t = 0; p.hitSet = new Set(); p.vy = Math.max(p.vy, 140); AU.sfx('swingHeavy'); } }
        else if (pressed.blast && p.meter >= CFG.BLAST_COST) { const t = nearestEnemy(420); if (t) p.face = Math.sign(t.x - p.x) || p.face; p.st = 'blast'; p.t = 0; p.blasted = false; p.meter = 0; p.vx = 0; bark('blast'); }
      }
    }
    if (p.st === 'attack' && p.t > ATK[p.stage].a0 + 0.05 || p.st === 'blast' || p.st === 'getup') p.vx *= Math.pow(0.002, dt);
    if (p.st === 'down' && p.onGround) p.vx *= Math.pow(0.0001, dt);
    // physics
    const prevY = p.y, wasGround = p.onGround;
    p.vy = Math.min(p.vy + GRAV * dt, 1300); p.x += p.vx * dt; p.y += p.vy * dt;
    const lb = bounds(); p.x = clamp(p.x, lb[0] + 14, lb[1] - 14);
    p.onGround = false; p.onPlat = false;
    if (p.vy >= 0) {
      const top = p.dropT > 0 ? null : platformLanding(p.x, prevY, p.y);
      if (top != null) { p.y = top; p.vy = 0; p.onGround = true; p.onPlat = true; }
      else if (p.y >= GY && prevY <= GY + 2 && !inPit(p.x)) { p.y = GY; p.vy = 0; p.onGround = true; }
    }
    if (p.onGround && !wasGround && p.vyPrev > 300) { p.landT = 0.1; AU.sfx('land'); }
    p.vyPrev = p.vy || p.vyPrev;
    if (p.onGround) { p.jumping = false; p.vyPrev = 0; if (!p.onPlat && !inPit(p.x - 40) && !inPit(p.x + 40)) p.lastSafeX = p.x; }
    if (p.y > GY + 180) {
      p.x = p.lastSafeX; p.y = GY; p.vx = 0; p.vy = 0; p.inv = 1.2; p.onGround = true;
      if (p.st !== 'down') { p.hp = Math.max(1, p.hp - 12); AU.sfx('hurt'); shake(6); popText(p.x, p.y - 100, '-12', '#ff5a5a', 10); }
      else { p.st = 'getup'; p.t = 0.6; }
    }
    for (const h of LV.hazards) {
      if (h.type === 'zap' && zapOn(h) && p.onGround && !p.onPlat && p.x > h.x0 && p.x < h.x1) { const r = damagePlayer(10, p.x - p.face * 10, { knock: 260, unblockable: true }); if (r === 'hit') AU.sfx('zap'); }
    }
  }
  function zapOn(h) { const c = h.on + h.off, t = (W.t + h.phase) % c; return t < h.on; }

  /* ============================ PROJECTILES ============================== */
  function updateShots(dt) {
    for (const s of W.shots) {
      s.life -= dt;
      if (s.kind === 'candle' && s.warn > 0) { s.warn -= dt; if (s.warn <= 0) { s.vy = 780; s.y = GY - VH - 40; } continue; }
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.kind === 'candle' && s.y >= GY - 6) { s.life = 0; AU.sfx('land'); sparks(s.x, GY - 4, 12, ['#ff3a3a', '#ff9a9a'], 240); shake(3); }
      if (s.owner === 'enemy') {
        const b = s.kind === 'candle' ? { x: s.x - 8, y: s.y - 40, w: 16, h: 40 } : s.kind === 'wave' ? { x: s.x - 16, y: GY - 28, w: 32, h: 28 } : { x: s.x - 6, y: s.y - 6, w: 12, h: 12 };
        if (ov(b, playerBox())) {
          const r = damagePlayer(s.dmg, s.x - s.vx * 0.02, { knock: 220, unblockable: s.kind === 'candle' });
          if (r === 'parry' && s.kind === 'bolt') { s.owner = 'player'; s.vx = -s.vx * 1.4; s.vy = -s.vy * 1.4; s.dmg = 26; s.hit = new Set(); popText(P.x, P.y - 100, 'REFLECT', '#7fe8ff', 10); }
          else if (r !== 'none') s.life = 0;
        }
      } else {
        for (const e of W.enemies) {
          if (!e.alive || e.st === 'intro' || (s.hit && s.hit.has(e))) continue;
          const eb = enemyBox(e);
          if (s.x > eb.x - 14 && s.x < eb.x + eb.w + 14 && s.y > eb.y - 12 && s.y < eb.y + eb.h + 12) {
            hitEnemy(e, s.dmg, Math.sign(s.vx) || 1, true, s.kind === 'blast' ? 'blast' : 'shot');
            if (s.kind === 'blast') s.hit.add(e); else { s.life = 0; break; }
          }
        }
        if (s.kind === 'blast' && Math.random() < 0.8) part({ x: s.x - Math.sign(s.vx) * 10, y: s.y + rnd(-10, 10), vx: -s.vx * 0.1, vy: rnd(-30, 30), color: rpick(['#14f195', '#9945ff', '#d8c2ff']), size: rnd(2, 5), max: 0.35 });
      }
    }
    W.shots = W.shots.filter(s => s.life > 0);
  }

  /* =============================== COINS ================================= */
  function updateCoins(dt) {
    for (const c of W.coins) {
      c.t += dt; c.life -= dt;
      const dx = P.x - c.x, dy = (P.y - 45) - c.y, d = Math.hypot(dx, dy) || 1, magnet = c.t > 0.35 && d < 130 && P.st !== 'down';
      if (magnet) { c.vx += dx / d * 2000 * dt; c.vy += dy / d * 2000 * dt; c.vx *= 0.9; c.vy *= 0.9; }
      else { c.vy += GRAV * 0.8 * dt; c.vx *= Math.pow(0.4, dt); }
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (!magnet && c.y > GY - 6 && !inPit(c.x) && c.vy > 0) { c.y = GY - 6; c.vy *= -0.35; }
      if (c.t > 0.25 && d < 28) { c.life = 0; P.sol += c.amt; W.stats.collected += c.amt; AU.sfx('coin'); sparks(c.x, c.y, 4, ['#14f195', '#9945ff'], 90, { grav: 0 }); }
      if (c.y > GY + 200) c.life = 0;
    }
    W.coins = W.coins.filter(c => c.life > 0);
    for (const k of W.pickups) {
      if (k.taken) continue;
      if (Math.abs(P.x - k.x) < 24 && Math.abs((P.y - 40) - k.y) < 48) { k.taken = true; P.sol += k.amt; W.stats.collected += k.amt; AU.sfx('coin'); popText(k.x, k.y - 16, '+' + k.amt + ' SOL', '#14f195', 9); }
    }
  }

  /* ================================ WAVES ================================ */
  function updateWaves(dt) {
    if (W.goT > 0) W.goT -= dt;
    const wv = W.waves[W.waveIdx];
    if (!W.active && wv && P.x >= wv.x) {
      W.active = wv; W.lock = wv.arena.slice(); W.spawnQ = wv.spawn.map(s => ({ type: s[0], side: s[1], t: s[2], done: false })); W.waveEnemies = [];
      AU.sfx('alarm'); if (wv.hint && CFG.HINTS[wv.hint]) toastSay(CFG.HINTS[wv.hint], 3.2); else if (W.waveIdx === 0) toastSay(CFG.WAVE_START, 2.2);
    }
    if (W.active) {
      for (const s of W.spawnQ) { s.t -= dt; if (s.t <= 0 && !s.done) { s.done = true; W.waveEnemies.push(spawnEnemy(s.type, s.side)); } }
      if (W.spawnQ.every(s => s.done) && W.waveEnemies.every(e => !e.alive)) {
        W.active = null; W.lock = null; W.waveIdx++; W.goT = 3.5; AU.sfx('clear'); toastSay(CFG.WAVE_CLEAR, 1.8);
      }
    }
    if (!W.boss && P.x >= LV.boss.trigger) {
      W.lock = LV.boss.arena.slice(); const b = spawnBoss(); state = 'cine'; AU.music(null); P.vx = 0; P.st = 'idle'; P.face = 1;
      startDialogue(CFG.BOSS_INTRO, () => { state = 'play'; b.st = 'idle'; b.t = 1.0; AU.music('boss'); });
    }
    if (W.bossDeadT > 0) {
      W.bossDeadT -= dt;
      if (W.bossDeadT <= 0) {
        state = 'cine'; AU.music(null); const b = W.boss;
        startDialogue(CFG.BOSS_DEFEAT, () => { dropSol(b.x, b.y - 60, 25, 260); W.lock = null; state = 'play'; W.goT = 4; AU.music('trench'); });
      }
    }
    if (W.boss && !W.boss.alive && !(W.bossDeadT > 0) && P.x >= LV.teevincs.x - 140 && state === 'play') startOutro();
    const z = zoneAt(P.x);
    if (z.id !== W.zoneId) {
      W.zoneId = z.id;
      if (CFG.ZONES[z.id]) { banner(CFG.ZONES[z.id]); say(CFG.ZONES[z.id], 'narrator'); }
      if (z.id === 'trenches' && CFG.HINTS.trenches) setTimeout(() => { if (state === 'play') toastSay(CFG.HINTS.trenches, 3); }, 3200);
    }
  }

  /* ============================== FLOW =================================== */
  function hideOverlays() { ['title', 'results', 'pause'].forEach(id => $(id).classList.remove('show')); }
  function resetWorld() {
    Object.assign(W, { t: 0, shake: 0, freeze: 0, lock: null, waves: LV.waves.slice(), waveIdx: 0, active: null, spawnQ: [], waveEnemies: [], enemies: [], shots: [], parts: [], coins: [],
      boss: null, bossDeadT: 0, zoneId: null, goT: 0, pump: 0, sendT: 0, outroWalk: 0, pickups: LV.pickups.map(p => Object.assign({}, p, { taken: false })),
      stats: { time: 0, kos: 0, dmg: 0, knockdowns: 0, parries: 0, blasts: 0, collected: 0 } });
    P = newPlayer(); W.camX = 0;
  }
  function startGame(withIntro) {
    if (!assetsReady) return;
    AU.unlock(); hideOverlays(); resetWorld(); paused = false;
    document.body.classList.add('ingame');
    if (withIntro) { state = 'intro'; AU.music('intro'); $('skip').classList.add('show'); startDialogue(CFG.INTRO, beginPlay); }
    else beginPlay();
  }
  function beginPlay() {
    $('skip').classList.remove('show'); DLG.active = false; DLG.el.className = ''; AU.stopVoice();
    state = 'play'; AU.music('trench'); W.zoneId = null;
  }
  function startOutro() {
    state = 'outro'; W.lock = null; P.vx = 0; AU.music(null); $('skip').classList.add('show');
    W.outroWalk = LV.teevincs.x - 90;
    setTimeout(() => { if (state === 'outro') startDialogue(CFG.OUTRO, showResults); }, 900);
  }
  function showResults() {
    if (state === 'results') return;
    state = 'results'; $('skip').classList.remove('show');
    if (!W.pump) dialogueEvent('pump');
    const sol = P.sol, rank = CFG.RANKS.find(r => sol >= r.minSol) || CFG.RANKS[CFG.RANKS.length - 1];
    let best = 0;
    try { best = parseFloat(localStorage.getItem('aaliyah_trench_best')) || 0; if (sol > best) { localStorage.setItem('aaliyah_trench_best', String(sol)); best = sol; } } catch (e) {}
    $('res-title').textContent = CFG.RESULTS_TITLE; $('res-rank').textContent = rank.title; $('res-desc').textContent = rank.desc;
    const st = W.stats;
    $('res-stats').innerHTML = [[sol.toFixed(1) + ' SOL', 'DELIVERED'], [fmtTime(st.time), 'TIME'], [st.kos, 'KOs'], [st.parries, 'PARRIES'], [st.knockdowns, 'KNOCKDOWNS']]
      .concat(best ? [[best.toFixed(1), 'BEST BAG']] : []).map(([a, b]) => '<div><b>' + a + '</b><span>' + b + '</span></div>').join('');
    setTimeout(() => $('results').classList.add('show'), 2600);
  }
  function togglePause() {
    if (state === 'title' || state === 'results') return;
    paused = !paused; $('pause').classList.toggle('show', paused); AU.sfx('pause');
    if (paused) AU.suspend(); else AU.resume();
  }
  function toggleMute() { AU.unlock(); AU.setMuted(!AU.muted); $('btn-mute').textContent = AU.muted ? '🔇' : '🔊'; $('btn-mute2').textContent = AU.muted ? 'SOUND: OFF' : 'SOUND: ON'; }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (state === 'play' && !paused) togglePause(); AU.suspend(); } else if (!paused) AU.resume(); });

  /* =============================== UPDATE ================================ */
  function update(dt) {
    W.t += dt;
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.classList.remove('show'); }
    if (slamT > 0) { slamT -= dt; if (slamT <= 0) slamEl.classList.remove('go'); }
    W.shake *= Math.pow(0.002, dt);
    updateDialogue(dt);
    if (!P) return;
    if (W.freeze > 0) { W.freeze -= dt; updateParticles(dt * 0.3); return; }
    if (state === 'play') {
      W.stats.time += dt;
      updatePlayer(dt);
      for (const e of W.enemies) if (e.type === 'dev') updateBoss(e, dt); else updateEnemy(e, dt);
      const al = W.enemies.filter(e => e.alive && !e.d.flying && e.type !== 'dev');
      for (let i = 0; i < al.length; i++) for (let j = i + 1; j < al.length; j++) { const a = al[i], b = al[j], d = b.x - a.x; if (Math.abs(d) < 34) { const push = (34 - Math.abs(d)) * 0.5 * (Math.sign(d) || 1); a.x -= push; b.x += push; } }
      W.enemies = W.enemies.filter(e => e.alive || e.fade > 0 || e === W.boss);
      updateShots(dt); updateCoins(dt); updateWaves(dt);
    } else if (state === 'cine' || state === 'intro') {
      if (P.st !== 'down') { P.st = 'idle'; P.vx = 0; } P.animT += dt;
      if (W.boss) W.boss.anim += dt;
    } else if (state === 'outro' || state === 'results') {
      P.animT += dt;
      if (W.outroWalk && P.x < W.outroWalk) { P.x += 140 * dt; P.st = 'walk'; P.face = 1; } else P.st = 'idle';
      if (W.sendT > 0) { W.sendT -= dt; if (Math.random() < 0.7) W.coins.push({ x: P.x + 10, y: P.y - 60, vx: rnd(150, 260), vy: rnd(-420, -260), amt: 0, t: 0, life: 1.0, fx: true }); }
      for (const c of W.coins) { c.vy += GRAV * 0.6 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.life -= dt; }
      W.coins = W.coins.filter(c => c.life > 0);
      if (W.pump > 0) W.pump += dt;
    }
    updateParticles(dt);
    updateCamera(dt);
  }
  function updateParticles(dt) {
    for (const q of W.parts) { q.life += dt; q.vy += q.grav * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    W.parts = W.parts.filter(q => q.life < q.max);
    if (Math.random() < 0.3) { const z = zoneAt(W.camX + VW / 2); part({ x: W.camX + rnd(0, VW), y: GY - VH * 0.85, vx: rnd(-20, 20), vy: rnd(30, 70), color: z.id === 'bunker' ? '#ff7a2a' : z.id === 'pool' ? '#b47bff' : '#8a8090', size: rnd(1, 2), max: 6, ambient: true }); }
  }
  function updateCamera(dt) {
    let target = P.x + (state === 'play' ? P.face * 60 : 0) - VW * 0.42;
    if (state === 'outro' || state === 'results') target = LV.teevincs.x - VW * 0.55;
    const lb = bounds(), minX = Math.max(0, lb[0] - 20), maxX = Math.max(minX, Math.min(LV.END_X + 60 - VW, lb[1] + 20 - VW));
    target = clamp(target, minX, maxX);
    W.camX += (target - W.camX) * Math.min(1, dt * 5);
  }

  /* =============================== RENDER ================================ */
  let grain = null;
  function drawLayer(img, par, y, h, camX) {
    const sw = img.width * 2, off = -(((camX * par) % sw) + sw) % sw;
    for (let x = off; x < VW; x += sw) g.drawImage(img, x, y, sw, h);
  }
  function frameCell(name, idx) { const list = meta.anims[name]; const i = list[clamp(idx, 0, list.length - 1)]; return [(i % meta.cols) * meta.cellW, Math.floor(i / meta.cols) * meta.cellH]; }
  function playerFrame() {
    const p = P, t = p.animT;
    switch (p.st) {
      case 'idle': return ['idle', Math.floor(t * 7) % 6];
      case 'walk': return ['walk', Math.floor(t * 10) % 6];
      case 'run': return ['run', Math.floor(t * 12) % 4];
      case 'jump': return p.vy < -260 ? ['jump', 1] : p.vy < 160 ? ['jump', 4] : ['jump', 2];
      case 'crouch': return ['crouch', 2];
      case 'block': return ['block', 0];
      case 'attack': return ATK[p.stage].frame;
      case 'airatk': return ['jump', 2];
      case 'blast': return ['block', 2];
      case 'hurt': return ['hit', p.t > 0.18 ? 0 : 1];
      case 'down': return ['hit', 2];
      case 'getup': return ['hit', p.t > 0.38 ? 3 : 4];
    }
    return ['idle', 0];
  }
  function drawPlayer(camX, camY) {
    const p = P, x = Math.round(p.x - camX), y = Math.round(p.y - camY);
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(x, (p.onPlat ? p.y : GY) - camY, 22, 5, 0, 0, 7); g.fill();
    const blink = p.inv > 0 && state === 'play' && p.st !== 'getup' && p.st !== 'down' && Math.floor(p.inv * 16) % 2 === 0;
    g.save(); g.globalCompositeOperation = 'lighter'; const rl = g.createRadialGradient(x, y - 50, 0, x, y - 50, 70); rl.addColorStop(0, 'rgba(255,170,90,0.16)'); rl.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rl; g.fillRect(x - 70, y - 120, 140, 140); g.restore();
    let [name, idx] = playerFrame();
    if (p.landT > 0 && p.onGround && (p.st === 'idle' || p.st === 'walk')) { name = 'jump'; idx = 3; }
    const [sx, sy] = frameCell(name, idx), S = CFG.SPRITES.scale || 0.78, dw = meta.cellW * S, dh = meta.cellH * S;
    g.save(); g.translate(x, y + meta.feetPad * S); g.scale(p.face, 1); if (blink) g.globalAlpha = 0.35;
    g.imageSmoothingEnabled = true; g.drawImage(atlas, sx, sy, meta.cellW, meta.cellH, -dw / 2, -dh, dw, dh);
    g.restore();
    if (p.st === 'attack') {
      const a = ATK[p.stage], k = clamp((p.t - a.a0 + 0.04) / (a.a1 - a.a0 + 0.08), 0, 1);
      if (k > 0 && k < 1) {
        g.save(); g.translate(x + p.face * 18, y - 50); g.scale(p.face, 1); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
        const r = a.reach * (a.heavy ? 0.95 : 0.8), st = -1.3 + k * 1.6;
        [[10, 'rgba(255,90,20,0.55)'], [5, 'rgba(255,190,90,0.8)'], [2, 'rgba(255,255,220,0.9)']].forEach(([w, c]) => { g.strokeStyle = c; g.lineWidth = w * (a.heavy ? 1.5 : 1); g.beginPath(); g.arc(0, 0, r, st - 0.9, st + 0.4); g.stroke(); });
        g.restore();
      }
    }
    if (p.st === 'airatk') { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,120,30,0.35)'; g.beginPath(); g.ellipse(x + p.face * 18, y - 22, 30, 40, p.face * 0.5, 0, 7); g.fill(); g.restore(); }
    if (p.st === 'blast' && p.t < 0.25) { g.save(); g.globalCompositeOperation = 'lighter'; const rr = 10 + p.t * 120, cx = x + p.face * 36, cy = y - 52; const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr); gr.addColorStop(0, 'rgba(216,194,255,0.9)'); gr.addColorStop(1, 'rgba(20,241,149,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, rr, 0, 7); g.fill(); g.restore(); }
    if ((p.st === 'block' || p.shieldFlash > 0) && shieldImg) {
      g.save(); g.translate(x + p.face * 30, y - 46); g.scale(p.face, 1); g.globalCompositeOperation = 'lighter';
      g.globalAlpha = p.shieldFlash > 0 ? 1 : 0.75 + Math.sin(W.t * 20) * 0.1; const s = p.shieldFlash > 0.25 ? 1.3 : 1;
      g.drawImage(shieldImg, -shieldImg.width * 0.4 * s, -shieldImg.height * 0.5 * s, shieldImg.width * 0.8 * s, shieldImg.height * s);
      g.restore();
    }
  }
  function enemyPose(e) {
    if (e.type === 'dev') return { idle: 'idle' + (Math.floor(e.anim * 2) % 2), intro: 'idle' + (Math.floor(e.anim * 2) % 2), dashWind: 'wind', dash: 'dash', cast: 'cast', leapWind: 'wind', leap: 'slam', summon: 'cast', stagger: 'hit', dead: 'down' }[e.st] || 'idle0';
    if (e.type === 'mev') return e.st === 'charge' ? 'charge' : 'fly' + (Math.floor(e.anim * 12) % 2);
    const ns = e.type === 'bundler' && e.shield <= 0 ? '_ns' : '';
    if (e.st === 'dead') return 'down';
    if (e.st === 'hurt') return 'hit' + ns;
    if (e.st === 'wind') return (e.type === 'bundler' ? 'walk0' : 'wind') + ns;
    if (e.st === 'atk') return (e.type === 'jeeter' ? 'punch' : e.type === 'rugger' ? 'swing' : 'bash') + ns;
    const moving = (e.st === 'chase' || e.st === 'enter') && (Math.abs(P.x - e.x) > e.d.reach * 0.8 || e.stolen > 0);
    return (moving ? 'walk' + (Math.floor(e.anim * 8) % 4) : 'walk0') + ns;
  }
  function drawEnemy(e, camX, camY) {
    const pose = enemyPose(e), img = e.type === 'dev' ? ART.dev(pose) : e.d.art(pose);
    const key = { dev: 'dev', jeeter: 'jeeter', rugger: 'rugger', mev: 'mev', bundler: 'bundler' }[e.type] + ':' + pose;
    const w = img.width * 2, h = img.height * 2, x = Math.round(e.x - camX), y = Math.round(e.y - camY);
    g.save(); g.globalAlpha = clamp(e.fade, 0, 1);
    g.fillStyle = 'rgba(0,0,0,' + (e.d.flying ? 0.25 : 0.45) + ')'; g.beginPath(); g.ellipse(x, GY - camY, e.d.flying ? 18 : w * 0.3, e.d.flying ? 4 : 5, 0, 0, 7); g.fill();
    g.translate(x, e.d.flying ? y + h - 6 : y); g.scale(e.face, 1); g.imageSmoothingEnabled = false;
    g.drawImage(e.flash > 0 ? (ART.flash(key) || img) : img, -w / 2, -h, w, h);
    g.restore();
    if (e.alive && (e.st === 'wind' || e.st === 'charge' || e.st === 'dashWind' || e.st === 'leapWind')) {
      g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,40,40,' + (0.5 + Math.sin(W.t * 40) * 0.3) + ')';
      g.beginPath(); g.arc(x, e.d.flying ? y - 10 : y - e.d.h - 14, 5, 0, 7); g.fill(); g.restore();
    }
    if (e.alive && e.type !== 'dev' && e.hp < e.d.hp) { const by = e.d.flying ? y - 16 : y - e.d.h - 24; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - 18, by, 36, 4); g.fillStyle = '#ff3a3a'; g.fillRect(x - 18, by, 36 * clamp(e.hp / e.d.hp, 0, 1), 4); }
  }
  function drawCoin(x, y, s, glow, t) {
    const img = ART.solCoin, w = img.width * s, sq = t != null ? Math.abs(Math.cos(t * 8)) * 0.7 + 0.3 : Math.abs(Math.cos(W.t * 3 + x * 0.01)) * 0.6 + 0.4;
    if (glow) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, y, 0, x, y, w * 1.3); gr.addColorStop(0, 'rgba(20,241,149,0.3)'); gr.addColorStop(1, 'rgba(20,241,149,0)'); g.fillStyle = gr; g.fillRect(x - w * 1.3, y - w * 1.3, w * 2.6, w * 2.6); g.restore(); }
    g.imageSmoothingEnabled = false; g.drawImage(img, x - w * sq / 2, y - w / 2, w * sq, w);
  }
  function render() {
    g.setTransform(SC, 0, 0, SC, 0, 0);
    if (!BG) BG = ART.backgrounds();
    if (!P) { drawTitleBg(); return; }
    let sx = 0, sy = 0; if (W.shake > 0.3) { sx = rnd(-1, 1) * W.shake; sy = rnd(-1, 1) * W.shake; }
    const cineNow = state === 'intro' || state === 'cine' || state === 'outro' || state === 'results';
    W.groundFrac = (W.groundFrac || 0.83) + ((cineNow ? 0.6 : 0.83) - (W.groundFrac || 0.83)) * 0.06;
    const camX = W.camX + sx, camY = GY - VH * W.groundFrac + sy, zone = zoneAt(W.camX + VW / 2);
    g.imageSmoothingEnabled = false;
    g.drawImage(BG.sky, 0, 0, VW, VH);
    drawLayer(BG.far, 0.12, GY - camY - 300, 360, camX);
    for (const z of LV.zones) {
      if (z.x1 < camX - 10 || z.x0 > camX + VW + 10) continue;
      g.save(); g.beginPath(); g.rect(z.x0 - camX, 0, z.x1 - z.x0, VH); g.clip();
      drawLayer(BG[z.bg], 0.45, GY - camY - 330, 360, camX);
      g.restore();
    }
    if (zone.id === 'trenches') {
      g.save(); g.globalCompositeOperation = 'lighter';
      [0, 1].forEach(i => { const a = Math.sin(W.t * 0.4 + i * 2) * 0.5 - Math.PI / 2, ox = i ? VW * 0.78 : VW * 0.18, oy = GY - camY - 70;
        g.fillStyle = 'rgba(255,240,200,0.05)'; g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + Math.cos(a - 0.08) * 600, oy + Math.sin(a - 0.08) * 600); g.lineTo(ox + Math.cos(a + 0.08) * 600, oy + Math.sin(a + 0.08) * 600); g.fill(); });
      g.restore();
    }
    // ground
    for (const z of LV.zones) {
      const tile = BG[z.ground]; if (z.x1 < camX || z.x0 > camX + VW) continue;
      g.save(); g.beginPath(); g.rect(z.x0 - camX, 0, z.x1 - z.x0, VH + 200); g.clip();
      for (let x = Math.floor(camX / 128) * 128; x < camX + VW + 128; x += 128) { g.drawImage(tile, x - camX, GY - camY, 128, 80); g.drawImage(tile, x - camX, GY - camY + 80, 128, 80); }
      g.restore();
    }
    for (const [a, b] of LV.pits) {
      if (b < camX || a > camX + VW) continue;
      const gr = g.createLinearGradient(0, GY - camY, 0, GY - camY + 160); gr.addColorStop(0, '#050307'); gr.addColorStop(1, '#2a0a0a');
      g.fillStyle = gr; g.fillRect(a - camX, GY - camY - 1, b - a, 200); g.fillStyle = 'rgba(255,60,30,0.18)'; g.fillRect(a - camX, GY - camY + 110, b - a, 60);
    }
    for (const h of LV.hazards) {
      if (h.x1 < camX || h.x0 > camX + VW) continue;
      const on = zapOn(h), c = h.on + h.off, tt = (W.t + h.phase) % c, warn = !on && tt > c - 0.45;
      g.fillStyle = '#1a1c22'; g.fillRect(h.x0 - camX, GY - camY - 3, h.x1 - h.x0, 6);
      for (let x = h.x0; x < h.x1; x += 12) { g.fillStyle = on ? '#7fe8ff' : warn ? (Math.floor(W.t * 20) % 2 ? '#ffd23f' : '#5a4a10') : '#3a3f47'; g.fillRect(x - camX + 2, GY - camY - 2, 8, 3); }
      if (on) { g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(127,232,255,0.8)'; g.lineWidth = 1.5; g.beginPath(); for (let x = h.x0; x < h.x1; x += 6) g.lineTo(x - camX, GY - camY - 4 - Math.random() * 16); g.stroke(); g.restore(); }
    }
    for (const p of LV.platforms) {
      if (p.x + p.w < camX - 40 || p.x > camX + VW + 40) continue;
      const top = platTop(p);
      if (p.kind === 'bags') g.drawImage(ART.sandbags(p.w / 2), p.x - camX, top - camY, p.w, p.h);
      else if (p.kind === 'crate') g.drawImage(ART.crate(p.w / 2, p.h / 2), p.x - camX, top - camY, p.w, p.h);
      else {
        g.fillStyle = '#2a2d33'; for (let x = p.x + 8; x < p.x + p.w; x += 40) g.fillRect(x - camX, top - camY + 8, 4, GY - top - 8);
        g.fillStyle = '#3a3f47'; g.fillRect(p.x - camX, top - camY, p.w, 6); g.fillStyle = '#16181c'; g.fillRect(p.x - camX, top - camY + 6, p.w, 3);
        g.fillStyle = '#d1a81c'; for (let x = p.x; x < p.x + p.w; x += 12) g.fillRect(x - camX, top - camY, 6, 2);
      }
    }
    for (const pr of LV.props) {
      if (pr.x < camX - 140 || pr.x > camX + VW + 140) continue;
      g.drawImage(ART.barrel(W.t + pr.x * 0.01), pr.x - camX - 24, GY - camY - 96, 48, 96);
      g.save(); g.globalCompositeOperation = 'lighter'; const r = 120 + Math.sin(W.t * 13 + pr.x) * 8, gr = g.createRadialGradient(pr.x - camX, GY - camY - 70, 0, pr.x - camX, GY - camY - 70, r);
      gr.addColorStop(0, 'rgba(255,120,40,0.32)'); gr.addColorStop(1, 'rgba(255,60,0,0)'); g.fillStyle = gr; g.fillRect(pr.x - camX - r, GY - camY - 70 - r, r * 2, r * 2); g.restore();
    }
    for (const k of W.pickups) if (!k.taken && k.x > camX - 20 && k.x < camX + VW + 20) drawCoin(k.x - camX, k.y - camY + Math.sin(W.t * 3 + k.x) * 3, 1.4, true);
    // Teevincs at his terminal
    const tvx = LV.teevincs.x;
    if (tvx > camX - 200 && tvx < camX + VW + 200) {
      const pose = W.pump > 0 ? 'hype' + (Math.floor(W.t * 6) % 2) : (Math.floor(W.t * 4) % 3 === 0 ? 'type' : 'idle0');
      g.save(); g.globalCompositeOperation = 'lighter'; const lamp = g.createRadialGradient(tvx - camX - 70, GY - camY - 150, 0, tvx - camX - 70, GY - camY - 150, 260); lamp.addColorStop(0, 'rgba(255,200,140,0.22)'); lamp.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = lamp; g.fillRect(tvx - camX - 330, GY - camY - 410, 520, 520); g.restore();
      g.drawImage(ART.teevincs(pose), tvx - camX - 80, GY - camY - 140, 160, 140);
      g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(tvx - camX, GY - camY - 90, 0, tvx - camX, GY - camY - 90, 150);
      gr.addColorStop(0, W.pump > 0 ? 'rgba(25,230,140,0.35)' : 'rgba(25,230,140,0.15)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(tvx - camX - 150, GY - camY - 240, 300, 260); g.restore();
    }
    for (const e of W.enemies) if (e.x > camX - 160 && e.x < camX + VW + 160) drawEnemy(e, camX, camY);
    drawPlayer(camX, camY);
    for (const c of W.coins) drawCoin(c.x - camX, c.y - camY, c.fx ? 1.3 : 1.1, false, c.t);
    for (const s of W.shots) {
      const x = s.x - camX, y = s.y - camY;
      if (s.kind === 'candle') {
        if (s.warn > 0) { g.fillStyle = 'rgba(255,40,40,' + (0.35 + Math.sin(W.t * 30) * 0.25) + ')'; g.fillRect(x - 12, GY - camY - 3, 24, 4); g.fillRect(x - 1, GY - camY - 60, 2, 56); continue; }
        g.fillStyle = '#ff3a3a'; g.fillRect(x - 6, y - 34, 12, 28); g.fillStyle = '#ff9a9a'; g.fillRect(x - 1, y - 44, 2, 44); g.fillStyle = '#8a0e0e'; g.fillRect(x - 6, y - 8, 12, 2);
      } else if (s.kind === 'wave') {
        g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(155,92,255,0.75)'; g.beginPath(); g.moveTo(x - 18, GY - camY); g.quadraticCurveTo(x, GY - camY - 44, x + 18, GY - camY); g.fill(); g.restore();
      } else {
        g.save(); g.globalCompositeOperation = 'lighter';
        const big = s.kind === 'blast', r = big ? 22 : 6, gr = g.createRadialGradient(x, y, 0, x, y, r * 2);
        gr.addColorStop(0, s.owner === 'player' ? (big ? 'rgba(230,220,255,1)' : 'rgba(127,232,255,1)') : 'rgba(255,200,200,1)');
        gr.addColorStop(0.4, s.owner === 'player' ? (big ? 'rgba(153,69,255,0.8)' : 'rgba(58,160,255,0.7)') : 'rgba(255,40,40,0.8)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 2, 0, 7); g.fill(); g.restore();
      }
    }
    g.save();
    for (const q of W.parts) {
      const a = 1 - q.life / q.max, x = q.x - camX, y = q.y - camY;
      if (q.kind === 'text') { g.globalAlpha = Math.min(1, a * 2); g.font = q.size + 'px "Press Start 2P", monospace'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(q.text, x, y); g.fillStyle = q.color; g.fillText(q.text, x, y); continue; }
      g.globalAlpha = q.ambient ? 0.5 : a; g.fillStyle = q.color; g.fillRect(x - q.size / 2, y - q.size / 2, q.size, q.size);
    }
    g.restore();
    // mood: grade + vignette + grain
    g.save();
    g.globalCompositeOperation = 'multiply'; g.fillStyle = zone.id === 'pool' ? '#d4c8ec' : zone.id === 'bunker' ? '#e2d4d4' : zone.id === 'hq' ? '#d4e6dc' : '#f0e2d4'; g.fillRect(0, 0, VW, VH);
    g.globalCompositeOperation = 'source-over';
    const vg = g.createRadialGradient(VW / 2, VH * 0.55, VH * 0.35, VW / 2, VH * 0.55, VW * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = vg; g.fillRect(0, 0, VW, VH);
    if (!grain) { const [c, gg] = ART.mk(128, 128), id = gg.createImageData(128, 128); for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 16; } gg.putImageData(id, 0, 0); grain = c; }
    const go = ((W.t * 60) | 0) % 4 * 32; for (let x = -go; x < VW; x += 128) for (let y = -go; y < VH; y += 128) g.drawImage(grain, x, y);
    g.restore();
    if (W.pump > 0) drawPump();
    if (state === 'intro' || state === 'cine' || state === 'outro' || state === 'results') { g.fillStyle = '#000'; g.fillRect(0, 0, VW, 28); g.fillRect(0, VH - 28, VW, 28); }
    drawHUD();
  }
  function drawPump() {
    const k = Math.min(1, W.pump / 2.2), x0 = VW * 0.1, x1 = VW * 0.9, y0 = VH * 0.62, y1 = VH * 0.16;
    g.save(); g.globalAlpha = Math.min(1, W.pump * 2) * 0.95;
    g.fillStyle = 'rgba(4,14,9,0.8)'; g.fillRect(x0 - 12, y1 - 30, x1 - x0 + 24, y0 - y1 + 44);
    g.strokeStyle = '#19e68c'; g.lineWidth = 3; g.beginPath();
    const n = 50; for (let i = 0; i <= n * k; i++) { const u = i / n, v = Math.pow(u, 3.2) + Math.sin(u * 30) * 0.02; g.lineTo(x0 + (x1 - x0) * u, y0 - (y0 - y1) * v); } g.stroke();
    g.font = '16px "Press Start 2P", monospace'; g.fillStyle = '#19e68c'; g.textAlign = 'right'; g.fillText('+' + Math.round(Math.pow(k, 3) * 4200) + '%', x1, y1 - 8);
    g.textAlign = 'left'; g.font = '9px "Press Start 2P", monospace'; g.fillStyle = '#9ff5cf'; g.fillText('$TRENCH / SOL', x0, y1 - 10);
    g.restore();
  }
  function drawHUD() {
    if (state !== 'play' && state !== 'cine') return;
    g.save(); const x = 12, y = 12;
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x - 4, y - 4, 196, 44);
    g.font = '8px "Press Start 2P", monospace'; g.fillStyle = '#e8d8c8'; g.textAlign = 'left'; g.fillText('AALIYAH', x, y + 7);
    const hp = clamp(P.hp / CFG.PLAYER_HP, 0, 1);
    g.fillStyle = '#3a0d0d'; g.fillRect(x, y + 11, 180, 10); g.fillStyle = P.hp < 30 ? (Math.floor(W.t * 6) % 2 ? '#ff3a3a' : '#a01818') : '#d8312a'; g.fillRect(x, y + 11, 180 * hp, 10);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y + 11, 180 * hp, 2);
    const m = P.meter / CFG.BLAST_COST;
    g.fillStyle = '#140a24'; g.fillRect(x, y + 25, 180, 6);
    const mg = g.createLinearGradient(x, 0, x + 180, 0); mg.addColorStop(0, '#9945ff'); mg.addColorStop(1, '#14f195'); g.fillStyle = mg; g.fillRect(x, y + 25, 180 * m, 6);
    if (m >= 1) { g.fillStyle = Math.floor(W.t * 4) % 2 ? '#14f195' : '#fff'; g.fillText('BLAST READY', x + 92, y + 7); }
    const bx = VW - 150;
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(bx - 4, y - 4, 142, 28);
    drawCoin(bx + 10, y + 9, 1.25, false);
    g.font = '11px "Press Start 2P", monospace'; g.fillStyle = '#14f195'; g.fillText(P.sol.toFixed(1) + ' SOL', bx + 24, y + 15);
    if (W.goT > 0 && !W.lock && Math.floor(W.t * 3) % 2) { g.font = '16px "Press Start 2P", monospace'; g.fillStyle = '#ffd23f'; g.textAlign = 'right'; g.fillText('GO ▶', VW - 20, VH * 0.42); }
    if (W.active) { const left = W.waveEnemies.filter(e => e.alive).length + W.spawnQ.filter(s => !s.done).length; g.font = '8px "Press Start 2P", monospace'; g.fillStyle = '#ff5a5a'; g.textAlign = 'center'; g.fillText('HOSTILES: ' + left, VW / 2, y + 30); }
    const b = W.boss;
    if (b && b.alive && b.st !== 'intro') {
      const bw = Math.min(420, VW * 0.7), bx2 = (VW - bw) / 2, by = VH - 50;
      g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(bx2 - 6, by - 16, bw + 12, 30);
      g.font = '9px "Press Start 2P", monospace'; g.fillStyle = '#d8c2ff'; g.textAlign = 'left'; g.fillText(CFG.NAMES.dev, bx2, by - 4);
      g.fillStyle = '#1a0b2e'; g.fillRect(bx2, by, bw, 8); g.fillStyle = '#9b5cff'; g.fillRect(bx2, by, bw * clamp(b.hp / b.d.hp, 0, 1), 8);
    }
    g.restore();
  }
  function drawTitleBg() {
    g.imageSmoothingEnabled = false; g.drawImage(BG.sky, 0, 0, VW, VH); drawLayer(BG.far, 0.1, 40, 360, W.t * 20); drawLayer(BG.trenches, 0.3, 30, 360, W.t * 20);
    const vg = g.createRadialGradient(VW / 2, VH / 2, VH * 0.2, VW / 2, VH / 2, VW * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0.2)'); vg.addColorStop(1, 'rgba(0,0,0,0.85)'); g.fillStyle = vg; g.fillRect(0, 0, VW, VH);
    if (atlas) {
      const [sx, sy] = frameCell('idle', Math.floor(W.t * 7) % 6), s = 1.7 * Math.min(1, VH / 360);
      g.imageSmoothingEnabled = true; g.drawImage(atlas, sx, sy, meta.cellW, meta.cellH, VW * (VW > VH * 1.4 ? 0.22 : 0.5) - meta.cellW * s / 2, VH * 0.97 - meta.cellH * s, meta.cellW * s, meta.cellH * s);
    }
  }

  /* ================================ LOOP ================================= */
  let last = performance.now(), acc = 0, lastCine = null;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    pollInput();
    if (!paused) {
      acc += dt; let n = 0;
      while (acc >= STEP && n < 6) { update(STEP); acc -= STEP; n++; for (const k in pressed) pressed[k] = false; }
      if (n >= 6) acc = 0;
    } else { acc = 0; for (const k in pressed) pressed[k] = false; }
    if (state === 'title') W.t += dt;
    const cine = state === 'intro' || state === 'cine' || state === 'outro' || state === 'results';
    if (cine !== lastCine) { lastCine = cine; document.body.classList.toggle('cine', cine); }
    render();
  }

  /* ================================ BOOT ================================= */
  portraits.teevincs = ART.portrait('teevincs'); portraits.dev = ART.portrait('dev');
  $('title-h1').innerHTML = CFG.TITLE + '<span>' + CFG.TITLE_SUB + '</span>';
  $('title-tag').textContent = CFG.TAGLINE; $('title-portrait').src = CFG.PORTRAITS.aaliyah;
  document.title = CFG.TITLE + ': ' + CFG.TITLE_SUB;
  $('btn-mute').textContent = AU.muted ? '🔇' : '🔊'; $('btn-mute2').textContent = AU.muted ? 'SOUND: OFF' : 'SOUND: ON';
  $('btn-start').onclick = () => startGame(true);
  $('btn-quick').onclick = () => startGame(false);
  $('btn-again').onclick = () => startGame(false);
  $('btn-resume').onclick = () => togglePause();
  $('btn-restart').onclick = () => { paused = false; $('pause').classList.remove('show'); AU.resume(); startGame(false); };
  $('btn-pause').onclick = e => { e.stopPropagation(); togglePause(); };
  $('btn-mute').onclick = e => { e.stopPropagation(); toggleMute(); };
  $('btn-mute2').onclick = () => toggleMute();
  $('skip').onclick = e => {
    e.stopPropagation(); AU.stopVoice();
    if (state === 'intro') { DLG.done = null; DLG.active = false; beginPlay(); }
    else if (state === 'outro') { DLG.active = false; DLG.done = null; DLG.el.className = ''; showResults(); }
  };
  AU.loadVoices().then(() => AU.preloadVoices(CFG.INTRO.map(l => [l.who || 'narrator', l.text])));
  requestAnimationFrame(frame);

  // test hook: deterministic simulation without rendering ("tap_x" keys press once)
  const sim = (k, n) => {
    for (const key in keys) keys[key] = false;
    for (const kk in k) if (!kk.startsWith('tap_')) keys[kk] = k[kk];
    for (let i = 0; i < n; i++) { pollInput(); if (i === 0) for (const kk in k) if (k[kk] && kk.startsWith('tap_')) pressed[kk.slice(4)] = true; update(STEP); for (const kk in pressed) pressed[kk] = false; }
    for (const key in keys) keys[key] = false;
  };
  // live input (used by the gameplay-recording tool): plain keys are held, "tap_x" presses once
  const setInput = k => { for (const key in keys) keys[key] = false; for (const kk in k) { if (kk.startsWith('tap_')) { if (k[kk]) pressed[kk.slice(4)] = true; } else keys[kk] = !!k[kk]; } };
  window.__trench = { get state() { return state; }, get P() { return P; }, W, sim, setInput, startGame, skip: () => { while (DLG.active) nextLine(); } };
})();
