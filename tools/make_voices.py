#!/usr/bin/env python3
"""Record the game's voiceover from the text in js/config.js.

Every intro/outro line, intro extra line, hint, clue and in-game shout is spoken by its
character and saved to assets/voice/*.mp3, plus assets/voice/manifest.json, which maps
"who|exact config text" -> file. The game plays these files; any line without a
recording falls back to the device's speech voice.

Setup (one time):
    python3 -m venv venv && ./venv/bin/pip install kokoro-onnx soundfile
    curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx
    curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
Run (from the repo root, needs node + ffmpeg):
    ./venv/bin/python tools/make_voices.py --model kokoro-v1.0.int8.onnx --voices voices-v1.0.bin
Only new or changed lines are recorded; unused files are removed.
"""
import argparse, hashlib, json, os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "voice")

# character -> (kokoro voice, speed, pitch factor)
CAST = {
    "aaliyah": ("af_heart", 1.0, 1.0),
    "teevincs": ("am_michael", 1.05, 1.0),
    "narrator": ("am_onyx", 0.88, 0.96),
    "dev": ("am_fenrir", 0.95, 0.9),
}


def load_config():
    js = "global.window={};require(%r);process.stdout.write(JSON.stringify(window.AALIYAH_CONFIG))" % os.path.join(ROOT, "js", "config.js")
    return json.loads(subprocess.check_output(["node", "-e", js]))


def collect(cfg):
    lines = []
    for key in ("INTRO", "BOSS_INTRO", "BOSS_DEFEAT", "OUTRO"):
        for ln in cfg.get(key, []):
            lines.append((ln.get("who", "narrator"), ln["text"]))
    lines += [("narrator", t) for t in (cfg.get("ZONES") or {}).values()]
    lines += [("aaliyah", t) for t in (cfg.get("HINTS") or {}).values()]
    for key in ("WAVE_START", "WAVE_CLEAR"):
        if cfg.get(key):
            lines.append(("aaliyah", cfg[key]))
    lines += [("aaliyah", t) for t in cfg.get("KNOCKDOWN", [])]
    for group in (cfg.get("BARKS") or {}).values():
        lines += [("aaliyah", t) for t in group]
    seen, out = set(), []
    for who, t in lines:
        if (who, t) not in seen:
            seen.add((who, t)); out.append((who, t))
    return out


def speakable(text):
    t = re.sub(r"\{sol\}\s*SOL[.,]?", "", text)                  # "{sol} SOL." is read out by the HUD, not the voice
    t = re.sub(r"\(?\{[a-z]+\}(/\d+)?\)?", "", t)             # drop other {placeholders}
    t = t.replace("—", ",").replace("...", ", ").replace("CLUE:", "Clue!")
    t = re.sub(r"\b(\d)\s*,\s*(\d)\b", r"\1, \2", t)
    t = re.sub(r"([A-Za-z])\1{3,}", r"\1\1\1", t)               # GOOOOOO -> GOOO
    t = re.sub(r"\b[A-Z]{2,}(?:'[A-Z]+)?\b", lambda m: m.group(0).lower(), t)     # SHOUTING -> shouting (else it's spelled out)
    reps = {r"\bteevincs\b": "Teevinks", r"\bTeevincs\b": "Teevinks", r"\bsol\b": "Sol", r"\bSOL\b": "Sol",
            r"\bfud\b": "fudd", r"\bFUD\b": "fudd", r"\bbday\b": "birthday", r"\bgm\b": "G M", r"\blol\b": "L O L",
            r"\bsolana\b": "Solana", r"\bnft\b": "N F T", r"\bMEV\b": "M E V", r"\bmev\b": "M E V", r"\$TRENCH": "trench", r"\bhq\b": "H Q"}
    for a, b in reps.items():
        t = re.sub(a, b, t, flags=0)
    t = re.sub(r"!{2,}", "!", t); t = re.sub(r"\?{2,}", "?", t); t = re.sub(r"\s+", " ", t).strip(" ,")
    return t[:1].upper() + t[1:] if t else t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True); ap.add_argument("--voices", required=True)
    a = ap.parse_args()
    from kokoro_onnx import Kokoro
    import soundfile as sf
    k = Kokoro(a.model, a.voices)
    os.makedirs(OUT, exist_ok=True)
    manifest, keep = {}, set()
    lines = collect(load_config())
    for who, text in lines:
        voice, speed, pitch = CAST.get(who, CAST["narrator"])
        say = speakable(text)
        if not say:
            continue
        name = hashlib.sha1(f"{who}|{say}|{voice}|{speed}|{pitch}".encode()).hexdigest()[:12] + ".mp3"
        path = os.path.join(OUT, name)
        if not os.path.exists(path):
            audio, sr = k.create(say, voice=voice, speed=speed, lang="en-us")
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                sf.write(tmp.name, audio, sr)
            af = f"asetrate={sr}*{pitch},aresample={sr},atempo={1 / pitch:.4f}," if pitch != 1 else ""
            af += "silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-15:TP=-1.5:LRA=11"
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp.name, "-af", af, "-ac", "1", "-ar", "24000",
                            "-c:a", "libmp3lame", "-b:a", "56k", path], check=True)
            os.unlink(tmp.name)
            print(f"recorded {who:9s} {say}")
        manifest[f"{who}|{text}"] = name
        keep.add(name)
    for f in os.listdir(OUT):
        if f.endswith(".mp3") and f not in keep:
            os.unlink(os.path.join(OUT, f))
    with open(os.path.join(OUT, "manifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=1, ensure_ascii=False)
    print(f"{len(manifest)} voice lines -> assets/voice/manifest.json")


if __name__ == "__main__":
    sys.exit(main())
