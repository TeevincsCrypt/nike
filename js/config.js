/* ==========================================================================
   AALIYAH THE RAIDER — EDITABLE CONFIG
   --------------------------------------------------------------------------
   Everything a non-programmer might want to tweak lives here:
   dialogue, names, images, timer, difficulty and end-screen ranks.

   Dialogue line format:
     { who: "aaliyah" | "teevincs" | "narrator", text: "...",
       shake: true,          // screen + portrait shake
       slam:  "BIG TEXT",    // giant text slammed across the screen
       event: "tip",         // special outro event (SOL explosion + birthday music)
       sfx:   "slam" }       // optional sound: slam, coin, clue, fanfare, hit, boing
   Placeholders you can use in any text:
     {sol}   = SOL fragments collected     {time} = run time (m:ss)
     {clues} = clues found                 {left} = time left on the clock
   ========================================================================== */
window.AALIYAH_CONFIG = {
  TITLE: "AALIYAH",
  TITLE_SUB: "THE RAIDER",
  TAGLINE: "A chaotic Solana birthday tip mission",

  NAMES: { aaliyah: "AALIYAH", teevincs: "TEEVINCS", narrator: "" },

  // Images. Swap these paths for your own files (put them in /assets).
  PORTRAITS: {
    aaliyah: "assets/aaliyah.jpg",
    teevincs: null            // null = auto-drawn placeholder Teevincs
  },

  // Optional 3D model for Aaliyah (.glb / .gltf, put it in /assets).
  // null = the built-in low-poly Aaliyah (hat, horns, blonde hair, cow print, bell).
  // If your model has animation clips, name them (case-insensitive) to map:
  //   idle, run, jump, fall, hang, climb, shoot, hurt, celebrate
  MODEL: {
    aaliyah: null,            // e.g. "assets/aaliyah.glb"
    aaliyahScale: 1,          // tweak if the model is too big/small (target ~1.7m tall)
    aaliyahYaw: 0,            // radians, if the model faces the wrong way
    teevincs: null,
    teevincsScale: 1
  },

  TIME_LIMIT: 240,          // seconds until Teevincs' birthday (fail state)
  START_HEARTS: 3,
  SOL_PER_FRAGMENT: 1,      // tip amount per collected fragment
  TEXT_SPEED: 50,           // dialogue letters per second
  INTRO_ON_REPLAY: false,   // replay the intro on "play again"?
  MAX_DPR: 1.5,             // lower to 1 for older phones
  SHADOWS: "auto",          // "auto" (desktop only), true, or false

  /* ---------------------------- INTRO ---------------------------------- */
  INTRO: [
    { who: "narrator", text: "SOMEWHERE IN THE ANCIENT SOLANA RUINS...", sfx: "slam" },
    { who: "aaliyah", text: "WAIT. WAIT WAIT WAIT WAIT.", shake: true },
    { who: "aaliyah", text: "TEEVINCS' birthday is SOON. I gotta find him and tip him some SOL before it's too late!!", shake: true },
    { who: "aaliyah", text: "He's hiding somewhere in these tombs. Probably. I think. The vibes said so." },
    { who: "aaliyah", text: "Grab the SOL fragments. Find 3 clues. Blast anything that says FUD." },
    { who: "narrator", text: "MISSION: LOCATE TEEVINCS. TIP SOL. DO NOT GET RUGGED.", slam: "FIND TEEVINCS!", sfx: "slam" },
    { who: "aaliyah", text: "LET'S GOOOOOOOOO!!!", shake: true }
  ],
  // One of these random lines gets slipped into the intro each run.
  INTRO_RANDOM: [
    "I haven't slept. I've had four energy drinks. I am UNSTOPPABLE.",
    "If a boulder chases me I'm writing a strongly worded tweet.",
    "My wallet is loaded. My hat is on. My sanity? Optional.",
    "Mom said I could be anything. I chose 'chaotic tipper'."
  ],

  /* ---------------------------- OUTRO ---------------------------------- */
  OUTRO: [
    { who: "aaliyah", text: "TEEVINCS!!! I FOUND YOU!!!", shake: true },
    { who: "teevincs", text: "...Aaliyah?? How did you get past the FUD goblins??" },
    { who: "aaliyah", text: "NO TIME. HOLD STILL. TIPPING IN 3... 2..." },
    { who: "aaliyah", text: "HAPPY BIRTHDAY, TEEVINCS!!! {sol} SOL INCOMING!!!", event: "tip", slam: "HAPPY BIRTHDAY TEEVINCS!", shake: true },
    { who: "teevincs", text: "My wallet is literally vibrating. Is that... normal??" },
    { who: "aaliyah", text: "Mission complete. I'm gonna go lie down in a sarcophagus now." }
  ],

  /* --------------------------- IN-GAME TEXT ----------------------------- */
  CLUES: [
    "CLUE: A cave painting of a guy holding cake. Suspicious.",
    "CLUE: Ancient scroll reads 'gm. it's almost my bday. — T'",
    "CLUE: A footprint... in frosting. He went THIS way!"
  ],
  ALL_CLUES: "ALL 3 CLUES! The birthday door is unlocked!",
  DOOR_LOCKED: "The door demands 3 clues. It's very picky. ({clues}/3)",
  DOOR_OPEN: "THE BIRTHDAY DOOR OPENS!!",
  CHASE_START: "RUUUUUUUN!!!",
  CHASE_END: "Boulder got rugged. LOL.",
  CHECKPOINT: ["Checkpoint! Saving my vibes.", "Torch lit. Emotionally stable for 4 seconds.", "Checkpoint. Breathe. Okay. GO."],
  HURT: ["OW!", "RUDE!", "FUD HURTS!", "MY HAT!!", "NOT TODAY!"],
  PIT: ["I meant to do that.", "Lava? In THIS economy?", "Gravity is FUD."],
  LOW_TIME: "TIME IS RUNNING OUT!!",
  HINTS: {
    courtyard: "Ruins! Jump the gap. Blast the FUD goblins with your SOL pistols!",
    climb: "Too high to jump? Jump at the ledge to GRAB it, then jump again to pull up!",
    traps: "Spikes, blades and darts. Tomb vibes. Time your runs!",
    levers: "Two ancient levers. Press ACTION next to each one to open the gate.",
    bridge: "Crumbling tiles over lava. Do NOT stand still!",
    block: "That plate looks... block-shaped. Walk into the block to push it!",
    boulder: "Why is this hallway SO round...",
    final: "I smell cake. He's close!!"
  },
  LEVER: "CLUNK! ({n}/2)",
  PLATE: "GATE OPEN! Big brain block moment.",

  GAME_OVER_TITLE: "RUGGED.",
  GAME_OVER_QUIPS: [
    "Aaliyah has been temporarily rugged. Try again!",
    "The FUD goblins are dancing. Unacceptable.",
    "Not even a little bit of SOL got tipped. Tragic.",
    "Skill issue? Never. Run it back."
  ],
  TIMEOUT_TITLE: "TOO LATE!!",
  TIMEOUT_QUIPS: [
    "The birthday came and went. Teevincs ate the cake alone.",
    "Teevincs is blowing out candles WITHOUT you. Run it back!"
  ],

  RESULTS_TITLE: "TIP DELIVERED!",
  // Ranks, checked top to bottom. First match wins.
  RANKS: [
    { minSolPct: 0.9, maxTime: 100, title: "LEGENDARY TIPPER", desc: "Teevincs will tell his grandkids about this." },
    { minSolPct: 0.7, maxTime: 140, title: "CERTIFIED DEGEN", desc: "Fast, loud, slightly unhinged. Perfect." },
    { minSolPct: 0.4, maxTime: 999, title: "CHAOS COURIER", desc: "Delivered with style. And bruises." },
    { minSolPct: 0.0, maxTime: 9999, title: "PAPER HANDS (BUT TRIED)", desc: "It's the thought that counts. Mostly." }
  ]
};
