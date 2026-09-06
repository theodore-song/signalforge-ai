import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SOURCE_URL = "https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&download=true";
const OUTPUT_PATH = resolve(process.cwd(), "lib/universe.generated.json");

type NasdaqRow = {
  symbol: string;
  name: string;
  lastsale: string;
  marketCap: string;
  country: string;
  sector: string;
  industry: string;
};

type NasdaqPayload = { data?: { rows?: NasdaqRow[] } };

const excludedName = /\b(warrants?|units?|rights?|preferred|preference shares?|notes? due|bonds?|ETFs?|ETNs?|fund|acquisition corp(?:oration)?|depositary shares? each representing)\b/i;
const excludedIndustry = /blank checks?/i;

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function numberFrom(value: string) {
  return Number(String(value || "0").replace(/[$,%\s,]/g, ""));
}

function normalizeTicker(value: string) {
  return value.trim().toUpperCase().replaceAll("/", ".");
}

function cleanCompany(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+(Class [A-Z] )?Common Stock\s*$/i, "")
    .replace(/\s+Class [A-Z] (Ordinary )?Shares?\s*$/i, "")
    .replace(/\s+Ordinary Shares?\s*$/i, "")
    .replace(/\s+American Depositary Shares?.*$/i, "")
    .trim();
}

function isEligible(row: NasdaqRow) {
  const marketCap = numberFrom(row.marketCap);
  const price = numberFrom(row.lastsale);
  const ticker = normalizeTicker(row.symbol);
  if (!ticker || marketCap <= 0 || price <= 0) return false;
  if (ticker.includes("^") || ticker.includes("+") || ticker.length > 8) return false;
  if (excludedName.test(row.name) || excludedIndustry.test(row.industry || "")) return false;
  return true;
}

async function loadPayload(): Promise<NasdaqPayload> {
  const input = argument("--input");
  if (input) return JSON.parse(await readFile(resolve(input), "utf8")) as NasdaqPayload;
  const response = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SignalForge-Universe/1.0)",
      Accept: "application/json,text/plain,*/*"
    }
  });
  if (!response.ok) throw new Error(`Nasdaq screener returned ${response.status}`);
  return await response.json() as NasdaqPayload;
}

async function main() {
  const payload = await loadPayload();
  const rows = payload.data?.rows;
  if (!rows || rows.length < 2_000) throw new Error(`Expected at least 2,000 Nasdaq rows, received ${rows?.length || 0}`);

  const seen = new Set<string>();
  const securities = rows
    .filter(isEligible)
    .sort((a, b) => numberFrom(b.marketCap) - numberFrom(a.marketCap))
    .flatMap((row) => {
      const ticker = normalizeTicker(row.symbol);
      if (seen.has(ticker)) return [];
      seen.add(ticker);
      return [{
        ticker,
        company: cleanCompany(row.name),
        sector: row.sector?.trim() || "Unclassified",
        industry: row.industry?.trim() || "Unclassified",
        country: row.country?.trim() || "Unknown",
        marketCap: Math.round(numberFrom(row.marketCap)),
        basePrice: Number(numberFrom(row.lastsale).toFixed(4)),
        isAdr: /American Depositary|\bADS\b/i.test(row.name)
      }];
    })
    .slice(0, 2_000)
    .map((security, index) => ({ ...security, marketCapRank: index + 1 }));

  if (securities.length !== 2_000) throw new Error(`Eligibility rules produced ${securities.length} securities instead of 2,000`);
  if (new Set(securities.map((security) => security.ticker)).size !== 2_000) throw new Error("Universe contains duplicate tickers");
  if (securities.some((security, index) => index > 0 && security.marketCap > securities[index - 1].marketCap)) throw new Error("Universe is not sorted by market capitalization");

  const output = {
    asOf: new Date().toISOString().slice(0, 10),
    source: "Nasdaq Stock Screener",
    sourceUrl: "https://www.nasdaq.com/market-activity/stocks/screener",
    methodology: "Top 2,000 eligible US-listed common stocks and ADRs by market capitalization; funds, preferred shares, debt securities, warrants, units, rights, and blank-check companies excluded.",
    securities
  };

  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote ${securities.length} securities to ${OUTPUT_PATH}`);
}

void main();
