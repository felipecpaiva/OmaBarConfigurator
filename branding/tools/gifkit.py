"""Turn captured frames into a captioned GIF and MP4. frames = [(seconds, path)], marks = [(seconds, caption)] (an empty caption
clears it), total = length in seconds. Frames are resampled at a fixed rate so a slow capture does not change the timing."""
import os, subprocess, tempfile

FONT = "/usr/share/fonts/TTF/JetBrainsMonoNerdFont-Bold.ttf"


def build(frames, total, marks, out_dir, name, width=960, fps=12, mp4_width=1280, fontsize=38):
    os.makedirs(out_dir, exist_ok=True)
    seq = tempfile.mkdtemp(prefix="omabar-seq-")
    n, j = int(total * fps), 0
    for k in range(n):
        while j + 1 < len(frames) and frames[j + 1][0] <= k / fps:
            j += 1
        os.symlink(frames[j][1], os.path.join(seq, f"s{k:05d}.jpg"))
    ends = [m[0] for m in marks[1:]] + [total]
    def esc(t): return t.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'").replace("%", "\\%")  # drawtext's own escapes
    draw = ",".join(
        f"drawtext=fontfile={FONT}:text='{esc(c)}':fontsize={fontsize}:fontcolor=#e8e6ff:box=1:boxcolor=#16181dcc:boxborderw=18:x=(w-text_w)/2:y=h-90:enable='between(t,{a:.2f},{e:.2f})'"
        for (a, c), e in zip(marks, ends) if c)
    pre = draw + "," if draw else ""
    src = ["-framerate", str(fps), "-i", os.path.join(seq, "s%05d.jpg")]
    gif = f"{pre}scale={width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *src, "-filter_complex", gif, "-loop", "0", os.path.join(out_dir, name + ".gif")], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *src, "-vf", f"{pre}scale={mp4_width}:-2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "24", "-r", "30", os.path.join(out_dir, name + ".mp4")], check=True)
