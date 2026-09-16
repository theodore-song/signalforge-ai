import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import universeSnapshot from "../lib/universe.generated.json";

const SOURCE_URL = "https://raw.githubusercontent.com/Seagull-Technologies/PoliticianTradesDataset/main/trades.json";
const SOURCE_PAGE = "https://github.com/Seagull-Technologies/PoliticianTradesDataset";
const OUTPUT_PATH = resolve(process.cwd(), "lib/politician-purchases.generated.json");
const MAX_EXAMPLES_PER_TICKER = 3;

type SourceTrade = {
  name?: string;
  party?: string;
  chamber?: string;
  state_abbreviation?: string;
  ticker?: string;
  trade_date?: string;
  days_until_disclosure?: number;
  trade_type?: string;
  trade_amount?: string;
  value_at_purchase?: string;
};

type Purchase = {
  politician: string;
  party: string;
  chamber: "House" | "Senate";
  state: string;
  tradeDate: string;
  amountRange: string;
  purchasePrice: number;
  disclosedAfterDays: number | null;
};

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function normalizeTicker(value: string) {
  return value.trim().toUpperCase().replace(/:US$/, "").replaceAll("/", ".");
}

function purchasePrice(value: string) {
  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isoDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString().slice(0, 10);
}

async function loadTrades(): Promise<SourceTrade[]> {
  const input = argument("--input");
  if (input) {
    const payload = JSON.parse(await readFile(resolve(input), "utf8")) as SourceTrade[] | SourceTrade[][];
    return payload.flat();
  }
  const response = await fetch(SOURCE_URL, { headers: { "User-Agent": "SignalForge-Disclosure-Indexer/1.0" } });
  if (!response.ok) throw new Error(`Politician trades dataset returned ${response.status}`);
  const payload = await response.json() as SourceTrade[] | SourceTrade[][];
  return payload.flat();
}

async function main() {
  const trades = await loadTrades();
  if (trades.length < 10_000) throw new Error(`Expected a substantial disclosure dataset, received ${trades.length} rows`);

  const universe = new Set(universeSnapshot.securities.map((security) => security.ticker));
  const seen = new Set<string>();
  const purchases: Record<string, Purchase[]> = {};
  let latestTradeDate = "";

  for (const trade of trades) {
    if (trade.trade_type?.toLowerCase() !== "buy" || !trade.ticker || !trade.trade_date || !trade.value_at_purchase) continue;
    const ticker = normalizeTicker(trade.ticker);
    const tradeDate = isoDate(trade.trade_date);
    const price = purchasePrice(trade.value_at_purchase);
    const chamber = trade.chamber === "Senate" ? "Senate" : trade.chamber === "House" ? "House" : null;
    if (!universe.has(ticker) || !tradeDate || !price || !chamber || !trade.name) continue;

    const amountRange = trade.trade_amount?.trim() || "Undisclosed range";
    const duplicateKey = [ticker, trade.name, tradeDate, amountRange, price].join("|");
    if (seen.has(duplicateKey)) continue;
    seen.add(duplicateKey);
    latestTradeDate = tradeDate > latestTradeDate ? tradeDate : latestTradeDate;
    (purchases[ticker] ||= []).push({
      politician: trade.name.trim(),
      party: trade.party?.trim() || "Unknown",
      chamber,
      state: trade.state_abbreviation?.trim() || "—",
      tradeDate,
      amountRange,
      purchasePrice: Number(price.toFixed(2)),
      disclosedAfterDays: Number.isFinite(trade.days_until_disclosure) ? Number(trade.days_until_disclosure) : null
    });
  }

  for (const ticker of Object.keys(purchases)) {
    purchases[ticker] = purchases[ticker]
      .sort((a, b) => b.tradeDate.localeCompare(a.tradeDate) || a.politician.localeCompare(b.politician))
      .slice(0, MAX_EXAMPLES_PER_TICKER);
  }

  const coveredTickers = Object.keys(purchases).length;
  const purchaseCount = Object.values(purchases).reduce((sum, items) => sum + items.length, 0);
  if (coveredTickers < 500 || purchaseCount < 1_000) {
    throw new Error(`Disclosure validation failed: ${coveredTickers} tickers and ${purchaseCount} retained purchases`);
  }

  const output = {
    asOf: latestTradeDate,
    generatedAt: new Date().toISOString(),
    source: "Politician Trades Dataset",
    sourceUrl: SOURCE_PAGE,
    sourceDataUrl: SOURCE_URL,
    methodology: "Up to three most recent unique reported purchases per ticker, limited to the SignalForge universe and rows with a transaction-date reference price.",
    coveredTickers,
    purchases
  };

  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote ${purchaseCount} purchase examples across ${coveredTickers} tickers to ${OUTPUT_PATH}`);
}

void main();
