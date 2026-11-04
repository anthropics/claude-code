#!/usr/bin/env python3
"""
Terminal Asteroids Game
A simple asteroids-style game playable in the terminal.

Controls:
- Arrow keys: Move ship
- Space: Shoot
- Q: Quit
"""

import curses
import random
import math
import time
from dataclasses import dataclass
from typing import List, Tuple


@dataclass
class GameObject:
    """Base class for game objects."""
    x: float
    y: float
    vx: float = 0.0
    vy: float = 0.0

    def update(self, max_x: int, max_y: int):
        """Update position and wrap around screen edges."""
        self.x += self.vx
        self.y += self.vy

        # Wrap around screen
        if self.x < 0:
            self.x = max_x - 1
        elif self.x >= max_x:
            self.x = 0

        if self.y < 0:
            self.y = max_y - 1
        elif self.y >= max_y:
            self.y = 0


@dataclass
class Ship(GameObject):
    """Player's ship."""
    angle: float = 0.0  # 0 = up, increases clockwise

    def rotate_left(self):
        self.angle -= 0.3

    def rotate_right(self):
        self.angle += 0.3

    def thrust(self):
        """Apply thrust in the direction ship is facing."""
        self.vx += math.sin(self.angle) * 0.3
        self.vy -= math.cos(self.angle) * 0.3

        # Limit max speed
        speed = math.sqrt(self.vx**2 + self.vy**2)
        if speed > 2.0:
            self.vx = (self.vx / speed) * 2.0
            self.vy = (self.vy / speed) * 2.0

    def get_shape(self) -> List[Tuple[int, int]]:
        """Return ship shape as list of relative coordinates."""
        # Simple triangle pointing in direction of angle
        front_x = int(2 * math.sin(self.angle))
        front_y = int(-2 * math.cos(self.angle))

        left_x = int(-1.5 * math.sin(self.angle + 2.5))
        left_y = int(1.5 * math.cos(self.angle + 2.5))

        right_x = int(-1.5 * math.sin(self.angle - 2.5))
        right_y = int(1.5 * math.cos(self.angle - 2.5))

        return [(front_x, front_y), (left_x, left_y), (right_x, right_y)]


@dataclass
class Asteroid(GameObject):
    """An asteroid."""
    size: int = 3  # 1=small, 2=medium, 3=large

    def get_radius(self) -> int:
        return self.size

    def split(self) -> List['Asteroid']:
        """Split asteroid into smaller pieces."""
        if self.size <= 1:
            return []

        pieces = []
        for _ in range(2):
            angle = random.uniform(0, 2 * math.pi)
            speed = random.uniform(0.5, 1.5)
            pieces.append(Asteroid(
                x=self.x,
                y=self.y,
                vx=self.vx + math.cos(angle) * speed,
                vy=self.vy + math.sin(angle) * speed,
                size=self.size - 1
            ))
        return pieces


@dataclass
class Bullet(GameObject):
    """A bullet fired from the ship."""
    lifetime: int = 40  # Frames before bullet disappears

    def update(self, max_x: int, max_y: int):
        super().update(max_x, max_y)
        self.lifetime -= 1

    def is_alive(self) -> bool:
        return self.lifetime > 0


class AsteroidsGame:
    """Main game class."""

    def __init__(self, stdscr):
        self.stdscr = stdscr
        self.max_y, self.max_x = stdscr.getmaxyx()

        # Game state
        self.ship = Ship(x=self.max_x // 2, y=self.max_y // 2)
        self.asteroids: List[Asteroid] = []
        self.bullets: List[Bullet] = []
        self.score = 0
        self.game_over = False
        self.level = 1

        # Setup
        curses.curs_set(0)  # Hide cursor
        self.stdscr.nodelay(1)  # Non-blocking input
        self.stdscr.timeout(50)  # 50ms timeout

        # Initialize colors if available
        if curses.has_colors():
            curses.init_pair(1, curses.COLOR_GREEN, curses.COLOR_BLACK)
            curses.init_pair(2, curses.COLOR_RED, curses.COLOR_BLACK)
            curses.init_pair(3, curses.COLOR_YELLOW, curses.COLOR_BLACK)
            curses.init_pair(4, curses.COLOR_CYAN, curses.COLOR_BLACK)

        self.spawn_asteroids(4)

    def spawn_asteroids(self, count: int):
        """Spawn new asteroids."""
        for _ in range(count):
            # Spawn away from ship
            while True:
                x = random.uniform(0, self.max_x)
                y = random.uniform(0, self.max_y)
                dx = x - self.ship.x
                dy = y - self.ship.y
                if dx*dx + dy*dy > 100:  # Far enough from ship
                    break

            angle = random.uniform(0, 2 * math.pi)
            speed = random.uniform(0.2, 0.8)

            self.asteroids.append(Asteroid(
                x=x,
                y=y,
                vx=math.cos(angle) * speed,
                vy=math.sin(angle) * speed,
                size=3
            ))

    def shoot(self):
        """Fire a bullet from the ship."""
        if len(self.bullets) < 5:  # Limit bullets on screen
            bullet_speed = 3.0
            self.bullets.append(Bullet(
                x=self.ship.x,
                y=self.ship.y,
                vx=self.ship.vx + math.sin(self.ship.angle) * bullet_speed,
                vy=self.ship.vy - math.cos(self.ship.angle) * bullet_speed
            ))

    def check_collision(self, obj1: GameObject, obj2: GameObject, dist: float) -> bool:
        """Check if two objects are colliding."""
        dx = obj1.x - obj2.x
        dy = obj1.y - obj2.y
        return (dx * dx + dy * dy) < (dist * dist)

    def update(self):
        """Update game state."""
        if self.game_over:
            return

        # Update ship
        self.ship.update(self.max_x, self.max_y)

        # Update asteroids
        for asteroid in self.asteroids:
            asteroid.update(self.max_x, self.max_y)

        # Update bullets
        self.bullets = [b for b in self.bullets if b.is_alive()]
        for bullet in self.bullets:
            bullet.update(self.max_x, self.max_y)

        # Check bullet-asteroid collisions
        new_asteroids = []
        bullets_to_remove = set()
        asteroids_to_remove = set()

        for i, asteroid in enumerate(self.asteroids):
            for j, bullet in enumerate(self.bullets):
                if self.check_collision(bullet, asteroid, asteroid.get_radius() + 1):
                    bullets_to_remove.add(j)
                    asteroids_to_remove.add(i)
                    new_asteroids.extend(asteroid.split())
                    self.score += (4 - asteroid.size) * 10

        self.bullets = [b for i, b in enumerate(self.bullets) if i not in bullets_to_remove]
        self.asteroids = [a for i, a in enumerate(self.asteroids) if i not in asteroids_to_remove]
        self.asteroids.extend(new_asteroids)

        # Check ship-asteroid collisions
        for asteroid in self.asteroids:
            if self.check_collision(self.ship, asteroid, asteroid.get_radius() + 1):
                self.game_over = True

        # Check if level complete
        if not self.asteroids:
            self.level += 1
            self.spawn_asteroids(3 + self.level)

    def draw(self):
        """Draw the game state."""
        self.stdscr.clear()

        # Draw ship
        if not self.game_over:
            shape = self.ship.get_shape()
            for dx, dy in shape:
                x = int(self.ship.x + dx)
                y = int(self.ship.y + dy)
                if 0 <= x < self.max_x and 0 <= y < self.max_y:
                    try:
                        self.stdscr.addstr(y, x, '^', curses.color_pair(1) if curses.has_colors() else 0)
                    except curses.error:
                        pass

        # Draw asteroids
        for asteroid in self.asteroids:
            x, y = int(asteroid.x), int(asteroid.y)
            if 0 <= x < self.max_x and 0 <= y < self.max_y:
                char = 'O' if asteroid.size == 3 else ('o' if asteroid.size == 2 else '.')
                try:
                    self.stdscr.addstr(y, x, char, curses.color_pair(2) if curses.has_colors() else 0)
                except curses.error:
                    pass

        # Draw bullets
        for bullet in self.bullets:
            x, y = int(bullet.x), int(bullet.y)
            if 0 <= x < self.max_x and 0 <= y < self.max_y:
                try:
                    self.stdscr.addstr(y, x, '*', curses.color_pair(3) if curses.has_colors() else 0)
                except curses.error:
                    pass

        # Draw UI
        try:
            self.stdscr.addstr(0, 0, f"Score: {self.score}  Level: {self.level}  ", curses.color_pair(4) if curses.has_colors() else 0)
            self.stdscr.addstr(1, 0, f"Asteroids: {len(self.asteroids)}  ", curses.color_pair(4) if curses.has_colors() else 0)

            if self.game_over:
                msg = "GAME OVER! Press R to restart or Q to quit"
                self.stdscr.addstr(self.max_y // 2, (self.max_x - len(msg)) // 2, msg,
                                 curses.color_pair(2) if curses.has_colors() else curses.A_BOLD)
        except curses.error:
            pass

        self.stdscr.refresh()

    def handle_input(self):
        """Handle keyboard input."""
        try:
            key = self.stdscr.getch()
        except:
            return True

        if key == ord('q') or key == ord('Q'):
            return False

        if self.game_over:
            if key == ord('r') or key == ord('R'):
                self.__init__(self.stdscr)
            return True

        if key == curses.KEY_LEFT:
            self.ship.rotate_left()
        elif key == curses.KEY_RIGHT:
            self.ship.rotate_right()
        elif key == curses.KEY_UP:
            self.ship.thrust()
        elif key == ord(' '):
            self.shoot()

        return True

    def run(self):
        """Main game loop."""
        while self.handle_input():
            self.update()
            self.draw()
            time.sleep(0.03)  # ~30 FPS


def main(stdscr):
    """Entry point for curses."""
    game = AsteroidsGame(stdscr)
    game.run()


if __name__ == "__main__":
    try:
        curses.wrapper(main)
    except KeyboardInterrupt:
        pass
