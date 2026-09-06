import { UNIVERSE } from "./universe";

export type Quote = { price: number; changePct: number; source: "alpaca" | "modeled" };

function seeded(ticker: string, bucket: number, salt: number) {
  let hash = 2166136261;
  for (const char of `${ticker}-${bucket}-${salt}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

function modeledQuotes(bucket: number): Record<string, Quote> {
  return Object.fromEntries(
    UNIVERSE.map((stock) => {
      const drift = (seeded(stock.ticker, bucket, 1) - 0.48) * 0.035;
      const changePct = (seeded(stock.ticker, bucket, 2) - 0.47) * 5.4;
      return [stock.ticker, { price: Number((stock.basePrice * (1 + drift)).toFixed(2)), changePct: Number(changePct.toFixed(2)), source: "modeled" as const }];
    })
  );
}

async function alpacaQuotes(): Promise<Record<string, Quote> | null> {
  const key = process.env.ALPACA_API_KEY;
  const secret = process.env.ALPACA_API_SECRET;
  if (!key || !secret) return null;
  const symbols = UNIVERSE.map((stock) => stock.ticker.replace(".", "")).join(",");
  try {
    const response = await fetch(`https://data.alpaca.markets/v2/stocks/snapshots?symbols=${symbols}&feed=iex`, {
      headers: { "APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret },
      next: { revalidate: 60 }
    });
    if (!response.ok) return null;
    const json = await response.json() as { snapshots?: Record<string, { latestTrade?: { p: number }; dailyBar?: { c: number }; prevDailyBar?: { c: number } }> };
    const result: Record<string, Quote> = {};
    for (const stock of UNIVERSE) {
      const rawTicker = stock.ticker.replace(".", "");
      const snapshot = json.snapshots?.[rawTicker];
      const price = snapshot?.latestTrade?.p || snapshot?.dailyBar?.c;
      const previous = snapshot?.prevDailyBar?.c;
      if (price && previous) result[stock.ticker] = { price, changePct: ((price / previous) - 1) * 100, source: "alpaca" };
    }
    return Object.keys(result).length >= Math.floor(UNIVERSE.length / 2) ? result : null;
  } catch {
    return null;
  }
}

export async function getQuotes(bucket: number) {
  return (await alpacaQuotes()) || modeledQuotes(bucket);
}

export function makeSparkline(ticker: string, price: number, bucket: number) {
  const points: number[] = [];
  let current = price * (0.97 + seeded(ticker, bucket, 8) * 0.03);
  for (let index = 0; index < 18; index += 1) {
    current *= 1 + (seeded(ticker, bucket - 18 + index, 9) - 0.47) * 0.012;
    points.push(Number(current.toFixed(2)));
  }
  points[points.length - 1] = price;
  return points;
}

type FeedItem = { ticker: string; score: number };

export async function getExternalScores(url?: string): Promise<Record<string, number> | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { next: { revalidate: 300 } });
    if (!response.ok) return null;
    const items = await response.json() as FeedItem[];
    return Object.fromEntries(items.filter((item) => item.ticker && Number.isFinite(item.score)).map((item) => [item.ticker.toUpperCase(), Math.max(0, Math.min(100, item.score))]));
  } catch {
    return null;
  }
}
