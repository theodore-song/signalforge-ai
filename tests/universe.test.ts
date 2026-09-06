import assert from "node:assert/strict";
import test from "node:test";
import snapshot from "../lib/universe.generated.json";
import { UNIVERSE, UNIVERSE_AS_OF } from "../lib/universe";

test("security master contains exactly 2,000 unique market-cap-ranked stocks", () => {
  assert.equal(snapshot.securities.length, 2_000);
  assert.equal(UNIVERSE.length, 2_000);
  assert.match(UNIVERSE_AS_OF, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Set(UNIVERSE.map((stock) => stock.ticker)).size, 2_000);
  UNIVERSE.forEach((stock, index) => {
    assert.equal(stock.marketCapRank, index + 1);
    assert.ok(stock.marketCap > 0);
    assert.ok(stock.basePrice > 0);
    assert.ok(stock.company.length > 0);
    assert.ok(stock.sector.length > 0);
    if (index > 0) assert.ok(UNIVERSE[index - 1].marketCap >= stock.marketCap);
  });
});

test("security master excludes unsupported security types", () => {
  const excluded = /\b(warrants?|units?|rights?|preferred|preference shares?|notes? due|bonds?|ETFs?|ETNs?|fund|acquisition corp(?:oration)?|depositary shares? each representing)\b/i;
  UNIVERSE.forEach((stock) => {
    assert.doesNotMatch(stock.company, excluded);
    assert.doesNotMatch(stock.industry, /blank checks?/i);
    assert.doesNotMatch(stock.ticker, /[+^/]/);
  });
});
