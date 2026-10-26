/* ==========================================================================
   AALIYAH: INTO THE TRENCHES — EDITABLE CONFIG
   Dialogue, names, voice, difficulty, ranks. After editing any spoken line,
   re-record the voiceover with tools/make_voices.py (until then it falls back
   to the device's speech voice).

   Dialogue line: { who: "aaliyah" | "teevincs" | "narrator" | "dev", text: "...",
                    shake: true, slam: "BIG TEXT", event: "send" | "pump", sfx: "boom" }
   Placeholders: {sol} = SOL in the bag   {time} = run time
   ========================================================================== */
window.AALIYAH_CONFIG = {
  TITLE: "AALIYAH",
  TITLE_SUB: "INTO THE TRENCHES",
  TAGLINE: "Teevincs is down bad. Get him the SOL. Survive the trenches.",

  NAMES: { aaliyah: "AALIYAH", teevincs: "TEEVINCS", narrator: "", dev: "THE DEV" },
  PORTRAITS: { aaliyah: "assets/aaliyah.jpg", teevincs: null, dev: null },   // null = drawn portrait

  // Aaliyah's sprites (sliced from assets/src/aaliyah_sheet.jpg by tools/slice_sprites.py)
  SPRITES: { atlas: "assets/aaliyah_sprites.png", meta: "assets/aaliyah_sprites.json", shield: "assets/shield_fx.png", scale: 0.78 },

  VOICE: { enabled: true, barks: true, autoAdvance: true,
    aaliyah:  { pitch: 1.1, rate: 1.0, voiceNames: ["Samantha", "Karen", "Zira", "Female"] },
    teevincs: { pitch: 0.85, rate: 1.0, voiceNames: ["Daniel", "Alex", "Fred", "Male"] },
    narrator: { pitch: 0.6, rate: 0.9, voiceNames: ["Daniel", "Alex", "Male"] },
    dev:      { pitch: 0.5, rate: 0.95, voiceNames: ["Fred", "Alex", "Male"] } },

  TOUCH: { buttonScale: 1 },
  MAX_DPR: 2,

  // Combat & difficulty
  PLAYER_HP: 100,
  KNOCKDOWN_SOL_LOSS: 0.15,   // share of the bag dropped when Aaliyah gets knocked down (she always gets back up)
  START_SOL: 5,               // SOL Aaliyah starts with
  BLAST_COST: 100,            // blast meter needed for a SOL blast (fills from landing hits)

  /* ------------------------------- INTRO -------------------------------- */
  INTRO: [
    { who: "narrator", text: "The Solana trenches. Where bags are made, and men are broken.", sfx: "boom" },
    { who: "teevincs", text: "Aaliyah. I'm down bad. Wallet's empty. There's a launch going live and I can't even pay gas." },
    { who: "aaliyah", text: "Say less. I'm bringing you SOL." },
    { who: "teevincs", text: "The trenches are crawling. Jeeters, rug pullers, MEV bots. And the Dev is guarding the only way through." },
    { who: "aaliyah", text: "Then the Dev's having a bad day.", shake: true },
    { who: "narrator", text: "Objective: reach Teevincs. Deliver the SOL. Let him trench.", slam: "INTO THE TRENCHES", sfx: "boom" }
  ],

  /* ------------------------------- BOSS --------------------------------- */
  BOSS_INTRO: [
    { who: "dev", text: "You think you're walking out of here with that bag? Every bag in this trench belongs to me.", shake: true },
    { who: "aaliyah", text: "You rugged half of these people. Today you get rugged." },
    { who: "dev", text: "Liquidity's pulled, girl. Come get it.", slam: "THE DEV", sfx: "boom" }
  ],
  BOSS_DEFEAT: [
    { who: "dev", text: "No. No no no. My liquidity!" },
    { who: "aaliyah", text: "Exit liquidity. That's you now." }
  ],

  /* ------------------------------- OUTRO -------------------------------- */
  OUTRO: [
    { who: "teevincs", text: "You actually made it. Through all of that?" },
    { who: "aaliyah", text: "Open your wallet. {sol} SOL. Don't make me regret it.", event: "send", slam: "SOL SENT", shake: true },
    { who: "teevincs", text: "Sniping the launch. Right now. Right now. We're in." },
    { who: "teevincs", text: "It's sending. It's actually sending. We are so back!", event: "pump", slam: "WE ARE SO BACK", shake: true },
    { who: "aaliyah", text: "Take profits this time. I'm not fighting the trenches twice." }
  ],

  /* ------------------------------ IN-GAME ------------------------------- */
  ZONES: {
    trenches: "ZONE 1 — THE TRENCHES",
    bunker: "ZONE 2 — THE BUNDLER BUNKER",
    pool: "ZONE 3 — THE LIQUIDITY POOL",
    hq: "TRENCH HQ"
  },
  HINTS: {
    trenches: "Jeeters ahead. Hit them till they fold.",
    bunker: "MEV bots up high. Block their shots, then hit back.",
    bundler: "That bundler hides behind a shield. Get behind him or blast it.",
    pool: "This is it. The Dev."
  },
  WAVE_START: "Clear them out.",
  WAVE_CLEAR: "Clear. Keep moving.",
  KNOCKDOWN: ["Not today.", "Get up. Get up.", "That's all you've got?"],
  BARKS: {
    kill: ["Next.", "Stay down.", "Paper hands.", "Too slow.", "Rugged."],
    hurt: ["Tch.", "Ugh.", "Cheap shot."],
    blast: ["Eat this.", "Full send."],
    block: ["Blocked."],
    steal: ["Hey, that's his bag!"]
  },

  RESULTS_TITLE: "BAG DELIVERED",
  RANKS: [
    { minSol: 60, title: "TRENCH GENERAL", desc: "The trenches will remember this name." },
    { minSol: 35, title: "CERTIFIED DEGEN", desc: "Teevincs is trenching with a full bag." },
    { minSol: 15, title: "SURVIVOR", desc: "Bruised, robbed, still delivered." },
    { minSol: 0,  title: "EXIT LIQUIDITY", desc: "You made it. The bag barely did." }
  ]
};
