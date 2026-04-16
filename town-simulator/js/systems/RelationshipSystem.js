class RelationshipSystem {
  constructor(world) {
    this.world = world;
  }

  tick(tickCount) {
    // Stagger processing across ticks for performance
    if (tickCount % 20 !== 0) return;

    const persons = this.world.persons;

    // Check for social interactions between persons on the same tile
    for (const person of persons) {
      if (person.isDead) continue;
      this.checkSocialInteractions(person);
    }

    // Check for romance and reproduction
    for (const person of persons) {
      if (person.isDead) continue;
      if (person.partner && !person.partner.isDead) {
        this.checkReproduction(person);
      } else if (!person.partner && person.age >= 18) {
        this.checkRomance(person);
      }
    }

    // Decay relationships over time
    if (tickCount % 200 === 0) {
      this.decayRelationships();
    }
  }

  checkSocialInteractions(person) {
    if (person.state === PersonState.SLEEPING || person.state === PersonState.WORKING) return;
    if (!Utils.chance(person.traits.sociability * 0.1)) return;

    // Find nearby persons (same tile or adjacent)
    const tile = this.world.grid.getTile(Math.floor(person.x), Math.floor(person.y));
    if (!tile) return;

    let candidates = tile.occupants.filter(p => p !== person && !p.isDead);

    // Also check current building occupants
    if (person.currentBuilding) {
      candidates = candidates.concat(
        person.currentBuilding.currentOccupants.filter(
          p => p !== person && !p.isDead && !candidates.includes(p)
        )
      );
    }

    if (candidates.length === 0) return;

    const other = Utils.pick(candidates);
    person.socializeWith(other);
    other.socializeWith(person);

    // Brief socialization state
    if (person.state === PersonState.IDLE || person.state === PersonState.LEISURE) {
      person.setState(PersonState.SOCIALIZING);
      person.stateTimer = Utils.rand(5, 20);
    }
  }

  checkRomance(person) {
    if (person.age < 18 || person.age > 70) return;
    if (!Utils.chance(Config.ROMANCE_CHANCE_PER_TICK)) return;

    // Find a compatible single adult
    const candidates = this.world.persons.filter(other =>
      other !== person &&
      !other.isDead &&
      !other.partner &&
      other.age >= 18 &&
      // Opposite genders by default (can be extended)
      ((person.gender === 'M' && other.gender === 'F') ||
       (person.gender === 'F' && other.gender === 'M'))
    );

    if (candidates.length === 0) return;

    // Find someone with high affinity
    const rel = person.relationships;
    let best = null;
    let bestAffinity = Config.ROMANCE_AFFINITY_THRESHOLD;

    for (const candidate of candidates) {
      const r = rel[candidate.id];
      if (r && r.affinity >= bestAffinity) {
        bestAffinity = r.affinity;
        best = candidate;
      }
    }

    if (best) {
      this.formPartnership(person, best);
    }
  }

  formPartnership(a, b) {
    a.partner = b;
    b.partner = a;
    a.happiness = Math.min(100, a.happiness + 15);
    b.happiness = Math.min(100, b.happiness + 15);

    // Try to move them to the same house
    const house = a.home || b.home || this.world.getAvailableHouse();
    if (house) {
      if (a.home && a.home !== house) {
        const idx = a.home.residents ? a.home.residents.indexOf(a) : -1;
        if (idx !== -1) a.home.residents.splice(idx, 1);
      }
      if (b.home && b.home !== house) {
        const idx = b.home.residents ? b.home.residents.indexOf(b) : -1;
        if (idx !== -1) b.home.residents.splice(idx, 1);
      }
      a.home = house;
      b.home = house;
      if (!house.residents) house.residents = [];
      if (!house.residents.includes(a)) house.residents.push(a);
      if (!house.residents.includes(b)) house.residents.push(b);
    }

    eventBus.emit('LOG', `${a.name} and ${b.name} are now partners!`);
  }

  checkReproduction(person) {
    // Only check once per female partner to avoid duplicates
    if (person.gender !== 'F') return;
    if (person.age < Config.REPRODUCE_MIN_AGE || person.age > Config.REPRODUCE_WOMAN_MAX_AGE) return;
    if (person.isDead || person.partner.isDead) return;

    const partner = person.partner;

    // Conditions
    if (person.health < Config.REPRODUCE_MIN_HEALTH) return;
    if (partner.health < Config.REPRODUCE_MIN_HEALTH) return;
    if (person.happiness < Config.REPRODUCE_MIN_HAPPINESS) return;
    if (partner.happiness < Config.REPRODUCE_MIN_HAPPINESS) return;
    if (person.money + partner.money < Config.REPRODUCE_MIN_MONEY) return;

    // No very young children already
    const youngChildren = person.children.filter(c => !c.isDead && c.age < 3);
    if (youngChildren.length > 0) return;

    if (!Utils.chance(Config.REPRODUCE_CHANCE_PER_TICK)) return;

    this.spawnChild(person, partner);
  }

  spawnChild(mother, father) {
    if (this.world.persons.length >= Config.MAX_POPULATION) return;

    const child = PersonFactory.createChild(this.world, [mother, father]);
    mother.children.push(child);
    father.children.push(child);

    this.world.addPerson(child);
    this.world.stats.birthsToday++;

    eventBus.emit('LOG', `${mother.name} and ${father.name} welcomed a baby, ${child.name}!`);
    eventBus.emit('BIRTH', { child, mother, father });
  }

  decayRelationships() {
    for (const person of this.world.persons) {
      if (person.isDead) continue;
      for (const [otherId, rel] of Object.entries(person.relationships)) {
        rel.affinity = Math.max(0, rel.affinity - Config.AFFINITY_DECAY_PER_TICK * 200);
      }
    }
  }
}
