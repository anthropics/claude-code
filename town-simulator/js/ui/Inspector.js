class Inspector {
  constructor(world, renderer) {
    this.world = world;
    this.renderer = renderer;
    this.panel = document.getElementById('inspector');
    this.selected = null; // Person or Building

    // Click handler on the canvas
    const canvas = renderer.canvas;
    canvas.addEventListener('click', (e) => {
      if (e.button !== 0) return; // Left click only
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      this.handleClick(sx, sy);
    });
  }

  handleClick(sx, sy) {
    const cam = this.renderer.camera;
    const tx = Math.floor((sx + cam.x) / Config.TILE_SIZE);
    const ty = Math.floor((sy + cam.y) / Config.TILE_SIZE);

    // Check for person first (small click radius)
    const persons = this.world.getPersonsAt(tx, ty);
    if (persons.length > 0) {
      this.selectPerson(persons[0]);
      return;
    }

    // Check for person in adjacent tiles (click tolerance)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const p = this.world.getPersonsAt(tx + dx, ty + dy);
        if (p.length > 0) {
          this.selectPerson(p[0]);
          return;
        }
      }
    }

    // Check for building
    const building = this.world.getBuildingAt(tx, ty);
    if (building) {
      this.selectBuilding(building);
      return;
    }

    // Deselect
    this.deselect();
  }

  selectPerson(person) {
    this.selected = person;
    this.renderer.setSelected(person);
    // Center camera on person
    this.renderer.camera.centerOn(Math.floor(person.x), Math.floor(person.y));
    this.refresh();
    this.panel.classList.remove('hidden');
  }

  selectBuilding(building) {
    this.selected = building;
    this.renderer.setSelected(null);
    this.renderer.camera.centerOn(Math.floor(building.centerX), Math.floor(building.centerY));
    this.refresh();
    this.panel.classList.remove('hidden');
  }

  deselect() {
    this.selected = null;
    this.renderer.setSelected(null);
    this.panel.classList.add('hidden');
  }

  refresh() {
    if (!this.selected) return;
    if (this.selected instanceof Person) {
      this.renderPersonPanel(this.selected);
    } else if (this.selected instanceof Building) {
      this.renderBuildingPanel(this.selected);
    }
  }

  renderPersonPanel(p) {
    const age = Math.floor(p.age);
    const partner = p.partner && !p.partner.isDead ? p.partner.name : 'None';
    const childCount = p.children.filter(c => !c.isDead).length;

    this.panel.innerHTML = `
      <div class="inspector-header">
        <span class="inspector-icon">${p.gender === 'M' ? '👨' : '👩'}</span>
        <div>
          <strong>${p.name}</strong>
          <div class="inspector-sub">${p.ageLabel} &bull; ${p.jobTitle}</div>
        </div>
        <button class="inspector-close" onclick="inspector.deselect()">✕</button>
      </div>

      <div class="stat-rows">
        ${this.statBar('Health',    p.health,    '#44cc44')}
        ${this.statBar('Happiness', p.happiness, '#ffcc00')}
        ${this.statBar('Hunger',    p.hunger,    '#ff8800')}
        ${this.statBar('Energy',    p.energy,    '#44aaff')}
      </div>

      <div class="inspector-info">
        <div><span class="lbl">Money:</span> ${Utils.formatMoney(p.money)}</div>
        <div><span class="lbl">State:</span> ${this.stateLabel(p.state)}</div>
        <div><span class="lbl">Activity:</span> ${p.recentActivity || '—'}</div>
        <div><span class="lbl">Partner:</span> ${partner}</div>
        <div><span class="lbl">Children:</span> ${childCount}</div>
        <div><span class="lbl">Friends:</span> ${p.friendCount}</div>
        <div><span class="lbl">Hobby:</span> ${p.hobby}</div>
      </div>

      <div class="inspector-traits">
        <div class="trait-row">
          <span>Sociable</span>
          <div class="trait-bar" style="width:${p.traits.sociability * 60}px"></div>
        </div>
        <div class="trait-row">
          <span>Work Ethic</span>
          <div class="trait-bar" style="width:${p.traits.workEthic * 60}px"></div>
        </div>
        <div class="trait-row">
          <span>Thrifty</span>
          <div class="trait-bar" style="width:${p.traits.thriftiness * 60}px"></div>
        </div>
        <div class="trait-row">
          <span>Constitution</span>
          <div class="trait-bar" style="width:${p.traits.constitution * 60}px"></div>
        </div>
      </div>
    `;
  }

  renderBuildingPanel(b) {
    const openStr = b.openState ? '<span class="open-tag">OPEN</span>' : '<span class="closed-tag">CLOSED</span>';
    const workers = b.workers ? b.workers.filter(w => !w.isDead).length : 0;
    const hours = b.openHour === -1 ? 'Always Open' : `${String(b.openHour).padStart(2,'0')}:00 – ${String(b.closeHour).padStart(2,'0')}:00`;

    this.panel.innerHTML = `
      <div class="inspector-header">
        <span class="inspector-icon">${this.buildingIcon(b.type)}</span>
        <div>
          <strong>${b.name}</strong>
          <div class="inspector-sub">${openStr}</div>
        </div>
        <button class="inspector-close" onclick="inspector.deselect()">✕</button>
      </div>

      <div class="inspector-info">
        <div><span class="lbl">Hours:</span> ${hours}</div>
        <div><span class="lbl">Visitors:</span> ${b.occupantCount} / ${b.capacity}</div>
        <div><span class="lbl">Workers:</span> ${workers} / ${b.maxWorkers}</div>
        <div><span class="lbl">Revenue:</span> ${Utils.formatMoney(b.revenue)}</div>
        ${b.isOnFire ? '<div class="fire-warn">🔥 ON FIRE!</div>' : ''}
        ${b.isDestroyed ? '<div class="fire-warn">💀 DESTROYED</div>' : ''}
      </div>

      <div class="inspector-info">
        <strong>Occupants:</strong><br>
        ${b.currentOccupants.slice(0, 8).map(p => `<span class="occ-tag">${p.name.split(' ')[0]}</span>`).join(' ')}
        ${b.currentOccupants.length > 8 ? `+${b.currentOccupants.length - 8} more` : ''}
      </div>
    `;
  }

  statBar(label, value, color) {
    const pct = Utils.clamp(value, 0, 100);
    return `
      <div class="stat-row">
        <span class="stat-label">${label}</span>
        <div class="stat-track">
          <div class="stat-fill" style="width:${pct}%; background:${color}"></div>
        </div>
        <span class="stat-val">${Math.round(pct)}</span>
      </div>
    `;
  }

  stateLabel(state) {
    const labels = {
      IDLE: '😐 Idle', WALKING: '🚶 Walking', WORKING: '💼 Working',
      EATING: '🍴 Eating', SLEEPING: '😴 Sleeping', LEISURE: '🎉 Leisure',
      SHOPPING: '🛒 Shopping', SOCIALIZING: '💬 Socializing',
      ATTENDING_EVENT: '🎊 At Event', SICK: '🤒 Sick',
    };
    return labels[state] || state;
  }

  buildingIcon(type) {
    const icons = {
      HOSPITAL: '🏥', LIBRARY: '📚', FIRE_STATION: '🚒', POLICE: '🚔',
      RESTAURANT: '🍽️', SCHOOL: '🏫', THEATRE: '🎭', PARK: '🌳',
      GROCERY: '🛒', BANK: '🏦', TOWN_HALL: '🏛️', CHURCH: '⛪',
      GYM: '💪', HOUSE: '🏠',
    };
    return icons[type] || '🏢';
  }

  // Called each frame to update live values
  update() {
    if (this.selected instanceof Person && !this.selected.isDead) {
      this.refresh();
    }
  }
}
