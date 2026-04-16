const Config = {
  // World dimensions
  GRID_WIDTH: 80,
  GRID_HEIGHT: 60,
  TILE_SIZE: 16,

  // Time: 1 tick = 1 game minute at 1x speed (60 ticks/sec real = 60 game minutes/sec)
  // So 1 game day = 1440 ticks at 1x = 24 real seconds
  TICKS_PER_SECOND: 60,

  // Economy
  INITIAL_TREASURY: 50000,
  TAX_RATE: 0.10,
  WELFARE_AMOUNT: 20,

  // Service costs
  RESTAURANT_COST_MIN: 20,
  RESTAURANT_COST_MAX: 40,
  GROCERY_COST_MIN: 5,
  GROCERY_COST_MAX: 15,
  GYM_COST: 10,
  THEATRE_COST: 15,
  BANK_INTEREST_RATE: 0.001,

  // Jobs (daily wage)
  WAGES: {
    DOCTOR:      200,
    BANKER:      160,
    TEACHER:     120,
    POLICE:      110,
    FIREFIGHTER: 100,
    ACTOR:        90,
    CHEF:         80,
    TRAINER:      75,
    LIBRARIAN:    70,
    CLERK:        60,
    UNEMPLOYED:   20,
  },

  // Population
  INITIAL_POPULATION: 40,
  MAX_POPULATION: 200,

  // Needs drain per tick
  HUNGER_DRAIN:    0.015,
  ENERGY_DRAIN:    0.010,
  HAPPINESS_DECAY: 0.005,

  // Need thresholds for overrides
  HUNGER_CRITICAL: 20,
  ENERGY_CRITICAL: 15,
  HEALTH_CRITICAL: 20,

  // Social
  AFFINITY_PER_INTERACTION: 4,
  AFFINITY_DECAY_PER_TICK: 0.0005,
  ROMANCE_AFFINITY_THRESHOLD: 70,
  ROMANCE_CHANCE_PER_TICK: 0.003,

  // Reproduction
  REPRODUCE_CHANCE_PER_TICK: 0.0002,
  REPRODUCE_MIN_MONEY: 400,
  REPRODUCE_MIN_HEALTH: 60,
  REPRODUCE_MIN_HAPPINESS: 55,
  REPRODUCE_WOMAN_MAX_AGE: 45,
  REPRODUCE_MIN_AGE: 18,

  // Health
  ILLNESS_BASE_RISK: 0.0005,
  ILLNESS_WINTER_MULTIPLIER: 1.8,
  ILLNESS_LOW_HEALTH_MULTIPLIER: 3.0,

  // Aging
  RETIRE_AGE: 65,
  ELDER_MORTALITY_START_AGE: 80,
  CHILD_MAX_AGE: 17,

  // Random events (probability per tick)
  EVENT_FIRE_RATE:     0.0003,
  EVENT_FESTIVAL_RATE: 0.00008,
  EVENT_EPIDEMIC_RATE: 0.00004,
  EVENT_ROBBERY_RATE:  0.0002,
  EVENT_ACCIDENT_RATE: 0.0005,

  // Pathfinding
  PATH_MAX_SEARCH: 60,

  // Camera/viewport
  VIEWPORT_WIDTH:  1000,
  VIEWPORT_HEIGHT: 680,

  // Speed options
  SPEEDS: [1, 2, 5, 10, 20],
};
