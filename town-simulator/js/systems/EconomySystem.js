class EconomySystem {
  constructor(world) {
    this.world = world;
  }

  tick(tickCount) {
    const clock = this.world.clock;

    // Pay wages at end of each day (23:59)
    if (clock.hour === 23 && clock.minute === 59) {
      this.processPayday();
    }

    // Apply bank interest once per day at midnight
    if (clock.isNewDay()) {
      this.processBankInterest();
    }
  }

  processPayday() {
    let totalWages = 0;

    for (const person of this.world.persons) {
      if (person.isDead) continue;
      const wage = person.wage;
      const tax = wage * Config.TAX_RATE;
      const netWage = wage - tax;

      person.money += netWage;
      totalWages += wage;
      this.world.stats.treasury += tax;

      // Happiness boost on payday
      person.happiness = Math.min(100, person.happiness + 3);
    }

    // Treasury funds public services
    this.world.stats.treasury -= totalWages * Config.TAX_RATE * 0.5; // Public service costs

    eventBus.emit('PAYDAY', { totalWages });
  }

  processBankInterest() {
    for (const person of this.world.persons) {
      if (person.isDead) continue;
      if (person.money > 100) {
        const interest = person.money * Config.BANK_INTEREST_RATE;
        person.money += interest;
      }
    }
  }

  // Called by buildings when a person uses a paid service
  static chargeForService(person, building) {
    const cost = building.getServiceCost();
    if (cost <= 0) return true;

    if (person.money >= cost) {
      person.money -= cost;
      building.revenue += cost;
      return true;
    } else {
      // Can't afford — slight unhappiness
      person.happiness = Math.max(0, person.happiness - 3);
      return false;
    }
  }
}
