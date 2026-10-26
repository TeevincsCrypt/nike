/* Tiny WebAudio synth: chiptune music sequencer + sound effects. No audio files needed. */
(function () {
  'use strict';
  const A = { ctx: null, muted: false, track: null, step: 0, nextTime: 0, timer: null, bpm: 170 };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  let master, musicBus, sfxBus, noiseBuf;

  try { A.muted = localStorage.getItem('aaliyah_muted') === '1'; } catch (e) {}

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    A.ctx = new AC();
    master = A.ctx.createGain(); master.gain.value = A.muted ? 0 : 0.8; master.connect(A.ctx.destination);
    musicBus = A.ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
    sfxBus = A.ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    noiseBuf = A.ctx.createBuffer(1, A.ctx.sampleRate, A.ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  };

  A.setMuted = function (m) {
    A.muted = m;
    try { localStorage.setItem('aaliyah_muted', m ? '1' : '0'); } catch (e) {}
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, A.ctx.currentTime, 0.02);
  };
  A.suspend = () => { if (A.ctx && A.ctx.state === 'running') A.ctx.suspend(); };
  A.resume = () => { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); };

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
    jump: t => tone('square', 320, t, 0.13, 0.18, null, 720),
    coin: t => { tone('square', 988, t, 0.06, 0.13); tone('square', 1480, t + 0.055, 0.14, 0.13); },
    clue: t => [72, 76, 79, 84, 88].forEach((m, i) => tone('triangle', mtof(m), t + i * 0.07, 0.2, 0.25)),
    heart: t => [67, 72, 76].forEach((m, i) => tone('square', mtof(m), t + i * 0.06, 0.12, 0.12)),
    hit: t => { noise(t, 0.18, 0.5, null, 'lowpass', 3000, 300); tone('square', 260, t, 0.25, 0.2, null, 70); },
    whip: t => { noise(t, 0.12, 0.35, null, 'bandpass', 800, 5000); tone('sawtooth', 900, t + 0.06, 0.05, 0.08, null, 1800); },
    stomp: t => { tone('square', 420, t, 0.14, 0.22, null, 90); noise(t, 0.08, 0.3, null, 'lowpass', 1500); },
    boing: t => tone('triangle', 180, t, 0.35, 0.35, null, 1100),
    death: t => { tone('square', 700, t, 0.7, 0.22, null, 50); noise(t, 0.4, 0.2, null, 'lowpass', 2000, 100); },
    door: t => { noise(t, 1.4, 0.5, null, 'lowpass', 400, 60); tone('sine', 70, t, 1.2, 0.4, null, 40); },
    gate: t => { noise(t, 0.6, 0.4, null, 'lowpass', 600, 80); tone('square', 110, t, 0.3, 0.1, null, 55); },
    lever: t => { tone('square', 1300, t, 0.04, 0.15); tone('square', 700, t + 0.05, 0.06, 0.15); },
    checkpoint: t => [69, 73, 76, 81].forEach((m, i) => tone('triangle', mtof(m), t + i * 0.05, 0.18, 0.2)),
    rumble: t => noise(t, 0.6, 0.35, null, 'lowpass', 160, 60),
    crash: t => { noise(t, 1.0, 0.7, null, 'lowpass', 1200, 50); tone('sine', 90, t, 0.8, 0.5, null, 30); },
    slam: t => { tone('sine', 140, t, 0.5, 0.6, null, 35); noise(t, 0.25, 0.4, null, 'lowpass', 2500, 200); },
    fanfare: t => {
      [[60, 64, 67], [65, 69, 72], [67, 71, 74], [72, 76, 79, 84]].forEach((ch, i) =>
        ch.forEach(m => tone('square', mtof(m), t + i * 0.14, i === 3 ? 0.6 : 0.13, 0.08)));
    },
    tip: t => { for (let i = 0; i < 8; i++) tone('square', mtof(84 + (i % 4) * 3), t + i * 0.04, 0.06, 0.07); },
    pause: t => tone('triangle', 600, t, 0.08, 0.15, null, 300)
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
  function kick(t) { tone('sine', 150, t, 0.16, 0.9, musicBus, 40); }
  function snare(t) { noise(t, 0.12, 0.45, musicBus, 'highpass', 1500); tone('triangle', 220, t, 0.06, 0.25, musicBus, 120); }
  function hat(t, v) { noise(t, 0.035, v || 0.18, musicBus, 'highpass', 7000); }

  // A harmonic minor tomb-rave. Chords: Am F G E
  const RAID_ROOTS = [45, 41, 43, 40];
  const RAID_CHORDS = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]];
  const ARP = [0, 1, 2, 3, 2, 1, 2, 0, 1, 2, 3, 2, 3, 1, 2, 1];
  const HOOK = [81, 0, 84, 0, 88, 86, 84, 0, 83, 0, 80, 0, 81, 0, 0, 0,
                77, 0, 81, 0, 84, 83, 81, 0, 79, 0, 83, 0, 86, 0, 84, 83];
  const raid = {
    div: 4,
    play(step, t, spb) {
      const bar = Math.floor(step / 16) % 4, s = step % 16, root = RAID_ROOTS[bar], ch = RAID_CHORDS[bar];
      const section = Math.floor(step / 64) % 2;
      if (s % 4 === 0) kick(t);
      if (s === 4 || s === 12) snare(t);
      if (bar === 3 && s >= 12) snare(t);
      if (s % 2 === 1) hat(t, 0.12); else hat(t, 0.06);
      if (s % 2 === 0) tone('square', mtof(root + (s % 4 === 2 ? 12 : 0)), t, spb * 1.6, 0.22, musicBus);
      const ai = ARP[s] % 4, note = root + 24 + (ai === 3 ? 12 : ch[ai]);
      tone('triangle', mtof(note), t, spb * 0.9, 0.12, musicBus);
      if (section === 1) {
        const h = HOOK[(step % 64) % 32 + (bar >= 2 ? 0 : 0)];
        if (h) tone('square', mtof(h - 12), t, spb * 1.8, 0.1, musicBus);
      }
    }
  };
  const intro = {
    div: 4,
    play(step, t, spb) {
      const s = step % 16, bar = Math.floor(step / 16) % 2;
      if (s % 4 === 0) kick(t);
      if (s % 2 === 1) hat(t, 0.1);
      if (s === 12 || (bar === 1 && s > 11)) snare(t);
      if (s % 2 === 0) tone('square', mtof((bar ? 41 : 45) + (s % 4 ? 12 : 0)), t, spb * 1.5, 0.2, musicBus);
    }
  };
  // Happy Birthday (public domain), chiptune speedrun edition. 3/4 time, 8th-note grid.
  const HB = [[67, 1], [67, 1], [69, 2], [67, 2], [72, 2], [71, 4],
              [67, 1], [67, 1], [69, 2], [67, 2], [74, 2], [72, 4],
              [67, 1], [67, 1], [79, 2], [76, 2], [72, 2], [71, 2], [69, 4],
              [77, 1], [77, 1], [76, 2], [72, 2], [74, 2], [72, 4], [0, 2]];
  const HB_STEPS = []; HB.forEach(([m, d]) => { HB_STEPS.push([m, d]); for (let i = 1; i < d; i++) HB_STEPS.push(null); });
  const HB_BASS = [48, 48, 43, 43, 43, 48, 48, 53, 48, 43, 48, 48, 48];
  const birthday = {
    div: 2,
    play(step, t, spb) {
      const i = step % HB_STEPS.length, n = HB_STEPS[i];
      if (n && n[0]) {
        tone('square', mtof(n[0]), t, spb * n[1] * 0.95, 0.16, musicBus);
        tone('triangle', mtof(n[0] + 12), t, spb * n[1] * 0.6, 0.08, musicBus);
      }
      const bar = Math.floor(i / 6) % HB_BASS.length, s = i % 6;
      if (s === 0) { kick(t); tone('square', mtof(HB_BASS[bar] - 12), t, spb * 1.6, 0.22, musicBus); }
      else if (s % 2 === 0) { snare(t); tone('square', mtof(HB_BASS[bar] + 7), t, spb * 0.8, 0.1, musicBus); }
      hat(t, s % 2 ? 0.08 : 0.14);
    }
  };
  const TRACKS = { raid, intro, birthday };
  const BPM = { raid: 172, intro: 150, birthday: 200 };

  function schedule() {
    if (!A.ctx || !A.track) return;
    const spb = 60 / A.bpm / A.track.div;
    while (A.nextTime < A.ctx.currentTime + 0.12) {
      A.track.play(A.step, A.nextTime, spb);
      A.step++; A.nextTime += spb;
    }
  }
  A.music = function (name) {
    if (!A.ctx) return;
    A.track = name ? TRACKS[name] : null;
    A.bpm = BPM[name] || 170;
    A.step = 0; A.nextTime = A.ctx.currentTime + 0.06;
    if (!A.timer) A.timer = setInterval(schedule, 25);
  };
  A.setTempo = bpm => { A.bpm = bpm; };

  window.AALIYAH_AUDIO = A;
})();
