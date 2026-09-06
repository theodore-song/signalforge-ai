"use client";

import { useEffect, useMemo, useState } from "react";
import type { PortfolioHolding, ScanResult, StockPick } from "@/lib/types";
import { ArrowIcon, CloseIcon, PlusIcon, RadarIcon, RefreshIcon, ShieldIcon, SparkIcon } from "./Icons";
import Sparkline from "./Sparkline";
import SearchWorkspace from "./SearchWorkspace";

const strategyCards = [
  ["Quality × Momentum", "Expert", "Profitable leaders with trend confirmation; avoids cheap stocks with deteriorating businesses."],
  ["Estimate Revision Drift", "Expert", "Looks for broad analyst upgrades that prices have not fully absorbed."],
  ["13F Conviction", "Filings", "Tracks concentrated institutional ownership changes, adjusted for the filing delay."],
  ["Congress Flow", "Disclosures", "Normalizes disclosed purchases while explicitly accounting for reporting lags."],
  ["Crowd Pulse", "Collective", "Uses attention, direction and disagreement—not raw popularity—to avoid mania."],
  ["Quiet Compounder", "Original", "Finds improving fundamentals before the story dominates public conversation."],
  ["Attention Gap", "Original", "Looks for evidence improving faster than narrative attention and price."],
  ["Insider Alignment", "Filings", "Rewards ownership alignment and open-market buying; discounts routine sales."],
] as const;

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value >= 1000 ? 0 : 2 }).format(value);
}

function timeAgo(date: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - new Date(date).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

export default function Dashboard({ initialScan }: { initialScan: ScanResult }) {
  const [scan, setScan] = useState(initialScan);
  const [selected, setSelected] = useState<StockPick>(initialScan.picks[0]);
  const [activeTab, setActiveTab] = useState<"scanner" | "search" | "portfolio" | "strategies">("scanner");
  const [scanning, setScanning] = useState(false);
  const [capital, setCapital] = useState(100000);
  const [size, setSize] = useState(8);
  const [portfolio, setPortfolio] = useState<PortfolioHolding[]>([]);
  const [toast, setToast] = useState("");
  const [clock, setClock] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("signalforge-paper-portfolio");
    if (stored) {
      try { setPortfolio(JSON.parse(stored)); } catch { /* ignore corrupt local state */ }
    }
  }, []);

  useEffect(() => {
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), 10000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!scan.market.isOpen) return;
    const timer = window.setInterval(async () => {
      const response = await fetch("/api/scan");
      if (response.ok) setScan(await response.json());
    }, 60000);
    return () => window.clearInterval(timer);
  }, [scan.market.isOpen]);

  function persist(next: PortfolioHolding[]) {
    setPortfolio(next);
    localStorage.setItem("signalforge-paper-portfolio", JSON.stringify(next));
  }

  async function runFreshScan() {
    setScanning(true);
    try {
      const response = await fetch("/api/scan", { method: "POST" });
      if (!response.ok) throw new Error("scan failed");
      const next = await response.json() as ScanResult;
      setScan(next);
      setSelected(next.picks[0]);
      setToast("Fresh scan complete");
    } catch {
      setToast("Scan could not refresh");
    } finally {
      setScanning(false);
      window.setTimeout(() => setToast(""), 2600);
    }
  }

  function addHolding(pick: StockPick) {
    if (portfolio.some((item) => item.ticker === pick.ticker)) {
      setToast(`${pick.ticker} is already in the paper portfolio`);
      window.setTimeout(() => setToast(""), 2200);
      return;
    }
    const budget = capital * Math.max(pick.suggestedWeight / 100, 0.05);
    const holding: PortfolioHolding = { ticker: pick.ticker, company: pick.company, shares: Number((budget / pick.price).toFixed(3)), entryPrice: pick.price, currentPrice: pick.price, weight: pick.suggestedWeight, score: pick.score };
    persist([...portfolio, holding]);
    setToast(`${pick.ticker} added to your paper portfolio`);
    window.setTimeout(() => setToast(""), 2200);
  }

  function buildPortfolio() {
    const chosen = scan.picks.slice(0, size);
    const scoreTotal = chosen.reduce((sum, pick) => sum + Math.max(pick.score - 60, 5), 0);
    const next = chosen.map((pick) => {
      const weight = Math.max(pick.score - 60, 5) / scoreTotal;
      return { ticker: pick.ticker, company: pick.company, shares: Number(((capital * weight) / pick.price).toFixed(3)), entryPrice: pick.price, currentPrice: pick.price, weight: Number((weight * 100).toFixed(1)), score: pick.score };
    });
    persist(next);
    setActiveTab("portfolio");
    setToast("AI paper portfolio created");
    window.setTimeout(() => setToast(""), 2400);
  }

  function addSearchSuggestion(ticker: string) {
    const pick = scan.picks.find((candidate) => candidate.ticker === ticker);
    if (!pick) {
      setToast(`${ticker} is no longer in the current composite shortlist`);
      window.setTimeout(() => setToast(""), 2400);
      return;
    }
    addHolding(pick);
  }

  const portfolioValue = useMemo(() => portfolio.reduce((sum, item) => {
    const live = scan.picks.find((pick) => pick.ticker === item.ticker)?.price || item.currentPrice;
    return sum + item.shares * live;
  }, 0), [portfolio, scan]);
  const invested = portfolio.reduce((sum, item) => sum + item.shares * item.entryPrice, 0);

  return (
    <main>
      <header className="topbar">
        <button className="brand" onClick={() => setActiveTab("scanner")}><span className="brand-mark"><RadarIcon size={21}/></span><span>SignalForge <b>AI</b></span></button>
        <nav aria-label="Primary navigation">
          <button className={activeTab === "scanner" ? "active" : ""} onClick={() => setActiveTab("scanner")}>Scanner</button>
          <button className={activeTab === "search" ? "active" : ""} onClick={() => setActiveTab("search")}>Search</button>
          <button className={activeTab === "portfolio" ? "active" : ""} onClick={() => setActiveTab("portfolio")}>Portfolio <span className="nav-count">{portfolio.length}</span></button>
          <button className={activeTab === "strategies" ? "active" : ""} onClick={() => setActiveTab("strategies")}>Strategies</button>
        </nav>
        <div className="market-chip"><span className={scan.market.isOpen ? "pulse" : "dot"}/><span><strong>{scan.market.label}</strong><small>{scan.market.nextEvent}</small></span></div>
      </header>

      {activeTab === "scanner" && <>
        <section className="hero shell">
          <div className="eyebrow"><SparkIcon size={14}/> MULTI-SIGNAL RESEARCH ENGINE</div>
          <div className="hero-grid">
            <div><h1>See the signal<br/><span>behind the noise.</span></h1><p>One explainable ranking across fundamentals, momentum, filings, disclosures and collective attention.</p></div>
            <div className="hero-panel">
              <div className="hero-panel-top"><span>AI committee brief</span><span className={`risk ${scan.regime.risk}`}>{scan.regime.risk} risk</span></div>
              <p>{scan.committeeBrief}</p>
              <div className="hero-stats"><div><small>Regime</small><strong>{scan.regime.label}</strong></div><div><small>Positive breadth</small><strong>{scan.breadth}%</strong></div><div><small>Universe</small><strong>{scan.universeSize}</strong></div></div>
            </div>
          </div>
          <div className="scan-strip">
            <div><span className={`mode-dot ${scan.dataMode}`}/><b>{scan.dataMode === "live" ? "Live data" : "Demonstration mode"}</b><span className="muted">{scan.dataNote}</span></div>
            <button className="primary" onClick={runFreshScan} disabled={scanning}><RefreshIcon size={16} className={scanning ? "spin" : ""}/>{scanning ? "Scanning market…" : "Run fresh scan"}</button>
          </div>
        </section>

        <section className="workspace shell">
          <div className="section-heading"><div><span className="kicker">TODAY&apos;S RANKING</span><h2>Highest-conviction opportunities</h2></div><div className="updated">Updated {clock ? timeAgo(scan.generatedAt, clock) : "just now"} · refreshes every 60s while open</div></div>
          <div className="scanner-layout">
            <div className="table-card">
              <div className="table-head"><span>Rank / company</span><span>Signal score</span><span>Price</span><span>Trend</span><span></span></div>
              {scan.picks.map((pick) => <button key={pick.ticker} className={`stock-row ${selected.ticker === pick.ticker ? "selected" : ""}`} onClick={() => setSelected(pick)}>
                <span className="company-cell"><em>{String(pick.rank).padStart(2, "0")}</em><span className="ticker-mark">{pick.ticker.slice(0, 2)}</span><span><b>{pick.ticker}</b><small>{pick.company}</small></span></span>
                <span className="score-cell"><b>{pick.score}</b><span className="score-track"><i style={{width: `${pick.score}%`}}/></span></span>
                <span className="price-cell"><b>{formatMoney(pick.price)}</b><small className={pick.changePct >= 0 ? "positive" : "negative"}>{pick.changePct >= 0 ? "+" : ""}{pick.changePct}%</small></span>
                <Sparkline values={pick.sparkline} positive={pick.changePct >= 0}/>
                <span className="row-arrow"><ArrowIcon size={16}/></span>
              </button>)}
            </div>

            <aside className="detail-card">
              <div className="detail-title"><div><span className="ticker-mark large">{selected.ticker.slice(0, 2)}</span><div><h3>{selected.ticker}</h3><p>{selected.company} · {selected.sector}</p></div></div><span className={`confidence ${selected.confidence.toLowerCase()}`}>{selected.confidence}</span></div>
              <div className="conviction"><div><small>COMPOSITE SIGNAL</small><strong>{selected.score}<span>/100</span></strong></div><div className="ring" style={{"--score": `${selected.score * 3.6}deg`} as React.CSSProperties}/></div>
              <p className="thesis">{selected.thesis}</p>
              <div className="factor-list">{selected.signals.slice(0, 6).map((factor) => <div className="factor" key={factor.key} title={factor.detail}><span>{factor.label}<small>{factor.source}</small></span><span className="factor-bar"><i style={{width: `${factor.score}%`}}/></span><b>{factor.score}</b></div>)}</div>
              <div className="risk-box"><ShieldIcon size={17}/><div><b>What breaks the thesis</b><p>{selected.risk}</p></div></div>
              <div className="detail-footer"><span>Research horizon <b>{selected.horizon}</b></span><button onClick={() => addHolding(selected)}><PlusIcon size={16}/> Add to paper portfolio</button></div>
            </aside>
          </div>
        </section>

        <section className="builder shell">
          <div><span className="kicker">PORTFOLIO LAB</span><h2>Turn research into a disciplined paper portfolio.</h2><p>Only current AI suggestions are eligible. Weights are score-adjusted and diversified—never sent to a broker.</p></div>
          <div className="builder-controls"><label>Starting capital<span><input type="number" min="1000" step="1000" value={capital} onChange={(event) => setCapital(Math.max(1000, Number(event.target.value)))}/><b>USD</b></span></label><label>Number of positions<span><input type="range" min="4" max="12" value={size} onChange={(event) => setSize(Number(event.target.value))}/><b>{size}</b></span></label><button className="primary wide" onClick={buildPortfolio}>Build AI paper portfolio <ArrowIcon size={17}/></button></div>
        </section>
      </>}

      {activeTab === "search" && <SearchWorkspace onAdd={addSearchSuggestion} portfolioTickers={portfolio.map((holding) => holding.ticker)}/>}

      {activeTab === "portfolio" && <section className="shell page-section">
        <div className="page-hero"><span className="kicker">PAPER PORTFOLIO</span><h1>Your AI research basket.</h1><p>A local, simulation-only portfolio made exclusively from SignalForge suggestions.</p></div>
        <div className="portfolio-summary"><div><small>MARKET VALUE</small><strong>{formatMoney(portfolioValue)}</strong></div><div><small>COST BASIS</small><strong>{formatMoney(invested)}</strong></div><div><small>UNREALIZED P&amp;L</small><strong className={portfolioValue - invested >= 0 ? "positive" : "negative"}>{portfolioValue - invested >= 0 ? "+" : ""}{formatMoney(portfolioValue - invested)}</strong></div><div><small>POSITIONS</small><strong>{portfolio.length}</strong></div></div>
        {portfolio.length ? <div className="portfolio-table"><div className="portfolio-row header"><span>Company</span><span>Shares</span><span>Entry</span><span>Current</span><span>Weight</span><span></span></div>{portfolio.map((holding) => { const current = scan.picks.find((pick) => pick.ticker === holding.ticker)?.price || holding.currentPrice; return <div className="portfolio-row" key={holding.ticker}><span><b>{holding.ticker}</b><small>{holding.company}</small></span><span>{holding.shares}</span><span>{formatMoney(holding.entryPrice)}</span><span>{formatMoney(current)}</span><span>{holding.weight}%</span><button aria-label={`Remove ${holding.ticker}`} onClick={() => persist(portfolio.filter((item) => item.ticker !== holding.ticker))}><CloseIcon size={16}/></button></div>})}</div> : <div className="empty-state"><RadarIcon size={40}/><h3>No paper positions yet</h3><p>Build a diversified basket from the latest scan or add a suggestion individually.</p><button className="primary" onClick={() => setActiveTab("scanner")}>Open scanner</button></div>}
      </section>}

      {activeTab === "strategies" && <section className="shell page-section">
        <div className="page-hero"><span className="kicker">STRATEGY LIBRARY</span><h1>Ten lenses. One auditable score.</h1><p>No single strategy gets to dominate. The engine looks for independent agreement and displays every component.</p></div>
        <div className="strategy-grid">{strategyCards.map(([title, type, body], index) => <article key={title}><span className="strategy-number">0{index + 1}</span><span className="strategy-type">{type}</span><h3>{title}</h3><p>{body}</p><div className="mini-line"/></article>)}</div>
        <div className="methodology"><ShieldIcon size={24}/><div><h3>Guardrails built into the score</h3><p>Stale disclosures are discounted. Crowding never counts as a standalone buy signal. Valuation extremes reduce conviction. Position weights are capped by diversification. This is an idea-ranking system—not a forecast or fiduciary recommendation.</p></div></div>
      </section>}

      <footer><div className="shell"><span className="brand footer-brand"><span className="brand-mark"><RadarIcon size={17}/></span>SignalForge AI</span><p>Educational research and paper simulation only. Not investment advice. Market, filing and alternative data may be delayed, incomplete or modeled.</p><span>Built for transparent decisions.</span></div></footer>
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
