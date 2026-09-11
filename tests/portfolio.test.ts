import assert from "node:assert/strict";
import test from "node:test";
import { accountMetrics, buyStock, createAiAccount, createCashAccount, migratePaperAccount, sellStock } from "../lib/portfolio";
import type { StockPick } from "../lib/types";

function pick(ticker: string, price: number, score: number): StockPick {
  return {
    rank: 1,
    ticker,
    company: `${ticker} Company`,
    sector: "Technology",
    price,
    changePct: 1,
    score,
    confidence: "High",
    horizon: "6–18 months",
    thesis: "Test thesis",
    risk: "Test risk",
    suggestedWeight: 10,
    signals: [],
    sparkline: []
  };
}

test("cash accounts and AI starter portfolios retain real buying power", () => {
  const now = "2026-09-11T12:00:00.000Z";
  const cash = createCashAccount(100_000, now);
  assert.equal(cash.cash, 100_000);
  assert.equal(cash.holdings.length, 0);

  const ai = createAiAccount([pick("AAA", 100, 90), pick("BBB", 50, 80)], 100_000, 2, now);
  assert.equal(ai.holdings.length, 2);
  assert.ok(ai.cash >= 14_999 && ai.cash <= 15_001);
  assert.equal(ai.transactions.length, 2);
  assert.ok(ai.transactions.every((transaction) => transaction.side === "BUY"));
});

test("repeat buys update weighted cost basis without replacing a position", () => {
  const first = buyStock(createCashAccount(10_000), pick("AAA", 100, 80), 10, "2026-09-11T12:00:00.000Z");
  const second = buyStock(first, pick("AAA", 120, 82), 5, "2026-09-11T13:00:00.000Z");
  assert.equal(second.holdings.length, 1);
  assert.equal(second.holdings[0].shares, 15);
  assert.equal(second.holdings[0].averageCost, 106.6667);
  assert.equal(second.cash, 8_400);
  assert.equal(second.transactions.length, 2);
});

test("partial and full sells release cash and preserve realized trade history", () => {
  const bought = buyStock(createCashAccount(10_000), pick("AAA", 100, 80), 10, "2026-09-11T12:00:00.000Z");
  const partial = sellStock(bought, "AAA", 120, 4, "2026-09-11T13:00:00.000Z");
  assert.equal(partial.holdings[0].shares, 6);
  assert.equal(partial.cash, 9_480);
  assert.equal(partial.realizedPnl, 80);

  const closed = sellStock(partial, "AAA", 90, 6, "2026-09-11T14:00:00.000Z");
  assert.equal(closed.holdings.length, 0);
  assert.equal(closed.cash, 10_020);
  assert.equal(closed.realizedPnl, 20);
  assert.equal(closed.transactions[0].side, "SELL");
  assert.equal(closed.transactions.length, 3);
});

test("orders enforce cash and owned-share boundaries", () => {
  const account = createCashAccount(1_000);
  assert.throws(() => buyStock(account, pick("AAA", 100, 80), 11), /available cash/);
  const bought = buyStock(account, pick("AAA", 100, 80), 5);
  assert.throws(() => sellStock(bought, "AAA", 100, 6), /available to sell/);
  assert.throws(() => sellStock(bought, "BBB", 100, 1), /not held/);
});

test("account metrics include cash, market value, and realized plus unrealized P&L", () => {
  const bought = buyStock(createCashAccount(10_000), pick("AAA", 100, 80), 10);
  const sold = sellStock(bought, "AAA", 110, 2);
  const metrics = accountMetrics(sold, { AAA: 120 });
  assert.equal(metrics.securitiesValue, 960);
  assert.equal(metrics.costBasis, 800);
  assert.equal(metrics.unrealizedPnl, 160);
  assert.equal(metrics.realizedPnl, 20);
  assert.equal(metrics.totalPnl, 180);
  assert.equal(metrics.totalValue, 10_180);
});

test("legacy position arrays migrate without losing holdings", () => {
  const migrated = migratePaperAccount([{ ticker: "AAA", company: "AAA Company", shares: 10, entryPrice: 100, currentPrice: 120, score: 80 }], 10_000, "2026-09-11T12:00:00.000Z");
  assert.ok(migrated);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.cash, 9_000);
  assert.equal(migrated.holdings[0].averageCost, 100);
  assert.equal(migrated.transactions[0].side, "OPENING");
});
