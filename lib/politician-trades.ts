import snapshotJson from "./politician-purchases.generated.json";
import type { PoliticianDisclosureMeta, PoliticianPurchaseExample } from "./types";

type StoredPurchase = Omit<PoliticianPurchaseExample, "estimatedReturnPct" | "returnPriceMode">;
type PoliticianPurchaseSnapshot = PoliticianDisclosureMeta & {
  generatedAt: string;
  sourceDataUrl: string;
  methodology: string;
  purchases: Record<string, StoredPurchase[]>;
};

const snapshot = snapshotJson as PoliticianPurchaseSnapshot;

export const POLITICIAN_DISCLOSURE_META: PoliticianDisclosureMeta = {
  asOf: snapshot.asOf,
  source: snapshot.source,
  sourceUrl: snapshot.sourceUrl,
  coveredTickers: snapshot.coveredTickers
};

export function politicianPurchaseExamples(ticker: string, currentPrice: number, returnPriceMode: "live" | "modeled"): PoliticianPurchaseExample[] {
  return (snapshot.purchases[ticker] || []).map((purchase) => ({
    ...purchase,
    estimatedReturnPct: Number((((currentPrice / purchase.purchasePrice) - 1) * 100).toFixed(1)),
    returnPriceMode
  }));
}
