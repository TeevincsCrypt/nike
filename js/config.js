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

  // Voiceover. Every line below is pre-recorded into assets/voice/ (see tools/make_voices.py).
  // If you edit a line, re-run that script to re-record it — until then the device's speech voice is used.
  VOICE: {
    enabled: true,       // speak dialogue lines, hints and clues
    barks: true,         // short in-game shouts ("Ow!", "Yeet!")
    autoAdvance: true,   // cutscene lines move on by themselves when the voice finishes
    // fallback device-speech tuning (only used for lines without a recording)
    aaliyah:  { pitch: 1.45, rate: 1.1, voiceNames: ["Samantha", "Karen", "Moira", "Tessa", "Zira", "Google US English", "Female"] },
    teevincs: { pitch: 0.8, rate: 1.0,  voiceNames: ["Daniel", "Alex", "Fred", "Aaron", "Google UK English Male", "Male"] },
    narrator: { pitch: 0.6, rate: 0.92, voiceNames: ["Daniel", "Alex", "Fred", "Google UK English Male", "Male"] }
  },
  // Easy mode helpers. Set any to false for a harder, more manual game.
  ASSIST: {
    invincible: true,     // Aaliyah can't die: hits just knock her back, lava puts her back on safe ground
    autoJump: true,       // jumps gaps and spike strips by herself while running
    autoClimb: true,      // climbs ledges up to ~2.4m just by running into them
    autoShoot: true,      // fires at nearby enemies by herself (SHOOT button still works)
    autoLever: true,      // pulls levers just by walking up to them
    guideArrow: true      // golden arrow + light beam showing where to go next
  },
  BARKS: {
    start: ["Let's go!", "Teevincs, I'm coming!", "Birthday mission, go go go!"],
    hurt: ["Ow!", "Rude!", "My hat!", "Not today!", "Ouch!"],
    lever: ["Clunk!", "Lever pulled!"],
    kill: ["Yeet!", "Bonk!", "Bye FUD!", "Get rugged!", "Too easy!"],
    clue: ["A clue!", "Ooh, a clue!", "Big brain moment!"],
    checkpoint: ["Checkpoint!", "Saved my vibes!"],
    boulder: ["Nope nope nope!", "RUN!", "Why is it always a boulder!"],
    door: ["It's open!", "Birthday door, let me in!"],
    pit: ["I meant to do that.", "Lava? Really?"]
  },

  // Touch controls (phones). Lower = calmer.
  TOUCH: {
    stickSensitivity: 0.7,   // how fast the joystick reaches full run (0.3 – 1.5)
    lookSensitivity: 0.55    // camera drag speed with the right thumb (0.2 – 1.5)
  },

  TIME_LIMIT: 0,            // seconds until Teevincs' birthday; 0 = no time limit (just a run timer)
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
  DOOR_LOCKED: "The door wants all 3 clues. Follow the arrow back!",
  DOOR_OPEN: "THE BIRTHDAY DOOR OPENS!!",
  CHASE_START: "RUUUUUUUN!!!",
  CHASE_END: "Boulder got rugged. LOL.",
  CHECKPOINT: ["Checkpoint! Saving my vibes.", "Torch lit. Emotionally stable for 4 seconds.", "Checkpoint. Breathe. Okay. GO."],
  HURT: ["OW!", "RUDE!", "FUD HURTS!", "MY HAT!!", "NOT TODAY!"],
  PIT: ["I meant to do that.", "Lava? In THIS economy?", "Gravity is FUD."],
  LOW_TIME: "TIME IS RUNNING OUT!!",
  HINTS: {
    courtyard: "Just follow the golden arrow. I'll jump and shoot by myself!",
    climb: "Ledges! I'll climb up if I just run into them.",
    traps: "Spikes, blades and darts. Tomb vibes. Just keep running!",
    levers: "Two ancient levers. I just have to walk up to them.",
    bridge: "Crumbling tiles over lava. Do NOT stand still!",
    block: "That plate looks block-shaped. Push the block onto it!",
    boulder: "Why is this hallway SO round...",
    final: "I smell cake. He's close!"
  },
  LEVER: "CLUNK! ({n}/2)",
  PLATE: "GATE OPEN! Big brain block moment.",
  GATE_OPEN: "Gate open! The ancient lever council approves.",

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
