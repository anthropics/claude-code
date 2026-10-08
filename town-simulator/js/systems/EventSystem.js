class GameEvent {
  constructor(type, location) {
    this.id = Utils.uniqueId();
    this.type = type;
    this.location = location;
    this.isResolved = false;
    this.ticksAlive = 0;
  }

  tick() {
    this.ticksAlive++;
  }

  resolve() {
    this.isResolved = true;
  }
}

class FireEvent extends GameEvent {
  constructor(building, world) {
    super('FIRE', building);
    this.building = building;
    this.world = world;
    this.firefightersAssigned = [];
    building.isOnFire = true;
    building.fireHealth = 100;

    // Dispatch firefighters
    const firefighters = world.persons.filter(
      p => p.job === 'FIREFIGHTER' && !p.isDead
    );
    for (const ff of firefighters.slice(0, 3)) {
      this.firefightersAssigned.push(ff);
      ff.seekBuilding(BuildingType.FIRE_STATION, PersonState.WORKING);
    }

    eventBus.emit('LOG', `FIRE at ${building.name}! Firefighters dispatched.`);
  }

  tick() {
    super.tick();

    if (this.building.isDestroyed || !this.building.isOnFire) {
      this.resolve();
      return;
    }

    // Spawn fire particles for visual effect
    const px = this.building.px + this.building.pw / 2;
    const py = this.building.py + this.building.ph / 2;
    this.world.spawnFireParticles(px, py);

    // Suppress fire based on firefighters at the scene
    const ffOnScene = this.firefightersAssigned.filter(
      ff => !ff.isDead && ff.currentBuilding === this.building
    ).length;

    if (ffOnScene > 0) {
      this.building.fireHealth = Math.min(100, this.building.fireHealth + ffOnScene * 1.5);
      if (this.building.fireHealth >= 100) {
        this.building.isOnFire = false;
        eventBus.emit('LOG', `The fire at ${this.building.name} has been extinguished!`);
        this.resolve();
      }
    }

    // Evacuate occupants
    for (const person of this.building.currentOccupants.slice()) {
      if (!person.isDead) {
        person.health = Math.max(0, person.health - 0.5);
        person.goHome(PersonState.IDLE);
      }
    }

    // Auto-resolve after 500 ticks if not suppressed (building destroyed)
    if (this.ticksAlive > 500) {
      this.building.fireHealth = 0;
      this.resolve();
    }
  }
}

class EventSystem {
  constructor(world) {
    this.world = world;
    this.cooldowns = {
      FIRE:     0,
      FESTIVAL: 0,
      EPIDEMIC: 0,
      ROBBERY:  0,
      ACCIDENT: 0,
    };
    this.activeFestival = false;
  }

  tick(tickCount) {
    // Decrement cooldowns
    for (const key of Object.keys(this.cooldowns)) {
      if (this.cooldowns[key] > 0) this.cooldowns[key]--;
    }

    // Check each event type
    if (this.cooldowns.FIRE === 0 && Utils.chance(Config.EVENT_FIRE_RATE)) {
      this.triggerFire();
    }

    if (this.cooldowns.FESTIVAL === 0 && Utils.chance(Config.EVENT_FESTIVAL_RATE)) {
      this.triggerFestival();
    }

    if (this.cooldowns.EPIDEMIC === 0 && Utils.chance(Config.EVENT_EPIDEMIC_RATE)) {
      this.triggerEpidemic();
    }

    if (this.cooldowns.ROBBERY === 0 && Utils.chance(Config.EVENT_ROBBERY_RATE)) {
      this.triggerRobbery();
    }

    if (this.cooldowns.ACCIDENT === 0 && Utils.chance(Config.EVENT_ACCIDENT_RATE)) {
      this.triggerAccident();
    }
  }

  triggerFire() {
    // Pick a random non-essential building
    const eligible = this.world.buildings.filter(b =>
      !b.isDestroyed && !b.isOnFire &&
      b.type !== BuildingType.FIRE_STATION &&
      b.type !== BuildingType.HOSPITAL &&
      b.type !== BuildingType.HOUSE
    );

    if (eligible.length === 0) return;

    const building = Utils.pick(eligible);
    const event = new FireEvent(building, this.world);
    this.world.events.push(event);
    this.cooldowns.FIRE = 1000;
  }

  triggerFestival() {
    const townHalls = this.world.getBuildingsOfType(BuildingType.TOWN_HALL);
    if (townHalls.length === 0) return;

    const hall = townHalls[0];
    const attendees = this.world.persons
      .filter(p => !p.isDead && p.happiness > 40)
      .slice(0, 20);

    for (const person of attendees) {
      person.happiness = Math.min(100, person.happiness + 20);
      person.seekBuilding(BuildingType.TOWN_HALL, PersonState.ATTENDING_EVENT);
    }

    this.cooldowns.FESTIVAL = 2880; // 2 days
    eventBus.emit('LOG', `A festival is being held at Town Hall!`);
  }

  triggerEpidemic() {
    const victims = this.world.persons
      .filter(p => !p.isDead)
      .slice(0, Math.max(1, Math.floor(this.world.persons.length * 0.10)));

    for (const person of victims) {
      person.health = Math.max(10, person.health - Utils.rand(15, 35));
      if (person.health < 40) {
        person.seekBuilding(BuildingType.HOSPITAL, PersonState.SICK);
      }
    }

    this.cooldowns.EPIDEMIC = 10000;
    eventBus.emit('LOG', `An epidemic has broken out! ${victims.length} people are ill.`);
  }

  triggerRobbery() {
    const victims = this.world.persons.filter(p => !p.isDead && p.money > 100);
    if (victims.length === 0) return;

    const victim = Utils.pick(victims);
    const stolen = Utils.rand(50, Math.min(200, victim.money));
    victim.money -= stolen;
    victim.happiness = Math.max(0, victim.happiness - 20);

    // Dispatch police
    const police = this.world.persons.filter(p => p.job === 'POLICE' && !p.isDead);
    if (police.length > 0) {
      const officer = Utils.pick(police);
      officer.seekBuilding(BuildingType.POLICE, PersonState.WORKING);
    }

    this.cooldowns.ROBBERY = 300;
    eventBus.emit('LOG', `${victim.name} was robbed of ${Utils.formatMoney(stolen)}!`);
  }

  triggerAccident() {
    const walkers = this.world.persons.filter(p => !p.isDead && p.state === PersonState.WALKING);
    if (walkers.length === 0) return;

    const victim = Utils.pick(walkers);
    const injury = Utils.rand(10, 40);
    victim.health = Math.max(1, victim.health - injury);
    victim.happiness = Math.max(0, victim.happiness - 10);

    if (victim.health < 30) {
      victim.seekBuilding(BuildingType.HOSPITAL, PersonState.SICK);
    }

    this.cooldowns.ACCIDENT = 100;
    eventBus.emit('LOG', `${victim.name} was in an accident and lost ${injury} health.`);
  }
}
