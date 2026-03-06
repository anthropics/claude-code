#!/usr/bin/env python3
"""
Renders the Clawd GIF as truecolor half-block unicode on the alt screen.
Called by uuddlrlrba.sh when the code is detected.
"""
import sys
import time
import os
from PIL import Image

GIF = os.path.join(os.path.dirname(__file__), "clawd.gif")
ESC = "\033"

# Target width in terminal columns. Each char = 1 pixel wide, 2 tall (half-blocks).
TARGET_W = 24

def sample_frame(frame, bbox, target_w):
    """Crop to bbox, scale to target_w wide, return list of ANSI-colored rows."""
    x0, y0, x1, y1 = bbox
    crop = frame.crop((x0, y0, x1 + 1, y1 + 1))
    w, h = crop.size
    scale = target_w / w
    target_h = int(h * scale)
    # Round target_h to even so we get clean row pairs
    if target_h % 2:
        target_h += 1
    small = crop.resize((target_w, target_h), Image.NEAREST)
    px = small.load()

    rows = []
    for y in range(0, target_h, 2):
        line = []
        for x in range(target_w):
            top = px[x, y]
            bot = px[x, y + 1] if y + 1 < target_h else (255, 255, 255, 0)
            # RGBA
            t_r, t_g, t_b, t_a = top
            b_r, b_g, b_b, b_a = bot
            t_vis = t_a > 128 and not (t_r > 240 and t_g > 240 and t_b > 240)
            b_vis = b_a > 128 and not (b_r > 240 and b_g > 240 and b_b > 240)

            if t_vis and b_vis:
                # ▀ with fg=top, bg=bottom
                line.append(f"{ESC}[38;2;{t_r};{t_g};{t_b}m{ESC}[48;2;{b_r};{b_g};{b_b}m▀{ESC}[0m")
            elif t_vis:
                line.append(f"{ESC}[38;2;{t_r};{t_g};{t_b}m▀{ESC}[0m")
            elif b_vis:
                line.append(f"{ESC}[38;2;{b_r};{b_g};{b_b}m▄{ESC}[0m")
            else:
                line.append(" ")
        rows.append("".join(line))
    return rows


def main():
    try:
        tty = open("/dev/tty", "w")
    except Exception:
        return

    img = Image.open(GIF)
    n = img.n_frames

    # Compute global bbox once
    minx, miny, maxx, maxy = 999, 999, 0, 0
    for f in range(n):
        img.seek(f)
        frame = img.convert("RGBA")
        px = frame.load()
        w, h = frame.size
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a > 128 and not (r > 240 and g > 240 and b > 240):
                    if x < minx: minx = x
                    if y < miny: miny = y
                    if x > maxx: maxx = x
                    if y > maxy: maxy = y
    bbox = (minx, miny, maxx, maxy)

    # Pre-render all frames
    frames = []
    durations = []
    for f in range(n):
        img.seek(f)
        durations.append(img.info.get("duration", 80) / 1000.0)
        frames.append(sample_frame(img.convert("RGBA"), bbox, TARGET_W))

    rows_h = len(frames[0])

    # Terminal dimensions for centering
    try:
        cols, lines = os.get_terminal_size(tty.fileno())
    except Exception:
        cols, lines = 80, 24
    left = max(1, (cols - TARGET_W) // 2)
    top = max(1, (lines - rows_h) // 2 - 1)

    w = tty.write

    # Enter alt screen, hide cursor, clear
    w(f"{ESC}[?1049h{ESC}[?25l{ESC}[2J")

    # +30 LIVES banner
    banner = "+ 30 LIVES"
    bl = max(1, (cols - len(banner)) // 2)
    banner_row = max(1, top - 2)
    w(f"{ESC}[{banner_row};{bl}H{ESC}[1m{ESC}[38;2;217;119;87m{banner}{ESC}[0m")
    tty.flush()
    time.sleep(0.4)
    w(f"{ESC}[{banner_row};1H{ESC}[2K")

    try:
        # Play twice
        for _ in range(2):
            for rows, dur in zip(frames, durations):
                for i, row in enumerate(rows):
                    w(f"{ESC}[{top + i};{left}H{ESC}[2K{row}")
                tty.flush()
                time.sleep(dur)
    finally:
        # Show cursor, leave alt screen. Ink's buffer untouched.
        w(f"{ESC}[?25h{ESC}[?1049l")
        tty.flush()
        tty.close()


if __name__ == "__main__":
    main()
