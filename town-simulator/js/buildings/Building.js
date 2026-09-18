class Building {
  constructor(config) {
    this.id = Utils.uniqueId();
    this.type = config.type;
    this.name = config.name;
    this.x = config.x;           // tile x (top-left)
    this.y = config.y;           // tile y (top-left)
    this.width = config.width;
    this.height = config.height;
    this.color = config.color || '#888888';
    this.roofColor = config.roofColor || '#555555';
    this.symbol = config.symbol || '';
    this.capacity = config.capacity || 20;
    this.openHour = config.openHour !== undefined ? config.openHour : -1;
    this.closeHour = config.closeHour !== undefined ? config.closeHour : -1;
    this.jobType = config.jobType || null;
    this.maxWorkers = config.maxWorkers || 0;
    this.happinessBonus = config.happinessBonus || 0;
    this.healthBonus = config.healthBonus || 0;
    this.serviceCostMin = config.serviceCostMin || 0;
    this.serviceCostMax = config.serviceCostMax || 0;

    this.workers = [];
    this.residents = [];         // For houses
    this.currentOccupants = [];
    this.entrance = null;        // {x, y} tile set by BuildingFactory

    this.isOnFire = false;
    this.fireHealth = 100;
    this.health = 100;
    this.isDestroyed = false;
    this.revenue = 0;
    this.openState = true;       // cached from clock
  }

  get centerX() { return this.x + this.width / 2; }
  get centerY() { return this.y + this.height / 2; }

  get isAtCapacity() {
    return this.currentOccupants.length >= this.capacity;
  }

  get occupantCount() {
    return this.currentOccupants.length;
  }

  isOpen(clock) {
    if (this.isDestroyed) return false;
    return clock.isOpen(this.openHour, this.closeHour);
  }

  onPersonEnter(person) {
    if (!this.currentOccupants.includes(person)) {
      this.currentOccupants.push(person);
    }
  }

  onPersonLeave(person) {
    const idx = this.currentOccupants.indexOf(person);
    if (idx !== -1) this.currentOccupants.splice(idx, 1);
  }

  getServiceCost() {
    if (this.serviceCostMax === 0) return 0;
    return Utils.randFloat(this.serviceCostMin, this.serviceCostMax);
  }

  tick(clock) {
    this.openState = this.isOpen(clock);

    if (this.isOnFire) {
      this.fireHealth -= 0.5;
      if (this.fireHealth <= 0) {
        this.isDestroyed = true;
        this.isOnFire = false;
        eventBus.emit('BUILDING_DESTROYED', this);
      }
    }
  }

  // Pixel coordinates for rendering
  get px() { return this.x * Config.TILE_SIZE; }
  get py() { return this.y * Config.TILE_SIZE; }
  get pw() { return this.width * Config.TILE_SIZE; }
  get ph() { return this.height * Config.TILE_SIZE; }
}
