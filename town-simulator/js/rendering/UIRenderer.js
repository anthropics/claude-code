class UIRenderer {
  constructor(ctx, camera) {
    this.ctx = ctx;
    this.camera = camera;
  }

  render(world, alpha) {
    const ctx = this.ctx;
    const cam = this.camera;

    // Render particles
    for (const p of world.particles) {
      const lifeRatio = p.life / p.maxLife;
      const px = p.x - cam.x;
      const py = p.y - cam.y;
      if (px < -10 || py < -10 || px > cam.vw + 10 || py > cam.vh + 10) continue;

      ctx.globalAlpha = lifeRatio;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(1, lifeRatio * 4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Render active event indicators
    for (const event of world.events) {
      if (event.type === 'FIRE' && event.building && !event.building.isDestroyed) {
        const b = event.building;
        const bpx = b.x * Config.TILE_SIZE - cam.x;
        const bpy = b.y * Config.TILE_SIZE - cam.y;
        // Pulsing warning indicator above building
        const pulse = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#ff4400';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🔥', bpx + b.pw / 2, bpy - 8);
        ctx.globalAlpha = 1;
      }
    }
  }
}
