// real-time player: each animation frame decides inputs and feeds them to the live game loop
window.__startRtBot = function () {
  const T = __trench, W = T.W, LV = window.AALIYAH_LEVEL, GY = LV.GROUND;
  const inPit = x => LV.pits.some(([a, b]) => x > a && x < b);
  let lastAtk = 0, lastJump = 0;
  (function tick() {
    requestAnimationFrame(tick);
    if (T.state !== 'play') { T.setInput({}); return; }
    const P = T.P, now = performance.now(), k = {};
    const en = W.enemies.filter(e => e.alive && e.st !== 'intro');
    const near = en.slice().sort((a, b) => Math.abs(a.x - P.x) - Math.abs(b.x - P.x))[0];
    const dirTo = x => (x > P.x ? 'right' : 'left');
    const danger = en.find(e => (e.st === 'wind' && e.t < 0.17 && Math.abs(e.x - P.x) < e.d.reach + 34) || (e.type === 'dev' && e.st === 'dashWind' && e.t < 0.18));
    const bolt = W.shots.find(s => s.owner === 'enemy' && s.kind === 'bolt' && Math.abs(s.x - P.x) < 60 && Math.sign(s.vx) === Math.sign(P.x - s.x));
    const wave = W.shots.find(s => s.owner === 'enemy' && s.kind === 'wave' && Math.abs(s.x - P.x) < 80 && Math.sign(s.vx) === Math.sign(P.x - s.x));
    const candle = W.shots.find(s => s.kind === 'candle' && s.warn > 0 && s.warn < 0.6 && Math.abs(s.x - P.x) < 34);
    const jump = () => { if (now - lastJump > 250 && P.onGround) { k.tap_jump = true; lastJump = now; } };
    if (wave && P.onGround) jump();
    else if (candle) k[candle.x > P.x ? 'left' : 'right'] = true;
    else if (danger || bolt) { k.block = true; k[dirTo((danger || bolt).x)] = true; }
    else if (P.meter >= 100 && near && Math.abs(near.x - P.x) < 320) k.tap_blast = true;
    else if (near && Math.abs(near.x - P.x) < (near.type === 'dev' ? 95 : 72) && (!near.d.flying || near.y > GY - 120)) { if (now - lastAtk > 115) { k.tap_attack = true; lastAtk = now; } }
    else if (near && near.d.flying && Math.abs(near.x - P.x) < 80 && near.y > GY - 200 && P.onGround) jump();
    else if (near && near.d.flying && !P.onGround && Math.abs(near.x - P.x) < 70) { if (now - lastAtk > 115) { k.tap_attack = true; lastAtk = now; } }
    else if (near) k[dirTo(near.x)] = true;
    else k.right = true;
    if ((k.right && inPit(P.x + 50)) || (k.left && inPit(P.x - 50))) { k.tap_jump = true; }
    T.setInput(k);
  })();
};
