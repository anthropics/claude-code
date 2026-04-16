class Pathfinder {
  // BFS pathfinding on the tile grid
  // Returns array of {x, y} tile positions from start to end (exclusive of start)
  static findPath(grid, startX, startY, endX, endY) {
    startX = Math.floor(startX);
    startY = Math.floor(startY);
    endX = Math.floor(endX);
    endY = Math.floor(endY);

    if (startX === endX && startY === endY) return [];

    // If end tile is not walkable, find nearest walkable
    const endTile = grid.getTile(endX, endY);
    if (!endTile || !endTile.isWalkable) {
      const alt = Pathfinder.findNearestWalkable(grid, endX, endY, 5);
      if (!alt) return null;
      endX = alt.x;
      endY = alt.y;
    }

    const queue = [{ x: startX, y: startY, path: [] }];
    const visited = new Set();
    visited.add(`${startX},${startY}`);

    let iterations = 0;
    const maxIterations = Config.PATH_MAX_SEARCH * Config.PATH_MAX_SEARCH;

    while (queue.length > 0) {
      iterations++;
      if (iterations > maxIterations) return null;

      const current = queue.shift();

      if (current.x === endX && current.y === endY) {
        return current.path;
      }

      const dirs = [
        { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
        { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
      ];

      for (const d of dirs) {
        const nx = current.x + d.dx;
        const ny = current.y + d.dy;
        const key = `${nx},${ny}`;

        if (visited.has(key)) continue;

        const tile = grid.getTile(nx, ny);
        if (!tile || !tile.isWalkable) continue;

        visited.add(key);
        queue.push({
          x: nx,
          y: ny,
          path: [...current.path, { x: nx, y: ny }],
        });
      }
    }

    return null; // No path found
  }

  // Find nearest walkable tile to (x, y) within maxRadius
  static findNearestWalkable(grid, x, y, maxRadius) {
    for (let r = 1; r <= maxRadius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const tile = grid.getTile(x + dx, y + dy);
          if (tile && tile.isWalkable && tile.type !== TileType.BUILDING_FLOOR) {
            return tile;
          }
        }
      }
    }
    return null;
  }

  // Finds the nearest road/sidewalk tile to a building entrance
  static findWalkableNear(grid, bx, by, bw, bh) {
    // Try below the building first
    const below = grid.getTile(bx + Math.floor(bw / 2), by + bh);
    if (below && below.isWalkable) return below;

    // Try above
    const above = grid.getTile(bx + Math.floor(bw / 2), by - 1);
    if (above && above.isWalkable) return above;

    // Try sides
    for (let dy = 0; dy < bh; dy++) {
      const left = grid.getTile(bx - 1, by + dy);
      if (left && left.isWalkable) return left;
      const right = grid.getTile(bx + bw, by + dy);
      if (right && right.isWalkable) return right;
    }

    return null;
  }
}
