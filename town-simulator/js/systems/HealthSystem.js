class HealthSystem {
  constructor(world) {
    this.world = world;
  }

  tick(tickCount) {
    const clock = this.world.clock;

    // Daily checks
    if (clock.isNewDay()) {
      for (let i = this.world.persons.length - 1; i >= 0; i--) {
        const person = this.world.persons[i];
        if (person.isDead) continue;

        this.ageUp(person);
        this.checkIllness(person);
        this.checkDeath(person);
      }
    }

    // Stagger per-tick health recovery for persons in hospital
    if (tickCount % 5 === 0) {
      for (const person of this.world.persons) {
        if (person.isDead) continue;
        if (person.state === PersonState.SICK && person.currentBuilding) {
          const b = person.currentBuilding;
          if (b.type === BuildingType.HOSPITAL) {
            person.health = Math.min(100, person.health + b.healthBonus);
            if (person.health >= 80) {
              person.setState(PersonState.IDLE);
            }
          }
        }
      }
    }
  }

  ageUp(person) {
    // 1 game year = 365 game days → each day adds 1/365 to age
    person.age += 1 / 365;

    // Retirement
    if (person.age >= Config.RETIRE_AGE && person.job && person.job !== 'UNEMPLOYED') {
      if (person.jobBuilding) {
        const idx = person.jobBuilding.workers.indexOf(person);
        if (idx !== -1) person.jobBuilding.workers.splice(idx, 1);
      }
      person.job = 'UNEMPLOYED';
      person.jobBuilding = null;
      person.happiness = Math.max(0, person.happiness - 5);
      eventBus.emit('LOG', `${person.name} has retired.`);
    }

    // Children become adults
    if (person.age >= 18 && !person.job) {
      PersonFactory.assignJobToAdult(this.world, person);
      eventBus.emit('LOG', `${person.name} is now an adult and working as ${person.jobTitle}.`);
    }

    // Natural health decline with old age
    if (person.age > 70) {
      const decline = (person.age - 70) * 0.002;
      person.health = Math.max(0, person.health - decline);
    }
  }

  checkIllness(person) {
    if (person.state === PersonState.SICK) return;
    if (person.health > 90) return; // Very healthy people rarely get sick

    let risk = Config.ILLNESS_BASE_RISK;
    if (person.health < 50) risk *= Config.ILLNESS_LOW_HEALTH_MULTIPLIER;
    if (this.world.clock.season === 'Winter') risk *= Config.ILLNESS_WINTER_MULTIPLIER;
    risk *= (1 - person.traits.constitution * 0.5); // constitution reduces risk

    if (Utils.chance(risk)) {
      const severity = Utils.rand(10, 35);
      person.health = Math.max(0, person.health - severity);
      person.happiness = Math.max(0, person.happiness - 10);
      eventBus.emit('LOG', `${person.name} fell ill.`);

      if (person.health < 30) {
        person.seekBuilding(BuildingType.HOSPITAL, PersonState.SICK);
      } else {
        person.setState(PersonState.SICK);
      }
    }
  }

  checkDeath(person) {
    let deathChance = 0;

    if (person.health <= 0) {
      deathChance = 1.0;
    } else if (person.age >= Config.ELDER_MORTALITY_START_AGE) {
      deathChance = Math.pow((person.age - Config.ELDER_MORTALITY_START_AGE) / 30, 2) * 0.05;
    }

    if (Utils.chance(deathChance)) {
      this.killPerson(person);
    }
  }

  killPerson(person) {
    person.isDead = true;

    // Notify partner
    if (person.partner) {
      person.partner.partner = null;
      person.partner.happiness = Math.max(0, person.partner.happiness - 30);
    }

    // Remove from job
    if (person.jobBuilding) {
      const idx = person.jobBuilding.workers.indexOf(person);
      if (idx !== -1) person.jobBuilding.workers.splice(idx, 1);
    }

    // Remove from home
    if (person.home && person.home.residents) {
      const idx = person.home.residents.indexOf(person);
      if (idx !== -1) person.home.residents.splice(idx, 1);
    }

    eventBus.emit('LOG', `${person.name} has passed away at age ${Math.floor(person.age)}.`);
    eventBus.emit('DEATH', person);
    this.world.removePerson(person);
  }
}
