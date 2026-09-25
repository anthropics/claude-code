const TileType = {
  GRASS:          'GRASS',
  ROAD:           'ROAD',
  SIDEWALK:       'SIDEWALK',
  BUILDING_FLOOR: 'BUILDING_FLOOR',
  WATER:          'WATER',
  PARK_GROUND:    'PARK_GROUND',
  SAND:           'SAND',
};

class Tile {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type || TileType.GRASS;
    this.building = null;       // Building reference if a building occupies this tile
    this.occupants = [];        // Persons currently on this tile
    this.streetLamp = false;    // For lighting renderer
    this.waterFrame = 0;        // Animation frame for water shimmer
  }

  get isWalkable() {
    return this.type !== TileType.WATER;
  }

  get isRoad() {
    return this.type === TileType.ROAD || this.type === TileType.SIDEWALK;
  }

  addOccupant(person) {
    if (!this.occupants.includes(person)) {
      this.occupants.push(person);
    }
  }

  removeOccupant(person) {
    const idx = this.occupants.indexOf(person);
    if (idx !== -1) this.occupants.splice(idx, 1);
  }
}
