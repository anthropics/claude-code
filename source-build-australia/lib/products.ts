export interface Product {
  slug: string
  title: string
  tagline: string
  description: string
  icon: string
  keyItems: string[]
  featured: boolean
}

export const products: Product[] = [
  {
    slug: 'stone-benchtops-vanities',
    title: 'Stone Benchtops, Countertops & Vanities',
    tagline: 'Premium engineered and natural stone, direct from source',
    description:
      'We supply engineered stone, porcelain slabs, natural marble, and granite benchtops and vanity tops to residential and commercial specifications. Our direct factory relationships mean premium stone at competitive supply pricing, delivered to site.',
    icon: 'Gem',
    keyItems: [
      'Engineered quartz benchtops (full slab)',
      'Porcelain slabs & large-format tops',
      'Natural marble & granite',
      'Vanity tops & bathroom ledges',
      'Commercial bar & reception tops',
      'Custom cut & edge profiles',
    ],
    featured: true,
  },
  {
    slug: 'windows-glazing-aluminium',
    title: 'Windows, Glazing & Aluminium',
    tagline: 'Aluminium-framed windows and glazing systems to spec',
    description:
      'Thermally broken aluminium windows, sliding and awning systems, curtain wall glazing, louvres, and shopfront framing. Factory-direct supply with custom sizing to your architectural plans.',
    icon: 'Square',
    keyItems: [
      'Thermally broken double-glazed windows',
      'Sliding, casement & awning systems',
      'Curtain wall & shopfront glazing',
      'Aluminium louvres & screens',
      'Bi-fold & stacking door systems',
      'Custom extrusions & profiles',
    ],
    featured: true,
  },
  {
    slug: 'cabinetry-joinery',
    title: 'Cabinetry & Joinery',
    tagline: 'Custom and semi-custom cabinetry for every project type',
    description:
      'Kitchen cabinetry, bathroom vanity units, laundry joinery, wardrobe systems, and commercial millwork. We supply flat-pack and assembled options, with custom sizing, finish, and hardware packages.',
    icon: 'LayoutGrid',
    keyItems: [
      'Kitchen cabinet carcasses & doors',
      'Bathroom vanity units',
      'Laundry joinery & linen',
      'Wardrobe & storage systems',
      'Commercial millwork & fitout joinery',
      'Soft-close hardware packages',
    ],
    featured: true,
  },
  {
    slug: 'tiles-surface-finishes',
    title: 'Tiles & Surface Finishes',
    tagline: 'Porcelain, ceramic, and natural stone tiles at scale',
    description:
      'Large-format porcelain, rectified ceramic, natural stone, mosaic, and feature tiles for floors, walls, and facades. We supply residential developments, commercial fitouts, and civil projects.',
    icon: 'Grid3x3',
    keyItems: [
      'Large-format porcelain (up to 1200×2400)',
      'Rectified ceramic floor & wall tiles',
      'Natural stone: marble, travertine, slate',
      'Mosaic & feature tiles',
      'Outdoor & anti-slip tiles',
      'Facade & pool tiles',
    ],
    featured: true,
  },
  {
    slug: 'doors-hardware-access',
    title: 'Doors, Hardware & Access',
    tagline: 'Internal, external, and security door solutions',
    description:
      'Solid timber, hollow-core, fire-rated, and steel security doors, plus door hardware, lever sets, locksets, hinges, and access control fittings. Supplied to residential and commercial specifications.',
    icon: 'DoorOpen',
    keyItems: [
      'Solid timber & veneer doors',
      'Fire-rated door sets',
      'Steel security & entry doors',
      'Cavity slider & bifold doors',
      'Lever sets, locksets & deadbolts',
      'Commercial door closers & hinges',
    ],
    featured: false,
  },
  {
    slug: 'roofing-facade-cladding',
    title: 'Roofing Systems & Façade Cladding',
    tagline: 'Roofing and cladding systems for every build type',
    description:
      'Metal roofing, terracotta and concrete tiles, membrane systems, aluminium composite cladding, fibre cement, and architectural facade panels. Suitable for residential, commercial, and industrial projects.',
    icon: 'Home',
    keyItems: [
      'Metal roofing: Colorbond-compatible profiles',
      'Terracotta & concrete roof tiles',
      'Aluminium composite panels (ACP)',
      'Fibre cement cladding',
      'Architectural facade systems',
      'Waterproof membrane systems',
    ],
    featured: false,
  },
  {
    slug: 'plumbing-sanitaryware',
    title: 'Plumbing Fixtures & Sanitaryware',
    tagline: 'Tapware, fixtures, and sanitaryware at project scale',
    description:
      'Basin mixers, shower systems, bath spouts, toilet suites, urinals, and commercial plumbing fixtures. WaterMark-compliant supply for residential developments and commercial fitouts.',
    icon: 'Droplets',
    keyItems: [
      'Basin & sink mixers',
      'Shower heads & rail systems',
      'Bath fillers & spouts',
      'Back-to-wall & wall-hung toilet suites',
      'Urinals & commercial sanitaryware',
      'WaterMark-compliant fixtures',
    ],
    featured: false,
  },
  {
    slug: 'bathrooms-kitchens-wet-areas',
    title: 'Bathrooms, Kitchens & Wet Areas',
    tagline: 'Complete wet area packages for developers and builders',
    description:
      'Full bathroom and kitchen package supply — from vanities, baths, shower screens, and waterproofing systems to kitchen sinks, waste fittings, and laundry tubs. Coordinated supply for entire developments.',
    icon: 'Bath',
    keyItems: [
      'Freestanding & built-in baths',
      'Frameless & semi-frameless shower screens',
      'Vanity units with stone tops',
      'Kitchen sinks & undermounts',
      'Laundry tubs & troughs',
      'Wet area waterproofing systems',
    ],
    featured: false,
  },
  {
    slug: 'engineered-timber-flooring',
    title: 'Engineered & Floating Timber Flooring',
    tagline: 'Hardwood look, engineered for Australian conditions',
    description:
      'Engineered hardwood, hybrid, SPC, and laminate flooring in a full range of species, colours, and grades. Suitable for slab and subfloor installation in residential and commercial applications.',
    icon: 'Layers',
    keyItems: [
      'Engineered hardwood (oak, blackbutt, spotted gum)',
      'Hybrid & SPC rigid core flooring',
      'Laminate flooring ranges',
      'Herringbone & feature patterns',
      'Stair nosings & transitions',
      'Underlay & installation accessories',
    ],
    featured: false,
  },
  {
    slug: 'specialist-trade-supply',
    title: 'Specialist & Trade-Specific Supply',
    tagline: 'Niche and hard-to-source building products, on demand',
    description:
      'Can\'t find it locally? Brief us. We source specialist and trade-specific building products direct from Chinese manufacturers — acoustic products, specialty hardware, custom fabrications, and more.',
    icon: 'Wrench',
    keyItems: [
      'Acoustic & soundproofing systems',
      'Specialty glazing & mirrors',
      'Custom fabricated metalwork',
      'Specialty hardware & ironmongery',
      'Architectural feature elements',
      'Project-specific custom sourcing',
    ],
    featured: false,
  },
  {
    slug: 'structural-steel-framing',
    title: 'Structural Steel & Framing',
    tagline: 'Steel sections, columns, and light gauge framing',
    description:
      'Structural steel sections, light gauge steel framing, lintels, columns, beams, and prefabricated steel components. Supplied to engineering specifications for residential, commercial, and industrial projects.',
    icon: 'Building2',
    keyItems: [
      'Light gauge steel frames & trusses',
      'Structural steel sections (RHS, SHS, UB)',
      'Lintels & beams',
      'Prefabricated steel components',
      'Cold-formed steel framing systems',
      'Engineering certification support',
    ],
    featured: false,
  },
  {
    slug: 'insulation-acoustic',
    title: 'Insulation & Acoustic Systems',
    tagline: 'Thermal and acoustic insulation for all build types',
    description:
      'Glass wool, rock wool, PIR board, reflective foil, and acoustic insulation batts. Supplied to NCC/BCA energy efficiency and acoustic compliance requirements for walls, ceilings, and floors.',
    icon: 'Wind',
    keyItems: [
      'Glass wool & rock wool batts',
      'PIR rigid board insulation',
      'Reflective foil blanket',
      'Acoustic wall & ceiling batts',
      'Underfloor insulation systems',
      'NCC Section J compliant supply',
    ],
    featured: false,
  },
  {
    slug: 'electrical-lighting',
    title: 'Electrical Fittings & Lighting',
    tagline: 'LED lighting and electrical fittings for every application',
    description:
      'LED downlights, strip lighting, commercial linear and high-bay lighting, switchplates, power outlets, and decorative light fittings. SAA-compliant supply for residential and commercial projects.',
    icon: 'Lightbulb',
    keyItems: [
      'LED downlights & surface lights',
      'LED strip & tape lighting',
      'Commercial high-bay & linear lighting',
      'Pendant & decorative fittings',
      'Switchplates & power outlets',
      'SAA-compliant products',
    ],
    featured: false,
  },
  {
    slug: 'landscaping-outdoor',
    title: 'Landscaping & Outdoor Products',
    tagline: 'Outdoor pavers, screening, and landscape elements',
    description:
      'Concrete and natural stone pavers, timber and aluminium decking, garden edging, retaining wall blocks, outdoor screens, and landscape feature elements for residential and commercial projects.',
    icon: 'TreePine',
    keyItems: [
      'Concrete & porcelain pavers',
      'Natural stone paving',
      'Composite & aluminium decking',
      'Retaining wall blocks & sleepers',
      'Garden edging & planter systems',
      'Aluminium privacy screens',
    ],
    featured: false,
  },
  {
    slug: 'concrete-masonry',
    title: 'Concrete, Masonry & Site Products',
    tagline: 'Blocks, bricks, and site-ready masonry at volume',
    description:
      'Concrete blocks, clay bricks, besser blocks, pavement blocks, site drainage, and concrete accessories. Bulk supply for residential and commercial construction sites.',
    icon: 'Box',
    keyItems: [
      'Concrete masonry units (CMU)',
      'Clay face bricks',
      'Besser blocks & retaining blocks',
      'Permeable & concrete pavers',
      'Site drainage & pits',
      'Concrete accessories & formwork',
    ],
    featured: false,
  },
  {
    slug: 'fixings-fasteners',
    title: 'Fixings, Fasteners & Site Hardware',
    tagline: 'Bulk fasteners and site hardware for every trade',
    description:
      'Structural bolts, anchor systems, screws, nails, wall ties, construction adhesives, and site hardware. Bulk-packed supply for builders, concreters, framers, and fit-out trades.',
    icon: 'Cog',
    keyItems: [
      'Structural bolts & anchor systems',
      'Self-drilling & self-tapping screws',
      'Nails & staples (bulk pack)',
      'Wall ties & masonry fixings',
      'Construction adhesives & sealants',
      'Site consumables & PPE',
    ],
    featured: false,
  },
]

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug)
}

export function getFeaturedProducts(): Product[] {
  return products.filter((p) => p.featured)
}
