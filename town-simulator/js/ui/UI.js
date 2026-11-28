class UI {
  constructor(world) {
    this.world = world;
    this.eventLog = [];
    this.maxLogEntries = 50;
    this.updateInterval = 30; // ticks between DOM updates
    this.tickCount = 0;

    this.setupEventLog();
    this.bindElements();
  }

  bindElements() {
    this.els = {
      day:        document.getElementById('stat-day'),
      time:       document.getElementById('stat-time'),
      season:     document.getElementById('stat-season'),
      population: document.getElementById('stat-pop'),
      happiness:  document.getElementById('stat-happy'),
      health:     document.getElementById('stat-health'),
      unemployment: document.getElementById('stat-unemp'),
      treasury:   document.getElementById('stat-treasury'),
      wealth:     document.getElementById('stat-wealth'),
      births:     document.getElementById('stat-births'),
      deaths:     document.getElementById('stat-deaths'),
      log:        document.getElementById('event-log-list'),
    };
  }

  setupEventLog() {
    eventBus.on('LOG', (message) => {
      this.addLogEntry(message);
    });

    eventBus.on('BIRTH', ({ child }) => {
      this.addLogEntry(`👶 ${child.name} was born!`);
    });

    eventBus.on('DEATH', (person) => {
      this.addLogEntry(`💀 ${person.name} has passed away.`);
    });

    eventBus.on('PAYDAY', ({ totalWages }) => {
      // Silent payday (too frequent to log)
    });
  }

  addLogEntry(message) {
    const clock = this.world.clock;
    const time = clock.getTimeString();
    this.eventLog.unshift({ message, time, day: clock.day });
    if (this.eventLog.length > this.maxLogEntries) {
      this.eventLog.pop();
    }
    this.renderLog();
  }

  renderLog() {
    const el = this.els.log;
    if (!el) return;
    el.innerHTML = this.eventLog.slice(0, 15).map(entry =>
      `<div class="log-entry">
        <span class="log-time">D${entry.day} ${entry.time}</span>
        <span class="log-msg">${entry.message}</span>
      </div>`
    ).join('');
  }

  // Called from the main update loop
  update(tickCount) {
    this.tickCount++;
    if (this.tickCount % this.updateInterval !== 0) return;

    const stats = this.world.getStats();
    const clock = this.world.clock;

    if (this.els.day)          this.els.day.textContent = clock.getDayString();
    if (this.els.time)         this.els.time.textContent = clock.getTimeString();
    if (this.els.season)       this.els.season.textContent = clock.season;
    if (this.els.population)   this.els.population.textContent = stats.population;
    if (this.els.happiness)    this.els.happiness.textContent = stats.avgHappiness + '%';
    if (this.els.health)       this.els.health.textContent = stats.avgHealth + '%';
    if (this.els.unemployment) this.els.unemployment.textContent = stats.unemploymentRate + '%';
    if (this.els.treasury)     this.els.treasury.textContent = Utils.formatMoney(stats.treasury);
    if (this.els.wealth)       this.els.wealth.textContent = Utils.formatMoney(stats.avgMoney);
    if (this.els.births)       this.els.births.textContent = stats.birthsToday;
    if (this.els.deaths)       this.els.deaths.textContent = stats.deathsToday;
  }
}
