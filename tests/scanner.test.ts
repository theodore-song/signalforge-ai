import assert from "node:assert/strict";
import test from "node:test";
import { getMarketStatus } from "../lib/market";
import { runScan } from "../lib/scanner";

test("market clock detects the regular US session", () => {
  const open = getMarketStatus(new Date("2026-09-08T15:00:00Z"));
  assert.equal(open.isOpen, true);
  assert.equal(open.session, "open");
});

test("scanner returns ranked, bounded and explainable picks", async () => {
  const scan = await runScan(false);
  assert.equal(scan.picks.length, 12);
  scan.picks.forEach((pick, index) => {
    assert.equal(pick.rank, index + 1);
    assert.ok(pick.score >= 0 && pick.score <= 100);
    assert.equal(pick.signals.length, 10);
    assert.ok(pick.risk.length > 20);
  });
  for (let index = 1; index < scan.picks.length; index += 1) {
    assert.ok(scan.picks[index - 1].score >= scan.picks[index].score);
  }
});
