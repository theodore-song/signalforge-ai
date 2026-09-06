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
  entryPrice: number;
  currentPrice: number;
  weight: number;
  score: number;
};
