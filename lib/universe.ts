import snapshot from "./universe.generated.json";
import type { UniverseSecurity } from "./types";

export type UniverseStock = UniverseSecurity & {
  quality: number;
  momentum: number;
  value: number;
  earnings: number;
  congress: number;
  billionaire: number;
  crowd: number;
  insider: number;
  risk: string;
};

type ScoreFields = Pick<UniverseStock, "quality" | "momentum" | "value" | "earnings" | "congress" | "billionaire" | "crowd" | "insider">;

const curated: Record<string, Partial<ScoreFields> & { risk?: string }> = {
  NVDA: { quality: 94, momentum: 91, value: 55, earnings: 96, congress: 72, billionaire: 81, crowd: 88, insider: 57, risk: "Premium valuation leaves little room for an AI-spending slowdown." },
  MSFT: { quality: 96, momentum: 76, value: 61, earnings: 89, congress: 79, billionaire: 87, crowd: 74, insider: 63, risk: "Cloud growth and AI monetization must offset rising infrastructure spend." },
  GOOGL: { quality: 93, momentum: 80, value: 78, earnings: 91, congress: 68, billionaire: 85, crowd: 71, insider: 59, risk: "Search disruption and regulatory remedies could pressure the multiple." },
  AMZN: { quality: 88, momentum: 83, value: 69, earnings: 90, congress: 74, billionaire: 82, crowd: 84, insider: 55, risk: "Retail margins remain sensitive to logistics costs and consumer demand." },
  META: { quality: 92, momentum: 87, value: 75, earnings: 93, congress: 66, billionaire: 83, crowd: 78, insider: 60, risk: "Heavy AI capex and platform regulation could compress free cash flow." },
  AVGO: { quality: 90, momentum: 89, value: 58, earnings: 92, congress: 70, billionaire: 78, crowd: 76, insider: 58, risk: "Customer concentration and acquisition integration raise execution risk." },
  LLY: { quality: 91, momentum: 73, value: 42, earnings: 90, congress: 64, billionaire: 73, crowd: 69, insider: 67, risk: "Obesity-drug expectations are high and manufacturing scale-up is critical." },
  JPM: { quality: 91, momentum: 77, value: 76, earnings: 84, congress: 71, billionaire: 86, crowd: 58, insider: 65, risk: "Credit normalization and rate cuts may pressure net interest income." },
  COST: { quality: 95, momentum: 70, value: 39, earnings: 83, congress: 61, billionaire: 76, crowd: 66, insider: 62, risk: "A rich multiple magnifies any membership or traffic disappointment." },
  V: { quality: 97, momentum: 71, value: 66, earnings: 86, congress: 69, billionaire: 89, crowd: 55, insider: 64, risk: "Regulation and alternative payment rails may erode transaction economics." },
  TSM: { quality: 95, momentum: 85, value: 72, earnings: 94, congress: 58, billionaire: 84, crowd: 79, insider: 56, risk: "Geopolitical concentration remains the dominant tail risk." },
  "BRK.B": { quality: 94, momentum: 63, value: 79, earnings: 75, congress: 60, billionaire: 98, crowd: 45, insider: 74, risk: "Scale limits opportunity and succession remains a long-term uncertainty." }
};

const sectorQuality: Record<string, number> = {
  Technology: 4,
  Healthcare: 3,
  "Health Care": 3,
  Industrials: 2,
  Finance: 1,
  Utilities: 2,
  "Consumer Staples": 3
};

const sectorRisks: Record<string, string> = {
  Technology: "Product cycles, competition, and valuation compression could weaken the signal.",
  Healthcare: "Clinical, reimbursement, and regulatory outcomes can overwhelm quantitative factors.",
  "Health Care": "Clinical, reimbursement, and regulatory outcomes can overwhelm quantitative factors.",
  Finance: "Credit quality, funding costs, and regulation can rapidly change the earnings outlook.",
  Energy: "Commodity prices and policy changes can dominate company-specific fundamentals.",
  Utilities: "Interest rates, regulation, and capital-project execution can pressure returns.",
  Industrials: "Economic sensitivity and supply-chain execution can reverse operating momentum.",
  "Consumer Discretionary": "Consumer demand and margin pressure can undermine the current ranking.",
  "Consumer Staples": "Input costs and pricing pressure could slow otherwise defensive growth.",
  "Real Estate": "Interest rates, refinancing needs, and occupancy trends can impair the thesis.",
  Telecommunications: "Capital intensity and competition may pressure free cash flow.",
  "Basic Materials": "Cyclical pricing and global demand can outweigh company execution."
};

function hashUnit(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10_000) / 10_000;
}

function clamp(value: number) {
  return Math.max(1, Math.min(99, Math.round(value)));
}

function modeledScores(security: UniverseSecurity): ScoreFields {
  const scale = 1 - (security.marketCapRank - 1) / 1_999;
  const unit = (name: string) => hashUnit(`${security.ticker}:${name}`);
  return {
    quality: clamp(43 + unit("quality") * 38 + scale * 14 + (sectorQuality[security.sector] || 0)),
    momentum: clamp(37 + unit("momentum") * 57),
    value: clamp(35 + unit("value") * 60 - scale * 2),
    earnings: clamp(39 + unit("earnings") * 53 + scale * 6),
    congress: clamp(29 + unit("congress") * 64),
    billionaire: clamp(33 + unit("billionaire") * 50 + scale * 13),
    crowd: clamp(30 + unit("crowd") * 65),
    insider: clamp(34 + unit("insider") * 59)
  };
}

function enrich(security: UniverseSecurity): UniverseStock {
  const scores = { ...modeledScores(security), ...(curated[security.ticker] || {}) };
  return {
    ...security,
    quality: scores.quality,
    momentum: scores.momentum,
    value: scores.value,
    earnings: scores.earnings,
    congress: scores.congress,
    billionaire: scores.billionaire,
    crowd: scores.crowd,
    insider: scores.insider,
    risk: curated[security.ticker]?.risk || sectorRisks[security.sector] || "Company-specific execution, liquidity, and market-regime changes could invalidate the signal."
  };
}

export const UNIVERSE_AS_OF = snapshot.asOf;
export const UNIVERSE_SOURCE = snapshot.sourceUrl;
export const UNIVERSE: UniverseStock[] = (snapshot.securities as UniverseSecurity[]).map(enrich);
