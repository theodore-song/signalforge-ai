"use client";

import { useEffect, useMemo, useState } from "react";
import { CompareIcon, PlusIcon, SearchIcon, ShieldIcon } from "./Icons";
import { SEARCH_FACTORS, SEARCH_FACTOR_LABELS, type ComparisonResponse, type ScreenerResponse, type ScreenerRow, type SearchFactorKey } from "@/lib/types";

const factorDescriptions: Record<SearchFactorKey, string> = {
  quality: "Durable profitability, balance-sheet resilience and competitive advantage.",
  earnings: "The direction and breadth of forward estimate changes.",
  momentum: "Medium-term trend reinforced by the current market session.",
  billionaire: "Concentrated institutional ownership inferred from delayed 13F filings.",
  quietCompounder: "Fundamental acceleration before the narrative becomes crowded.",
  value: "Cash-flow and earnings value relative to comparable companies."
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value >= 1_000 ? 0 : 2 }).format(value);
}

function compactMoney(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", style: "currency", currency: "USD", maximumFractionDigits: 1 }).format(value);
}

function ScoreBar({ score }: { score: number }) {
  return <span className="search-score"><b>{score}</b><span><i style={{ width: `${score}%` }}/></span></span>;
}

export default function SearchWorkspace({ onAdd, portfolioTickers }: { onAdd: (ticker: string) => void; portfolioTickers: string[] }) {
  const [factor, setFactor] = useState<SearchFactorKey>("quality");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sector, setSector] = useState("All sectors");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ScreenerResponse | null>(null);
  const [selected, setSelected] = useState<ScreenerRow | null>(null);
  const [compareSymbols, setCompareSymbols] = useState<string[]>([]);
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [view, setView] = useState<"leaders" | "compare">("leaders");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ factor, q: debouncedQuery, sector, page: String(page), limit: "50" });
    fetch(`/api/stocks?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load the research universe");
        return response.json() as Promise<ScreenerResponse>;
      })
      .then((result) => {
        setData(result);
        setSelected((current) => result.rows.find((row) => row.ticker === current?.ticker) || result.rows[0] || null);
      })
      .catch((reason) => { if (reason.name !== "AbortError") setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [factor, debouncedQuery, sector, page]);

  const selectedCount = compareSymbols.length;
  const portfolioSet = useMemo(() => new Set(portfolioTickers), [portfolioTickers]);

  function chooseFactor(next: SearchFactorKey) {
    setFactor(next);
    setPage(1);
    setView("leaders");
  }

  function toggleComparison(ticker: string) {
    setCompareSymbols((current) => current.includes(ticker)
      ? current.filter((symbol) => symbol !== ticker)
      : current.length < 5 ? [...current, ticker] : current);
  }

  async function openComparison() {
    if (compareSymbols.length < 2) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/stocks/compare?symbols=${encodeURIComponent(compareSymbols.join(","))}`);
      if (!response.ok) throw new Error("Unable to compare these stocks");
      setComparison(await response.json());
      setView("compare");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to compare these stocks");
    } finally {
      setLoading(false);
    }
  }

  return <section className="shell page-section search-page">
    <div className="search-hero">
      <div><span className="kicker">2,000-STOCK RESEARCH UNIVERSE</span><h1>Find what each<br/><em>signal favours.</em></h1><p>Search the largest US-listed companies by market cap, inspect category leaders, and compare the evidence—not just the story.</p></div>
      <div className="search-meta">
        <div><small>UNIVERSE</small><strong>{data?.universeSize.toLocaleString() || "2,000"}</strong><span>US-listed stocks</span></div>
        <div><small>UNIVERSE AS OF</small><strong>{data?.universeAsOf || "—"}</strong><span>Monthly membership</span></div>
        <div><small>DATA MODE</small><strong className={data?.dataMode === "live" ? "positive" : "amber"}>{data?.dataMode || "modeled"}</strong><span>Per-factor provenance</span></div>
      </div>
    </div>

    <div className="research-toolbar">
      <label className="stock-search"><SearchIcon size={17}/><input aria-label="Search stocks" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); setView("leaders"); }} placeholder="Search ticker or company…"/></label>
      <label className="sector-filter"><span>Sector</span><select aria-label="Filter by sector" value={sector} onChange={(event) => { setSector(event.target.value); setPage(1); setView("leaders"); }}><option>All sectors</option>{data?.sectors.map((item) => <option key={item}>{item}</option>)}</select></label>
      <div className="view-toggle"><button className={view === "leaders" ? "active" : ""} onClick={() => setView("leaders")}>Leaderboards</button><button className={view === "compare" ? "active" : ""} onClick={openComparison} disabled={selectedCount < 2}><CompareIcon size={14}/> Compare {selectedCount ? `(${selectedCount})` : ""}</button></div>
    </div>

    <div className="factor-tabs" role="tablist" aria-label="Research categories">{SEARCH_FACTORS.map((key) => <button role="tab" aria-selected={factor === key} className={factor === key ? "active" : ""} key={key} onClick={() => chooseFactor(key)}><span>{SEARCH_FACTOR_LABELS[key]}</span><small>{factorDescriptions[key]}</small></button>)}</div>

    {error && <div className="search-error">{error}</div>}

    {view === "leaders" && <>
      <div className="results-heading"><div><span className="kicker">{SEARCH_FACTOR_LABELS[factor].toUpperCase()} LEADERS</span><h2>{data ? `${data.total.toLocaleString()} matching stocks` : "Loading universe…"}</h2></div><p>Rank is global within the complete 2,000-stock universe. Category scores are independent of composite rank.</p></div>
      <div className="search-layout">
        <div className={`screener-card ${loading ? "loading" : ""}`}>
          <div className="screener-head"><span>Compare</span><span>Category rank / company</span><span>{SEARCH_FACTOR_LABELS[factor]}</span><span>Composite</span><span>Price</span><span>Source</span></div>
          {!loading && data?.rows.length === 0 && <div className="no-results"><SearchIcon size={28}/><b>No matching stocks</b><span>Try a different company, ticker, or sector.</span></div>}
          {data?.rows.map((row) => <div className={`screener-row ${selected?.ticker === row.ticker ? "selected" : ""}`} key={row.ticker}>
            <button type="button" className="compare-check" aria-label={`Compare ${row.ticker}`} aria-pressed={compareSymbols.includes(row.ticker)} disabled={!compareSymbols.includes(row.ticker) && selectedCount >= 5} onClick={() => toggleComparison(row.ticker)}><span/></button>
            <button className="screener-company" onClick={() => setSelected(row)}><em>#{row.categoryRank}</em><span className="ticker-mark">{row.ticker.slice(0, 2)}</span><span><b>{row.ticker}</b><small>{row.company} · {row.sector}</small></span></button>
            <ScoreBar score={row.selectedScore}/>
            <span className="composite-score">{row.compositeScore}</span>
            <span className="search-price"><b>{money(row.price)}</b><small className={row.changePct >= 0 ? "positive" : "negative"}>{row.changePct >= 0 ? "+" : ""}{row.changePct}%</small></span>
            <span className={`source-pill ${row.factorStatus[factor]}`}>{row.factorStatus[factor]}<small>{row.provenance[factor]}</small></span>
          </div>)}
          {loading && <div className="screener-loading"><span/><span/><span/><span/><span/></div>}
          {data && data.totalPages > 1 && <div className="pagination"><button disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page <b>{page}</b> of {data.totalPages}</span><button disabled={page >= data.totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next</button></div>}
        </div>

        <aside className="research-detail">
          {selected ? <>
            <div className="detail-title"><div><span className="ticker-mark large">{selected.ticker.slice(0, 2)}</span><div><h3>{selected.ticker}</h3><p>{selected.company}</p></div></div><span className="market-rank">MC #{selected.marketCapRank}</span></div>
            <div className="research-price"><div><small>PRICE</small><strong>{money(selected.price)}</strong></div><div><small>MARKET CAP</small><strong>{compactMoney(selected.marketCap)}</strong></div></div>
            <p className="thesis">{selected.thesis}</p>
            <div className="research-factors">{SEARCH_FACTORS.map((key) => <div key={key} className={key === factor ? "active" : ""}><span><b>{SEARCH_FACTOR_LABELS[key]}</b><small>{selected.factorStatus[key]} · {selected.provenance[key]}</small></span><span className="factor-bar"><i style={{width: `${selected.factorScores[key]}%`}}/></span><strong>{selected.factorScores[key]}</strong></div>)}</div>
            <div className="risk-box"><ShieldIcon size={17}/><div><b>Research risk</b><p>{selected.risk}</p></div></div>
            {selected.portfolioEligible ? <button className="primary detail-add" onClick={() => onAdd(selected.ticker)}><PlusIcon size={16}/>{portfolioSet.has(selected.ticker) ? "Trade existing position" : "Open paper trade ticket"}</button> : <div className="eligibility-note"><b>Category leader, not a portfolio pick</b><span>This stock is not in the latest 12-name composite shortlist.</span></div>}
          </> : <div className="no-results"><SearchIcon size={28}/><b>Select a stock</b><span>Open a result to inspect all six factors.</span></div>}
        </aside>
      </div>
    </>}

    {view === "compare" && comparison && <div className="comparison-panel">
      <div className="comparison-heading"><div><span className="kicker">SIDE-BY-SIDE EVIDENCE</span><h2>Factor comparison</h2></div><button onClick={() => { setCompareSymbols([]); setComparison(null); setView("leaders"); }}>Clear comparison</button></div>
      <div className="comparison-grid" style={{"--columns": comparison.items.length} as React.CSSProperties}>
        <div className="comparison-label header"><span>Category</span></div>
        {comparison.items.map((item) => <div className="comparison-stock header" key={item.ticker}><span className="ticker-mark">{item.ticker.slice(0, 2)}</span><b>{item.ticker}</b><small>{item.found ? item.company : "Not found"}</small></div>)}
        {SEARCH_FACTORS.map((key) => <div className="comparison-row" key={key}>
          <div className="comparison-label"><b>{SEARCH_FACTOR_LABELS[key]}</b><small>{factorDescriptions[key]}</small></div>
          {comparison.items.map((item) => {
            const winner = item.found && comparison.winners[key].includes(item.ticker);
            return <div className={`comparison-value ${winner ? "winner" : ""}`} key={item.ticker}>{item.found ? <><strong>{item.factorScores[key]}</strong><span className="factor-bar"><i style={{width: `${item.factorScores[key]}%`}}/></span><small>{winner ? "Category leader" : item.factorStatus[key]}</small></> : <span>—</span>}</div>;
          })}
        </div>)}
        <div className="comparison-row summary-row"><div className="comparison-label"><b>Composite score</b><small>All ten signals combined</small></div>{comparison.items.map((item) => <div className="comparison-value" key={item.ticker}><strong>{item.found ? item.compositeScore : "—"}</strong>{item.found && <small>{item.portfolioEligible ? "Portfolio eligible" : "Research only"}</small>}</div>)}</div>
      </div>
    </div>}
    <div className="search-disclaimer"><ShieldIcon size={17}/><span>{data?.dataNote || "Scores are loading."} Rankings are research outputs, not forecasts or personalized investment advice.</span></div>
  </section>;
}
