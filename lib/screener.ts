import { evaluateUniverse, type ScoredStock, type UniverseEvaluation } from "./scanner";
import { SEARCH_FACTORS, type ComparisonResponse, type ScreenerResponse, type ScreenerRow, type SearchFactorKey } from "./types";
import { UNIVERSE, UNIVERSE_AS_OF } from "./universe";

export type ScreenerQuery = {
  factor: SearchFactorKey;
  query?: string;
  sector?: string;
  page?: number;
  limit?: number;
};

function signalFor(item: ScoredStock, factor: SearchFactorKey) {
  const signal = item.signals.find((candidate) => candidate.key === factor);
  if (!signal) throw new Error(`Missing ${factor} signal for ${item.stock.ticker}`);
  return signal;
}

function factorStatuses(item: ScoredStock, evaluation: UniverseEvaluation): ScreenerRow["factorStatus"] {
  const institutionalLive = evaluation.sources.find((source) => source.label === "13F institutional filings")?.status === "live";
  return {
    quality: "modeled",
    earnings: "modeled",
    momentum: item.quote.source === "alpaca" ? "live" : "modeled",
    billionaire: institutionalLive ? "live" : "modeled",
    quietCompounder: "modeled",
    value: "modeled"
  };
}

function factorRecord<T>(makeValue: (factor: SearchFactorKey) => T) {
  return Object.fromEntries(SEARCH_FACTORS.map((factor) => [factor, makeValue(factor)])) as Record<SearchFactorKey, T>;
}

function eligibleTickers(evaluation: UniverseEvaluation) {
  return new Set(
    [...evaluation.stocks]
      .sort((a, b) => b.score - a.score || a.stock.marketCapRank - b.stock.marketCapRank)
      .slice(0, 12)
      .map((item) => item.stock.ticker)
  );
}

function toRow(item: ScoredStock, factor: SearchFactorKey, categoryRank: number, eligible: Set<string>, evaluation: UniverseEvaluation): ScreenerRow {
  const selected = signalFor(item, factor);
  return {
    ticker: item.stock.ticker,
    company: item.stock.company,
    sector: item.stock.sector,
    industry: item.stock.industry,
    country: item.stock.country,
    marketCap: item.stock.marketCap,
    marketCapRank: item.stock.marketCapRank,
    price: Number(item.quote.price.toFixed(2)),
    changePct: Number(item.quote.changePct.toFixed(2)),
    compositeScore: item.score,
    categoryRank,
    selectedFactor: factor,
    selectedScore: selected.score,
    factorScores: factorRecord((key) => signalFor(item, key).score),
    provenance: factorRecord((key) => signalFor(item, key).source),
    factorStatus: factorStatuses(item, evaluation),
    portfolioEligible: eligible.has(item.stock.ticker),
    thesis: item.thesis,
    risk: item.stock.risk
  };
}

export function availableSectors() {
  return [...new Set(UNIVERSE.map((stock) => stock.sector))].sort((a, b) => a.localeCompare(b));
}

export async function queryScreener(options: ScreenerQuery): Promise<ScreenerResponse> {
  const evaluation = await evaluateUniverse();
  const factor = options.factor;
  const query = (options.query || "").trim().slice(0, 64);
  const sector = options.sector || "All sectors";
  const page = options.page || 1;
  const limit = options.limit || 50;
  const eligible = eligibleTickers(evaluation);
  const ranked = [...evaluation.stocks]
    .sort((a, b) => signalFor(b, factor).score - signalFor(a, factor).score || b.score - a.score || a.stock.marketCapRank - b.stock.marketCapRank)
    .map((item, index) => toRow(item, factor, index + 1, eligible, evaluation));
  const lowerQuery = query.toLocaleLowerCase();
  const filtered = ranked.filter((row) => {
    const queryMatches = !lowerQuery || row.ticker.toLocaleLowerCase().includes(lowerQuery) || row.company.toLocaleLowerCase().includes(lowerQuery);
    const sectorMatches = sector === "All sectors" || row.sector === sector;
    return queryMatches && sectorMatches;
  });
  const start = (page - 1) * limit;
  return {
    generatedAt: evaluation.generatedAt,
    universeAsOf: UNIVERSE_AS_OF,
    universeSize: UNIVERSE.length,
    dataMode: evaluation.dataMode,
    dataNote: evaluation.dataNote,
    factor,
    query,
    sector,
    page,
    limit,
    total: filtered.length,
    totalPages: Math.ceil(filtered.length / limit),
    sectors: availableSectors(),
    rows: filtered.slice(start, start + limit)
  };
}

export async function compareStocks(symbols: string[]): Promise<ComparisonResponse> {
  const evaluation = await evaluateUniverse();
  const eligible = eligibleTickers(evaluation);
  const byTicker = new Map(evaluation.stocks.map((item) => [item.stock.ticker, item]));
  const rows = symbols.map((ticker) => {
    const item = byTicker.get(ticker);
    if (!item) return { found: false as const, ticker };
    const row = toRow(item, "quality", 0, eligible, evaluation);
    const { categoryRank: _categoryRank, selectedFactor: _selectedFactor, selectedScore: _selectedScore, ...comparisonRow } = row;
    return { found: true as const, ...comparisonRow };
  });
  const foundRows = rows.filter((row): row is Extract<(typeof rows)[number], { found: true }> => row.found);
  const winners = factorRecord((factor) => {
    const best = Math.max(...foundRows.map((row) => row.factorScores[factor]));
    return foundRows.filter((row) => row.factorScores[factor] === best).map((row) => row.ticker);
  });
  return {
    generatedAt: evaluation.generatedAt,
    universeAsOf: UNIVERSE_AS_OF,
    dataMode: evaluation.dataMode,
    items: rows,
    winners
  };
}
