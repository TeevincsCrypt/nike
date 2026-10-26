# AALIYAH: INTO THE TRENCHES

A dark, pixel-art 2D side-scrolling brawler. Teevincs is down bad in the Solana trenches: his wallet is empty and a launch is about to go live. Aaliyah fights through the trenches to bring him the SOL so he can trench.

A run is about 3 minutes of combat plus voiced cutscenes:

1. **The Trenches.** Jeeters (paper-hands grunts) and Rug Pullers, who steal SOL from your bag and run.
2. **The Bundler Bunker.** MEV sandwich bots that shoot from above, Bundlers behind coin shields, and electrified floors.
3. **The Liquidity Pool.** Boss fight against **The Dev**: dash attacks, red-candle rain, ground-slam shockwaves, and summons in phase 2.
4. **Trench HQ.** Hand Teevincs the bag, watch him snipe the launch, and get your rank (Trench General → Exit Liquidity).

Aaliyah never dies. When she's beaten down she drops part of her SOL bag, which you can pick back up, and gets back up.

## Play

It's a static site with no build step, so any static host works (Vercel, Netlify, GitHub Pages).

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

### Controls

| | Keyboard | Phone |
|---|---|---|
| Move / crouch | A D / ← → · S ↓ | ◀ ▶ · ▼ |
| Jump | W / Space / ↑ | JUMP |
| Strike (tap for a 3-hit combo, in the air for a dive kick) | J / X | STRIKE |
| Block (just before a hit = **parry**: stuns enemies and reflects shots) | K / C / Shift | BLOCK |
| SOL Blast (when the meter is full; breaks shields) | L / V | BLAST |
| Pause · Mute | P / Esc · M | top-right buttons |

## Customize

- **Story, dialogue, difficulty, ranks:** `js/config.js`
- **Level layout, enemy waves, pits, platforms, hazards:** `js/level.js`
- **Aaliyah's sprites:** sliced from `assets/src/aaliyah_sheet.jpg` by `python3 tools/slice_sprites.py`, which writes `assets/aaliyah_sprites.png`, `assets/aaliyah_sprites.json` and `assets/shield_fx.png`. For a new sheet with the same layout (IDLE / WALK / RUN / JUMP / CROUCH / BLOCK / HIT), replace the JPG and re-run the script.
- **Gameplay music:** `assets/music/bgm.mp3` loops during all fighting, including the boss. It fades out for cutscenes and resumes where it left off. To use a different song, swap the file or change `MUSIC` in `js/config.js`.
- **Voiceover:** every cutscene line, zone title, hint and combat shout is pre-recorded in `assets/voice/`. After you edit a line, re-record it with `tools/make_voices.py` (setup is at the top of that file). Until you do, the edited line falls back to the device's speech voice.

## Files

```
index.html  css/style.css    UI shell (HUD, dialogue, touch controls, overlays)
js/config.js                 ← story, dialogue, voice, difficulty, ranks
js/level.js                  ← zones, waves, pits, platforms, hazards
js/game.js                   engine: physics, combat, enemy AI, boss, cutscenes, rendering
js/art.js                    pixel art: enemies, the Dev, Teevincs, backgrounds, props
js/audio.js                  WebAudio: dark trap/synth music, SFX, voiceover playback
assets/                      Aaliyah sprites, portrait, voice lines
tools/                       sprite slicer + voice recorder
```
