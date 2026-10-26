#!/usr/bin/env python3
"""Turn a capture from record.js into gameplay.mp4 (1280x720, 30 fps, H.264 + AAC), synced by wall-clock timestamps."""
import json, os, subprocess, sys

d = sys.argv[1]
m = json.load(open(os.path.join(d, "meta.json")))
f = m["frames"]
v0 = m["clickT"] - 0.15                      # video starts as the intro starts
i0 = max([i for i, (_, t) in enumerate(f) if t <= v0] or [0])
sel = f[i0:]
lines = []
for i, (n, t) in enumerate(sel):
    nxt = sel[i + 1][1] if i + 1 < len(sel) else m["endT"]
    lines.append(f"file 'frames/{n}'\nduration {max(0.001, nxt - max(t, v0)):.5f}")
lines.append(f"file 'frames/{sel[-1][0]}'")
open(os.path.join(d, "list.txt"), "w").write("\n".join(lines) + "\n")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "list.txt",
                "-ss", f"{v0 - m['audioStart']:.4f}", "-i", "audio.webm", "-map", "0:v", "-map", "1:a",
                "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "25", "-tune", "grain",
                "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", "gameplay.mp4"],
               cwd=d, check=True)
print("wrote", os.path.join(d, "gameplay.mp4"))
