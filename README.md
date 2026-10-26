# AALIYAH THE RAIDER

A short, chaotic, Tomb Raider-style **3D third-person** action-adventure. Aaliyah raids an ancient Solana tomb to find Teevincs before his birthday and tip him SOL.

One run takes about 2–3 minutes. Each run is a little different: enemy spots, coin lines, trap timings, which side the ledges and clues are on, and the crumbling-bridge layout all change.

## Play

It's a static web app with no build step. Three.js is vendored in `/vendor`, so it works offline.

```bash
python3 -m http.server 8000     # or any static file server
# open http://localhost:8000
```

To put it online, upload the folder as is to any static host (GitHub Pages, Netlify, Vercel or itch.io).

### Controls

| Action | Keyboard / mouse | Touch |
|---|---|---|
| Move | WASD / arrow keys (Shift = walk) | left thumb (floating joystick) |
| Camera | click the game, then move the mouse · Q / E | drag with the right thumb |
| Jump / grab ledge / pull up | Space | JUMP |
| SOL pistols (auto lock-on, homing shots) | J or left click | SHOOT (hold) |
| Pull lever / let go of ledge | F | ACT (lights up when something is in reach) |
| Pause · Mute | P / Esc · M | top-right buttons |

**Raider moves:** jump at a high ledge to **grab** it, then press jump (or keep pushing forward) to **pull up**. You can shimmy left and right while hanging. Walking into waist-high blocks vaults them. Vine walls can be climbed.

## The run

1. **Courtyard.** Jump the lava gap, vault, and blast the FUD goblins.
2. **Climb Hall.** Ledge grabs, pull-ups and a vine wall. Clue #1 is on the terrace.
3. **Trap Hall.** Timed spikes, swinging blades, dart walls and RUG bats.
4. **Lever Room.** Pull 2 levers to open the gate. Clue #2 is on the lever ledge.
5. **Lava Bridge.** Crumbling tiles. Clue #3 is on a side platform. Push the block onto the plate.
6. **Boulder Run.** A giant FUD boulder chases you. Run.
7. **Birthday Chamber.** The 3-clue door, Teevincs, cake, and the SOL tip explosion.

You fail if you lose all your hearts or the birthday timer runs out. Lava and pits cost a heart and send you back to the last torch. "Run it back" restarts the level.

## Customize

### Dialogue, names, timer and ranks: `js/config.js`
Every line of the intro and outro is plain text in `INTRO` / `OUTRO`. Each line can add:
- `shake: true` to shake the screen,
- `slam: "BIG TEXT"` to slam giant text across the screen,
- `event: "tip"` to trigger the SOL explosion and the birthday music,
- the placeholders `{sol}`, `{clues}`, `{time}` and `{left}`.

The same file holds the hints, clue texts, game-over quips, the end-screen ranks, `TIME_LIMIT` and `START_HEARTS`.

### Voice, sound and touch feel: `js/config.js`
- `VOICE`: every dialogue line is spoken aloud. Each character has their own pitch and speed, using the device's built-in voice. Short in-game shouts come from `BARKS`. For real recorded lines, add `voice: "assets/voice/line.mp3"` to any dialogue line.
- `TOUCH.stickSensitivity` and `TOUCH.lookSensitivity` tune the joystick and the camera drag. Lower numbers are calmer.
- On iPhone, sound plays even with the ringer switch on silent. Just tap START first.

### Aaliyah's look
- **Portrait** (dialogue box and title): `PORTRAITS.aaliyah`, currently `assets/aaliyah.jpg`.
- **3D model**: by default she's a built-in low-poly model (cowboy hat, horns, cow ears, long blonde hair, cow-print outfit, sleeves and boots, gold bell, tail, SOL pistols). To use your own model, put a `.glb` file in `/assets` and set:
  ```js
  MODEL: { aaliyah: "assets/aaliyah.glb", aaliyahScale: 1, aaliyahYaw: 0 }
  ```
  The model is auto-scaled to about 1.7 m. Animation clips named `idle`, `run`, `jump`, `fall`, `hang`, `climb`, `shoot`, `hurt` and `celebrate` are picked up automatically. Teevincs can be swapped the same way (`MODEL.teevincs`, `PORTRAITS.teevincs`).

### Level: `js/level.js`
The tomb is built from simple boxes: `B(x0, x1, y0, y1, z0, z1, opts)`. Each section is commented, so you can move platforms, add coins (`coinLine`, `coinArc`), enemies (`enemySpawns`) or traps.

## Files

```
index.html        UI shell (HUD, dialogue, overlays, touch controls)
css/style.css     styling
js/config.js      ← all editable text and settings
js/audio.js       WebAudio chiptune music + SFX (no audio files)
js/models.js      procedural 3D Aaliyah, Teevincs, goblins, bats, coins
js/level.js       tomb geometry, traps, puzzles
js/game.js        physics, ledge grabs, combat, camera, cinematics
vendor/           three.js r147 (MIT)
```

## Performance

There are no real-time shadows on phones (a blob shadow is used instead), the pixel ratio is capped at 1.5, and coins and spikes use instanced meshes. On older phones, set `MAX_DPR: 1` in the config.
