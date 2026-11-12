"""Fit raw_demo.webm to the narration, add text overlays, export H.264/AAC 1080p.

usage: python build.py RAW_VIDEO MARKERS_JSON NARRATION_DIR OUT_MP4 [--simulated]

MARKERS_JSON comes from record_demo.mjs: {"starts": [one raw timestamp per spoken line], "end": ...}.
Each raw segment is fitted to its narration clip + GAP seconds. The voice is never changed: longer footage is
sped up, shorter footage holds its last frame. --simulated adds a caption saying PayPal was simulated.
"""
import json, subprocess, sys
from pathlib import Path

args = [a for a in sys.argv[1:] if not a.startswith("--")]
SIMULATED = "--simulated" in sys.argv
RAW, MARKERS, NARR, OUT = Path(args[0]), Path(args[1]), Path(args[2]), Path(args[3])
WORK = OUT.parent / f"{OUT.stem}-segments"
WORK.mkdir(parents=True, exist_ok=True)

GAP = 0.6          # silence after each line (record_demo.mjs paces with the same gap)
TAIL = 1.5         # extra hold on the end card
FPS = 30
FONT = "C\\:/Windows/Fonts/segoeui.ttf"
FONT_BOLD = "C\\:/Windows/Fonts/segoeuib.ttf"
APIS = "Invoicing v2  ·  Payouts v1  ·  Webhooks (signature-verified)  ·  Agent Toolkit"

# beat id -> list of (text, size, y, bold, box)
OVERLAYS = {
    1:  [("PayPilot", 96, "h*0.36", True, False),
         ("Collections and collaborator payouts for freelancers, on PayPal", 40, "h*0.36+120", False, False)],
    6:  [("PayPal Invoicing API  ·  update note + remind", 36, "h-140", False, True)],
    8:  [("PayPal Invoicing API  ·  record payment", 36, "h-140", False, True)],
    9:  [("PayPal Payouts API", 36, "h-140", False, True)],
    11: [("PayPal APIs used", 44, "60", True, True), (APIS, 34, "130", False, True)],
    12: [("PayPal APIs used", 44, "60", True, True), (APIS, 34, "130", False, True)],
    13: [("PayPal APIs used", 44, "60", True, True), (APIS, 34, "130", False, True)],
    15: [("PayPilot", 96, "h*0.36", True, False),
         ("github.com/vedikaagarwal28/paypilot", 40, "h*0.36+120", False, False)],
}
TITLE_CARDS = {1, 15}
SIM_CAPTION = "Recorded with a simulated PayPal API"


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"ffmpeg failed:\n{r.stderr[-2000:]}")


def probe(path, entries, stream=None):
    cmd = ["ffprobe", "-v", "error"] + (["-select_streams", stream] if stream else []) + \
          ["-show_entries", entries, "-of", "default=nw=1", str(path)]
    return subprocess.run(cmd, capture_output=True, text=True, check=True).stdout


def textfile(name, text):
    tf = WORK / name
    tf.write_text(text, encoding="utf-8")
    return tf.as_posix().replace(":", "\\:")


def drawtext(beat_id, seg_len):
    filters = []
    for n, (text, size, y, bold, box) in enumerate(OVERLAYS.get(beat_id, [])):
        fade = f"if(lt(t,0.3),t/0.3,if(gt(t,{seg_len - 0.3:.3f}),({seg_len:.3f}-t)/0.3,1))"
        opts = [f"fontfile='{FONT_BOLD if bold else FONT}'", f"textfile='{textfile(f'text{beat_id:02d}_{n}.txt', text)}'",
                f"fontsize={size}", "fontcolor=white", "x=(w-text_w)/2", f"y={y}", f"alpha='{fade}'"]
        opts += ["box=1", "boxcolor=0x003087@0.85", "boxborderw=18"] if box else \
                ["shadowcolor=black@0.6", "shadowx=2", "shadowy=2"]
        filters.append("drawtext=" + ":".join(opts))
    if beat_id in TITLE_CARDS:
        # dim the app UI (mostly white) so unboxed title text stays readable
        filters.insert(0, "drawbox=x=0:y=0:w=iw:h=ih:color=0x001435@0.72:t=fill")
    if SIMULATED:
        filters.append(f"drawtext=fontfile='{FONT}':textfile='{textfile('sim.txt', SIM_CAPTION)}':fontsize=22:"
                       "fontcolor=white@0.95:x=24:y=h-52:box=1:boxcolor=black@0.55:boxborderw=10")
    return filters


def main():
    beats = json.loads((NARR / "beats.json").read_text(encoding="utf-8"))
    m = json.loads(MARKERS.read_text(encoding="utf-8"))
    starts, end = m["starts"], m["end"]
    assert len(starts) == len(beats), f"need {len(beats)} markers, got {len(starts)}"
    bounds = starts + [end]

    parts, report = [], []
    for i, b in enumerate(beats):
        raw_s, raw_e = bounds[i], bounds[i + 1]
        raw_len = raw_e - raw_s
        target = b["seconds"] + GAP + (TAIL if i == len(beats) - 1 else 0)
        factor = raw_len / target
        if factor >= 1:
            timing, how = f"setpts=(PTS-STARTPTS)/{factor:.5f}", f"video x{factor:.2f}"
        else:
            timing, how = f"setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={target - raw_len:.3f}", \
                          f"hold +{target - raw_len:.2f}s"
        vf = ",".join([timing, "scale=1920:1080:force_original_aspect_ratio=decrease",
                       "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black", f"fps={FPS}", "format=yuv420p",
                       *drawtext(b["id"], target)])
        seg = WORK / f"seg{b['id']:02d}.mp4"
        run(["ffmpeg", "-y", "-ss", f"{raw_s:.3f}", "-to", f"{raw_e:.3f}", "-i", str(RAW),
             "-i", str(NARR / b["audio"]),
             "-filter_complex", f"[0:v]{vf}[v];[1:a]aresample=48000,apad=whole_dur={target:.3f}[a]",
             "-map", "[v]", "-map", "[a]", "-t", f"{target:.3f}",
             "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-profile:v", "high", "-r", str(FPS),
             "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", str(seg)])
        parts.append(seg)
        report.append((b["id"], b["section"], raw_len, b["seconds"], target, how))

    lst = WORK / "concat.txt"
    lst.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy",
         "-movflags", "+faststart", str(OUT)])

    print(" id sec   raw    voice  slot   fit")
    t = 0.0
    for bid, sec, raw_len, voice, target, how in report:
        print(f"{bid:3d}  s{sec}  {raw_len:6.2f} {voice:6.2f} {target:6.2f}  {how:12s} @ {int(t // 60)}:{t % 60:05.2f}")
        t += target
    print(probe(OUT, "format=duration"), probe(OUT, "stream=codec_name,width,height,r_frame_rate", "v:0"),
          probe(OUT, "stream=codec_name,sample_rate,channels", "a:0"), sep="")


main()
