"use client";

import { useEffect, useMemo, useState } from "react";
import { accountMetrics, buyStock, sellStock } from "@/lib/portfolio";
import type { PaperPortfolioAccount, StockPick } from "@/lib/types";
import { ArrowIcon, PlusIcon, RadarIcon, ShieldIcon } from "./Icons";

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function shares(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value);
}

function signedMoney(value: number) {
  return `${value >= 0 ? "+" : ""}${money(value)}`;
}

type Props = {
  account: PaperPortfolioAccount | null;
  eligiblePicks: StockPick[];
  requestedTicker: string | null;
  defaultCapital: number;
  onCreateCashAccount: (capital: number) => void;
  onChange: (account: PaperPortfolioAccount) => void;
  onOpenScanner: () => void;
  onToast: (message: string) => void;
};

export default function PaperPortfolio({ account, eligiblePicks, requestedTicker, defaultCapital, onCreateCashAccount, onChange, onOpenScanner, onToast }: Props) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [symbol, setSymbol] = useState(requestedTicker || eligiblePicks[0]?.ticker || "");
  const [quantity, setQuantity] = useState("");
  const [openingCash, setOpeningCash] = useState(defaultCapital);

  const priceMap = useMemo(() => Object.fromEntries(eligiblePicks.map((pick) => [pick.ticker, pick.price])), [eligiblePicks]);
  const metrics = useMemo(() => account ? accountMetrics(account, priceMap) : null, [account, priceMap]);
  const held = account?.holdings.find((holding) => holding.ticker === symbol);
  const pick = eligiblePicks.find((candidate) => candidate.ticker === symbol);
  const quotePrice = pick?.price || held?.currentPrice || 0;
  const numericQuantity = Number(quantity);
  const notional = Number.isFinite(numericQuantity) ? numericQuantity * quotePrice : 0;
  const options = side === "buy" ? eligiblePicks : account?.holdings || [];

  useEffect(() => {
    if (!requestedTicker) return;
    setSide("buy");
    setSymbol(requestedTicker);
    setQuantity("");
  }, [requestedTicker]);

  useEffect(() => {
    if (options.some((option) => option.ticker === symbol)) return;
    setSymbol(options[0]?.ticker || "");
    setQuantity("");
  }, [options, side, symbol]);

  function changeSide(next: "buy" | "sell") {
    setSide(next);
    setQuantity("");
    const nextOptions = next === "buy" ? eligiblePicks : account?.holdings || [];
    if (!nextOptions.some((option) => option.ticker === symbol)) setSymbol(nextOptions[0]?.ticker || "");
  }

  function useMaximum() {
    if (!account || !quotePrice) return;
    const maximum = side === "buy"
      ? Math.floor((account.cash / quotePrice) * 1000) / 1000
      : held?.shares || 0;
    setQuantity(maximum ? String(maximum) : "");
  }

  function executeOrder() {
    if (!account || !symbol || !numericQuantity) return;
    try {
      const next = side === "buy"
        ? buyStock(account, pick!, numericQuantity)
        : sellStock(account, symbol, quotePrice, numericQuantity);
      onChange(next);
      onToast(`${side === "buy" ? "Bought" : "Sold"} ${shares(numericQuantity)} ${symbol} at ${money(quotePrice)}`);
      setQuantity("");
    } catch (reason) {
      onToast(reason instanceof Error ? reason.message : "The paper order could not be completed");
    }
  }

  function tradeHolding(ticker: string) {
    setSide("sell");
    setSymbol(ticker);
    setQuantity("");
    document.querySelector(".order-ticket")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (!account) return <section className="shell page-section portfolio-page">
    <div className="page-hero"><span className="kicker">PAPER BROKERAGE</span><h1>Create your simulated account.</h1><p>Choose an opening cash balance, then decide when and how much to buy. Orders are local simulations and never reach a broker.</p></div>
    <div className="account-onboarding">
      <div className="account-onboarding-copy"><span className="onboarding-mark"><RadarIcon size={30}/></span><div><h2>Start with cash, not forced positions.</h2><p>Your account will track buying power, cost basis, realized gains, open-position performance, and every paper order.</p></div></div>
      <label>OPENING CASH BALANCE<span><b>$</b><input aria-label="Opening cash balance" type="number" min="1000" step="1000" value={openingCash} onChange={(event) => setOpeningCash(Math.max(1000, Number(event.target.value)))}/><small>USD</small></span></label>
      <button className="primary" onClick={() => onCreateCashAccount(openingCash)}><PlusIcon size={16}/> Create paper account</button>
    </div>
    <div className="portfolio-guardrail"><ShieldIcon size={18}/><span>Only stocks in the latest AI Scanner shortlist can be purchased. Any position you already own can always be sold, even if it later leaves the shortlist.</span></div>
  </section>;

  return <section className="shell page-section portfolio-page">
    <div className="page-hero portfolio-hero"><div><span className="kicker">PAPER BROKERAGE</span><h1>Your simulated portfolio.</h1><p>Cash, positions, cost basis, and an immutable trade history—controlled by you.</p></div><div className="account-id"><small>ACCOUNT</small><strong>SF-{account.createdAt.slice(2, 10).replaceAll("-", "")}</strong><span>Paper · USD</span></div></div>

    <div className="portfolio-summary brokerage-summary">
      <div><small>TOTAL VALUE</small><strong>{money(metrics!.totalValue)}</strong><span>Cash + securities</span></div>
      <div><small>CASH AVAILABLE</small><strong>{money(account.cash)}</strong><span>{metrics!.cashWeight}% uninvested</span></div>
      <div><small>SECURITIES</small><strong>{money(metrics!.securitiesValue)}</strong><span>{account.holdings.length} open positions</span></div>
      <div><small>UNREALIZED P&amp;L</small><strong className={metrics!.unrealizedPnl >= 0 ? "positive" : "negative"}>{signedMoney(metrics!.unrealizedPnl)}</strong><span>Open positions</span></div>
      <div><small>REALIZED P&amp;L</small><strong className={metrics!.realizedPnl >= 0 ? "positive" : "negative"}>{signedMoney(metrics!.realizedPnl)}</strong><span>Closed shares</span></div>
    </div>

    <div className="allocation-strip"><span style={{ width: `${100 - metrics!.cashWeight}%` }}/><div><b>{(100 - metrics!.cashWeight).toFixed(1)}% invested</b><small>{metrics!.cashWeight}% held in cash</small></div></div>

    <div className="brokerage-layout">
      <div className="positions-card">
        <div className="brokerage-card-heading"><div><span className="kicker">OPEN POSITIONS</span><h2>Holdings</h2></div><span>{account.holdings.length} positions</span></div>
        {account.holdings.length ? <div className="positions-table">
          <div className="position-row header"><span>Company</span><span>Shares</span><span>Avg. cost</span><span>Last</span><span>Market value</span><span>Return</span><span>Allocation</span><span></span></div>
          {account.holdings.map((holding) => {
            const current = priceMap[holding.ticker] || holding.currentPrice;
            const marketValue = holding.shares * current;
            const pnl = marketValue - holding.shares * holding.averageCost;
            const allocation = metrics!.totalValue ? (marketValue / metrics!.totalValue) * 100 : 0;
            return <div className="position-row" key={holding.ticker}>
              <span className="position-company"><span className="ticker-mark">{holding.ticker.slice(0, 2)}</span><span><b>{holding.ticker}</b><small>{holding.company}</small></span></span>
              <span data-label="Shares">{shares(holding.shares)}</span>
              <span data-label="Avg. cost">{money(holding.averageCost)}</span>
              <span data-label="Last">{money(current)}</span>
              <span data-label="Market value"><b>{money(marketValue)}</b></span>
              <span data-label="Return" className={pnl >= 0 ? "positive" : "negative"}><b>{signedMoney(pnl)}</b><small>{holding.averageCost ? `${pnl >= 0 ? "+" : ""}${((current / holding.averageCost - 1) * 100).toFixed(2)}%` : "—"}</small></span>
              <span data-label="Allocation">{allocation.toFixed(1)}%</span>
              <button aria-label={`Trade ${holding.ticker}`} onClick={() => tradeHolding(holding.ticker)}>Trade</button>
            </div>;
          })}
        </div> : <div className="positions-empty"><RadarIcon size={32}/><div><b>Your account is fully in cash.</b><span>Use the trade ticket to buy an eligible AI suggestion.</span></div></div>}
      </div>

      <aside className="order-ticket">
        <div className="brokerage-card-heading"><div><span className="kicker">ORDER TICKET</span><h2>Paper trade</h2></div><span className="paper-badge">Simulation</span></div>
        <div className="side-toggle"><button className={side === "buy" ? "active buy" : ""} onClick={() => changeSide("buy")}>Buy</button><button className={side === "sell" ? "active sell" : ""} onClick={() => changeSide("sell")} disabled={!account.holdings.length}>Sell</button></div>
        <label className="order-field">SYMBOL<select aria-label="Order symbol" value={symbol} onChange={(event) => { setSymbol(event.target.value); setQuantity(""); }}>{options.map((option) => <option key={option.ticker} value={option.ticker}>{option.ticker} — {option.company}</option>)}</select></label>
        <div className="quote-line"><span><small>ESTIMATED PRICE</small><b>{quotePrice ? money(quotePrice) : "—"}</b></span><span><small>{side === "buy" ? "BUYING POWER" : "SHARES OWNED"}</small><b>{side === "buy" ? money(account.cash) : shares(held?.shares || 0)}</b></span></div>
        <label className="order-field">SHARES<span className="quantity-input"><input aria-label="Order shares" type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="0.000"/><button type="button" onClick={useMaximum}>MAX</button></span></label>
        <div className="order-preview"><span>Estimated total</span><strong>{money(Math.max(0, notional))}</strong><small>{side === "buy" ? `Cash after order: ${money(account.cash - Math.max(0, notional))}` : `Cash after order: ${money(account.cash + Math.max(0, notional))}`}</small></div>
        <button className={`primary order-submit ${side}`} disabled={!symbol || !numericQuantity || numericQuantity <= 0 || (side === "buy" && (!pick || notional > account.cash)) || (side === "sell" && (!held || numericQuantity > held.shares))} onClick={executeOrder}>{side === "buy" ? "Buy" : "Sell"} {symbol}<ArrowIcon size={16}/></button>
        <p className="ticket-note"><ShieldIcon size={14}/> Executed immediately at the displayed modeled/live price. No real money or brokerage connection is used.</p>
      </aside>
    </div>

    <div className="activity-card">
      <div className="brokerage-card-heading"><div><span className="kicker">ACCOUNT ACTIVITY</span><h2>Trade history</h2></div><span>{account.transactions.length} records</span></div>
      {account.transactions.length ? <div className="activity-list"><div className="activity-row header"><span>Type</span><span>Security</span><span>Shares</span><span>Price</span><span>Total</span><span>Realized P&amp;L</span><span>Executed</span></div>{account.transactions.slice(0, 20).map((transaction) => <div className="activity-row" key={transaction.id}><span><b className={`transaction-side ${transaction.side.toLowerCase()}`}>{transaction.side}</b></span><span><b>{transaction.ticker}</b><small>{transaction.company}</small></span><span data-label="Shares">{shares(transaction.shares)}</span><span data-label="Price">{money(transaction.price)}</span><span data-label="Total">{money(transaction.total)}</span><span data-label="Realized P&L" className={transaction.realizedPnl >= 0 ? "positive" : "negative"}>{transaction.side === "SELL" ? signedMoney(transaction.realizedPnl) : "—"}</span><span data-label="Executed">{new Date(transaction.executedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></div>)}</div> : <div className="positions-empty"><ShieldIcon size={28}/><div><b>No trades yet.</b><span>Your first buy or sell will appear here.</span></div></div>}
    </div>

    <div className="portfolio-guardrail"><ShieldIcon size={18}/><span>Purchases remain limited to the latest 12-name Scanner shortlist. Selling is always available for owned positions; nothing is deleted from account history.</span><button onClick={onOpenScanner}>View eligible stocks</button></div>
  </section>;
}
