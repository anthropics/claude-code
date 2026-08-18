class WorldRenderer {
  constructor(ctx, camera) {
    this.ctx = ctx;
    this.camera = camera;

    // Tile colors
    this.COLORS = {
      [TileType.GRASS]:          '#4a7c35',
      [TileType.ROAD]:           '#555555',
      [TileType.SIDEWALK]:       '#999999',
      [TileType.BUILDING_FLOOR]: '#7a6a5a',
      [TileType.WATER]:          '#2244aa',
      [TileType.PARK_GROUND]:    '#5a9e40',
      [TileType.SAND]:           '#d4b86a',
    };

    this.waterOffset = 0;
  }

  render(world, alpha) {
    const ctx = this.ctx;
    const cam = this.camera;
    const grid = world.grid;
    const ts = Config.TILE_SIZE;

    this.waterOffset = (this.waterOffset + 0.02) % (Math.PI * 2);

    // Only render visible tiles
    const startX = Math.max(0, Math.floor(cam.x / ts));
    const startY = Math.max(0, Math.floor(cam.y / ts));
    const endX = Math.min(grid.width - 1, Math.ceil((cam.x + cam.vw) / ts));
    const endY = Math.min(grid.height - 1, Math.ceil((cam.y + cam.vh) / ts));

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const tile = grid.tiles[y][x];
        const px = x * ts - cam.x;
        const py = y * ts - cam.y;

        let color = this.COLORS[tile.type] || '#333333';

        // Water shimmer
        if (tile.type === TileType.WATER) {
          const shimmer = Math.sin(this.waterOffset + x * 0.5 + y * 0.3) * 15;
          const base = 34 + shimmer;
          const g = 68 + shimmer * 0.5;
          const b = 170 + shimmer;
          color = `rgb(${Math.round(base)},${Math.round(g)},${Math.round(Math.min(255,b))})`;
        }

        ctx.fillStyle = color;
        ctx.fillRect(px, py, ts, ts);

        // Road center line (dashed yellow on road tiles)
        if (tile.type === TileType.ROAD) {
          this.drawRoadMarkings(ctx, tile, px, py, ts, grid, x, y);
        }

        // Grass detail (subtle texture)
        if (tile.type === TileType.GRASS && (x + y) % 3 === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.05)';
          ctx.fillRect(px + 2, py + 3, 2, 1);
        }

        // Street lamp
        if (tile.streetLamp) {
          this.drawStreetLamp(ctx, px, py, ts);
        }
      }
    }
  }

  drawRoadMarkings(ctx, tile, px, py, ts, grid, tx, ty) {
    // Check if there's a road neighbor above/below for vertical road
    const above = grid.getTile(tx, ty - 1);
    const below = grid.getTile(tx, ty + 1);
    const left = grid.getTile(tx - 1, ty);
    const right = grid.getTile(tx + 1, ty);

    const hasVRoad = (above && above.type === TileType.ROAD) || (below && below.type === TileType.ROAD);
    const hasHRoad = (left && left.type === TileType.ROAD) || (right && right.type === TileType.ROAD);

    ctx.fillStyle = 'rgba(255, 220, 0, 0.3)';

    if (hasVRoad && !hasHRoad) {
      // Vertical dashes
      if (ty % 4 < 2) {
        ctx.fillRect(px + ts / 2 - 1, py, 2, ts);
      }
    } else if (hasHRoad && !hasVRoad) {
      // Horizontal dashes
      if (tx % 4 < 2) {
        ctx.fillRect(px, py + ts / 2 - 1, ts, 2);
      }
    }
  }

  drawStreetLamp(ctx, px, py, ts) {
    ctx.fillStyle = '#888866';
    ctx.fillRect(px + ts / 2 - 1, py + 2, 2, ts - 4);
    ctx.fillStyle = '#ffffaa';
    ctx.beginPath();
    ctx.arc(px + ts / 2, py + 3, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
