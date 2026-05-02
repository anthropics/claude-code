export interface Market {
  id: string;
  question: string;
  slug: string;
  outcomePrices: number[];
  outcomes: string[];
  volume: number;
  liquidity: number;
  endDate: string | null;
  sport: string;
  image?: string;
}

export interface SportTab {
  label: string;
  slug: string;
  icon: string;
}
