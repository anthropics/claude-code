const PersonState = {
  IDLE:            'IDLE',
  WALKING:         'WALKING',
  WORKING:         'WORKING',
  EATING:          'EATING',
  SLEEPING:        'SLEEPING',
  LEISURE:         'LEISURE',
  SHOPPING:        'SHOPPING',
  SOCIALIZING:     'SOCIALIZING',
  ATTENDING_EVENT: 'ATTENDING_EVENT',
  SICK:            'SICK',
};

// Job type definitions (used for assignment and scheduling)
const JobTypes = {
  DOCTOR:      { title: 'Doctor',       buildingType: BuildingType.HOSPITAL,     wage: Config.WAGES.DOCTOR },
  TEACHER:     { title: 'Teacher',      buildingType: BuildingType.SCHOOL,       wage: Config.WAGES.TEACHER },
  POLICE:      { title: 'Police',       buildingType: BuildingType.POLICE,       wage: Config.WAGES.POLICE },
  FIREFIGHTER: { title: 'Firefighter',  buildingType: BuildingType.FIRE_STATION, wage: Config.WAGES.FIREFIGHTER },
  BANKER:      { title: 'Banker',       buildingType: BuildingType.BANK,         wage: Config.WAGES.BANKER },
  CHEF:        { title: 'Chef',         buildingType: BuildingType.RESTAURANT,   wage: Config.WAGES.CHEF },
  LIBRARIAN:   { title: 'Librarian',    buildingType: BuildingType.LIBRARY,      wage: Config.WAGES.LIBRARIAN },
  ACTOR:       { title: 'Actor',        buildingType: BuildingType.THEATRE,      wage: Config.WAGES.ACTOR },
  TRAINER:     { title: 'Trainer',      buildingType: BuildingType.GYM,         wage: Config.WAGES.TRAINER },
  CLERK:       { title: 'Clerk',        buildingType: BuildingType.GROCERY,      wage: Config.WAGES.CLERK },
  UNEMPLOYED:  { title: 'Unemployed',   buildingType: null,                      wage: Config.WAGES.UNEMPLOYED },
};

// Hobbies influence leisure destination choices
const Hobbies = ['READING', 'FITNESS', 'DINING', 'THEATRE', 'SOCIALIZING', 'WALKING'];

class PersonFactory {
  static spawnInitial(world, count) {
    const houses = world.getBuildingsOfType(BuildingType.HOUSE);
    if (houses.length === 0) return;

    for (let i = 0; i < count; i++) {
      const house = houses[i % houses.length];
      const person = PersonFactory.create(world, house, null, true);
      world.addPerson(person);
    }

    // Assign jobs
    PersonFactory.assignJobs(world);
  }

  static create(world, home, parents, isAdult) {
    const gender = Math.random() < 0.5 ? 'M' : 'F';
    const age = isAdult
      ? Utils.rand(20, 55)
      : (parents ? 0 : Utils.rand(5, 17));

    const person = new Person(world);
    person.name = Utils.randomName(gender);
    person.gender = gender;
    person.age = age;
    person.home = home;

    // Start at home entrance
    if (home && home.entrance) {
      person.x = home.entrance.x;
      person.y = home.entrance.y;
    } else {
      person.x = 5;
      person.y = 5;
    }
    person.pixelX = person.x * Config.TILE_SIZE + Config.TILE_SIZE / 2;
    person.pixelY = person.y * Config.TILE_SIZE + Config.TILE_SIZE / 2;
    person.prevPixelX = person.pixelX;
    person.prevPixelY = person.pixelY;

    // Stats
    person.health = Utils.rand(70, 100);
    person.happiness = Utils.rand(60, 90);
    person.hunger = Utils.rand(60, 100);
    person.energy = Utils.rand(70, 100);
    person.money = isAdult ? Utils.rand(50, 500) : 0;

    // Traits (stable personality)
    person.traits = {
      sociability: Utils.randFloat(0.2, 1.0),
      workEthic:   Utils.randFloat(0.3, 1.0),
      thriftiness: Utils.randFloat(0.2, 1.0),
      constitution:Utils.randFloat(0.3, 1.0),
    };

    // Hobby
    person.hobby = Utils.pick(Hobbies);

    // Register in home
    if (home) {
      if (!home.residents) home.residents = [];
      home.residents.push(person);
    }

    return person;
  }

  static createChild(world, parents) {
    const home = parents[0].home || world.getAvailableHouse();
    const child = PersonFactory.create(world, home, parents, false);
    child.age = 0;
    child.money = 0;
    child.job = null;
    return child;
  }

  // Assign jobs to adults based on available positions
  static assignJobs(world) {
    const adults = world.persons.filter(p => p.age >= 18 && !p.job);

    // Build a list of available job slots
    const slots = [];
    for (const [jobKey, jobDef] of Object.entries(JobTypes)) {
      if (jobKey === 'UNEMPLOYED') continue;
      if (!jobDef.buildingType) continue;
      const buildings = world.getBuildingsOfType(jobDef.buildingType);
      for (const b of buildings) {
        const slots_available = b.maxWorkers - b.workers.length;
        for (let i = 0; i < slots_available; i++) {
          slots.push({ jobKey, jobDef, building: b });
        }
      }
    }

    // Shuffle adults and assign
    const shuffled = adults.slice().sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffled.length; i++) {
      const person = shuffled[i];
      if (i < slots.length) {
        const slot = slots[i];
        person.job = slot.jobKey;
        person.jobBuilding = slot.building;
        slot.building.workers.push(person);
      } else {
        person.job = 'UNEMPLOYED';
        person.jobBuilding = null;
      }
    }
  }

  // Assign a job to a newly grown adult
  static assignJobToAdult(world, person) {
    if (person.job) return;

    for (const [jobKey, jobDef] of Object.entries(JobTypes)) {
      if (jobKey === 'UNEMPLOYED') continue;
      if (!jobDef.buildingType) continue;
      const buildings = world.getBuildingsOfType(jobDef.buildingType);
      for (const b of buildings) {
        if (b.workers.length < b.maxWorkers) {
          person.job = jobKey;
          person.jobBuilding = b;
          b.workers.push(person);
          return;
        }
      }
    }

    person.job = 'UNEMPLOYED';
    person.jobBuilding = null;
  }
}
