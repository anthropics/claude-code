class LightingRenderer {
  constructor(camera) {
    this.camera = camera;
    // Off-screen canvas for compositing
    this.lightCanvas = document.createElement('canvas');
    this.lightCtx = this.lightCanvas.getContext('2d');
    this.resize(Config.VIEWPORT_WIDTH, Config.VIEWPORT_HEIGHT);
  }

  resize(w, h) {
    this.lightCanvas.width = w;
    this.lightCanvas.height = h;
  }

  render(mainCtx, world, alpha) {
    const nightAlpha = world.clock.getNightAlpha();
    if (nightAlpha < 0.01) return; // Skip during full daylight

    const lc = this.lightCtx;
    const cam = this.camera;
    const w = this.lightCanvas.width;
    const h = this.lightCanvas.height;

    // Fill the light canvas with the night color
    lc.clearRect(0, 0, w, h);
    lc.fillStyle = `rgba(0, 0, 30, ${nightAlpha})`;
    lc.fillRect(0, 0, w, h);

    // Cut out light sources using destination-out
    lc.globalCompositeOperation = 'destination-out';

    // Building windows/lights
    for (const building of world.buildings) {
      if (building.isDestroyed) continue;
      if (!building.openState && building.type !== BuildingType.HOUSE) continue;

      const bpx = building.x * Config.TILE_SIZE - cam.x + building.width * Config.TILE_SIZE / 2;
      const bpy = building.y * Config.TILE_SIZE - cam.y + building.height * Config.TILE_SIZE / 2;

      if (bpx < -80 || bpy < -80 || bpx > w + 80 || bpy > h + 80) continue;

      // Window glow radius scales with building size
      const r = Math.min(building.width, building.height) * Config.TILE_SIZE * 0.7;
      this.drawGlow(lc, bpx, bpy, r, nightAlpha * 0.8);

      // Fire glow (extra bright)
      if (building.isOnFire) {
        this.drawGlow(lc, bpx, bpy, r * 2.5, nightAlpha);
      }
    }

    // Street lamp glows
    const grid = world.grid;
    const startX = Math.max(0, Math.floor(cam.x / Config.TILE_SIZE));
    const startY = Math.max(0, Math.floor(cam.y / Config.TILE_SIZE));
    const endX = Math.min(grid.width - 1, Math.ceil((cam.x + cam.vw) / Config.TILE_SIZE));
    const endY = Math.min(grid.height - 1, Math.ceil((cam.y + cam.vh) / Config.TILE_SIZE));

    for (let ty = startY; ty <= endY; ty++) {
      for (let tx = startX; tx <= endX; tx++) {
        const tile = grid.tiles[ty][tx];
        if (tile.streetLamp) {
          const lpx = tx * Config.TILE_SIZE - cam.x + Config.TILE_SIZE / 2;
          const lpy = ty * Config.TILE_SIZE - cam.y + 3;
          this.drawGlow(lc, lpx, lpy, 35, nightAlpha * 0.6);
        }
      }
    }

    lc.globalCompositeOperation = 'source-over';

    // Composite lighting canvas onto main canvas
    mainCtx.drawImage(this.lightCanvas, 0, 0);
  }

  drawGlow(ctx, x, y, radius, alpha) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, `rgba(255, 230, 180, ${alpha})`);
    grad.addColorStop(0.4, `rgba(255, 200, 100, ${alpha * 0.5})`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
