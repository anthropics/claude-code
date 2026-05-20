class PersonRenderer {
  constructor(ctx, camera) {
    this.ctx = ctx;
    this.camera = camera;
    this.selectedPerson = null;
    this.pulseFrame = 0;
  }

  render(world, alpha) {
    const ctx = this.ctx;
    const cam = this.camera;
    this.pulseFrame = (this.pulseFrame + 1) % 60;

    for (const person of world.persons) {
      if (person.isDead) continue;

      // Interpolated pixel position
      const px = Utils.lerp(person.prevPixelX, person.pixelX, alpha) - cam.x;
      const py = Utils.lerp(person.prevPixelY, person.pixelY, alpha) - cam.y;

      // Cull off-screen
      if (px < -10 || py < -10 || px > cam.vw + 10 || py > cam.vh + 10) continue;

      this.renderPerson(ctx, person, px, py);
    }
  }

  renderPerson(ctx, person, px, py) {
    const isSelected = this.selectedPerson === person;
    const r = this.getPersonRadius(person);

    // Selection highlight ring
    if (isSelected) {
      const pulse = Math.sin(this.pulseFrame * 0.2) * 2;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, r + 4 + pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(px, py + r + 1, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body circle
    ctx.fillStyle = this.getPersonColor(person);
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();

    // Outline
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // State indicator dot (above head)
    const stateColor = this.getStateColor(person.state);
    if (stateColor) {
      ctx.fillStyle = stateColor;
      ctx.beginPath();
      ctx.arc(px, py - r - 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Happiness mini-bar (below person)
    this.renderMiniBar(ctx, px - r, py + r + 3, r * 2, 2, person.happiness / 100);

    // Partner link (faint line between partners when nearby)
    if (person.partner && !person.partner.isDead) {
      const partnerPx = person.partner.pixelX - this.camera.x;
      const partnerPy = person.partner.pixelY - this.camera.y;
      const dist = Utils.distance(px, py, partnerPx, partnerPy);
      if (dist < 40) {
        ctx.strokeStyle = 'rgba(255,182,193,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(partnerPx, partnerPy);
        ctx.stroke();
      }
    }
  }

  getPersonRadius(person) {
    const age = Math.floor(person.age);
    if (age < 5) return 2.5;
    if (age < 18) return 3.5;
    return 5;
  }

  getPersonColor(person) {
    const age = Math.floor(person.age);
    if (age < 18) {
      return '#88bbff'; // children: light blue
    }
    if (age >= Config.RETIRE_AGE) {
      return '#aaaaaa'; // elderly: gray
    }
    if (person.state === PersonState.SICK) {
      return '#ddaa88'; // sick: pale
    }
    // Adults by gender
    if (person.gender === 'M') return '#4488cc';
    return '#cc6688';
  }

  getStateColor(state) {
    switch (state) {
      case PersonState.WORKING:         return '#ff8800';
      case PersonState.SLEEPING:        return '#334488';
      case PersonState.SICK:            return '#cc2222';
      case PersonState.EATING:          return '#44cc44';
      case PersonState.LEISURE:         return '#44dd88';
      case PersonState.SOCIALIZING:     return '#ffdd00';
      case PersonState.SHOPPING:        return '#dd88ff';
      case PersonState.ATTENDING_EVENT: return '#ff66ff';
      default: return null;
    }
  }

  renderMiniBar(ctx, x, y, w, h, fraction) {
    fraction = Utils.clamp(fraction, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x, y, w, h);
    const color = fraction > 0.6 ? '#44cc44' : fraction > 0.3 ? '#cccc44' : '#cc4444';
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * fraction, h);
  }

  setSelected(person) {
    this.selectedPerson = person;
  }
}
