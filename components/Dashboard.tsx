"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuthUser, PaperPortfolioAccount, PortfolioAgentSettings, PortfolioQuotesResponse, SavedPortfolio, ScanResult, ScreenerResponse, ScreenerRow, StockPick } from "@/lib/types";
import { applyHoldingQuotes, createAiAccount, createCashAccount, migratePaperAccount, runConvictionAgent, type TradeQuote } from "@/lib/portfolio";
import { ArrowIcon, PlusIcon, RadarIcon, RefreshIcon, ShieldIcon, SparkIcon, UserIcon } from "./Icons";
import Sparkline from "./Sparkline";
import SearchWorkspace from "./SearchWorkspace";
import PaperPortfolio from "./PaperPortfolio";
import StockResearchModal from "./StockResearchModal";
import AccountModal from "./AccountModal";

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
  const [account, setAccount] = useState<PaperPortfolioAccount | null>(null);
  const [tradeTicker, setTradeTicker] = useState<string | null>(null);
  const [categoryQuotes, setCategoryQuotes] = useState<TradeQuote[]>([]);
  const [toast, setToast] = useState("");
  const [clock, setClock] = useState<number | null>(null);
  const [research, setResearch] = useState<{ ticker: string; row: ScreenerRow | null; loading: boolean; error: string } | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [storageReady, setStorageReady] = useState(true);
  const [portfolios, setPortfolios] = useState<SavedPortfolio[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountLoading, setAccountLoading] = useState(true);
  const holdingSymbols = useMemo(() => account?.holdings.map((holding) => holding.ticker).sort().join(",") || "", [account?.holdings]);
  const activePortfolio = portfolios.find((portfolio) => portfolio.id === activePortfolioId) || null;

  useEffect(() => {
    let disposed = false;
    async function hydrateAccount() {
      let localAccount: PaperPortfolioAccount | null = null;
      const stored = localStorage.getItem("signalforge-paper-portfolio");
      if (stored) {
        try { localAccount = migratePaperAccount(JSON.parse(stored), 100_000); } catch { /* ignore corrupt local state */ }
      }
      try {
        const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
        const session = await sessionResponse.json() as { user: AuthUser | null; storageReady: boolean };
        if (disposed) return;
        setStorageReady(session.storageReady);
        setUser(session.user);
        if (session.user) {
          const response = await fetch("/api/portfolios", { cache: "no-store" });
          const result = await response.json() as { portfolios?: SavedPortfolio[] };
          if (disposed) return;
          const next = result.portfolios || [];
          const remembered = localStorage.getItem(`signalforge:active-portfolio:${session.user.id}`);
          const chosen = next.find((portfolio) => portfolio.id === remembered) || next[0] || null;
          setPortfolios(next);
          setActivePortfolioId(chosen?.id || null);
          setAccount(chosen?.account || null);
        } else {
          setAccount(localAccount);
        }
      } catch {
        if (!disposed) setAccount(localAccount);
      } finally { if (!disposed) setAccountLoading(false); }
    }
    void hydrateAccount();
    return () => { disposed = true; };
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

  useEffect(() => {
    if (!holdingSymbols) return;
    let disposed = false;
    async function refreshPortfolioQuotes() {
      try {
        const symbols = holdingSymbols.split(",");
        const batches: string[][] = [];
        for (let index = 0; index < symbols.length; index += 50) batches.push(symbols.slice(index, index + 50));
        const responses = await Promise.all(batches.map((batch) => fetch(`/api/quotes?symbols=${encodeURIComponent(batch.join(","))}`, { cache: "no-store" })));
        if (responses.some((response) => !response.ok) || disposed) return;
        const results = await Promise.all(responses.map((response) => response.json() as Promise<PortfolioQuotesResponse>));
        const quotes = results.flatMap((result) => result.quotes);
        const generatedAt = results.map((result) => result.generatedAt).sort().at(-1)!;
        setAccount((current) => {
          if (!current || disposed) return current;
          const next = applyHoldingQuotes(current, quotes, generatedAt);
          if (next !== current) {
            if (user && activePortfolioId) {
              setPortfolios((items) => items.map((item) => item.id === activePortfolioId ? { ...item, account: next, updatedAt: next.updatedAt } : item));
              void fetch(`/api/portfolios/${activePortfolioId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account: next }) });
            } else localStorage.setItem("signalforge-paper-portfolio", JSON.stringify(next));
          }
          return next;
        });
      } catch { /* keep the last successful quote when the feed is unavailable */ }
    }
    void refreshPortfolioQuotes();
    const timer = window.setInterval(refreshPortfolioQuotes, 60_000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [holdingSymbols, user, activePortfolioId]);

  function persist(next: PaperPortfolioAccount) {
    setAccount(next);
    if (user && activePortfolioId) {
      setPortfolios((items) => items.map((item) => item.id === activePortfolioId ? { ...item, account: next, updatedAt: next.updatedAt } : item));
      void fetch(`/api/portfolios/${activePortfolioId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account: next }) })
        .then((response) => { if (!response.ok) announce("This change is saved locally but cloud sync needs another try"); })
        .catch(() => announce("This change is saved locally but cloud sync needs another try"));
    } else localStorage.setItem("signalforge-paper-portfolio", JSON.stringify(next));
  }

  async function loadPortfolios(preferredId?: string) {
    const response = await fetch("/api/portfolios", { cache: "no-store" });
    if (!response.ok) return;
    const result = await response.json() as { portfolios: SavedPortfolio[] };
    const chosen = result.portfolios.find((portfolio) => portfolio.id === preferredId) || result.portfolios[0] || null;
    setPortfolios(result.portfolios);
    setActivePortfolioId(chosen?.id || null);
    setAccount(chosen?.account || null);
    if (user && chosen) localStorage.setItem(`signalforge:active-portfolio:${user.id}`, chosen.id);
  }

  function switchPortfolio(id: string) {
    const chosen = portfolios.find((portfolio) => portfolio.id === id);
    if (!chosen) return;
    setActivePortfolioId(id);
    setAccount(chosen.account);
    setTradeTicker(null);
    if (user) localStorage.setItem(`signalforge:active-portfolio:${user.id}`, id);
  }

  async function createNewPortfolio(name: string, amount: number, importedAccount?: PaperPortfolioAccount) {
    if (!user) {
      const next = importedAccount || createCashAccount(amount);
      persist(next);
      setAccountModalOpen(true);
      announce("Portfolio created locally — create an account to save multiple portfolios");
      return;
    }
    const response = await fetch("/api/portfolios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, startingBalance: amount, importedAccount }) });
    const result = await response.json() as { portfolio?: SavedPortfolio; error?: string };
    if (!response.ok || !result.portfolio) { announce(result.error || "Portfolio could not be created"); return; }
    setPortfolios((items) => [result.portfolio!, ...items]);
    setActivePortfolioId(result.portfolio.id);
    setAccount(result.portfolio.account);
    localStorage.setItem(`signalforge:active-portfolio:${user.id}`, result.portfolio.id);
    announce(`${result.portfolio.name} created`);
  }

  async function updateAgent(changes: Partial<Pick<PortfolioAgentSettings, "enabled" | "targetPositions" | "cashReservePct">>) {
    if (!user || !activePortfolioId) {
      setAccountModalOpen(true);
      announce("Sign in to keep an AI agent running between visits");
      return;
    }
    const response = await fetch(`/api/portfolios/${activePortfolioId}/agent`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
    const result = await response.json() as { portfolio?: SavedPortfolio; error?: string };
    if (!response.ok || !result.portfolio) { announce(result.error || "Agent settings could not be saved"); return; }
    setPortfolios((items) => items.map((item) => item.id === result.portfolio!.id ? result.portfolio! : item));
    announce(result.portfolio.agent.enabled ? "AI auto-invest is enabled" : "AI auto-invest is paused");
  }

  async function runAgentNow() {
    if (!account) return;
    if (!user || !activePortfolioId) {
      const result = runConvictionAgent(account, scan.picks, 8, 15);
      persist(result.account);
      announce(result.orders ? `AI bought ${result.orders} highest-conviction positions` : "Cash reserve is already satisfied");
      return;
    }
    const response = await fetch(`/api/portfolios/${activePortfolioId}/agent`, { method: "POST" });
    const result = await response.json() as { portfolio?: SavedPortfolio; error?: string };
    if (!response.ok || !result.portfolio) { announce(result.error || "The AI agent could not run"); return; }
    setPortfolios((items) => items.map((item) => item.id === result.portfolio!.id ? result.portfolio! : item));
    setAccount(result.portfolio.account);
    announce(result.portfolio.agent.lastSummary || "AI agent scan complete");
  }

  function announce(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
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

  function openTradeTicket(quote: TradeQuote) {
    setCategoryQuotes((current) => [quote, ...current.filter((item) => item.ticker !== quote.ticker)]);
    setTradeTicker(quote.ticker);
    setActiveTab("portfolio");
  }

  function inspectSearchStock(row: ScreenerRow) {
    setResearch({ ticker: row.ticker, row, loading: false, error: "" });
  }

  async function inspectScannerStock(pick: StockPick) {
    setSelected(pick);
    setResearch({ ticker: pick.ticker, row: null, loading: true, error: "" });
    try {
      const params = new URLSearchParams({ factor: "quality", q: pick.ticker, page: "1", limit: "50" });
      const response = await fetch(`/api/stocks?${params}`);
      if (!response.ok) throw new Error("Unable to load this company record.");
      const result = await response.json() as ScreenerResponse;
      const row = result.rows.find((candidate) => candidate.ticker === pick.ticker);
      if (!row) throw new Error(`${pick.ticker} is not available in the current research universe.`);
      setResearch((current) => current?.ticker === pick.ticker ? { ticker: pick.ticker, row, loading: false, error: "" } : current);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Unable to load this company record.";
      setResearch((current) => current?.ticker === pick.ticker ? { ticker: pick.ticker, row: null, loading: false, error: message } : current);
    }
  }

  function buildPortfolio() {
    if (!account) {
      const starter = createAiAccount(scan.picks, capital, size);
      void createNewPortfolio("AI Starter Portfolio", capital, starter);
      announce("AI paper portfolio created with a 15% cash reserve");
    }
    setActiveTab("portfolio");
  }

  const tradeableQuotes = useMemo(() => {
    const quotes = new Map<string, TradeQuote>();
    categoryQuotes.forEach((quote) => quotes.set(quote.ticker, quote));
    account?.holdings.forEach((holding) => quotes.set(holding.ticker, { ticker: holding.ticker, company: holding.company, price: holding.currentPrice, score: holding.score }));
    scan.picks.forEach((pick) => quotes.set(pick.ticker, pick));
    return [...quotes.values()];
  }, [account, categoryQuotes, scan.picks]);

  return (
    <main>
      <header className="topbar">
        <div className="topbar-inner">
          <button type="button" className="brand" onClick={() => setActiveTab("scanner")}><span className="brand-mark"><RadarIcon size={21}/></span><span className="brand-copy"><span>SignalForge <b>AI</b></span><small>Research intelligence</small></span></button>
          <nav aria-label="Primary navigation">
            <button type="button" aria-current={activeTab === "scanner" ? "page" : undefined} className={activeTab === "scanner" ? "active" : ""} onClick={() => setActiveTab("scanner")}>Scanner</button>
            <button type="button" aria-current={activeTab === "search" ? "page" : undefined} className={activeTab === "search" ? "active" : ""} onClick={() => setActiveTab("search")}>Search</button>
            <button type="button" aria-current={activeTab === "portfolio" ? "page" : undefined} className={activeTab === "portfolio" ? "active" : ""} onClick={() => setActiveTab("portfolio")}>Portfolio <span className="nav-count">{account?.holdings.length || 0}</span></button>
            <button type="button" aria-current={activeTab === "strategies" ? "page" : undefined} className={activeTab === "strategies" ? "active" : ""} onClick={() => setActiveTab("strategies")}>Strategies</button>
          </nav>
          <div className="topbar-actions"><div className="market-chip"><span className={scan.market.isOpen ? "pulse" : "dot"}/><span><strong>{scan.market.label}</strong><small>{scan.market.nextEvent}</small></span></div><button className="account-button" onClick={() => setAccountModalOpen(true)} aria-label={user ? `Account for ${user.name}` : "Sign in or create account"}><span>{user ? user.name.slice(0, 2).toUpperCase() : <UserIcon size={16}/>}</span><b>{user ? user.name : "Sign in"}</b></button></div>
        </div>
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
              {scan.picks.map((pick) => <button key={pick.ticker} className={`stock-row ${selected.ticker === pick.ticker ? "selected" : ""}`} onClick={() => void inspectScannerStock(pick)} aria-label={`Open research for ${pick.ticker}`}>
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
              <div className="detail-footer"><span>Research horizon <b>{selected.horizon}</b></span><button onClick={() => openTradeTicket(selected)}><PlusIcon size={16}/> Open trade ticket</button></div>
            </aside>
          </div>
        </section>

        <section className="builder shell">
          <div><span className="kicker">PORTFOLIO LAB</span><h2>Turn research into a disciplined paper portfolio.</h2><p>Create a simulated brokerage account with real cash accounting. The AI starter portfolio invests 85% and keeps 15% available for future orders.</p></div>
          <div className="builder-controls"><label>Starting cash<span><input type="number" min="1000" step="1000" value={capital} onChange={(event) => setCapital(Math.max(1000, Number(event.target.value)))}/><b>USD</b></span></label><label>Starter positions<span><input type="range" min="4" max="12" value={size} onChange={(event) => setSize(Number(event.target.value))}/><b>{size}</b></span></label><button className="primary wide" onClick={buildPortfolio}>{account ? "Open paper brokerage" : "Create AI starter portfolio"} <ArrowIcon size={17}/></button></div>
        </section>
      </>}

      {activeTab === "search" && <SearchWorkspace onTrade={openTradeTicket} onInspect={inspectSearchStock} portfolioTickers={account?.holdings.map((holding) => holding.ticker) || []}/>}

      {activeTab === "portfolio" && <PaperPortfolio account={account} accountLoading={accountLoading} user={user} portfolios={portfolios} activePortfolioId={activePortfolioId} activeAgent={activePortfolio?.agent || null} tradeableQuotes={tradeableQuotes} requestedTicker={tradeTicker} defaultCapital={capital} onCreateCashAccount={(name, amount) => void createNewPortfolio(name, amount)} onCreatePortfolio={(name, amount) => void createNewPortfolio(name, amount)} onSwitchPortfolio={switchPortfolio} onChange={persist} onOpenSearch={() => setActiveTab("search")} onOpenAccount={() => setAccountModalOpen(true)} onRunAgent={() => void runAgentNow()} onUpdateAgent={(changes) => void updateAgent(changes)} onToast={announce}/>}

      {activeTab === "strategies" && <section className="shell page-section">
        <div className="page-hero"><span className="kicker">STRATEGY LIBRARY</span><h1>Ten lenses. One auditable score.</h1><p>No single strategy gets to dominate. The engine looks for independent agreement and displays every component.</p></div>
        <div className="strategy-grid">{strategyCards.map(([title, type, body], index) => <article key={title}><span className="strategy-number">0{index + 1}</span><span className="strategy-type">{type}</span><h3>{title}</h3><p>{body}</p><div className="mini-line"/></article>)}</div>
        <div className="methodology"><ShieldIcon size={24}/><div><h3>Guardrails built into the score</h3><p>Stale disclosures are discounted. Crowding never counts as a standalone buy signal. Valuation extremes reduce conviction. Position weights are capped by diversification. This is an idea-ranking system—not a forecast or fiduciary recommendation.</p></div></div>
      </section>}

      <footer><div className="shell"><span className="brand footer-brand"><span className="brand-mark"><RadarIcon size={17}/></span>SignalForge AI</span><p>Educational research and paper simulation only. Not investment advice. Market, filing and alternative data may be delayed, incomplete or modeled.</p><span>Built for transparent decisions.</span></div></footer>
      {research && <StockResearchModal
        ticker={research.ticker}
        row={research.row}
        loading={research.loading}
        error={research.error}
        held={Boolean(account?.holdings.some((holding) => holding.ticker === research.ticker))}
        onClose={() => setResearch(null)}
        onTrade={(row) => {
          setResearch(null);
          openTradeTicket({ ticker: row.ticker, company: row.company, price: row.price, score: row.compositeScore });
        }}
      />}
      {toast && <div className="toast">{toast}</div>}
      <AccountModal open={accountModalOpen} user={user} storageReady={storageReady} importedAccount={user ? null : account} onClose={() => setAccountModalOpen(false)} onAuthenticated={(nextUser, portfolio) => { setUser(nextUser); setStorageReady(true); if (portfolio) { setPortfolios([portfolio]); setActivePortfolioId(portfolio.id); setAccount(portfolio.account); localStorage.removeItem("signalforge-paper-portfolio"); localStorage.setItem(`signalforge:active-portfolio:${nextUser.id}`, portfolio.id); } else void loadPortfolios(); announce(`Signed in as ${nextUser.name}`); }} onLogout={() => { setUser(null); setPortfolios([]); setActivePortfolioId(null); setAccount(null); announce("Signed out"); }}/>
    </main>
  );
}
