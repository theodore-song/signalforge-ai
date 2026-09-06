import { makeCommitteeBrief } from "./ai";
import { getExternalScores, getQuotes, makeSparkline, type Quote } from "./data";
import { getMarketStatus, marketBucket } from "./market";
import type { FactorSignal, ScanResult, StockPick, StrategyKey } from "./types";
import { UNIVERSE, type UniverseStock } from "./universe";

const labels: Record<StrategyKey, string> = {
  quality: "Quality moat", momentum: "Price momentum", value: "Valuation", earnings: "Earnings revisions",
  congress: "Congress flow", billionaire: "13F conviction", crowd: "Crowd pulse", insider: "Insider alignment",
  quietCompounder: "Quiet compounder", attentionGap: "Attention gap"
};

const sourceFor: Record<StrategyKey, FactorSignal["source"]> = {
  quality: "fundamentals", momentum: "market", value: "fundamentals", earnings: "fundamentals",
  congress: "disclosure", billionaire: "filing", crowd: "crowd", insider: "filing",
  quietCompounder: "model", attentionGap: "model"
};

export type ScoredStock = {
  stock: UniverseStock;
  quote: Quote;
  signals: FactorSignal[];
  score: number;
  thesis: string;
};

export type UniverseEvaluation = {
  generatedAt: string;
  bucket: number;
  dataMode: "live" | "modeled";
  dataNote: string;
  stocks: ScoredStock[];
  sources: ScanResult["sources"];
};

function clamp(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }

function signal(key: StrategyKey, score: number, detail: string): FactorSignal {
  return { key, label: labels[key], score: clamp(score), detail, source: sourceFor[key] };
}

function buildSignals(stock: UniverseStock, changePct: number, external: { congress?: number; billionaire?: number; crowd?: number }): FactorSignal[] {
  const momentum = clamp(stock.momentum + changePct * 2.4);
  const quiet = clamp(stock.quality * 0.55 + stock.earnings * 0.35 - Math.max(stock.crowd - 65, 0) * 0.3);
  const attentionGap = clamp(stock.earnings * 0.45 + momentum * 0.35 + (100 - stock.crowd) * 0.2);
  return [
    signal("quality", stock.quality, "Profitability, balance-sheet resilience and durable competitive position."),
    signal("momentum", momentum, "Medium-term trend plus current-session price confirmation."),
    signal("value", stock.value, "Cash-flow yield and relative valuation versus sector peers."),
    signal("earnings", stock.earnings, "Direction and breadth of forward estimate revisions."),
    signal("congress", external.congress ?? stock.congress, external.congress == null ? "Modeled proxy; connect a disclosure feed for filed transaction data." : "Normalized score from the connected congressional disclosure feed."),
    signal("billionaire", external.billionaire ?? stock.billionaire, external.billionaire == null ? "Modeled 13F-conviction proxy; public filings are delayed and not trade alerts." : "Normalized institutional conviction from the connected holdings feed."),
    signal("crowd", external.crowd ?? stock.crowd, external.crowd == null ? "Modeled attention proxy; connect a sentiment feed for live crowd data." : "Attention, direction and dispersion from the connected crowd feed."),
    signal("insider", stock.insider, "Insider ownership and modeled transaction alignment."),
    signal("quietCompounder", quiet, "Original signal: fundamental acceleration before broad narrative saturation."),
    signal("attentionGap", attentionGap, "Original signal: gap between improving evidence and lagging public attention.")
  ];
}

const weights: Record<StrategyKey, number> = {
  quality: .16, momentum: .13, value: .10, earnings: .15, congress: .07,
  billionaire: .10, crowd: .08, insider: .07, quietCompounder: .08, attentionGap: .06
};

function scoreSignals(signals: FactorSignal[]) {
  const raw = signals.reduce((sum, item) => sum + item.score * weights[item.key], 0);
  const agreement = signals.filter((item) => item.score >= 75).length;
  return clamp(raw + Math.min(agreement, 5) * 1.2);
}

function thesisFor(stock: UniverseStock, signals: FactorSignal[]) {
  const best = [...signals].sort((a, b) => b.score - a.score).slice(0, 2).map((item) => item.label.toLowerCase());
  return `${stock.company} screens strongly on ${best[0]} and ${best[1]}, with cross-signal agreement that reduces reliance on any single narrative.`;
}

let cachedEvaluation: { bucket: number; value: Promise<UniverseEvaluation> } | null = null;

async function calculateUniverse(now: Date): Promise<UniverseEvaluation> {
  const bucket = marketBucket(now);
  const [quotes, congress, billionaire, crowd] = await Promise.all([
    getQuotes(bucket),
    getExternalScores(process.env.POLITICIAN_TRADES_URL),
    getExternalScores(process.env.INSTITUTIONAL_HOLDINGS_URL),
    getExternalScores(process.env.CROWD_SENTIMENT_URL)
  ]);
  const liveCount = Object.values(quotes).filter((quote) => quote.source === "alpaca").length;
  const dataMode = liveCount > 0 ? "live" as const : "modeled" as const;
  const stocks = UNIVERSE.map((stock) => {
    const quote = quotes[stock.ticker] || { price: stock.basePrice, changePct: 0, source: "modeled" as const };
    const signals = buildSignals(stock, quote.changePct, { congress: congress?.[stock.ticker], billionaire: billionaire?.[stock.ticker], crowd: crowd?.[stock.ticker] });
    return { stock, quote, signals, score: scoreSignals(signals), thesis: thesisFor(stock, signals) };
  });
  return {
    generatedAt: now.toISOString(),
    bucket,
    dataMode,
    dataNote: dataMode === "live"
      ? `${liveCount.toLocaleString()} live IEX snapshots via Alpaca; missing quotes and unconnected alternative-data factors remain modeled.`
      : "Demonstration dataset. Connect provider credentials before using this for live research.",
    stocks,
    sources: [
      { label: "Market snapshots", status: dataMode === "live" ? "live" : "modeled" },
      { label: "Congress disclosures", status: congress ? "live" : "not connected" },
      { label: "13F institutional filings", status: billionaire ? "live" : "modeled" },
      { label: "Crowd sentiment", status: crowd ? "live" : "modeled" }
    ]
  };
}

export function evaluateUniverse(forceFresh = false): Promise<UniverseEvaluation> {
  const now = new Date();
  const bucket = marketBucket(now);
  if (!forceFresh && cachedEvaluation?.bucket === bucket) return cachedEvaluation.value;
  const value = calculateUniverse(now);
  cachedEvaluation = { bucket, value };
  return value;
}

function toPick(item: ScoredStock, rank: number, bucket: number): StockPick {
  return {
    rank,
    ticker: item.stock.ticker,
    company: item.stock.company,
    sector: item.stock.sector,
    price: Number(item.quote.price.toFixed(2)),
    changePct: Number(item.quote.changePct.toFixed(2)),
    score: item.score,
    confidence: item.score >= 86 ? "High" : item.score >= 79 ? "Medium" : "Watch",
    horizon: item.score >= 86 ? "3–12 months" : "1–6 months",
    thesis: item.thesis,
    risk: item.stock.risk,
    suggestedWeight: 0,
    signals: [...item.signals].sort((a, b) => b.score - a.score),
    sparkline: makeSparkline(item.stock.ticker, item.quote.price, bucket)
  };
}

export async function runScan(includeAi = false, forceFresh = false): Promise<ScanResult> {
  const evaluation = await evaluateUniverse(forceFresh);
  const ranked = [...evaluation.stocks]
    .sort((a, b) => b.score - a.score || a.stock.marketCapRank - b.stock.marketCapRank)
    .slice(0, 12);
  const picks = ranked.map((item, index) => toPick(item, index + 1, evaluation.bucket));
  const totalEdge = picks.reduce((sum, pick) => sum + Math.max(pick.score - 65, 3), 0);
  picks.forEach((pick) => { pick.suggestedWeight = Number(((Math.max(pick.score - 65, 3) / totalEdge) * 100).toFixed(1)); });

  const averageChange = picks.reduce((sum, pick) => sum + pick.changePct, 0) / picks.length;
  const regime = averageChange > .45
    ? { label: "Risk-on expansion", risk: "moderate" as const, detail: "Breadth and momentum agree; avoid chasing crowded extremes." }
    : averageChange < -.55
      ? { label: "Defensive rotation", risk: "high" as const, detail: "Weak participation favors quality and smaller position sizes." }
      : { label: "Selective risk-on", risk: "moderate" as const, detail: "Leadership is narrow, so factor agreement matters more than beta." };
  const committeeBrief = includeAi ? await makeCommitteeBrief(picks, regime.label) : `${picks.slice(0, 3).map((pick) => pick.ticker).join(", ")} lead the current ranking. The model favors independent signal agreement and penalizes crowded, expensive momentum.`;

  return {
    id: `scan-${evaluation.bucket}`,
    generatedAt: evaluation.generatedAt,
    dataMode: evaluation.dataMode,
    dataNote: evaluation.dataNote,
    universeSize: UNIVERSE.length,
    market: getMarketStatus(new Date(evaluation.generatedAt)),
    regime,
    breadth: Math.round((ranked.filter((item) => item.quote.changePct > 0).length / ranked.length) * 100),
    picks,
    committeeBrief,
    sources: evaluation.sources
  };
}
