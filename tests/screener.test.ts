import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET as getStocks } from "../app/api/stocks/route";
import { GET as compareRoute } from "../app/api/stocks/compare/route";
import { compareStocks, queryScreener } from "../lib/screener";
import { runScan } from "../lib/scanner";

test("leaderboard sorts globally by factor, composite, then market-cap rank", async () => {
  const result = await queryScreener({ factor: "quality", limit: 100 });
  assert.equal(result.universeSize, 2_000);
  assert.equal(result.total, 2_000);
  assert.equal(result.rows.length, 100);
  result.rows.forEach((row, index) => assert.equal(row.categoryRank, index + 1));
  for (let index = 1; index < result.rows.length; index += 1) {
    const previous = result.rows[index - 1];
    const current = result.rows[index];
    assert.ok(previous.selectedScore > current.selectedScore
      || (previous.selectedScore === current.selectedScore && previous.compositeScore > current.compositeScore)
      || (previous.selectedScore === current.selectedScore && previous.compositeScore === current.compositeScore && previous.marketCapRank < current.marketCapRank));
  }
});

test("search, sector filters, and pagination preserve global category rank", async () => {
  const apple = await queryScreener({ factor: "earnings", query: "apple" });
  assert.ok(apple.rows.some((row) => row.ticker === "AAPL"));
  const technology = await queryScreener({ factor: "momentum", sector: "Technology", page: 2, limit: 25 });
  assert.equal(technology.page, 2);
  assert.ok(technology.rows.every((row) => row.sector === "Technology"));
  assert.ok(technology.rows.every((row) => row.categoryRank > 0));
});

test("comparison preserves order, reports unknowns, and identifies winners", async () => {
  const comparison = await compareStocks(["MSFT", "NOTREAL", "AAPL"]);
  assert.deepEqual(comparison.items.map((item) => item.ticker), ["MSFT", "NOTREAL", "AAPL"]);
  assert.equal(comparison.items[0].found, true);
  assert.equal(comparison.items[1].found, false);
  assert.equal(comparison.items[2].found, true);
  Object.values(comparison.winners).forEach((winners) => assert.ok(winners.length >= 1));
});

test("only the 12 composite scanner picks are portfolio eligible", async () => {
  const scan = await runScan(false);
  const comparison = await compareStocks(scan.picks.slice(0, 5).map((pick) => pick.ticker));
  comparison.items.forEach((item) => assert.ok(item.found && item.portfolioEligible));
  assert.equal(scan.picks.length, 12);
});

test("stock routes reject malformed filters and comparisons", async () => {
  const invalidFactor = await getStocks(new NextRequest("http://localhost/api/stocks?factor=magic"));
  assert.equal(invalidFactor.status, 400);
  const invalidPage = await getStocks(new NextRequest("http://localhost/api/stocks?page=zero"));
  assert.equal(invalidPage.status, 400);
  const tooMany = await compareRoute(new NextRequest("http://localhost/api/stocks/compare?symbols=AAPL,MSFT,NVDA,GOOG,AMZN,META"));
  assert.equal(tooMany.status, 400);
  const duplicate = await compareRoute(new NextRequest("http://localhost/api/stocks/compare?symbols=AAPL,AAPL"));
  assert.equal(duplicate.status, 400);
});
