class GameLoop {
  constructor() {
    this.world = null;
    this.renderer = null;
    this.running = false;
    this.paused = false;
    this.speedMultiplier = 1;
    this.lastTimestamp = 0;
    this.accumulator = 0;
    this.TICK_MS = 1000 / Config.TICKS_PER_SECOND;
    this.tickCount = 0;
    this.boundLoop = this.loop.bind(this);
  }

  init(world, renderer) {
    this.world = world;
    this.renderer = renderer;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = 0;
    requestAnimationFrame(this.boundLoop);
  }

  pause() {
    this.paused = true;
  }

  resume() {
    if (this.paused) {
      this.paused = false;
      this.lastTimestamp = 0;
    }
  }

  togglePause() {
    if (this.paused) this.resume();
    else this.pause();
  }

  setSpeed(multiplier) {
    this.speedMultiplier = multiplier;
  }

  loop(timestamp) {
    if (!this.running) return;
    requestAnimationFrame(this.boundLoop);

    if (this.paused) {
      if (this.renderer) this.renderer.render(0);
      return;
    }

    if (this.lastTimestamp === 0) this.lastTimestamp = timestamp;
    let delta = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    // Clamp delta to avoid spiral of death on tab refocus
    delta = Math.min(delta, 250);

    this.accumulator += delta * this.speedMultiplier;

    // Cap number of ticks per frame to prevent lock-up at high speeds
    let maxTicks = Math.ceil(this.speedMultiplier * 4);
    while (this.accumulator >= this.TICK_MS && maxTicks > 0) {
      this.world.tick(this.tickCount);
      this.tickCount++;
      this.accumulator -= this.TICK_MS;
      maxTicks--;
    }

    // Drain accumulator if we hit the cap (prevents runaway at very high speed)
    if (maxTicks === 0) {
      this.accumulator = 0;
    }

    const alpha = this.accumulator / this.TICK_MS;
    this.renderer.render(alpha);
  }
}

const gameLoop = new GameLoop();
