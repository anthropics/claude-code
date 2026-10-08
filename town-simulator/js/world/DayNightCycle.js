class DayNightCycle {
  constructor() {
    this.hour = 8;
    this.minute = 0;
    this.day = 1;
    this.seasonIndex = 0;
    this.seasonDay = 0;
    this.seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
    this._ticksSinceNewDay = false;
    this._newHour = false;
  }

  get season() {
    return this.seasons[this.seasonIndex];
  }

  // 1 tick = 1 game minute
  tick() {
    this._ticksSinceNewDay = false;
    this._newHour = false;

    this.minute++;
    if (this.minute >= 60) {
      this.minute = 0;
      this.hour++;
      this._newHour = true;

      if (this.hour >= 24) {
        this.hour = 0;
        this.day++;
        this.seasonDay++;
        this._ticksSinceNewDay = true;

        if (this.seasonDay >= 30) {
          this.seasonDay = 0;
          this.seasonIndex = (this.seasonIndex + 1) % 4;
        }
      }
    }
  }

  isNewDay() {
    return this._ticksSinceNewDay;
  }

  isNewHour() {
    return this._newHour;
  }

  get timeFloat() {
    return this.hour + this.minute / 60;
  }

  isNight() {
    return this.hour < 6 || this.hour >= 21;
  }

  isDawn() {
    return this.hour >= 5 && this.hour < 7;
  }

  isDusk() {
    return this.hour >= 18 && this.hour < 21;
  }

  isDay() {
    return this.hour >= 7 && this.hour < 18;
  }

  // Returns an RGB string for the sky background
  getSkyColor() {
    const t = this.timeFloat;
    // Night: 21–5
    if (t >= 21 || t < 5) return '#0a0a2e';
    // Dawn: 5–7
    if (t >= 5 && t < 7) {
      const p = (t - 5) / 2;
      return Utils.interpolateColor('#0a0a2e', '#87CEEB', p);
    }
    // Day: 7–18
    if (t >= 7 && t < 18) return '#87CEEB';
    // Dusk: 18–21
    if (t >= 18 && t < 20) {
      const p = (t - 18) / 2;
      return Utils.interpolateColor('#87CEEB', '#FF6633', p);
    }
    // 20–21: fade to night
    const p = (t - 20);
    return Utils.interpolateColor('#FF6633', '#0a0a2e', p);
  }

  // Alpha for the night overlay (0 = full daylight, 0.7 = deep night)
  getNightAlpha() {
    const t = this.timeFloat;
    if (t >= 7 && t < 18) return 0;
    if (t >= 18 && t < 21) return ((t - 18) / 3) * 0.70;
    if (t >= 21 || t < 5) return 0.70;
    if (t >= 5 && t < 7) return ((7 - t) / 2) * 0.70;
    return 0;
  }

  // Check if a building with given operating hours is open
  isOpen(openHour, closeHour) {
    if (openHour === -1) return true; // Always open
    if (closeHour > openHour) {
      return this.hour >= openHour && this.hour < closeHour;
    }
    // Wraps midnight
    return this.hour >= openHour || this.hour < closeHour;
  }

  getTimeString() {
    const h = String(this.hour).padStart(2, '0');
    const m = String(this.minute).padStart(2, '0');
    return `${h}:${m}`;
  }

  getDayString() {
    return `Day ${this.day}`;
  }
}
