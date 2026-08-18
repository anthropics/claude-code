export interface CustomerSegment {
  id: string
  title: string
  description: string
  icon: string
}

export const customerSegments: CustomerSegment[] = [
  {
    id: 'residential-builders',
    title: 'Residential Builders',
    description: 'Volume and custom home builders sourcing across all trades and finishes',
    icon: 'Home',
  },
  {
    id: 'commercial-contractors',
    title: 'Commercial Contractors',
    description: 'Head contractors and subcontractors on commercial builds and fitouts',
    icon: 'Building2',
  },
  {
    id: 'property-developers',
    title: 'Property Developers',
    description: 'Developers specifying and procuring across entire project supply chains',
    icon: 'TrendingUp',
  },
  {
    id: 'trade-contractors',
    title: 'Trade Contractors',
    description: 'Tilers, plumbers, electricians, and fit-out trades buying at volume',
    icon: 'Wrench',
  },
  {
    id: 'site-project-managers',
    title: 'Site & Project Managers',
    description: 'PMs and site managers co-ordinating multi-trade supply on active sites',
    icon: 'ClipboardList',
  },
  {
    id: 'civil-contractors',
    title: 'Civil Contractors',
    description: 'Civil and infrastructure contractors requiring bulk product supply',
    icon: 'Truck',
  },
]
