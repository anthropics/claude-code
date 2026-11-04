class BuildingFactory {
  // Main entry point: generate the entire town layout
  static generate(world) {
    const { grid } = world;

    // Step 1: Draw the road network
    BuildingFactory.drawRoads(grid);

    // Step 2: Place all named civic/commercial buildings
    const buildings = BuildingFactory.placeCivicBuildings(world);

    // Step 3: Fill remaining blocks with houses
    BuildingFactory.placeHouses(world, buildings);

    // Step 4: Place a water feature (pond) in bottom-right corner
    BuildingFactory.placePond(grid);

    // Step 5: Add street lamps along roads
    BuildingFactory.addStreetLamps(grid);

    return buildings;
  }

  // --- Road network ---
  // Grid is 80x60. We use a 3-column, 3-row block layout.
  // Vertical roads at x=26,27 and x=53,54
  // Horizontal roads at y=20,21 and y=42,43
  // Border roads: x=0,1 (left), x=78,79 (right), y=0,1 (top), y=58,59 (bottom)
  static drawRoads(grid) {
    const W = Config.GRID_WIDTH;
    const H = Config.GRID_HEIGHT;

    // Border roads (perimeter)
    grid.drawHRoad(0, 0, W);
    grid.drawHRoad(0, H - 2, W);
    grid.drawVRoad(0, 0, H);
    grid.drawVRoad(W - 2, 0, H);

    // Major horizontal roads
    grid.drawHRoad(0, 21, W);   // middle horizontal
    grid.drawHRoad(0, 43, W);   // lower horizontal

    // Major vertical roads
    grid.drawVRoad(27, 0, H);   // left-center vertical
    grid.drawVRoad(54, 0, H);   // right-center vertical

    // Minor horizontal connectors (within blocks)
    grid.drawHRoad(2, 11, 24);
    grid.drawHRoad(29, 11, 24);
    grid.drawHRoad(56, 11, 20);

    grid.drawHRoad(2, 32, 24);
    grid.drawHRoad(29, 32, 24);
    grid.drawHRoad(56, 32, 20);

    grid.drawHRoad(2, 52, 24);
    grid.drawHRoad(29, 52, 24);
    grid.drawHRoad(56, 52, 20);

    // Minor vertical connectors
    grid.drawVRoad(13, 2, 18);
    grid.drawVRoad(40, 2, 18);
    grid.drawVRoad(67, 2, 18);

    grid.drawVRoad(13, 23, 18);
    grid.drawVRoad(40, 23, 18);
    grid.drawVRoad(67, 23, 18);

    grid.drawVRoad(13, 45, 12);
    grid.drawVRoad(40, 45, 12);
    grid.drawVRoad(67, 45, 12);

    // Add sidewalks adjacent to roads
    BuildingFactory.addSidewalks(grid);
  }

  static addSidewalks(grid) {
    const W = Config.GRID_WIDTH;
    const H = Config.GRID_HEIGHT;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const tile = grid.getTile(x, y);
        if (!tile || tile.type !== TileType.ROAD) continue;

        // Check neighbors; if any neighbor is GRASS, make it SIDEWALK
        const neighbors = grid.getNeighbors4(x, y);
        for (const n of neighbors) {
          if (n.type === TileType.GRASS) {
            n.type = TileType.SIDEWALK;
          }
        }
      }
    }
  }

  static addStreetLamps(grid) {
    const W = Config.GRID_WIDTH;
    const H = Config.GRID_HEIGHT;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const tile = grid.getTile(x, y);
        if (tile && tile.type === TileType.SIDEWALK) {
          // Place lamp every ~10 tiles, offset by position to spread them
          if ((x + y * 3) % 12 === 0) {
            tile.streetLamp = true;
          }
        }
      }
    }
  }

  // --- Civic building placement ---
  // Layout:
  //   Blocks (approx):
  //   TL: x=2-12, y=2-10  |  TC: x=15-25, y=2-10  |  TR: x=29-39, y=2-10  | ...
  static placeCivicBuildings(world) {
    const buildings = [];

    const placements = [
      // type,                  x,  y
      [BuildingType.PARK,        2,  2],   // top-left park
      [BuildingType.HOSPITAL,   15,  2],   // top-left area
      [BuildingType.SCHOOL,     22,  2],   // beside hospital
      [BuildingType.LIBRARY,    29,  2],   // top center-left
      [BuildingType.TOWN_HALL,  34,  2],   // top center
      [BuildingType.THEATRE,    41,  2],   // top center-right
      [BuildingType.CHURCH,     47,  2],   // top right area
      [BuildingType.GROCERY,    56,  2],   // top right
      [BuildingType.BANK,       61,  2],   // top right
      [BuildingType.GYM,        66,  2],   // top far right
      [BuildingType.FIRE_STATION, 2, 23],  // middle left
      [BuildingType.POLICE,      8, 23],   // middle left
      [BuildingType.RESTAURANT, 29, 23],   // middle center
      [BuildingType.RESTAURANT, 34, 23],   // middle center (2nd)
      [BuildingType.GROCERY,    56, 23],   // middle right
      [BuildingType.GYM,        62, 23],   // middle right
      [BuildingType.RESTAURANT, 29, 44],   // lower center (3rd)
      [BuildingType.LIBRARY,    56, 44],   // lower right
    ];

    for (const [type, x, y] of placements) {
      const building = BuildingFactory.create(type, x, y);
      if (building) {
        buildings.push(building);
        BuildingFactory.registerOnGrid(world.grid, building);
        world.buildings.push(building);
      }
    }

    return buildings;
  }

  static create(type, x, y) {
    const def = BuildingDefs[type];
    if (!def) return null;

    const config = Object.assign({}, def, { x, y });

    // Vary house colors
    if (type === BuildingType.HOUSE) {
      const palette = Utils.pick(HOUSE_COLORS);
      config.color = palette.color;
      config.roofColor = palette.roofColor;
    }

    const building = new Building(config);

    // Find entrance: tile directly below the building
    building.entrance = { x: x + Math.floor(def.width / 2), y: y + def.height };

    return building;
  }

  // Register building footprint on the grid
  static registerOnGrid(grid, building) {
    for (let ty = building.y; ty < building.y + building.height; ty++) {
      for (let tx = building.x; tx < building.x + building.width; tx++) {
        const tile = grid.getTile(tx, ty);
        if (tile) {
          tile.type = TileType.BUILDING_FLOOR;
          tile.building = building;
        }
      }
    }
  }

  // --- House placement ---
  // Fill available grass areas with 3x3 houses
  static placeHouses(world, existingBuildings) {
    // Track occupied tiles (already set to BUILDING_FLOOR)
    // Try to place 3x3 houses in grass areas, leaving sidewalk borders
    const grid = world.grid;
    const W = Config.GRID_WIDTH;
    const H = Config.GRID_HEIGHT;
    const houseCount = { count: 0 };

    // Scan in rows with spacing
    for (let y = 2; y < H - 5; y += 4) {
      for (let x = 2; x < W - 5; x += 4) {
        if (houseCount.count >= 50) break;
        if (BuildingFactory.canPlaceHere(grid, x, y, 3, 3)) {
          const house = BuildingFactory.create(BuildingType.HOUSE, x, y);
          if (house) {
            // Set entrance
            house.entrance = { x: x + 1, y: y + 3 };
            // Check entrance is walkable
            const entranceTile = grid.getTile(house.entrance.x, house.entrance.y);
            if (entranceTile && entranceTile.isWalkable) {
              BuildingFactory.registerOnGrid(grid, house);
              world.buildings.push(house);
              houseCount.count++;
            }
          }
        }
      }
    }
  }

  static canPlaceHere(grid, x, y, w, h) {
    // Check footprint + 1 tile border are all grass or sidewalk (not road, not already building)
    for (let ty = y - 1; ty <= y + h; ty++) {
      for (let tx = x - 1; tx <= x + w; tx++) {
        const tile = grid.getTile(tx, ty);
        if (!tile) return false;
        // Interior must be grass
        if (tx >= x && tx < x + w && ty >= y && ty < y + h) {
          if (tile.type !== TileType.GRASS && tile.type !== TileType.SIDEWALK) return false;
        } else {
          // Border: must not be a building floor
          if (tile.type === TileType.BUILDING_FLOOR) return false;
        }
      }
    }
    return true;
  }

  static placePond(grid) {
    // Blue pond in lower-right area
    const px = 67, py = 45;
    grid.fillRect(px, py, 10, 10, TileType.WATER);
    // Sandy border
    for (let d = 0; d < 1; d++) {
      for (let tx = px - 1; tx <= px + 10; tx++) {
        const t1 = grid.getTile(tx, py - 1);
        const t2 = grid.getTile(tx, py + 10);
        if (t1 && t1.type === TileType.GRASS) t1.type = TileType.SAND;
        if (t2 && t2.type === TileType.GRASS) t2.type = TileType.SAND;
      }
      for (let ty = py - 1; ty <= py + 10; ty++) {
        const t1 = grid.getTile(px - 1, ty);
        const t2 = grid.getTile(px + 10, ty);
        if (t1 && t1.type === TileType.GRASS) t1.type = TileType.SAND;
        if (t2 && t2.type === TileType.GRASS) t2.type = TileType.SAND;
      }
    }
  }
}
