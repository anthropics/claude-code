#!/usr/bin/env python3
import curses
import time
import random

FPS = 20
FRAME_TIME = 1.0 / FPS
GRAVITY = 0.3
FLAP_VEL = -1.5
PIPE_GAP = 10
PIPE_WIDTH = 3
PIPE_SPEED = 1
PIPE_SPAWN_INTERVAL = 40
MIN_ROWS = 24
MIN_COLS = 60
BIRD_COL_RATIO = 4  # bird fixed at max_x // BIRD_COL_RATIO
CLAUDE_SPRITE = [
    "▛█▜",
]  # ▛█▜ — Claude block logo (1 row)
BIRD_HEIGHT = len(CLAUDE_SPRITE)


def reset_game(max_y, max_x):
    return {
        "bird_y": float(max_y // 2),
        "bird_vel": 0.0,
        "pipes": [],
        "score": 0,
        "frame": 0,
        "state": "PLAYING",
    }


def spawn_pipe(max_y, max_x):
    gap_top = random.randint(2, max_y - PIPE_GAP - 3)
    return {"x": max_x - 1, "gap_top": gap_top, "scored": False}


def update_pipes(gs, max_y, max_x):
    gs["frame"] += 1
    if gs["frame"] % PIPE_SPAWN_INTERVAL == 0:
        gs["pipes"].append(spawn_pipe(max_y, max_x))
    for p in gs["pipes"]:
        p["x"] -= PIPE_SPEED
    gs["pipes"] = [p for p in gs["pipes"] if p["x"] + PIPE_WIDTH > 0]


def check_score(gs, bird_col):
    for p in gs["pipes"]:
        if not p["scored"] and p["x"] + PIPE_WIDTH < bird_col:
            p["scored"] = True
            gs["score"] += 1


def check_collision(gs, bird_col, max_y):
    bird_row = int(gs["bird_y"])
    for dr in range(BIRD_HEIGHT):
        r = bird_row + dr
        if r <= 0 or r >= max_y - 1:
            return True
        for p in gs["pipes"]:
            if p["x"] <= bird_col <= p["x"] + PIPE_WIDTH - 1:
                if not (p["gap_top"] <= r < p["gap_top"] + PIPE_GAP):
                    return True
    return False


def draw_game(stdscr, gs, bird_col, max_y, max_x):
    stdscr.erase()
    try:
        stdscr.addstr(0, 0, f"SCORE: {gs['score']}")
    except curses.error:
        pass
    for p in gs["pipes"]:
        for row in range(1, max_y - 1):
            if row < p["gap_top"] or row >= p["gap_top"] + PIPE_GAP:
                for col in range(p["x"], min(p["x"] + PIPE_WIDTH, max_x - 1)):
                    if 0 <= col < max_x - 1:
                        try:
                            stdscr.addch(row, col, "|")
                        except curses.error:
                            pass
    bird_row = int(gs["bird_y"])
    for i, sprite_row in enumerate(CLAUDE_SPRITE):
        r = bird_row + i
        if 0 < r < max_y - 1 and 0 <= bird_col < max_x - 2:
            try:
                stdscr.addstr(r, bird_col, sprite_row)
            except curses.error:
                pass
    stdscr.refresh()


def draw_title(stdscr, max_y, max_x):
    stdscr.erase()
    lines = [
        " ___ _      _   ___ ___ _   _",
        "| __| |    /_\\ | _ \\ _ \\ | | |",
        "| _|| |__ / _ \\|  _/  _/ |_| |",
        "|_| |____/_/ \\_\\_| |_|  \\___/",
        "",
        "  ___ _      _   _   _ ___  ___",
        " / __| |    /_\\ | | | |   \\| __|",
        "| (__| |__ / _ \\| |_| | |) | _|",
        " \\___|____/_/ \\_|\\___/|___/|___|",
        "",
        "Press SPACE to start",
        "Press Q to quit",
    ]
    start_y = max_y // 2 - len(lines) // 2
    for i, line in enumerate(lines):
        x = max(0, max_x // 2 - len(line) // 2)
        try:
            stdscr.addstr(start_y + i, x, line)
        except curses.error:
            pass
    stdscr.refresh()


def draw_game_over(stdscr, score, max_y, max_x):
    stdscr.erase()
    lines = [
        "GAME OVER",
        "",
        f"Score: {score}",
        "",
        "Press R to restart",
        "Press Q to quit",
    ]
    start_y = max_y // 2 - len(lines) // 2
    for i, line in enumerate(lines):
        x = max(0, max_x // 2 - len(line) // 2)
        try:
            stdscr.addstr(start_y + i, x, line)
        except curses.error:
            pass
    stdscr.refresh()


def main(stdscr):
    try:
        curses.curs_set(0)
    except curses.error:
        pass
    stdscr.nodelay(True)
    stdscr.keypad(True)

    max_y, max_x = stdscr.getmaxyx()
    if max_y < MIN_ROWS or max_x < MIN_COLS:
        try:
            stdscr.addstr(
                0,
                0,
                f"Terminal too small! Need {MIN_ROWS}x{MIN_COLS}, got {max_y}x{max_x}",
            )
            stdscr.refresh()
        except curses.error:
            pass
        time.sleep(2)
        return

    bird_col = max_x // BIRD_COL_RATIO
    gs = reset_game(max_y, max_x)
    gs["state"] = "TITLE"

    try:
        while True:
            key = stdscr.getch()

            if key == ord("q") or key == ord("Q"):
                return

            if gs["state"] == "TITLE":
                draw_title(stdscr, max_y, max_x)
                if key == ord(" ") or key == curses.KEY_UP:
                    gs["state"] = "PLAYING"

            elif gs["state"] == "PLAYING":
                if key == ord(" ") or key == curses.KEY_UP:
                    gs["bird_vel"] = FLAP_VEL

                gs["bird_vel"] += GRAVITY
                gs["bird_y"] += gs["bird_vel"]

                update_pipes(gs, max_y, max_x)
                check_score(gs, bird_col)

                if check_collision(gs, bird_col, max_y):
                    gs["state"] = "GAME_OVER"
                else:
                    draw_game(stdscr, gs, bird_col, max_y, max_x)

            elif gs["state"] == "GAME_OVER":
                draw_game_over(stdscr, gs["score"], max_y, max_x)
                if key == ord("r") or key == ord("R"):
                    gs = reset_game(max_y, max_x)

            time.sleep(FRAME_TIME)
    except KeyboardInterrupt:
        pass


def run():
    curses.wrapper(main)


if __name__ == "__main__":
    run()
