# SignalForge AI

SignalForge is a public, Vercel-ready stock research dashboard. It combines expert factor models, institutional and congressional disclosure signals, crowd attention, and two original strategies into an explainable ranking. It builds paper portfolios only; it never executes trades.

## What works out of the box

- Responsive public dashboard with a market-cap-ranked 2,000-stock US-listed universe
- Deterministic demonstration market data, clearly labelled as modeled
- Ten-factor explainable scoring and risk cases
- Search tab with six factor leaderboards, ticker/company search, sector filters, pagination, and five-stock comparison
- 13F stock details with separate STOCK Act politician purchase examples and estimated price returns
- Fresh scan endpoint with optional OpenAI investment-committee brief
- Secure email/password accounts with durable, cross-release portfolio storage
- Multiple named paper portfolios per account with cash, fractional orders, cost basis, P&L, and trade history
- Opt-in AI conviction agent that buys the latest composite leaders while preserving a configurable cash reserve
- Automatic browser refresh every 60 seconds during the regular US session
- Vercel Cron endpoint plus optional Upstash/Vercel KV persistence
- Optional live Alpaca IEX snapshots and external alternative-data feed adapters

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Data connections

Set `ALPACA_API_KEY` and `ALPACA_API_SECRET` for live IEX snapshots. Without them, the site intentionally runs in demonstration mode.

The checked-in security master is generated from Nasdaq's public stock screener and contains the 2,000 largest eligible US-listed common stocks and ADRs by market capitalization. Funds, preferred shares, debt securities, warrants, units, rights, and blank-check companies are excluded. Run `npm run refresh:universe` to refresh it; a monthly GitHub workflow validates and commits membership changes automatically.

The 13F leaderboard remains an institutional-ownership factor. Its stock detail panel separately shows up to three recent politician purchase examples compiled from public STOCK Act disclosures. Run `npm run refresh:politicians` to rebuild the checked-in snapshot; the monthly research-data workflow refreshes and validates it automatically. Each displayed return is the simple stock-price change from the transaction-date reference price to the current displayed quote. It is not a verified portfolio profit and excludes dividends, position sizing, taxes, options terms, and later sales. House and Senate filing portals are linked beside every example.

Optional disclosure and sentiment endpoints must return a JSON array:

```json
[
  { "ticker": "MSFT", "score": 84 },
  { "ticker": "NVDA", "score": 91 }
]
```

Connect them with `POLITICIAN_TRADES_URL`, `INSTITUTIONAL_HOLDINGS_URL`, and `CROWD_SENTIMENT_URL`. Scores must be normalized from 0–100. Filing/disclosure adapters should account for reporting delay; they are research inputs, not real-time trade alerts.

Set `OPENAI_API_KEY` to enable the server-side investment committee brief. `OPENAI_MODEL` defaults to `gpt-5.4-mini`. The API key is never exposed to the browser.

## Scheduled scans

`vercel.json` invokes `/api/cron` once each weekday during the US session, which is compatible with Vercel Hobby. Vercel sends the production cron authorization header when `CRON_SECRET` is configured. Add `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or the current `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` names) to persist scheduled snapshots, user accounts, sessions, portfolios, and AI-agent settings. Without Redis, market research remains available but account creation is disabled and guest portfolios stay local.

Pro and Enterprise projects can change the schedule to `*/10 13-21 * * 1-5` for ten-minute weekday scans. The UTC window is intentionally broad because US daylight-saving time changes the UTC market hours. The server route and open dashboards can still refresh on demand regardless of plan.

Cron availability and frequency depend on your Vercel plan. The browser-side refresh keeps an open dashboard current regardless.

## Screener APIs

- `GET /api/stocks?factor=quality&q=apple&sector=Technology&page=1&limit=50` returns a paginated category leaderboard.
- `GET /api/stocks/compare?symbols=AAPL,MSFT,NVDA` returns two to five stocks with all six searchable factors and category winners.

Searchable factors are `quality`, `earnings`, `momentum`, `billionaire`, `quietCompounder`, and `value`. Every stock in the 2,000-name research universe is eligible for paper trading; the Scanner remains the focused 12-stock composite shortlist.

## Paper brokerage

Visitors can create a cash-only simulated account or generate an AI starter portfolio that retains a 15% cash reserve. Signed-in users can create and switch between multiple named portfolios; all balances, positions, trade history, and agent settings are stored server-side and survive deployments. Existing browser portfolios are offered for import when a user registers.

The conviction agent is paper-only. A user can run it once or enable scheduled auto-investing for a saved portfolio. It buys the current highest composite-conviction ideas, uses score-weighted sizing, honors the selected position count and cash reserve, and never sells, borrows, or connects to a brokerage. AI-originated orders are identified separately in account activity.

Buys support fractional shares across the complete 2,000-stock universe: open any company from any Search category to prefill its trade ticket. Repeat buys update weighted average cost; sells update cash and realized P&L; complete trade history is retained. Existing position-only portfolios are migrated automatically.

Every open position is repriced through `GET /api/quotes?symbols=AAPL,MSFT` on load and once per minute while the site remains open. The endpoint covers up to 50 held tickers, shares the universe engine's five-minute market bucket, and reports whether each quote is live via Alpaca or explicitly modeled. Last successful quote freshness is shown above the holdings table and persisted with the account.

## Important limitations

- This is educational software, not investment advice or a promise of performance.
- “Best” means highest score under the documented model, not guaranteed future return.
- Public filings are delayed; congressional disclosures and 13F filings can be weeks old.
- Politician returns are price-return estimates, not proof that a filer still owns the security or realized the displayed gain or loss.
- Modeled/demo signals are synthetic and must not be used for real-money decisions.
- US market session detection does not independently model exchange holidays; the connected market-data provider should be the production source of truth.
- A production deployment should add a licensed fundamentals provider, data-quality monitoring, a complete security master, point-in-time backtests, and authenticated administrative scan controls.

## Deployment

Import the repository into Vercel or run:

```bash
npx vercel
npx vercel --prod
```

Add the environment variables from `.env.example` in the Vercel project settings.
