class Controls {
  constructor(gameLoop) {
    this.gameLoop = gameLoop;
    this.currentSpeed = 1;
    this.isPaused = false;

    this.setupSpeedButtons();
    this.setupPauseButton();
    this.setupKeyboardShortcuts();
  }

  setupSpeedButtons() {
    for (const speed of Config.SPEEDS) {
      const btn = document.getElementById(`speed-${speed}x`);
      if (btn) {
        btn.addEventListener('click', () => this.setSpeed(speed));
      }
    }
  }

  setupPauseButton() {
    const btn = document.getElementById('btn-pause');
    if (btn) {
      btn.addEventListener('click', () => this.togglePause());
    }
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          this.togglePause();
          break;
        case '1': this.setSpeed(1); break;
        case '2': this.setSpeed(2); break;
        case '3': this.setSpeed(5); break;
        case '4': this.setSpeed(10); break;
        case '5': this.setSpeed(20); break;
      }
    });
  }

  setSpeed(speed) {
    if (this.isPaused) {
      this.togglePause(); // Resume first
    }
    this.currentSpeed = speed;
    this.gameLoop.setSpeed(speed);

    // Update button active states
    for (const s of Config.SPEEDS) {
      const btn = document.getElementById(`speed-${s}x`);
      if (btn) btn.classList.toggle('active', s === speed);
    }
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.gameLoop.pause();
    } else {
      this.gameLoop.resume();
    }

    const btn = document.getElementById('btn-pause');
    if (btn) {
      btn.textContent = this.isPaused ? '▶' : '⏸';
      btn.classList.toggle('active', this.isPaused);
    }

    const indicator = document.getElementById('pause-indicator');
    if (indicator) {
      indicator.style.display = this.isPaused ? 'block' : 'none';
    }
  }
}
