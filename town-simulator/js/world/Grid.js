class Grid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.tiles = [];

    for (let y = 0; y < height; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < width; x++) {
        this.tiles[y][x] = new Tile(x, y, TileType.GRASS);
      }
    }
  }

  getTile(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.tiles[y][x];
  }

  setType(x, y, type) {
    const tile = this.getTile(x, y);
    if (tile) tile.type = type;
  }

  isWalkable(x, y) {
    const tile = this.getTile(x, y);
    return tile ? tile.isWalkable : false;
  }

  isInBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  getNeighbors4(x, y) {
    const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
    const result = [];
    for (const d of dirs) {
      const t = this.getTile(x + d.dx, y + d.dy);
      if (t) result.push(t);
    }
    return result;
  }

  // Fill a rectangular region with a tile type
  fillRect(x, y, w, h, type) {
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) {
        this.setType(tx, ty, type);
      }
    }
  }

  // Draw a horizontal road (2 tiles tall)
  drawHRoad(x, y, length) {
    for (let tx = x; tx < x + length; tx++) {
      this.setType(tx, y, TileType.ROAD);
      this.setType(tx, y + 1, TileType.ROAD);
    }
  }

  // Draw a vertical road (2 tiles wide)
  drawVRoad(x, y, length) {
    for (let ty = y; ty < y + length; ty++) {
      this.setType(x, ty, TileType.ROAD);
      this.setType(x + 1, ty, TileType.ROAD);
    }
  }

  // Draw sidewalk border around a road segment
  drawSidewalk(x, y, w, h) {
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) {
        const t = this.getTile(tx, ty);
        if (t && t.type === TileType.GRASS) {
          t.type = TileType.SIDEWALK;
        }
      }
    }
  }

  findTilesOfType(type) {
    const result = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.tiles[y][x].type === type) result.push(this.tiles[y][x]);
      }
    }
    return result;
  }
}
