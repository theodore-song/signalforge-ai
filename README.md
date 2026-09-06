# SignalForge AI

SignalForge is a public, Vercel-ready stock research dashboard. It combines expert factor models, institutional and congressional disclosure signals, crowd attention, and two original strategies into an explainable ranking. It builds paper portfolios only; it never executes trades.

## What works out of the box

- Responsive public dashboard with a 20-stock liquid US universe
- Deterministic demonstration market data, clearly labelled as modeled
- Ten-factor explainable scoring and risk cases
- Fresh scan endpoint with optional OpenAI investment-committee brief
- AI-suggested-only paper portfolio stored in the visitor's browser
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

`vercel.json` invokes `/api/cron` once each weekday during the US session, which is compatible with Vercel Hobby. Vercel sends the production cron authorization header when `CRON_SECRET` is configured. Add `KV_REST_API_URL` and `KV_REST_API_TOKEN` to persist scheduled snapshots. Without KV, visitors still receive a current on-demand scan.

Pro and Enterprise projects can change the schedule to `*/10 13-21 * * 1-5` for ten-minute weekday scans. The UTC window is intentionally broad because US daylight-saving time changes the UTC market hours. The server route and open dashboards can still refresh on demand regardless of plan.

Cron availability and frequency depend on your Vercel plan. The browser-side refresh keeps an open dashboard current regardless.

## Important limitations

- This is educational software, not investment advice or a promise of performance.
- “Best” means highest score under the documented model, not guaranteed future return.
- Public filings are delayed; congressional disclosures and 13F filings can be weeks old.
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
