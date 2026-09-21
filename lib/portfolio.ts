import type { PaperPortfolioAccount, PortfolioHolding, PortfolioQuote, PortfolioTransaction, StockPick } from "./types";

export type TradeQuote = Pick<StockPick, "ticker" | "company" | "price" | "score">;

export type AccountMetrics = {
  securitiesValue: number;
  totalValue: number;
  costBasis: number;
  unrealizedPnl: number;
  realizedPnl: number;
  totalPnl: number;
  cashWeight: number;
};

const money = (value: number) => Number(value.toFixed(2));
const quantity = (value: number) => Number(value.toFixed(3));
const cost = (value: number) => Number(value.toFixed(4));

function transactionId(side: PortfolioTransaction["side"], ticker: string, now: string, index = 0) {
  return `${now}-${side}-${ticker}-${index}`;
}

function validAmount(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be greater than zero`);
}

export function createCashAccount(startingBalance: number, now = new Date().toISOString()): PaperPortfolioAccount {
  validAmount(startingBalance, "Starting balance");
  const normalized = money(startingBalance);
  return { version: 2, startingBalance: normalized, cash: normalized, realizedPnl: 0, holdings: [], transactions: [], createdAt: now, updatedAt: now };
}

export function buyStock(account: PaperPortfolioAccount, quote: TradeQuote, requestedShares: number, now = new Date().toISOString(), source: PortfolioTransaction["source"] = "user") {
  validAmount(requestedShares, "Shares");
  validAmount(quote.price, "Price");
  const shares = quantity(requestedShares);
  if (shares <= 0) throw new Error("Shares must be at least 0.001");
  const total = money(shares * quote.price);
  if (total > account.cash + 0.001) throw new Error("This order exceeds the available cash balance");

  const current = account.holdings.find((holding) => holding.ticker === quote.ticker);
  const nextShares = quantity((current?.shares || 0) + shares);
  const averageCost = cost((((current?.shares || 0) * (current?.averageCost || 0)) + total) / nextShares);
  const holding: PortfolioHolding = {
    ticker: quote.ticker,
    company: quote.company,
    shares: nextShares,
    averageCost,
    currentPrice: quote.price,
    score: quote.score,
    openedAt: current?.openedAt || now
  };
  const holdings = current
    ? account.holdings.map((item) => item.ticker === quote.ticker ? holding : item)
    : [...account.holdings, holding];
  const transaction: PortfolioTransaction = {
    id: transactionId("BUY", quote.ticker, now, account.transactions.length),
    side: "BUY",
    source,
    ticker: quote.ticker,
    company: quote.company,
    shares,
    price: quote.price,
    total,
    realizedPnl: 0,
    executedAt: now
  };
  return { ...account, cash: money(account.cash - total), holdings, transactions: [transaction, ...account.transactions], updatedAt: now };
}

export function sellStock(account: PaperPortfolioAccount, ticker: string, price: number, requestedShares: number, now = new Date().toISOString()) {
  validAmount(requestedShares, "Shares");
  validAmount(price, "Price");
  const holding = account.holdings.find((item) => item.ticker === ticker);
  if (!holding) throw new Error(`${ticker} is not held in this portfolio`);
  const shares = quantity(requestedShares);
  if (shares <= 0) throw new Error("Shares must be at least 0.001");
  if (shares > holding.shares + 0.0001) throw new Error(`Only ${holding.shares} shares are available to sell`);

  const total = money(shares * price);
  const realizedPnl = money((price - holding.averageCost) * shares);
  const remaining = quantity(holding.shares - shares);
  const holdings = remaining <= 0
    ? account.holdings.filter((item) => item.ticker !== ticker)
    : account.holdings.map((item) => item.ticker === ticker ? { ...item, shares: remaining, currentPrice: price } : item);
  const transaction: PortfolioTransaction = {
    id: transactionId("SELL", ticker, now, account.transactions.length),
    side: "SELL",
    source: "user",
    ticker,
    company: holding.company,
    shares,
    price,
    total,
    realizedPnl,
    executedAt: now
  };
  return {
    ...account,
    cash: money(account.cash + total),
    realizedPnl: money(account.realizedPnl + realizedPnl),
    holdings,
    transactions: [transaction, ...account.transactions],
    updatedAt: now
  };
}

export function createAiAccount(picks: StockPick[], startingBalance: number, positionCount: number, now = new Date().toISOString(), cashReserve = 0.15) {
  const account = createCashAccount(startingBalance, now);
  const chosen = picks.slice(0, Math.max(1, positionCount));
  if (!chosen.length) return account;
  const scoreTotal = chosen.reduce((sum, pick) => sum + Math.max(pick.score - 60, 5), 0);
  const investable = startingBalance * (1 - cashReserve);
  return chosen.reduce((current, pick) => {
    const allocation = investable * (Math.max(pick.score - 60, 5) / scoreTotal);
    const shares = Math.floor((allocation / pick.price) * 1000) / 1000;
    return shares > 0 ? buyStock(current, pick, shares, now, "ai") : current;
  }, account);
}

export function runConvictionAgent(
  account: PaperPortfolioAccount,
  picks: StockPick[],
  targetPositions: number,
  cashReservePct: number,
  now = new Date().toISOString()
) {
  const chosen = picks.slice(0, Math.min(12, Math.max(1, Math.round(targetPositions))));
  if (!chosen.length) return { account, orders: 0, invested: 0 };
  const metrics = accountMetrics(account);
  const reserve = metrics.totalValue * Math.min(50, Math.max(0, cashReservePct)) / 100;
  const investable = Math.max(0, account.cash - reserve);
  if (investable < 1) return { account, orders: 0, invested: 0 };

  const scoreTotal = chosen.reduce((sum, pick) => sum + Math.max(pick.score - 60, 5), 0);
  let next = account;
  let orders = 0;
  let invested = 0;
  for (const pick of chosen) {
    const allocation = investable * (Math.max(pick.score - 60, 5) / scoreTotal);
    const available = Math.max(0, next.cash - reserve);
    const budget = Math.min(allocation, available);
    const shares = Math.floor((budget / pick.price) * 1000) / 1000;
    if (shares <= 0) continue;
    next = buyStock(next, pick, shares, now, "ai");
    invested = money(invested + shares * pick.price);
    orders += 1;
  }
  return { account: next, orders, invested };
}

export function accountMetrics(account: PaperPortfolioAccount, prices: Record<string, number> = {}): AccountMetrics {
  const securitiesValue = money(account.holdings.reduce((sum, holding) => sum + holding.shares * (prices[holding.ticker] || holding.currentPrice), 0));
  const costBasis = money(account.holdings.reduce((sum, holding) => sum + holding.shares * holding.averageCost, 0));
  const unrealizedPnl = money(securitiesValue - costBasis);
  const totalValue = money(account.cash + securitiesValue);
  return {
    securitiesValue,
    totalValue,
    costBasis,
    unrealizedPnl,
    realizedPnl: account.realizedPnl,
    totalPnl: money(unrealizedPnl + account.realizedPnl),
    cashWeight: totalValue > 0 ? Number(((account.cash / totalValue) * 100).toFixed(1)) : 0
  };
}

export function applyHoldingQuotes(account: PaperPortfolioAccount, quotes: PortfolioQuote[], generatedAt: string) {
  const prices = new Map(quotes.filter((quote) => Number.isFinite(quote.price) && quote.price > 0).map((quote) => [quote.ticker, quote.price]));
  let changed = account.quotesUpdatedAt !== generatedAt;
  const holdings = account.holdings.map((holding) => {
    const price = prices.get(holding.ticker);
    if (!price || price === holding.currentPrice) return holding;
    changed = true;
    return { ...holding, currentPrice: price };
  });
  return changed ? { ...account, holdings, quotesUpdatedAt: generatedAt } : account;
}

type LegacyHolding = { ticker?: unknown; company?: unknown; shares?: unknown; entryPrice?: unknown; currentPrice?: unknown; score?: unknown };

export function migratePaperAccount(raw: unknown, fallbackBalance = 100_000, now = new Date().toISOString()): PaperPortfolioAccount | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && (raw as { version?: unknown }).version === 2) {
    const account = raw as PaperPortfolioAccount;
    if (Array.isArray(account.holdings) && Array.isArray(account.transactions) && Number.isFinite(account.cash)) return account;
  }
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const legacy = (raw as LegacyHolding[]).flatMap((item) => {
    const ticker = typeof item.ticker === "string" ? item.ticker : "";
    const company = typeof item.company === "string" ? item.company : ticker;
    const shares = Number(item.shares);
    const averageCost = Number(item.entryPrice);
    const currentPrice = Number(item.currentPrice) || averageCost;
    const score = Number(item.score) || 0;
    if (!ticker || !Number.isFinite(shares) || shares <= 0 || !Number.isFinite(averageCost) || averageCost <= 0) return [];
    return [{ ticker, company, shares: quantity(shares), averageCost: cost(averageCost), currentPrice, score, openedAt: now } satisfies PortfolioHolding];
  });
  if (!legacy.length) return null;
  const invested = money(legacy.reduce((sum, holding) => sum + holding.shares * holding.averageCost, 0));
  const startingBalance = money(Math.max(fallbackBalance, invested));
  const transactions = legacy.map((holding, index): PortfolioTransaction => ({
    id: transactionId("OPENING", holding.ticker, now, index),
    side: "OPENING",
    ticker: holding.ticker,
    company: holding.company,
    shares: holding.shares,
    price: holding.averageCost,
    total: money(holding.shares * holding.averageCost),
    realizedPnl: 0,
    executedAt: now
  }));
  return { version: 2, startingBalance, cash: money(startingBalance - invested), realizedPnl: 0, holdings: legacy, transactions, createdAt: now, updatedAt: now };
}
