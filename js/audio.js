/* Tiny WebAudio synth: chiptune music sequencer + sound effects. No audio files needed. */
(function () {
  'use strict';
  const A = { ctx: null, muted: false, track: null, step: 0, nextTime: 0, timer: null, bpm: 170 };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  let master, musicBus, sfxBus, noiseBuf;

  try { A.muted = localStorage.getItem('aaliyah_muted') === '1'; } catch (e) {}

  // iPhone: Web Audio is silenced by the ringer switch unless a media element is playing.
  // A looping silent <audio> tag moves the page to the "playback" audio session.
  let silentEl = null;
  function silentWav() {
    const n = 4410, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 44100, true); v.setUint32(28, 88200, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    let bin = ''; const u = new Uint8Array(b); for (let i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]);
    return 'data:audio/wav;base64,' + btoa(bin);
  }
  A.unlock = function () {
    A.init();
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    if (!silentEl) {
      silentEl = document.createElement('audio'); silentEl.src = silentWav(); silentEl.loop = true;
      silentEl.setAttribute('playsinline', ''); silentEl.setAttribute('x-webkit-airplay', 'deny'); silentEl.preload = 'auto';
    }
    if (silentEl.paused) { const pr = silentEl.play(); if (pr && pr.catch) pr.catch(() => {}); }
    if (A.ctx && A.ctx.state !== 'running') A.ctx.resume();
    if (A.ctx && !A.unlocked) {
      const src = A.ctx.createBufferSource(); src.buffer = A.ctx.createBuffer(1, 1, 22050); src.connect(A.ctx.destination); src.start(0);
      A.unlocked = true;
    }
    if (A.voiceUnlock) A.voiceUnlock();
    if (A.ctx) A.primeMusic();
  };

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    A.ctx = new AC();
    master = A.ctx.createGain(); master.gain.value = A.muted ? 0 : 0.8; master.connect(A.ctx.destination);
    musicBus = A.ctx.createGain(); musicBus.gain.value = 0.42; A.musicBus = musicBus; musicBus.connect(master);
    sfxBus = A.ctx.createGain(); sfxBus.gain.value = 0.65; sfxBus.connect(master);
    noiseBuf = A.ctx.createBuffer(1, A.ctx.sampleRate, A.ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  };

  A.setMuted = function (m) {
    A.muted = m;
    try { localStorage.setItem('aaliyah_muted', m ? '1' : '0'); } catch (e) {}
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, A.ctx.currentTime, 0.02);
    if (m) A.stopVoice();
    if (bgm && !bgmGain) bgm.muted = m;
  };
  A.suspend = () => { if (A.ctx && A.ctx.state === 'running') A.ctx.suspend(); A.stopVoice(); A.bgmPause(); };

  /* ------------------------------ VOICE ------------------------------ */
  // Each character speaks their lines. Uses a recorded file if the line has `voice: "assets/voice/x.mp3"`,
  // otherwise the device's text-to-speech with a per-character pitch/rate (see VOICE in config.js).
  const VCFG = () => (window.AALIYAH_CONFIG && window.AALIYAH_CONFIG.VOICE) || {};
  const synth = window.speechSynthesis;
  let voices = [], fileVoice = null, lastBark = 0;
  function loadVoices() { try { voices = synth ? synth.getVoices() : []; } catch (e) { voices = []; } }
  if (synth) { loadVoices(); if (synth.addEventListener) synth.addEventListener('voiceschanged', loadVoices); else synth.onvoiceschanged = loadVoices; }
  function pickVoice(who) {
    if (!voices.length) loadVoices();
    const en = voices.filter(v => /^en/i.test(v.lang));
    const pool = en.length ? en : voices;
    const want = (VCFG()[who] && VCFG()[who].voiceNames) || [];
    for (const n of want) { const v = pool.find(x => x.name.toLowerCase().includes(n.toLowerCase())); if (v) return v; }
    return pool[0] || null;
  }
  function duck(on) { if (musicBus && A.ctx) musicBus.gain.setTargetAtTime(on ? 0.16 : 0.42, A.ctx.currentTime, 0.08); }
  A.voiceUnlock = function () {
    if (A.voiceUnlocked || !synth) return;
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); A.voiceUnlocked = true; } catch (e) {}
  };
  // Recorded voiceover: assets/voice/manifest.json maps "who|config text" -> mp3 (made by tools/make_voices.py).
  let manifest = {}, voiceSrc = null, voiceGain = null, speakingUntil = 0, lineEnd = null;
  const raw = {}, decoded = {};
  A.loadVoices = function () {
    return fetch('assets/voice/manifest.json').then(r => r.ok ? r.json() : {}).then(m => { manifest = m || {}; }).catch(() => {});
  };
  function fetchRaw(file) {
    if (!raw[file]) raw[file] = fetch('assets/voice/' + file).then(r => r.arrayBuffer()).catch(() => null);
    return raw[file];
  }
  function getBuffer(file) {
    if (!decoded[file]) decoded[file] = fetchRaw(file).then(ab => {
      if (!ab || !A.ctx) { decoded[file] = null; return null; }
      return new Promise(res => A.ctx.decodeAudioData(ab.slice(0), res, () => res(null)));
    });
    return decoded[file];
  }
  // warm the cache (downloads only; decoding happens once audio is unlocked)
  A.preloadVoices = function (lines) { lines.forEach(([who, text]) => { const f = manifest[who + '|' + text]; if (f) fetchRaw(f); }); };
  A.hasVoice = (who, text) => !!manifest[who + '|' + text];
  A.isSpeaking = () => performance.now() < speakingUntil || (synth && synth.speaking);

  A.stopVoice = function () {
    try { if (synth) synth.cancel(); } catch (e) {}
    if (fileVoice) { fileVoice.pause(); fileVoice = null; }
    if (voiceSrc) { try { voiceSrc.onended = null; voiceSrc.stop(); } catch (e) {} voiceSrc = null; }
    speakingUntil = 0; lineEnd = null;
    duck(false);
  };
  A.voiceOn = () => VCFG().enabled !== false && !A.muted;
  function tts(text, who, onEnd) {
    if (!synth || VCFG().tts === false) return false;
    const clean = String(text).replace(/\{[a-z]+\}/g, '').replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, '').replace(/\.{3}/g, ', ').replace(/!{2,}/g, '!').replace(/\?{2,}/g, '?').trim();
    if (!clean) return false;
    const c = VCFG()[who] || VCFG().narrator || {};
    const u = new SpeechSynthesisUtterance(clean);
    const v = pickVoice(who); if (v) u.voice = v;
    u.pitch = c.pitch != null ? c.pitch : 1; u.rate = c.rate != null ? c.rate : 1; u.volume = 1;
    u.onend = u.onerror = () => { duck(false); if (onEnd) onEnd(); };
    duck(true);
    try { synth.speak(u); } catch (e) { return false; }
    return true;
  }
  // Speak a line. `text` is the exact text from config.js (used to find the recording).
  // onEnd fires when the line finishes. Returns true if something will be spoken.
  A.say = function (text, who, file, onEnd) {
    if (!A.voiceOn()) return false;
    A.stopVoice();
    who = who || 'aaliyah';
    const rec = manifest[who + '|' + text];
    if (rec && A.ctx) {
      const token = {}; lineEnd = token;
      speakingUntil = performance.now() + 8000;
      getBuffer(rec).then(buf => {
        if (lineEnd !== token) return;                 // superseded by another line
        if (!buf) { speakingUntil = 0; if (!tts(text, who, onEnd) && onEnd) onEnd(); return; }
        if (!voiceGain) { voiceGain = A.ctx.createGain(); voiceGain.gain.value = 1.15; voiceGain.connect(master); }
        const src = A.ctx.createBufferSource(); src.buffer = buf; src.connect(voiceGain);
        src.onended = () => { if (voiceSrc === src) { voiceSrc = null; speakingUntil = 0; duck(false); if (onEnd) onEnd(); } };
        voiceSrc = src; duck(true); src.start();
        speakingUntil = performance.now() + buf.duration * 1000 + 50;
        if (A.onLineStart) A.onLineStart(buf.duration);
      });
      return true;
    }
    if (file) {
      fileVoice = new Audio(file); fileVoice.setAttribute('playsinline', '');
      fileVoice.onended = () => { duck(false); if (onEnd) onEnd(); }; duck(true);
      const pr = fileVoice.play(); if (pr && pr.catch) pr.catch(() => duck(false));
      return true;
    }
    return tts(text, who, onEnd);
  };
  // short in-game shouts, rate-limited and never on top of a dialogue line
  A.bark = function (text, who) {
    if (!A.voiceOn() || VCFG().barks === false) return;
    const now = performance.now(); if (now - lastBark < 1800 || A.isSpeaking()) return;
    lastBark = now; A.say(text, who || 'aaliyah');
  };

  A.resume = () => { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); A.bgmResume(); };

  function tone(type, f0, t, dur, vol, dest, f1, attack) {
    const o = A.ctx.createOscillator(), gn = A.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.005));
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn); gn.connect(dest || sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(t, dur, vol, dest, ftype, freq, freq1) {
    const s = A.ctx.createBufferSource(), f = A.ctx.createBiquadFilter(), gn = A.ctx.createGain();
    s.buffer = noiseBuf; f.type = ftype || 'highpass'; f.frequency.setValueAtTime(freq || 1000, t);
    if (freq1) f.frequency.exponentialRampToValueAtTime(freq1, t + dur);
    gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(gn); gn.connect(dest || sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  /* ------------------------------ SFX ------------------------------- */
  const SFX = {
    jump: t => { noise(t, 0.08, 0.25, null, 'bandpass', 900, 2400); tone('triangle', 180, t, 0.1, 0.12, null, 320); },
    land: t => noise(t, 0.08, 0.3, null, 'lowpass', 600, 120),
    swing: t => noise(t, 0.13, 0.32, null, 'bandpass', 600, 3200),
    swingHeavy: t => { noise(t, 0.2, 0.42, null, 'bandpass', 300, 2600); tone('sawtooth', 120, t, 0.18, 0.08, null, 60); },
    hit: t => { noise(t, 0.12, 0.6, null, 'lowpass', 2400, 200); tone('sine', 130, t, 0.14, 0.6, null, 45); },
    hitHeavy: t => { noise(t, 0.25, 0.8, null, 'lowpass', 3000, 90); tone('sine', 90, t, 0.3, 0.8, null, 30); tone('square', 70, t, 0.12, 0.12, null, 40); },
    hurt: t => { noise(t, 0.18, 0.55, null, 'lowpass', 1800, 150); tone('sine', 160, t, 0.2, 0.5, null, 60); },
    block: t => { tone('square', 1400, t, 0.05, 0.12); tone('triangle', 900, t, 0.25, 0.18, null, 600); noise(t, 0.06, 0.3, null, 'highpass', 4000); },
    parry: t => { [1320, 1980, 2640].forEach((f, i) => tone('triangle', f, t + i * 0.025, 0.35, 0.14)); noise(t, 0.1, 0.25, null, 'highpass', 5000); },
    clang: t => { tone('square', 620, t, 0.18, 0.12, null, 540); tone('square', 930, t, 0.12, 0.08); noise(t, 0.08, 0.3, null, 'bandpass', 3000); },
    blast: t => { tone('sawtooth', 90, t, 0.6, 0.35, null, 40); noise(t, 0.5, 0.5, null, 'lowpass', 4000, 200); tone('sine', 400, t, 0.4, 0.3, null, 1400); },
    coin: t => { tone('square', 1568, t, 0.05, 0.07); tone('square', 2093, t + 0.045, 0.1, 0.07); },
    steal: t => { [700, 520, 380].forEach((f, i) => tone('square', f, t + i * 0.07, 0.08, 0.1)); },
    shoot: t => { tone('sawtooth', 1800, t, 0.12, 0.1, null, 500); noise(t, 0.06, 0.15, null, 'highpass', 3000); },
    zap: t => { for (let i = 0; i < 5; i++) noise(t + i * 0.03, 0.03, 0.3, null, 'bandpass', 4000 + Math.random() * 3000); tone('square', 60, t, 0.2, 0.15); },
    knockdown: t => { noise(t, 0.5, 0.7, null, 'lowpass', 900, 60); tone('sine', 70, t, 0.6, 0.7, null, 28); },
    getup: t => { [220, 330, 440].forEach((f, i) => tone('triangle', f, t + i * 0.06, 0.15, 0.12)); },
    enemyDie: t => { noise(t, 0.35, 0.5, null, 'lowpass', 1500, 80); tone('sine', 110, t, 0.3, 0.4, null, 35); },
    boom: t => { tone('sine', 60, t, 1.4, 0.9, null, 25); noise(t, 1.0, 0.6, null, 'lowpass', 800, 40); },
    candle: t => { tone('sawtooth', 300, t, 0.4, 0.1, null, 80); },
    slam: t => { tone('sine', 55, t, 0.8, 0.9, null, 22); noise(t, 0.6, 0.7, null, 'lowpass', 700, 50); },
    dash: t => noise(t, 0.35, 0.45, null, 'bandpass', 400, 2000),
    send: t => { for (let i = 0; i < 10; i++) tone('square', 880 + i * 110, t + i * 0.04, 0.06, 0.05); },
    alarm: t => { tone('square', 660, t, 0.18, 0.08); tone('square', 440, t + 0.2, 0.18, 0.08); },
    pause: t => tone('triangle', 500, t, 0.08, 0.15, null, 250),
    clear: t => { [392, 523, 659, 784].forEach((f, i) => tone('triangle', f, t + i * 0.07, 0.25, 0.12)); }
  };
  A.sfx = function (name) {
    if (!A.ctx || A.muted || !SFX[name]) return;
    SFX[name](A.ctx.currentTime + 0.005);
  };
  // dialogue "voice" babble
  A.blip = function (who) {
    if (!A.ctx || A.muted) return;
    const t = A.ctx.currentTime;
    if (who === 'aaliyah') tone('square', 620 + Math.random() * 380, t, 0.045, 0.05);
    else if (who === 'teevincs') tone('square', 190 + Math.random() * 120, t, 0.05, 0.06);
    else tone('triangle', 140 + Math.random() * 40, t, 0.06, 0.12);
  };

  /* ----------------------------- MUSIC ------------------------------ */
  // Dark trap / synthwave. 16th-note grid.
  function kick(t, v) { tone('sine', 140, t, 0.22, v || 0.95, musicBus, 38); }
  function snare(t, v) { noise(t, 0.16, v || 0.5, musicBus, 'highpass', 1200); noise(t, 0.08, 0.3, musicBus, 'bandpass', 2500); }
  function clap(t) { for (let i = 0; i < 3; i++) noise(t + i * 0.012, 0.09, 0.32, musicBus, 'bandpass', 1500); }
  function hat(t, v) { noise(t, 0.03, v || 0.14, musicBus, 'highpass', 8000); }
  function sub(t, f, dur, glide) { tone('sine', f, t, dur, 0.55, musicBus, glide); tone('triangle', f * 2, t, dur * 0.6, 0.08, musicBus, glide ? glide * 2 : 0); }
  function pad(t, notes, dur, v) { notes.forEach(m => { tone('sawtooth', mtof(m), t, dur, v || 0.025, musicBus, 0, dur * 0.3); tone('sawtooth', mtof(m) * 1.006, t, dur, v || 0.025, musicBus, 0, dur * 0.3); }); }
  function lead(t, m, dur, v) { tone('square', mtof(m), t, dur, v || 0.05, musicBus); tone('square', mtof(m) * 1.004, t, dur, (v || 0.05) * 0.6, musicBus); }
  // C minor: Cm  Ab  Eb  Bb  (i VI III VII)
  const PROG = [[48, [60, 63, 67]], [44, [56, 60, 63]], [51, [58, 63, 67]], [46, [58, 62, 65]]];
  const MEL = [72, 0, 0, 70, 0, 67, 0, 0, 68, 0, 67, 0, 63, 0, 65, 0];
  const trench = {
    div: 4,
    play(step, t, spb) {
      const bar = Math.floor(step / 16) % 4, s = step % 16, [root, chord] = PROG[bar], sec = Math.floor(step / 64) % 4;
      if (s === 0 || s === 10 || (bar % 2 === 1 && s === 7)) kick(t);
      if (s === 8) { snare(t); clap(t); }
      const roll = (bar === 3 && s >= 12);
      if (roll) hat(t, 0.1), hat(t + spb / 2, 0.08); else if (s % 2 === 0) hat(t, s % 4 === 0 ? 0.13 : 0.08);
      if (s === 0) sub(t, mtof(root - 12), spb * 7);
      if (s === 10) sub(t, mtof(root - 12), spb * 5, bar === 3 ? mtof(root - 14) : 0);
      if (s === 0) pad(t, chord, spb * 16, 0.02);
      if (sec >= 1 && MEL[s]) lead(t, MEL[s] - (bar === 1 ? 4 : 0), spb * 1.8, 0.035);
      if (sec >= 2 && s % 4 === 2) tone('triangle', mtof(chord[(s / 4 | 0) % 3] + 12), t, spb, 0.05, musicBus);
    }
  };
  const boss = {
    div: 4,
    play(step, t, spb) {
      const bar = Math.floor(step / 16) % 4, s = step % 16, root = [48, 49, 48, 46][bar];
      if (s % 4 === 0 || s === 14) kick(t);
      if (s === 4 || s === 12) { snare(t, 0.6); clap(t); }
      hat(t, s % 2 ? 0.07 : 0.13);
      if (s % 2 === 0) tone('sawtooth', mtof(root - 12 + (s % 8 === 6 ? 12 : 0)), t, spb * 1.6, 0.11, musicBus);
      if (s === 0) sub(t, mtof(root - 24), spb * 15);
      if (s % 4 === 0) tone('square', mtof(root + 24 + [0, 3, 7, 10][(s / 4) | 0]), t, spb * 0.8, 0.035, musicBus);
      if (s === 0 && bar === 0) pad(t, [root + 12, root + 15, root + 18], spb * 32, 0.02);
    }
  };
  const intro = {
    div: 4,
    play(step, t, spb) {
      const s = step % 32;
      if (s === 0) { sub(t, mtof(36), spb * 30); pad(t, [60, 63, 67, 70], spb * 32, 0.02); }
      if (s === 0 || s === 20) kick(t, 0.8);
      if (s === 16) snare(t, 0.35);
      if (s % 4 === 2) hat(t, 0.05);
    }
  };
  const outro = {
    div: 4,
    play(step, t, spb) {
      const bar = Math.floor(step / 16) % 4, s = step % 16, [root, chord] = [[44, [56, 60, 63]], [51, [58, 63, 67]], [46, [58, 62, 65]], [48, [60, 63, 67]]][bar];
      if (s === 0 || s === 6 || s === 10) kick(t);
      if (s === 8) { snare(t); clap(t); }
      if (s % 2 === 0) hat(t, 0.1);
      if (s === 0) { sub(t, mtof(root - 12), spb * 14); pad(t, chord.map(n => n + 12), spb * 16, 0.025); }
      if (s % 2 === 0) tone('triangle', mtof(chord[(s / 2) % 3] + 24), t, spb * 0.9, 0.05, musicBus);
    }
  };
  const TRACKS = { trench, boss, intro, outro };
  const BPM = { trench: 140, boss: 156, intro: 90, outro: 132 };

  function schedule() {
    if (!A.ctx || !A.track) return;
    const spb = 60 / A.bpm / A.track.div;
    while (A.nextTime < A.ctx.currentTime + 0.12) {
      A.track.play(A.step, A.nextTime, spb);
      A.step++; A.nextTime += spb;
    }
  }
  /* ---------------------- GAMEPLAY MUSIC (audio file) ---------------------- */
  // CONFIG.MUSIC.tracks maps a music name to a file; those play the file instead of the synth.
  // One <audio> element routed through Web Audio, so mute, pause and voice ducking all apply.
  const MCFG = () => (window.AALIYAH_CONFIG && window.AALIYAH_CONFIG.MUSIC) || {};
  let bgm = null, bgmGain = null, bgmWanted = false, bgmPrimed = false, bgmStopT = null;
  function ensureBgm(src) {
    if (!src) return null;
    if (!bgm) {
      bgm = new Audio(); bgm.loop = true; bgm.preload = 'auto'; bgm.setAttribute('playsinline', ''); bgm.src = src;
    } else if (!bgm.src.endsWith(src)) { bgm.src = src; }
    if (A.ctx && !bgmGain) {
      try {
        const node = A.ctx.createMediaElementSource(bgm);
        bgmGain = A.ctx.createGain(); bgmGain.gain.value = 0; node.connect(bgmGain); bgmGain.connect(musicBus);
      } catch (e) { bgmGain = null; }
    }
    return bgm;
  }
  function bgmLevel() { return MCFG().volume != null ? MCFG().volume * 1.7 : 1.7; }
  function bgmFade(to, secs) {
    if (bgmGain) bgmGain.gain.setTargetAtTime(to, A.ctx.currentTime, secs / 3);
    else if (bgm) bgm.volume = Math.min(1, to / 1.7) * (A.muted ? 0 : 1);
  }
  function bgmPlay(src) {
    const el = ensureBgm(src); if (!el) return;
    bgmWanted = true; if (bgmStopT) { clearTimeout(bgmStopT); bgmStopT = null; }
    if (el.paused) { const pr = el.play(); if (pr && pr.catch) pr.catch(() => {}); }
    bgmFade(bgmLevel(), 0.8);
  }
  function bgmStop() {
    if (!bgm || !bgmWanted) return;
    bgmWanted = false; bgmFade(0, 0.6);
    bgmStopT = setTimeout(() => { if (!bgmWanted && bgm) bgm.pause(); }, 700);   // keeps its position, resumes there
  }
  // prime the element inside a user tap so iOS lets it start later from the game loop
  A.primeMusic = function () {
    const src = (MCFG().tracks || {}).trench; if (!src || bgmPrimed) return;
    const el = ensureBgm(src); bgmPrimed = true;
    const pr = el.play(); if (pr && pr.then) pr.then(() => { if (!bgmWanted) el.pause(); }).catch(() => { bgmPrimed = false; });
  };
  A.bgmPause = () => { if (bgm && !bgm.paused) bgm.pause(); };
  A.bgmResume = () => { if (bgm && bgmWanted && bgm.paused) { const pr = bgm.play(); if (pr && pr.catch) pr.catch(() => {}); } };

  A.music = function (name) {
    if (!A.ctx) return;
    const file = name && (MCFG().tracks || {})[name];
    if (file) { A.track = null; bgmPlay(file); return; }
    bgmStop();
    A.track = name ? TRACKS[name] : null;
    A.bpm = BPM[name] || 170;
    A.step = 0; A.nextTime = A.ctx.currentTime + 0.06;
    if (!A.timer) A.timer = setInterval(schedule, 25);
  };
  A.setTempo = bpm => { A.bpm = bpm; };
  // full game mix as a MediaStream (used by the gameplay-recording tool)
  A.captureStream = function () { A.init(); if (!A.capDest) { A.capDest = A.ctx.createMediaStreamDestination(); master.connect(A.capDest); } return A.capDest.stream; };

  window.AALIYAH_AUDIO = A;
})();
