export type StrategyKey =
  | "quality"
  | "momentum"
  | "value"
  | "earnings"
  | "congress"
  | "billionaire"
  | "crowd"
  | "insider"
  | "quietCompounder"
  | "attentionGap";

export const SEARCH_FACTORS = ["quality", "earnings", "momentum", "billionaire", "quietCompounder", "value"] as const;
export type SearchFactorKey = (typeof SEARCH_FACTORS)[number];

export const SEARCH_FACTOR_LABELS: Record<SearchFactorKey, string> = {
  quality: "Quality moat",
  earnings: "Earnings revisions",
  momentum: "Price momentum",
  billionaire: "13F conviction",
  quietCompounder: "Quiet compounder",
  value: "Valuation"
};

export type FactorSignal = {
  key: StrategyKey;
  label: string;
  score: number;
  detail: string;
  source: "market" | "fundamentals" | "filing" | "disclosure" | "crowd" | "model";
};

export type StockPick = {
  rank: number;
  ticker: string;
  company: string;
  sector: string;
  price: number;
  changePct: number;
  score: number;
  confidence: "High" | "Medium" | "Watch";
  horizon: string;
  thesis: string;
  risk: string;
  suggestedWeight: number;
  signals: FactorSignal[];
  sparkline: number[];
};

export type MarketStatus = {
  isOpen: boolean;
  label: string;
  session: "pre-market" | "open" | "after-hours" | "closed";
  nextEvent: string;
};

export type ScanResult = {
  id: string;
  generatedAt: string;
  dataMode: "live" | "modeled";
  dataNote: string;
  universeSize: number;
  market: MarketStatus;
  regime: { label: string; risk: "low" | "moderate" | "high"; detail: string };
  breadth: number;
  picks: StockPick[];
  committeeBrief: string;
  sources: { label: string; status: "live" | "modeled" | "not connected" }[];
};

export type PortfolioHolding = {
  ticker: string;
  company: string;
  shares: number;
  averageCost: number;
  currentPrice: number;
  score: number;
  openedAt: string;
};

export type PortfolioTransaction = {
  id: string;
  side: "BUY" | "SELL" | "OPENING";
  ticker: string;
  company: string;
  shares: number;
  price: number;
  total: number;
  realizedPnl: number;
  executedAt: string;
};

export type PaperPortfolioAccount = {
  version: 2;
  startingBalance: number;
  cash: number;
  realizedPnl: number;
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
  createdAt: string;
  updatedAt: string;
};

export type UniverseSecurity = {
  ticker: string;
  company: string;
  sector: string;
  industry: string;
  country: string;
  marketCap: number;
  marketCapRank: number;
  basePrice: number;
  isAdr: boolean;
};

export type ScreenerRow = {
  ticker: string;
  company: string;
  sector: string;
  industry: string;
  country: string;
  marketCap: number;
  marketCapRank: number;
  price: number;
  changePct: number;
  compositeScore: number;
  categoryRank: number;
  selectedFactor: SearchFactorKey;
  selectedScore: number;
  factorScores: Record<SearchFactorKey, number>;
  provenance: Record<SearchFactorKey, FactorSignal["source"]>;
  factorStatus: Record<SearchFactorKey, "live" | "modeled">;
  portfolioEligible: boolean;
  thesis: string;
  risk: string;
};

export type ScreenerResponse = {
  generatedAt: string;
  universeAsOf: string;
  universeSize: number;
  dataMode: "live" | "modeled";
  dataNote: string;
  factor: SearchFactorKey;
  query: string;
  sector: string;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  sectors: string[];
  rows: ScreenerRow[];
};

export type ComparisonItem =
  | ({ found: true } & Omit<ScreenerRow, "categoryRank" | "selectedFactor" | "selectedScore">)
  | { found: false; ticker: string };

export type ComparisonResponse = {
  generatedAt: string;
  universeAsOf: string;
  dataMode: "live" | "modeled";
  items: ComparisonItem[];
  winners: Record<SearchFactorKey, string[]>;
};
