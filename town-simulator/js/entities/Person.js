class Person {
  constructor(world) {
    this.id = world._nextPersonId++;
    this.world = world;
    this.name = '';
    this.gender = 'M';
    this.age = 25;

    // Position
    this.x = 0;         // tile X (integer)
    this.y = 0;         // tile Y (integer)
    this.pixelX = 0;    // smooth pixel X (for rendering)
    this.pixelY = 0;
    this.prevPixelX = 0;
    this.prevPixelY = 0;

    // Stats (0–100, except money)
    this.health = 100;
    this.happiness = 80;
    this.hunger = 100;
    this.energy = 100;
    this.money = 100;

    // Personality
    this.traits = { sociability: 0.5, workEthic: 0.5, thriftiness: 0.5, constitution: 0.5 };
    this.hobby = 'SOCIALIZING';

    // Job
    this.job = null;           // string key e.g. 'DOCTOR'
    this.jobBuilding = null;   // Building reference

    // Home
    this.home = null;          // Building reference

    // State machine
    this.state = PersonState.IDLE;
    this.path = [];            // Array of {x, y} tiles
    this.pathTarget = null;    // {x, y} destination tile
    this.pathTargetBuilding = null; // Building we're heading to
    this.stateTimer = 0;       // ticks remaining in current state activity
    this.currentBuilding = null; // Building we're currently inside

    // Social
    this.partner = null;
    this.children = [];
    this.relationships = {};   // personId -> {affinity, interactions}
    this.friendCount = 0;

    // Flags
    this.isAlive = true;
    this.isDead = false;
    this.education = Utils.rand(20, 60);

    // Event log (last few actions)
    this.recentActivity = '';
  }

  // ---- Main tick ----
  tick(tickCount) {
    if (this.isDead) return;

    this.prevPixelX = this.pixelX;
    this.prevPixelY = this.pixelY;

    // Drain needs
    this.updateNeeds();

    // Stagger pathfinding recalculation
    const shouldRepath = (this.id + tickCount) % 8 === 0;

    // Override checks (emergency needs take priority)
    if (this.health <= Config.HEALTH_CRITICAL && this.state !== PersonState.SICK) {
      this.seekBuilding(BuildingType.HOSPITAL, PersonState.SICK);
      return;
    }

    if (this.hunger <= Config.HUNGER_CRITICAL && this.state !== PersonState.EATING) {
      this.seekFood();
      return;
    }

    if (this.energy <= Config.ENERGY_CRITICAL && this.state !== PersonState.SLEEPING) {
      this.goHome(PersonState.SLEEPING);
      return;
    }

    // Schedule-based behavior
    if (this.state === PersonState.WALKING) {
      this.updateMovement();
    } else {
      this.updateSchedule();
    }

    // Handle timed states
    if (this.stateTimer > 0) {
      this.stateTimer--;
      this.performStateAction();
      if (this.stateTimer === 0) {
        this.finishStateAction();
      }
    }

    // Update smooth pixel position
    this.updatePixelPosition();
  }

  updateNeeds() {
    this.hunger = Math.max(0, this.hunger - Config.HUNGER_DRAIN);
    this.energy = Math.max(0, this.energy - Config.ENERGY_DRAIN);

    // Sleeping restores energy fast
    if (this.state === PersonState.SLEEPING) {
      this.energy = Math.min(100, this.energy + Config.ENERGY_DRAIN * 5);
    }
  }

  // ---- Schedule ----
  updateSchedule() {
    const hour = this.world.clock.hour;
    const isChild = this.age < 18;
    const isAdult = this.age >= 18;
    const isRetired = this.age >= Config.RETIRE_AGE;
    const clock = this.world.clock;

    // NIGHT: everyone sleeps (21:00 - 6:00)
    if (hour >= 22 || hour < 6) {
      if (this.state !== PersonState.SLEEPING) {
        this.goHome(PersonState.SLEEPING);
      }
      return;
    }

    // MORNING wake-up: go eat if hungry, otherwise start the day
    if (hour === 6 && this.state === PersonState.SLEEPING) {
      this.setState(PersonState.IDLE);
    }

    // WORK hours (adults with jobs)
    if (isAdult && !isRetired && this.job && this.job !== 'UNEMPLOYED') {
      const jobDef = JobTypes[this.job];
      const workStart = this.getWorkStart();
      const workEnd = this.getWorkEnd();

      if (hour >= workStart && hour < workEnd) {
        if (this.state !== PersonState.WORKING) {
          this.seekBuilding(jobDef.buildingType, PersonState.WORKING);
        }
        return;
      }
    }

    // CHILDREN go to school
    if (isChild && this.age >= 5 && hour >= 8 && hour < 15) {
      if (this.state !== PersonState.WORKING) {
        this.seekBuilding(BuildingType.SCHOOL, PersonState.WORKING);
      }
      return;
    }

    // LEISURE time (evenings and days off)
    if (hour >= 16 && hour < 22) {
      if (this.state === PersonState.WORKING || this.state === PersonState.IDLE) {
        this.doLeisure();
      }
      return;
    }

    // MID-MORNING activities (unemployed, retired, between activities)
    if (hour >= 9 && hour < 16 && (this.state === PersonState.IDLE || this.state === PersonState.SLEEPING)) {
      if (Math.random() < 0.2) {
        this.doLeisure();
      } else if (this.hunger < 70) {
        this.seekFood();
      }
    }
  }

  getWorkStart() {
    const schedules = {
      DOCTOR: 8, TEACHER: 8, POLICE: 7, FIREFIGHTER: 7,
      BANKER: 9, CHEF: 10, LIBRARIAN: 9, ACTOR: 18,
      TRAINER: 8, CLERK: 9,
    };
    return schedules[this.job] || 9;
  }

  getWorkEnd() {
    const schedules = {
      DOCTOR: 17, TEACHER: 15, POLICE: 15, FIREFIGHTER: 15,
      BANKER: 17, CHEF: 22, LIBRARIAN: 19, ACTOR: 23,
      TRAINER: 18, CLERK: 18,
    };
    return schedules[this.job] || 17;
  }

  doLeisure() {
    // Choose a destination based on hobby and open buildings
    const hour = this.world.clock.hour;
    let targetType = null;

    switch (this.hobby) {
      case 'READING':
        targetType = BuildingType.LIBRARY;
        break;
      case 'FITNESS':
        targetType = Math.random() < 0.5 ? BuildingType.GYM : BuildingType.PARK;
        break;
      case 'DINING':
        targetType = Math.random() < 0.5 ? BuildingType.RESTAURANT : BuildingType.GROCERY;
        break;
      case 'THEATRE':
        targetType = hour >= 18 ? BuildingType.THEATRE : BuildingType.PARK;
        break;
      case 'SOCIALIZING':
        targetType = Math.random() < 0.5 ? BuildingType.PARK : BuildingType.RESTAURANT;
        break;
      case 'WALKING':
        targetType = BuildingType.PARK;
        break;
      default:
        targetType = BuildingType.PARK;
    }

    // Occasionally choose church (Sunday)
    if (this.world.clock.season !== null && this.world.clock.day % 7 === 0 && hour < 12) {
      targetType = BuildingType.CHURCH;
    }

    const building = this.world.getOpenBuilding(targetType);
    if (building) {
      this.seekBuilding(targetType, PersonState.LEISURE);
    } else {
      // No available building, wander or go home
      if (Math.random() < 0.3) this.goHome(PersonState.IDLE);
    }
  }

  seekFood() {
    // Prefer restaurant if we can afford it; otherwise grocery
    const canAffordRestaurant = this.money >= Config.RESTAURANT_COST_MIN;
    const type = canAffordRestaurant && Math.random() < 0.4
      ? BuildingType.RESTAURANT
      : BuildingType.GROCERY;
    const building = this.world.getOpenBuilding(type);
    if (building) {
      this.seekBuilding(type, PersonState.EATING);
    } else {
      // Eat at home if no option
      this.goHome(PersonState.EATING);
    }
  }

  seekBuilding(type, arrivalState) {
    const building = this.world.getOpenBuilding(type)
      || this.world.getNearestBuilding(type, this.x, this.y);

    if (!building) return;

    const entrance = building.entrance || { x: building.x, y: building.y + building.height };
    const path = Pathfinder.findPath(this.world.grid, this.x, this.y, entrance.x, entrance.y);

    if (path !== null) {
      this.path = path;
      this.pathTargetBuilding = building;
      this.pathTarget = entrance;
      this.pathArrivalState = arrivalState;
      this.setState(PersonState.WALKING);
    }
  }

  goHome(arrivalState) {
    if (!this.home) return;
    const entrance = this.home.entrance || { x: this.home.x + 1, y: this.home.y + this.home.height };
    const path = Pathfinder.findPath(this.world.grid, this.x, this.y, entrance.x, entrance.y);
    if (path !== null) {
      this.path = path;
      this.pathTargetBuilding = this.home;
      this.pathTarget = entrance;
      this.pathArrivalState = arrivalState;
      this.setState(PersonState.WALKING);
    }
  }

  // ---- Movement ----
  updateMovement() {
    if (this.path.length === 0) {
      // Arrived at destination
      this.arriveAtDestination();
      return;
    }

    const next = this.path[0];
    const tile = this.world.grid.getTile(next.x, next.y);

    if (!tile || !tile.isWalkable) {
      // Path blocked, recalculate or give up
      this.path = [];
      this.setState(PersonState.IDLE);
      return;
    }

    // Move one tile per tick
    const prevTile = this.world.grid.getTile(this.x, this.y);
    if (prevTile) prevTile.removeOccupant(this);

    this.x = next.x;
    this.y = next.y;
    tile.addOccupant(this);
    this.path.shift();
  }

  arriveAtDestination() {
    const building = this.pathTargetBuilding;
    const arrivalState = this.pathArrivalState || PersonState.IDLE;

    if (building && !building.isAtCapacity) {
      // Leave previous building
      if (this.currentBuilding && this.currentBuilding !== building) {
        this.currentBuilding.onPersonLeave(this);
      }
      building.onPersonEnter(this);
      this.currentBuilding = building;

      this.setState(arrivalState);
      this.stateTimer = this.getStateDuration(arrivalState, building);
      this.recentActivity = this.getActivityDescription(arrivalState, building);
    } else {
      this.setState(PersonState.IDLE);
    }

    this.pathTargetBuilding = null;
    this.pathTarget = null;
  }

  getStateDuration(state, building) {
    switch (state) {
      case PersonState.WORKING:   return Utils.rand(60, 120);
      case PersonState.EATING:    return Utils.rand(15, 30);
      case PersonState.SLEEPING:  return Utils.rand(200, 400);
      case PersonState.LEISURE:   return Utils.rand(30, 90);
      case PersonState.SICK:      return Utils.rand(60, 150);
      case PersonState.SHOPPING:  return Utils.rand(10, 25);
      case PersonState.SOCIALIZING: return Utils.rand(20, 50);
      default: return 30;
    }
  }

  getActivityDescription(state, building) {
    const name = building ? building.name : 'home';
    switch (state) {
      case PersonState.WORKING:   return `Working at ${name}`;
      case PersonState.EATING:    return `Eating at ${name}`;
      case PersonState.SLEEPING:  return `Sleeping`;
      case PersonState.LEISURE:   return `Relaxing at ${name}`;
      case PersonState.SICK:      return `Sick at ${name}`;
      default: return `At ${name}`;
    }
  }

  performStateAction() {
    const b = this.currentBuilding;
    switch (this.state) {
      case PersonState.SLEEPING:
        this.energy = Math.min(100, this.energy + 0.3);
        break;

      case PersonState.EATING:
        this.hunger = Math.min(100, this.hunger + 2.5);
        if (b) {
          const cost = b.getServiceCost();
          this.money = Math.max(0, this.money - cost / this.stateTimer);
          b.revenue += cost / this.stateTimer;
        }
        break;

      case PersonState.WORKING:
        // Productivity/happiness from work
        if (this.traits.workEthic > 0.5) {
          this.happiness = Math.min(100, this.happiness + 0.01);
        }
        break;

      case PersonState.SICK:
        if (b && b.type === BuildingType.HOSPITAL) {
          this.health = Math.min(100, this.health + b.healthBonus * 0.1);
        }
        break;

      case PersonState.LEISURE:
        if (b) {
          this.happiness = Math.min(100, this.happiness + b.happinessBonus * 0.02);
          if (b.healthBonus > 0) this.health = Math.min(100, this.health + b.healthBonus * 0.02);
          // Pay service cost once (spread across duration)
          const cost = b.getServiceCost();
          if (cost > 0 && this.money >= cost) {
            this.money -= cost / Math.max(1, this.stateTimer);
            b.revenue += cost / Math.max(1, this.stateTimer);
          }
        }
        break;

      case PersonState.SOCIALIZING:
        this.happiness = Math.min(100, this.happiness + 0.1 * this.traits.sociability);
        break;
    }
  }

  finishStateAction() {
    const prevBuilding = this.currentBuilding;

    if (prevBuilding) {
      prevBuilding.onPersonLeave(this);
      this.currentBuilding = null;
    }

    // After work or leisure, go home
    const hour = this.world.clock.hour;
    if (hour >= 20 || hour < 6) {
      this.goHome(PersonState.SLEEPING);
    } else {
      this.setState(PersonState.IDLE);
    }
  }

  // ---- Pixel position ----
  updatePixelPosition() {
    const targetPX = this.x * Config.TILE_SIZE + Config.TILE_SIZE / 2;
    const targetPY = this.y * Config.TILE_SIZE + Config.TILE_SIZE / 2;
    this.pixelX = Utils.lerp(this.pixelX, targetPX, 0.3);
    this.pixelY = Utils.lerp(this.pixelY, targetPY, 0.3);
  }

  // ---- State management ----
  setState(newState) {
    this.state = newState;
    this.stateTimer = 0;
  }

  // ---- Social interaction ----
  socializeWith(other) {
    if (!other || other === this || other.isDead) return;

    if (!this.relationships[other.id]) {
      this.relationships[other.id] = { affinity: 10, interactions: 0 };
    }
    const rel = this.relationships[other.id];
    rel.affinity = Math.min(100, rel.affinity + Config.AFFINITY_PER_INTERACTION);
    rel.interactions++;

    this.happiness = Math.min(100, this.happiness + 2 * this.traits.sociability);

    // Count friends
    this.friendCount = Object.values(this.relationships).filter(r => r.affinity >= 50).length;
  }

  // ---- Computed properties for display ----
  get jobTitle() {
    if (!this.job) return 'Child';
    const def = JobTypes[this.job];
    return def ? def.title : 'Unknown';
  }

  get wage() {
    if (!this.job) return 0;
    const def = JobTypes[this.job];
    return def ? def.wage : 0;
  }

  get ageLabel() {
    const a = Math.floor(this.age);
    if (a < 18) return `Age ${a} (Child)`;
    if (a >= Config.RETIRE_AGE) return `Age ${a} (Retired)`;
    return `Age ${a}`;
  }
}
