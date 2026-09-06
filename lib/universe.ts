export type UniverseStock = {
  ticker: string;
  company: string;
  sector: string;
  basePrice: number;
  quality: number;
  momentum: number;
  value: number;
  earnings: number;
  congress: number;
  billionaire: number;
  crowd: number;
  insider: number;
  risk: string;
};

export const UNIVERSE: UniverseStock[] = [
  { ticker: "NVDA", company: "NVIDIA", sector: "Semiconductors", basePrice: 174.32, quality: 94, momentum: 91, value: 55, earnings: 96, congress: 72, billionaire: 81, crowd: 88, insider: 57, risk: "Premium valuation leaves little room for an AI-spending slowdown." },
  { ticker: "MSFT", company: "Microsoft", sector: "Software", basePrice: 532.14, quality: 96, momentum: 76, value: 61, earnings: 89, congress: 79, billionaire: 87, crowd: 74, insider: 63, risk: "Cloud growth and AI monetization must offset rising infrastructure spend." },
  { ticker: "GOOGL", company: "Alphabet", sector: "Interactive Media", basePrice: 226.83, quality: 93, momentum: 80, value: 78, earnings: 91, congress: 68, billionaire: 85, crowd: 71, insider: 59, risk: "Search disruption and regulatory remedies could pressure the multiple." },
  { ticker: "AMZN", company: "Amazon", sector: "Broadline Retail", basePrice: 241.17, quality: 88, momentum: 83, value: 69, earnings: 90, congress: 74, billionaire: 82, crowd: 84, insider: 55, risk: "Retail margins remain sensitive to logistics costs and consumer demand." },
  { ticker: "META", company: "Meta Platforms", sector: "Interactive Media", basePrice: 742.21, quality: 92, momentum: 87, value: 75, earnings: 93, congress: 66, billionaire: 83, crowd: 78, insider: 60, risk: "Heavy AI capex and platform regulation could compress free cash flow." },
  { ticker: "AVGO", company: "Broadcom", sector: "Semiconductors", basePrice: 356.44, quality: 90, momentum: 89, value: 58, earnings: 92, congress: 70, billionaire: 78, crowd: 76, insider: 58, risk: "Customer concentration and acquisition integration raise execution risk." },
  { ticker: "LLY", company: "Eli Lilly", sector: "Pharmaceuticals", basePrice: 812.55, quality: 91, momentum: 73, value: 42, earnings: 90, congress: 64, billionaire: 73, crowd: 69, insider: 67, risk: "Obesity-drug expectations are high and manufacturing scale-up is critical." },
  { ticker: "JPM", company: "JPMorgan Chase", sector: "Banks", basePrice: 302.71, quality: 91, momentum: 77, value: 76, earnings: 84, congress: 71, billionaire: 86, crowd: 58, insider: 65, risk: "Credit normalization and rate cuts may pressure net interest income." },
  { ticker: "COST", company: "Costco", sector: "Consumer Staples", basePrice: 986.39, quality: 95, momentum: 70, value: 39, earnings: 83, congress: 61, billionaire: 76, crowd: 66, insider: 62, risk: "A rich multiple magnifies any membership or traffic disappointment." },
  { ticker: "V", company: "Visa", sector: "Financial Services", basePrice: 382.11, quality: 97, momentum: 71, value: 66, earnings: 86, congress: 69, billionaire: 89, crowd: 55, insider: 64, risk: "Regulation and alternative payment rails may erode transaction economics." },
  { ticker: "UBER", company: "Uber", sector: "Ground Transportation", basePrice: 96.02, quality: 76, momentum: 84, value: 73, earnings: 87, congress: 62, billionaire: 75, crowd: 82, insider: 71, risk: "Autonomous vehicles and driver classification could reshape margins." },
  { ticker: "PLTR", company: "Palantir", sector: "Software", basePrice: 171.48, quality: 82, momentum: 95, value: 31, earnings: 88, congress: 81, billionaire: 69, crowd: 94, insider: 48, risk: "Extreme expectations and concentrated sentiment create sharp downside risk." },
  { ticker: "GE", company: "GE Aerospace", sector: "Aerospace", basePrice: 311.65, quality: 86, momentum: 86, value: 64, earnings: 85, congress: 76, billionaire: 77, crowd: 61, insider: 68, risk: "Supply-chain bottlenecks can delay engine deliveries and cash conversion." },
  { ticker: "ETN", company: "Eaton", sector: "Electrical Equipment", basePrice: 386.72, quality: 89, momentum: 79, value: 56, earnings: 86, congress: 73, billionaire: 78, crowd: 57, insider: 69, risk: "Data-center demand is cyclical and currently priced for durable strength." },
  { ticker: "CEG", company: "Constellation Energy", sector: "Utilities", basePrice: 338.24, quality: 82, momentum: 88, value: 60, earnings: 81, congress: 78, billionaire: 74, crowd: 75, insider: 66, risk: "Power prices, regulation, and long project timelines drive volatility." },
  { ticker: "TSM", company: "Taiwan Semiconductor", sector: "Semiconductors", basePrice: 281.63, quality: 95, momentum: 85, value: 72, earnings: 94, congress: 58, billionaire: 84, crowd: 79, insider: 56, risk: "Geopolitical concentration remains the dominant tail risk." },
  { ticker: "BRK.B", company: "Berkshire Hathaway", sector: "Diversified Financials", basePrice: 526.10, quality: 94, momentum: 63, value: 79, earnings: 75, congress: 60, billionaire: 98, crowd: 45, insider: 74, risk: "Scale limits opportunity and succession remains a long-term uncertainty." },
  { ticker: "WMT", company: "Walmart", sector: "Consumer Staples", basePrice: 121.48, quality: 89, momentum: 75, value: 62, earnings: 82, congress: 67, billionaire: 79, crowd: 62, insider: 70, risk: "Wage pressure and price competition can narrow already-thin margins." },
  { ticker: "CRWD", company: "CrowdStrike", sector: "Cybersecurity", basePrice: 512.80, quality: 84, momentum: 82, value: 43, earnings: 84, congress: 65, billionaire: 72, crowd: 81, insider: 52, risk: "Valuation and platform execution leave little tolerance for churn." },
  { ticker: "XOM", company: "Exxon Mobil", sector: "Energy", basePrice: 118.37, quality: 83, momentum: 57, value: 86, earnings: 68, congress: 77, billionaire: 71, crowd: 48, insider: 72, risk: "Commodity prices and energy-transition policy dominate earnings." }
];
