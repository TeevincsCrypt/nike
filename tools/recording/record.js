/* Record a raw, unedited gameplay video (intro -> full run -> outro -> results) with in-game audio.
   Needs: node + playwright, ffmpeg, and the game served locally:  python3 -m http.server 8123
   Run:   node tools/recording/record.js /tmp/rec   (writes frames, audio.webm and meta.json)
   Then:  python3 tools/recording/assemble.py /tmp/rec   (writes /tmp/rec/gameplay.mp4, 1280x720 30fps) */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = process.argv[2]; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT + '/frames', { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.addInitScript(fs.readFileSync(__dirname + '/rtbot.js', 'utf8'));
  const audioOut = fs.openSync(OUT + '/audio.webm', 'w');
  await p.exposeFunction('__audioChunk', b64 => { fs.writeSync(audioOut, Buffer.from(b64, 'base64')); });
  await p.goto('http://localhost:8123/index.html'); await p.waitForFunction(() => !document.getElementById('btn-start').disabled);
  await p.waitForTimeout(800);
  // screencast: every composited frame with its wall-clock timestamp
  const cdp = await p.context().newCDPSession(p); const frames = [];
  cdp.on('Page.screencastFrame', f => {
    const name = String(frames.length).padStart(6, '0') + '.jpg';
    fs.writeFileSync(OUT + '/frames/' + name, Buffer.from(f.data, 'base64'));
    frames.push([name, f.metadata.timestamp]);
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  // audio: full game mix via MediaRecorder
  const audioStart = await p.evaluate(() => new Promise(res => {
    const A = window.AALIYAH_AUDIO; A.unlock(); const rec = new MediaRecorder(A.captureStream(), { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 192000 });
    rec.ondataavailable = async e => { if (e.data.size) { const buf = new Uint8Array(await e.data.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); await window.__audioChunk(btoa(s)); } };
    rec.onstart = () => res(Date.now() / 1000); window.__rec = rec; rec.start(1000);
  }));
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, everyNthFrame: 1 });
  await p.waitForTimeout(600);
  const clickT = await p.evaluate(() => { const t = Date.now() / 1000; document.getElementById('btn-start').click(); window.__startRtBot(); return t; });
  console.log('recording… intro started');
  let last = '';
  for (let i = 0; i < 600; i++) {
    await p.waitForTimeout(1000);
    const st = await p.evaluate(() => __trench.state + (document.getElementById('results').classList.contains('show') ? '+results' : ''));
    if (st !== last) { console.log(i + 's', st); last = st; }
    if (st === 'results+results') { await p.waitForTimeout(5000); break; }
  }
  const endT = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');
  await p.evaluate(() => new Promise(res => { window.__rec.onstop = () => setTimeout(res, 500); window.__rec.stop(); }));
  await p.waitForTimeout(1500); fs.closeSync(audioOut);
  const stats = await p.evaluate(() => { const s = __trench.W.stats; return { sol: __trench.P.sol.toFixed(1), time: s.time.toFixed(0), kos: s.kos, knockdowns: s.knockdowns }; });
  fs.writeFileSync(OUT + '/meta.json', JSON.stringify({ frames, audioStart, clickT, endT, stats }));
  console.log('frames', frames.length, 'duration', (endT - clickT).toFixed(0) + 's', JSON.stringify(stats));
  await b.close();
})();
