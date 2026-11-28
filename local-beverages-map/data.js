// Local beverages dataset. Coordinates are approximate and ratings are
// illustrative — intended as seed data for the demo UI.
window.CITIES = [
  {
    id: "portland-or",
    name: "Portland, Oregon",
    blurb:
      "A craft-beer capital with a rising wine scene from the nearby Willamette Valley.",
    center: [45.5231, -122.6765],
    zoom: 12,
    beverages: [
      {
        type: "beer",
        name: "Apocalypse IPA",
        venue: "10 Barrel Brewing",
        rating: 4.4,
        address: "1411 NW Flanders St",
        coords: [45.5264, -122.685],
        description:
          "Piney, citrus-forward West Coast IPA served on tap at their Pearl District pub.",
      },
      {
        type: "beer",
        name: "Black Butte Porter",
        venue: "Deschutes Brewery Public House",
        rating: 4.5,
        address: "210 NW 11th Ave",
        coords: [45.5258, -122.6822],
        description:
          "Iconic Oregon porter — chocolatey, roasty, remarkably sessionable.",
      },
      {
        type: "beer",
        name: "Workhorse IPA",
        venue: "Laurelwood Brewing",
        rating: 4.2,
        address: "5115 NE Sandy Blvd",
        coords: [45.5354, -122.6108],
        description:
          "Long-running NE Portland IPA with bright grapefruit notes.",
      },
      {
        type: "beer",
        name: "Mirror Pond Pale Ale",
        venue: "Breakside Brewery (Slabtown)",
        rating: 4.3,
        address: "1570 NW 22nd Ave",
        coords: [45.5338, -122.6974],
        description:
          "Balanced pale ale, a classic intro to Oregon hop character.",
      },
      {
        type: "wine",
        name: "Willamette Valley Pinot Noir",
        venue: "Oregon Wines on Broadway",
        rating: 4.6,
        address: "515 SW Broadway",
        coords: [45.519, -122.6796],
        description:
          "Downtown tasting bar featuring small-production Willamette Pinots.",
      },
      {
        type: "wine",
        name: "Chehalem Mountains Chardonnay",
        venue: "ENSO Winery",
        rating: 4.3,
        address: "1416 SE Stark St",
        coords: [45.5195, -122.6485],
        description:
          "Urban winery pouring cool-climate Oregon whites in a relaxed taproom.",
      },
      {
        type: "wine",
        name: "Columbia Gorge Riesling",
        venue: "Hip Chicks Do Wine",
        rating: 4.1,
        address: "4510 SE 23rd Ave",
        coords: [45.4918, -122.6434],
        description:
          "Friendly southeast winery with approachable, off-dry whites.",
      },
    ],
  },
  {
    id: "munich",
    name: "Munich, Germany",
    blurb:
      "Home of the Reinheitsgebot: crisp helles lagers and riverside beer gardens.",
    center: [48.1374, 11.5755],
    zoom: 13,
    beverages: [
      {
        type: "beer",
        name: "Augustiner Helles",
        venue: "Augustiner-Keller",
        rating: 4.7,
        address: "Arnulfstraße 52",
        coords: [48.1445, 11.5545],
        description:
          "Beloved Munich helles, poured from wooden barrels in a chestnut-shaded garden.",
      },
      {
        type: "beer",
        name: "Hofbräu Original",
        venue: "Hofbräuhaus am Platzl",
        rating: 4.3,
        address: "Platzl 9",
        coords: [48.1374, 11.5799],
        description:
          "The city's most famous beer hall, rowdy and historic — a one-liter mass is standard.",
      },
      {
        type: "beer",
        name: "Paulaner Hefe-Weißbier",
        venue: "Paulaner am Nockherberg",
        rating: 4.5,
        address: "Hochstraße 77",
        coords: [48.1265, 11.5819],
        description:
          "Classic Bavarian wheat beer — banana and clove, cloudy and refreshing.",
      },
      {
        type: "beer",
        name: "Spaten Münchner Hell",
        venue: "Spatenhaus an der Oper",
        rating: 4.2,
        address: "Residenzstraße 12",
        coords: [48.1411, 11.5773],
        description:
          "Refined helles alongside Bavarian classics across from the National Theatre.",
      },
      {
        type: "wine",
        name: "Franken Silvaner",
        venue: "Weinhaus Neuner",
        rating: 4.4,
        address: "Herzogspitalstraße 8",
        coords: [48.1372, 11.5702],
        description:
          "Historic wine house pouring dry Franconian whites from the Bocksbeutel bottle.",
      },
      {
        type: "wine",
        name: "Württemberg Trollinger",
        venue: "Garibaldi Weinbar",
        rating: 4.0,
        address: "Buttermelcherstraße 10",
        coords: [48.1329, 11.5788],
        description:
          "Casual wine bar with a rotating glass list of southern German reds.",
      },
    ],
  },
  {
    id: "napa",
    name: "Napa, California",
    blurb:
      "The United States' benchmark wine region, with a few excellent local breweries.",
    center: [38.2975, -122.2869],
    zoom: 12,
    beverages: [
      {
        type: "wine",
        name: "Cabernet Sauvignon",
        venue: "Stags' Leap Winery",
        rating: 4.8,
        address: "6150 Silverado Trail",
        coords: [38.3942, -122.3164],
        description:
          "Structured, age-worthy Napa Cab from the historic Stags Leap District.",
      },
      {
        type: "wine",
        name: "Chardonnay",
        venue: "Domaine Carneros",
        rating: 4.6,
        address: "1240 Duhig Rd",
        coords: [38.2316, -122.3441],
        description:
          "Château-style tasting terrace known for sparkling wines and crisp Chard.",
      },
      {
        type: "wine",
        name: "Zinfandel",
        venue: "Frog's Leap Winery",
        rating: 4.5,
        address: "8815 Conn Creek Rd, Rutherford",
        coords: [38.4518, -122.3781],
        description:
          "Organic, dry-farmed Rutherford estate with a relaxed, garden-focused tasting.",
      },
      {
        type: "wine",
        name: "Sauvignon Blanc",
        venue: "Cakebread Cellars",
        rating: 4.4,
        address: "8300 St Helena Hwy, Rutherford",
        coords: [38.4454, -122.3766],
        description:
          "Food-friendly whites with bright citrus, in a welcoming family-run house.",
      },
      {
        type: "beer",
        name: "Downtown Brown Ale",
        venue: "Downtown Joe's Brewery",
        rating: 4.0,
        address: "902 Main St, Napa",
        coords: [38.2971, -122.2856],
        description:
          "Riverside brewpub pouring approachable house ales and seasonal lagers.",
      },
      {
        type: "beer",
        name: "Old Kilt Scotch Ale",
        venue: "Napa Smith Brewery",
        rating: 4.1,
        address: "1 Executive Way, Napa",
        coords: [38.2438, -122.2671],
        description:
          "South-of-downtown brewery known for malt-forward ales and a sunny patio.",
      },
    ],
  },
  {
    id: "bordeaux",
    name: "Bordeaux, France",
    blurb:
      "A world capital of red wine, with a growing craft beer scene along the Garonne.",
    center: [44.8378, -0.5792],
    zoom: 13,
    beverages: [
      {
        type: "wine",
        name: "Médoc Cabernet Blend",
        venue: "Max Bordeaux Wine Gallery",
        rating: 4.6,
        address: "14 Cours de l'Intendance",
        coords: [44.8411, -0.5781],
        description:
          "By-the-glass tastings of grand cru Médocs via Enomatic dispensers.",
      },
      {
        type: "wine",
        name: "Saint-Émilion Merlot",
        venue: "Bar à Vin du CIVB",
        rating: 4.5,
        address: "3 Cours du XXX Juillet",
        coords: [44.8429, -0.5739],
        description:
          "Official wine council bar — affordable pours of regional classics.",
      },
      {
        type: "wine",
        name: "Sauternes",
        venue: "L'Intendant",
        rating: 4.4,
        address: "2 Allées de Tourny",
        coords: [44.8425, -0.5745],
        description:
          "Spiral-staircase cellar with one of the deepest Bordeaux selections in the city.",
      },
      {
        type: "wine",
        name: "Entre-Deux-Mers Blanc",
        venue: "Aux Quatre Coins du Vin",
        rating: 4.3,
        address: "8 Rue de la Devise",
        coords: [44.8391, -0.5738],
        description:
          "Self-serve tasting cards across 32 rotating wines in the Saint-Pierre quarter.",
      },
      {
        type: "beer",
        name: "La Garonne IPA",
        venue: "Brasserie Garage",
        rating: 4.2,
        address: "39 Rue des Faures",
        coords: [44.8363, -0.5671],
        description:
          "Neighborhood micro-brewery pouring hop-forward ales right on premises.",
      },
      {
        type: "beer",
        name: "Blonde du Port",
        venue: "La Fabrique Pangée",
        rating: 4.1,
        address: "8 Rue Sicard",
        coords: [44.8338, -0.5617],
        description:
          "Craft brewery and taproom on the right bank, known for crisp blondes.",
      },
    ],
  },
  {
    id: "tokyo",
    name: "Tokyo, Japan",
    blurb:
      "A surprising craft-beer hub, plus a growing lineup of Japanese-grown wines.",
    center: [35.6762, 139.6503],
    zoom: 12,
    beverages: [
      {
        type: "beer",
        name: "Yona Yona Ale",
        venue: "YONA YONA BEER WORKS Shinjuku",
        rating: 4.4,
        address: "3-36-12 Shinjuku",
        coords: [35.6909, 139.7036],
        description:
          "Flagship American pale ale by Yoho Brewing, poured fresh at their beer works.",
      },
      {
        type: "beer",
        name: "Hitachino Nest White Ale",
        venue: "Hitachino Brewing Lab Akihabara",
        rating: 4.5,
        address: "1-25-4 Kanda-Sudacho",
        coords: [35.6972, 139.7722],
        description:
          "Kiuchi Brewery's spiced witbier, a gateway Japanese craft beer.",
      },
      {
        type: "beer",
        name: "Shiga Kogen IPA",
        venue: "Craft Beer Market Jinbocho",
        rating: 4.3,
        address: "2-11-3 Kanda-Jinbocho",
        coords: [35.6957, 139.7577],
        description:
          "Multi-tap bar featuring rotating regional craft beers from across Japan.",
      },
      {
        type: "wine",
        name: "Koshu (Yamanashi)",
        venue: "Nihon no Wine-ya Tokyo",
        rating: 4.2,
        address: "5-8-5 Ginza",
        coords: [35.6706, 139.7651],
        description:
          "Retailer-bar devoted to Japanese wines, with Koshu whites as a specialty.",
      },
      {
        type: "wine",
        name: "Muscat Bailey A",
        venue: "Wine Bar Tokyo",
        rating: 4.0,
        address: "2-14-5 Shibuya",
        coords: [35.6595, 139.7005],
        description:
          "Approachable light red made from a grape bred in Japan in the 1920s.",
      },
    ],
  },
];
