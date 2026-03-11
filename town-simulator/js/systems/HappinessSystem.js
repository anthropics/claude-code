class HappinessSystem {
  constructor(world) {
    this.world = world;
  }

  tick(tickCount) {
    // Every 30 ticks, do a happiness recalculation for all persons
    if (tickCount % 30 !== 0) return;

    for (const person of this.world.persons) {
      if (person.isDead) continue;
      this.updateHappiness(person);
    }
  }

  updateHappiness(person) {
    let delta = 0;

    // Natural happiness decay
    delta -= Config.HAPPINESS_DECAY * 30;

    // Money effects
    if (person.money < 50) delta -= 3;
    else if (person.money > 500) delta += 1;

    // Health effects
    if (person.health < 30) delta -= 5;
    else if (person.health > 80) delta += 1;

    // Hunger effects
    if (person.hunger < 30) delta -= 4;
    else if (person.hunger > 80) delta += 1;

    // Energy effects
    if (person.energy < 20) delta -= 3;

    // Social effects
    if (person.partner) delta += 2;
    delta += Math.min(5, person.friendCount * 0.5);

    // State effects
    if (person.state === PersonState.SICK) delta -= 2;
    if (person.state === PersonState.SOCIALIZING) delta += 1;

    // Season effects
    const season = this.world.clock.season;
    if (season === 'Spring' || season === 'Summer') delta += 0.5;
    if (season === 'Winter') delta -= 0.5;

    // Apply delta
    person.happiness = Utils.clamp(person.happiness + delta, 0, 100);
  }
}
