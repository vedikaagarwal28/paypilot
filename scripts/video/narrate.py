"""Render one edge-tts clip per spoken line in DEMO_SCRIPT.md and measure each clip.

usage: python narrate.py DEMO_SCRIPT.md OUT_DIR [VOICE]

Writes beatNN.mp3 and beats.json (line, section, clip length). record_demo.mjs --timings reads beats.json
to pace each step; build.py reads it to fit the video to the voice.
"""
import asyncio, json, re, subprocess, sys
from pathlib import Path

import edge_tts

SCRIPT = Path(sys.argv[1])
OUT = Path(sys.argv[2])
VOICE = sys.argv[3] if len(sys.argv) > 3 else "en-US-AvaNeural"
OUT.mkdir(parents=True, exist_ok=True)


def parse_beats(md: str):
    beats, section = [], None
    for line in md.splitlines():
        m = re.match(r"^## (\d)\. (.+)$", line)
        if m:
            section = int(m.group(1))
            continue
        m = re.match(r"^\| (\d:\d\d) \| (.+?) \| \"(.+)\" \|$", line)
        if m and section:
            beats.append({"section": section, "planned": m.group(1), "screen": m.group(2), "say": m.group(3)})
    return beats


def duration(path: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                       capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


async def main():
    beats = parse_beats(SCRIPT.read_text(encoding="utf-8"))
    for i, b in enumerate(beats, 1):
        mp3 = OUT / f"beat{i:02d}.mp3"
        await edge_tts.Communicate(b["say"], VOICE).save(str(mp3))
        b["id"], b["audio"], b["seconds"] = i, mp3.name, round(duration(mp3), 3)
        print(f"{i:2d}  s{b['section']}  {b['planned']}  {b['seconds']:6.2f}s  {b['say'][:60]}")
    (OUT / "beats.json").write_text(json.dumps(beats, indent=2), encoding="utf-8")
    for s in sorted({b["section"] for b in beats}):
        print(f"section {s}: {sum(b['seconds'] for b in beats if b['section'] == s):.2f}s")
    print(f"total: {sum(b['seconds'] for b in beats):.2f}s")


asyncio.run(main())
