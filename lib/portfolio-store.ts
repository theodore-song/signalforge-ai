import { randomUUID } from "node:crypto";
import { applyHoldingQuotes, createCashAccount, runConvictionAgent } from "./portfolio";
import { readJson, redisCommand, writeJson } from "./redis";
import { runScan } from "./scanner";
import type { PaperPortfolioAccount, PortfolioAgentSettings, SavedPortfolio, ScanResult } from "./types";

const portfolioKey = (id: string) => `sf:portfolio:${id}`;
const userPortfolioKey = (userId: string) => `sf:user-portfolios:${userId}`;
const agentSetKey = "sf:agent-portfolios";

export const defaultAgentSettings = (): PortfolioAgentSettings => ({ enabled: false, targetPositions: 8, cashReservePct: 15 });

export async function listPortfolios(userId: string) {
  const ids = await redisCommand<string[]>("SMEMBERS", userPortfolioKey(userId));
  if (!ids.length) return [];
  const values = await redisCommand<Array<string | null>>("MGET", ...ids.map(portfolioKey));
  return values.flatMap((value) => {
    if (!value) return [];
    try {
      const portfolio = JSON.parse(value) as SavedPortfolio;
      return portfolio.userId === userId ? [portfolio] : [];
    } catch { return []; }
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getPortfolio(id: string) {
  return readJson<SavedPortfolio>(portfolioKey(id));
}

export async function createPortfolio(userId: string, name: string, startingBalance: number, importedAccount?: PaperPortfolioAccount) {
  const now = new Date().toISOString();
  const portfolio: SavedPortfolio = {
    id: randomUUID(),
    userId,
    name: cleanPortfolioName(name),
    account: importedAccount || createCashAccount(startingBalance, now),
    agent: defaultAgentSettings(),
    createdAt: now,
    updatedAt: now
  };
  await writeJson(portfolioKey(portfolio.id), portfolio);
  await redisCommand("SADD", userPortfolioKey(userId), portfolio.id);
  return portfolio;
}

export async function savePortfolio(userId: string, id: string, account: PaperPortfolioAccount, name?: string) {
  const current = await getPortfolio(id);
  if (!current || current.userId !== userId) return null;
  const currentChanged = new Date(current.account.updatedAt).getTime();
  const incomingChanged = new Date(account.updatedAt).getTime();
  const safeAccount = currentChanged > incomingChanged
    ? applyHoldingQuotes(current.account, account.holdings.map((holding) => ({ ticker: holding.ticker, price: holding.currentPrice, changePct: 0, source: "modeled" })), account.quotesUpdatedAt || current.account.quotesUpdatedAt || current.updatedAt)
    : account;
  const next: SavedPortfolio = { ...current, account: safeAccount, name: name ? cleanPortfolioName(name) : current.name, updatedAt: new Date().toISOString() };
  await writeJson(portfolioKey(id), next);
  return next;
}

export async function updateAgent(userId: string, id: string, changes: Partial<Pick<PortfolioAgentSettings, "enabled" | "targetPositions" | "cashReservePct">>) {
  const current = await getPortfolio(id);
  if (!current || current.userId !== userId) return null;
  const agent: PortfolioAgentSettings = {
    ...current.agent,
    enabled: typeof changes.enabled === "boolean" ? changes.enabled : current.agent.enabled,
    targetPositions: Math.min(12, Math.max(1, Math.round(changes.targetPositions ?? current.agent.targetPositions))),
    cashReservePct: Math.min(50, Math.max(0, Math.round(changes.cashReservePct ?? current.agent.cashReservePct)))
  };
  const next = { ...current, agent, updatedAt: new Date().toISOString() };
  await writeJson(portfolioKey(id), next);
  await redisCommand(agent.enabled ? "SADD" : "SREM", agentSetKey, id);
  return next;
}

export async function runPortfolioAgent(id: string, scan?: ScanResult, force = false) {
  const current = await getPortfolio(id);
  if (!current || (!force && !current.agent.enabled)) return null;
  const latest = scan || await runScan(false);
  if (!force && current.agent.lastRunScanId === latest.id) return current;
  const now = new Date().toISOString();
  const result = runConvictionAgent(current.account, latest.picks, current.agent.targetPositions, current.agent.cashReservePct, now);
  const summary = result.orders
    ? `Bought ${result.orders} highest-conviction ${result.orders === 1 ? "position" : "positions"} for $${result.invested.toLocaleString("en-US", { maximumFractionDigits: 2 })}.`
    : "No order was needed; the cash-reserve guardrail is already satisfied.";
  const next: SavedPortfolio = {
    ...current,
    account: result.account,
    agent: { ...current.agent, lastRunAt: now, lastRunScanId: latest.id, lastSummary: summary },
    updatedAt: now
  };
  await writeJson(portfolioKey(id), next);
  return next;
}

export async function runEnabledPortfolioAgents(scan: ScanResult) {
  if (!scan.market.isOpen) return { considered: 0, updated: 0 };
  const ids = await redisCommand<string[]>("SMEMBERS", agentSetKey);
  const outcomes = await Promise.allSettled(ids.slice(0, 100).map((id) => runPortfolioAgent(id, scan)));
  return { considered: ids.length, updated: outcomes.filter((outcome) => outcome.status === "fulfilled" && outcome.value).length };
}

function cleanPortfolioName(name: string) {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 48);
  return clean || "My Portfolio";
}
