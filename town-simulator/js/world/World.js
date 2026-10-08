class World {
  constructor() {
    this.grid = new Grid(Config.GRID_WIDTH, Config.GRID_HEIGHT);
    this.clock = new DayNightCycle();
    this.buildings = [];
    this.persons = [];
    this.particles = [];  // Visual effects
    this.events = [];     // Active game events

    // Systems (set after construction)
    this.economySystem = null;
    this.healthSystem = null;
    this.happinessSystem = null;
    this.relationshipSystem = null;
    this.eventSystem = null;

    // Stats
    this.stats = {
      birthsToday: 0,
      deathsToday: 0,
      treasury: Config.INITIAL_TREASURY,
    };

    this._nextPersonId = 0;
  }

  // --- Initialization ---

  init() {
    BuildingFactory.generate(this);
    this.economySystem     = new EconomySystem(this);
    this.healthSystem      = new HealthSystem(this);
    this.happinessSystem   = new HappinessSystem(this);
    this.relationshipSystem = new RelationshipSystem(this);
    this.eventSystem       = new EventSystem(this);

    // Spawn initial population
    PersonFactory.spawnInitial(this, Config.INITIAL_POPULATION);
  }

  // --- Tick ---

  tick(tickCount) {
    this.clock.tick();

    if (this.clock.isNewDay()) {
      this.stats.birthsToday = 0;
      this.stats.deathsToday = 0;
    }

    // Tick all persons
    for (let i = this.persons.length - 1; i >= 0; i--) {
      this.persons[i].tick(tickCount);
    }

    // Tick systems
    this.economySystem.tick(tickCount);
    this.healthSystem.tick(tickCount);
    this.happinessSystem.tick(tickCount);
    this.relationshipSystem.tick(tickCount);
    this.eventSystem.tick(tickCount);

    // Tick active events
    for (let i = this.events.length - 1; i >= 0; i--) {
      this.events[i].tick();
      if (this.events[i].isResolved) {
        this.events.splice(i, 1);
      }
    }

    // Tick particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].life--;
      this.particles[i].x += this.particles[i].vx;
      this.particles[i].y += this.particles[i].vy;
      this.particles[i].vy -= 0.05; // gravity
      if (this.particles[i].life <= 0) this.particles.splice(i, 1);
    }

    // Update building open status
    for (const b of this.buildings) {
      b.tick(this.clock);
    }
  }

  // --- Spatial Queries ---

  getPersonsAt(tileX, tileY) {
    const tile = this.grid.getTile(tileX, tileY);
    return tile ? tile.occupants.slice() : [];
  }

  getBuildingAt(tileX, tileY) {
    const tile = this.grid.getTile(tileX, tileY);
    return tile ? tile.building : null;
  }

  getBuildingsOfType(type) {
    return this.buildings.filter(b => b.type === type && !b.isDestroyed);
  }

  getNearestBuilding(type, fromX, fromY) {
    const candidates = this.getBuildingsOfType(type);
    if (candidates.length === 0) return null;
    let best = null;
    let bestDist = Infinity;
    for (const b of candidates) {
      const d = Utils.distance(fromX, fromY, b.centerX, b.centerY);
      if (d < bestDist) {
        bestDist = d;
        best = b;
      }
    }
    return best;
  }

  getAvailableHouse() {
    const houses = this.getBuildingsOfType(BuildingType.HOUSE);
    for (const h of houses) {
      if (h.residents && h.residents.length < 2) return h;
    }
    return Utils.pick(houses) || null;
  }

  getOpenBuilding(type) {
    const candidates = this.getBuildingsOfType(type).filter(
      b => b.isOpen(this.clock) && !b.isAtCapacity
    );
    return candidates.length > 0 ? Utils.pick(candidates) : null;
  }

  // --- Entity Management ---

  addPerson(person) {
    this.persons.push(person);
    eventBus.emit('PERSON_ADDED', person);
  }

  removePerson(person) {
    const idx = this.persons.indexOf(person);
    if (idx !== -1) this.persons.splice(idx, 1);

    // Remove from tile
    const tile = this.grid.getTile(Math.floor(person.x), Math.floor(person.y));
    if (tile) tile.removeOccupant(person);

    // Remove from building
    if (person.currentBuilding) {
      person.currentBuilding.onPersonLeave(person);
    }

    this.stats.deathsToday++;
    eventBus.emit('PERSON_REMOVED', person);
  }

  addParticle(x, y, color, vx, vy, life) {
    this.particles.push({ x, y, color, vx, vy, life, maxLife: life });
  }

  spawnFireParticles(bx, by) {
    const colors = ['#ff4400', '#ff8800', '#ffcc00', '#ff2200'];
    for (let i = 0; i < 3; i++) {
      this.addParticle(
        bx + Utils.randFloat(-8, 8),
        by + Utils.randFloat(-4, 4),
        Utils.pick(colors),
        Utils.randFloat(-0.5, 0.5),
        Utils.randFloat(0.5, 2.0),
        Utils.rand(20, 40)
      );
    }
  }

  // --- Statistics ---

  getStats() {
    const pop = this.persons.length;
    const employed = this.persons.filter(p => p.job && p.job !== 'UNEMPLOYED' && p.age >= 18).length;
    const adults = this.persons.filter(p => p.age >= 18).length;
    const avgHealth = pop === 0 ? 0 : this.persons.reduce((s, p) => s + p.health, 0) / pop;
    const avgHappiness = pop === 0 ? 0 : this.persons.reduce((s, p) => s + p.happiness, 0) / pop;
    const avgMoney = pop === 0 ? 0 : this.persons.reduce((s, p) => s + p.money, 0) / pop;
    const unemploymentRate = adults === 0 ? 0 : (adults - employed) / adults;

    return {
      population: pop,
      avgHealth: Math.round(avgHealth),
      avgHappiness: Math.round(avgHappiness),
      avgMoney: Math.round(avgMoney),
      unemploymentRate: Math.round(unemploymentRate * 100),
      treasury: Math.round(this.stats.treasury),
      birthsToday: this.stats.birthsToday,
      deathsToday: this.stats.deathsToday,
      day: this.clock.day,
      season: this.clock.season,
    };
  }
}
