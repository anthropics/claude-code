class BuildingRenderer {
  constructor(ctx, camera) {
    this.ctx = ctx;
    this.camera = camera;
    this.fireFrame = 0;
  }

  render(world, alpha) {
    const ctx = this.ctx;
    const cam = this.camera;
    this.fireFrame = (this.fireFrame + 1) % 20;

    for (const building of world.buildings) {
      if (building.isDestroyed) {
        this.renderDestroyed(ctx, building, cam);
        continue;
      }

      const px = building.x * Config.TILE_SIZE - cam.x;
      const py = building.y * Config.TILE_SIZE - cam.y;
      const pw = building.width * Config.TILE_SIZE;
      const ph = building.height * Config.TILE_SIZE;

      // Cull off-screen buildings
      if (px + pw < 0 || py + ph < 0 || px > cam.vw || py > cam.vh) continue;

      this.renderBuilding(ctx, building, px, py, pw, ph, world.clock);
    }
  }

  renderBuilding(ctx, building, px, py, pw, ph, clock) {
    // Main body
    ctx.fillStyle = building.color;
    ctx.fillRect(px, py, pw, ph);

    // Roof strip (top 20-25%)
    const roofH = Math.max(4, Math.floor(ph * 0.22));
    ctx.fillStyle = building.roofColor;
    ctx.fillRect(px, py, pw, roofH);

    // Type-specific details
    switch (building.type) {
      case BuildingType.HOSPITAL:   this.renderHospital(ctx, building, px, py, pw, ph, clock); break;
      case BuildingType.FIRE_STATION: this.renderFireStation(ctx, building, px, py, pw, ph); break;
      case BuildingType.POLICE:     this.renderPolice(ctx, building, px, py, pw, ph); break;
      case BuildingType.PARK:       this.renderPark(ctx, building, px, py, pw, ph); break;
      case BuildingType.CHURCH:     this.renderChurch(ctx, building, px, py, pw, ph); break;
      case BuildingType.BANK:       this.renderBank(ctx, building, px, py, pw, ph); break;
      case BuildingType.THEATRE:    this.renderTheatre(ctx, building, px, py, pw, ph); break;
      case BuildingType.SCHOOL:     this.renderSchool(ctx, building, px, py, pw, ph); break;
      case BuildingType.HOUSE:      this.renderHouse(ctx, building, px, py, pw, ph, clock); break;
      default:                      this.renderGeneric(ctx, building, px, py, pw, ph, clock); break;
    }

    // Building outline
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(px, py, pw, ph);

    // Name label (only if building is large enough)
    if (pw >= 32 && building.type !== BuildingType.HOUSE) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `bold ${Math.min(10, pw / building.symbol.length * 0.8)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(building.symbol || building.name.slice(0, 4),
        px + pw / 2, py + ph / 2 + 2);
    }

    // Fire effect overlay
    if (building.isOnFire) {
      this.renderFire(ctx, building, px, py, pw, ph);
    }

    // Health bar if on fire or damaged
    if (building.isOnFire) {
      this.renderHealthBar(ctx, px, py, pw, building.fireHealth / 100);
    }
  }

  renderHospital(ctx, b, px, py, pw, ph, clock) {
    // White cross
    const cx = px + pw / 2;
    const cy = py + ph / 2 + 4;
    const arm = Math.min(pw, ph) * 0.15;
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(cx - arm * 3, cy - arm, arm * 6, arm * 2);
    ctx.fillRect(cx - arm, cy - arm * 3, arm * 2, arm * 6);

    // Windows
    this.renderWindows(ctx, px, py, pw, ph, '#aaddff', clock, b.openState);
  }

  renderFireStation(ctx, b, px, py, pw, ph) {
    // Red garage door
    const doorW = pw * 0.6;
    const doorH = ph * 0.4;
    ctx.fillStyle = '#ff4400';
    ctx.fillRect(px + (pw - doorW) / 2, py + ph - doorH, doorW, doorH);
    // Door panels
    ctx.strokeStyle = '#cc2200';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const lx = px + (pw - doorW) / 2 + doorW / 4 * i;
      ctx.beginPath();
      ctx.moveTo(lx, py + ph - doorH);
      ctx.lineTo(lx, py + ph);
      ctx.stroke();
    }
  }

  renderPolice(ctx, b, px, py, pw, ph) {
    // Blue stripe across front
    ctx.fillStyle = '#3355aa';
    ctx.fillRect(px, py + ph * 0.5, pw, ph * 0.1);
    // Badge symbol
    ctx.fillStyle = '#ffcc00';
    ctx.font = `${Math.floor(ph * 0.3)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', px + pw / 2, py + ph * 0.72);
  }

  renderPark(ctx, b, px, py, pw, ph) {
    // Trees (green circles)
    const treePositions = [
      [0.15, 0.2], [0.5, 0.15], [0.8, 0.22],
      [0.1, 0.6],  [0.45, 0.55], [0.75, 0.65],
      [0.25, 0.8], [0.65, 0.8],
    ];
    for (const [tx, ty] of treePositions) {
      const trx = px + pw * tx;
      const try_ = py + ph * ty;
      const r = Math.min(pw, ph) * 0.09;
      // Trunk
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(trx - 1, try_ - 2, 2, r + 2);
      // Canopy
      ctx.fillStyle = '#228822';
      ctx.beginPath();
      ctx.arc(trx, try_ - r * 0.3, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#33aa33';
      ctx.beginPath();
      ctx.arc(trx - r * 0.3, try_ - r * 0.5, r * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }
    // Path through park
    ctx.fillStyle = '#d4b86a';
    ctx.fillRect(px + pw * 0.35, py, pw * 0.12, ph);
    ctx.fillRect(px, py + ph * 0.4, pw, ph * 0.12);
  }

  renderChurch(ctx, b, px, py, pw, ph) {
    // Steeple on top
    ctx.fillStyle = b.roofColor;
    ctx.beginPath();
    ctx.moveTo(px + pw / 2, py - ph * 0.3);
    ctx.lineTo(px + pw * 0.2, py);
    ctx.lineTo(px + pw * 0.8, py);
    ctx.closePath();
    ctx.fill();

    // Cross on steeple
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + pw / 2, py - ph * 0.28);
    ctx.lineTo(px + pw / 2, py - ph * 0.1);
    ctx.moveTo(px + pw / 2 - 4, py - ph * 0.2);
    ctx.lineTo(px + pw / 2 + 4, py - ph * 0.2);
    ctx.stroke();

    // Arched window
    ctx.fillStyle = '#aac4ff';
    const aw = pw * 0.25;
    const ah = ph * 0.25;
    ctx.fillRect(px + pw / 2 - aw / 2, py + ph * 0.45, aw, ah);
    ctx.beginPath();
    ctx.arc(px + pw / 2, py + ph * 0.45, aw / 2, Math.PI, 0);
    ctx.fill();
  }

  renderBank(ctx, b, px, py, pw, ph) {
    // Columns
    const colW = pw * 0.06;
    const positions = [0.15, 0.38, 0.62, 0.85];
    ctx.fillStyle = '#bbbbbb';
    for (const t of positions) {
      ctx.fillRect(px + pw * t - colW / 2, py + ph * 0.18, colW, ph * 0.75);
    }
    // Pediment (triangle)
    ctx.fillStyle = b.roofColor;
    ctx.beginPath();
    ctx.moveTo(px + pw * 0.05, py + ph * 0.18);
    ctx.lineTo(px + pw / 2, py + ph * 0.02);
    ctx.lineTo(px + pw * 0.95, py + ph * 0.18);
    ctx.closePath();
    ctx.fill();
  }

  renderTheatre(ctx, b, px, py, pw, ph) {
    // Marquee strip
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(px + pw * 0.05, py + ph * 0.3, pw * 0.9, ph * 0.15);
    // Lights on marquee
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = this.fireFrame % 4 < 2 ? '#ffff00' : '#ff8800';
      ctx.beginPath();
      ctx.arc(px + pw * 0.1 + i * (pw * 0.8 / 5), py + ph * 0.375, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Curtain (doors)
    ctx.fillStyle = '#cc0044';
    ctx.fillRect(px + pw * 0.2, py + ph * 0.55, pw * 0.25, ph * 0.42);
    ctx.fillRect(px + pw * 0.55, py + ph * 0.55, pw * 0.25, ph * 0.42);
  }

  renderSchool(ctx, b, px, py, pw, ph) {
    // Bell tower suggestion on top
    ctx.fillStyle = '#d4c040';
    ctx.fillRect(px + pw * 0.4, py - ph * 0.1, pw * 0.2, ph * 0.12);
    // Windows in grid
    const rows = 2, cols = 3;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = '#aad4ff';
        ctx.fillRect(
          px + pw * (0.15 + c * 0.28),
          py + ph * (0.35 + r * 0.28),
          pw * 0.18, ph * 0.18
        );
      }
    }
  }

  renderHouse(ctx, b, px, py, pw, ph, clock) {
    // Pitched roof (triangle)
    ctx.fillStyle = b.roofColor;
    ctx.beginPath();
    ctx.moveTo(px - 2, py + ph * 0.28);
    ctx.lineTo(px + pw / 2, py - ph * 0.15);
    ctx.lineTo(px + pw + 2, py + ph * 0.28);
    ctx.closePath();
    ctx.fill();

    // Door
    ctx.fillStyle = '#5c3a1e';
    const dw = pw * 0.22;
    const dh = ph * 0.35;
    ctx.fillRect(px + pw / 2 - dw / 2, py + ph - dh, dw, dh);

    // Windows
    const isNight = clock ? clock.isNight() : false;
    const winColor = isNight ? '#ffee88' : '#aad4ff';
    ctx.fillStyle = winColor;
    ctx.fillRect(px + pw * 0.1, py + ph * 0.4, pw * 0.25, ph * 0.22);
    ctx.fillRect(px + pw * 0.65, py + ph * 0.4, pw * 0.25, ph * 0.22);
  }

  renderGeneric(ctx, b, px, py, pw, ph, clock) {
    // Generic windows
    this.renderWindows(ctx, px, py, pw, ph, '#aad4ff', clock, b.openState);
  }

  renderWindows(ctx, px, py, pw, ph, color, clock, isOpen) {
    const nightColor = '#ffee88';
    const winColor = (clock && clock.isNight() && isOpen) ? nightColor : color;
    const rows = Math.max(1, Math.floor(ph / 20) - 1);
    const cols = Math.max(1, Math.floor(pw / 20));
    const ww = Math.min(8, pw / cols * 0.4);
    const wh = Math.min(8, ph / rows * 0.35);

    ctx.fillStyle = winColor;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillRect(
          px + (pw / cols) * (c + 0.25),
          py + ph * 0.3 + (ph * 0.55 / rows) * r,
          ww, wh
        );
      }
    }
  }

  renderFire(ctx, b, px, py, pw, ph) {
    const ff = this.fireFrame;
    // Flickering fire rectangles
    for (let i = 0; i < 5; i++) {
      const fw = pw * Utils.randFloat(0.1, 0.35);
      const fh = ph * Utils.randFloat(0.2, 0.5);
      const fx = px + Math.random() * (pw - fw);
      const fy = py + ph * 0.3 - fh * 0.5;
      const alpha = Utils.randFloat(0.5, 0.9);
      const colors = ['rgba(255,68,0,', 'rgba(255,136,0,', 'rgba(255,200,0,'];
      ctx.fillStyle = Utils.pick(colors) + alpha + ')';
      ctx.fillRect(fx, fy, fw, fh);
    }
    // Smoke at top
    ctx.fillStyle = 'rgba(40,40,40,0.3)';
    ctx.beginPath();
    ctx.arc(px + pw * 0.4, py - 5, 8 + (ff % 5), 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + pw * 0.6, py - 8, 6 + (ff % 4), 0, Math.PI * 2);
    ctx.fill();
  }

  renderDestroyed(ctx, building, cam) {
    const px = building.x * Config.TILE_SIZE - cam.x;
    const py = building.y * Config.TILE_SIZE - cam.y;
    const pw = building.width * Config.TILE_SIZE;
    const ph = building.height * Config.TILE_SIZE;

    if (px + pw < 0 || py + ph < 0 || px > cam.vw || py > cam.vh) return;

    ctx.fillStyle = '#3a3028';
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = '#555544';
    // Rubble pattern
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(
        px + (pw * 0.05) + (i % 4) * pw * 0.23,
        py + (ph * 0.1) + Math.floor(i / 4) * ph * 0.45,
        pw * 0.18, ph * 0.35
      );
    }
    ctx.fillStyle = 'rgba(80,60,40,0.7)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DESTROYED', px + pw / 2, py + ph / 2);
  }

  renderHealthBar(ctx, px, py, pw, fraction) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(px, py - 6, pw, 4);
    ctx.fillStyle = fraction > 0.5 ? '#44cc44' : fraction > 0.25 ? '#cccc44' : '#cc4444';
    ctx.fillRect(px, py - 6, pw * fraction, 4);
  }
}
