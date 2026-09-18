"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ScreenerRow, SearchFactorKey } from "@/lib/types";
import { SEARCH_FACTOR_LABELS } from "@/lib/types";
import { CloseIcon, PlusIcon, ShieldIcon, SparkIcon } from "./Icons";

type Props = {
  ticker: string;
  row: ScreenerRow | null;
  loading: boolean;
  error: string;
  held: boolean;
  onClose: () => void;
  onTrade: (row: ScreenerRow) => void;
};

const factorCopy: Record<SearchFactorKey, { good: string; bad: string }> = {
  quality: {
    good: "The quality model sees stronger profitability, resilience, and competitive durability than most of the universe.",
    bad: "The quality profile is less convincing, suggesting thinner business defenses or less dependable profitability."
  },
  earnings: {
    good: "Forward earnings expectations are moving in a supportive direction, which can provide a fundamental catalyst.",
    bad: "Earnings revisions are not providing much support and may signal cooling expectations or limited visibility."
  },
  momentum: {
    good: "Price action is confirming the fundamental story instead of fighting it.",
    bad: "The market trend is weak, so improving fundamentals may not yet be recognized by investors."
  },
  billionaire: {
    good: "Delayed institutional filings show relatively strong conviction among large professional holders.",
    bad: "Institutional-conviction evidence is limited or below the broader research universe."
  },
  quietCompounder: {
    good: "Fundamental improvement appears stronger than the surrounding narrative, leaving room for discovery.",
    bad: "The quiet-compounder signal is muted, so the opportunity may already be well understood or lack acceleration."
  },
  value: {
    good: "The valuation model finds meaningful support relative to cash-flow and peer expectations.",
    bad: "The valuation leaves less room for disappointment and may require unusually strong execution."
  }
};

const analysisLabels: Record<SearchFactorKey, string> = {
  quality: "Business quality",
  earnings: "Earnings direction",
  momentum: "Market confirmation",
  billionaire: "Institutional evidence",
  quietCompounder: "Underfollowed growth",
  value: "Valuation support"
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value >= 1_000 ? 0 : 2 }).format(value);
}

function compactMoney(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", style: "currency", currency: "USD", maximumFractionDigits: 1 }).format(value);
}

function scoreLabel(score: number) {
  if (score >= 80) return "Strong";
  if (score >= 65) return "Supportive";
  if (score >= 50) return "Mixed";
  return "Caution";
}

function tone(score: number) {
  if (score >= 70) return "positive";
  if (score < 50) return "negative";
  return "neutral";
}

export default function StockResearchModal({ ticker, row, loading, error, held, onClose, onTrade }: Props) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key === "Tab" && dialog.current) {
        const focusable = [...dialog.current.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])")];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable.at(-1)!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, []);

  const rankedFactors = useMemo(() => row
    ? (Object.entries(row.factorScores) as [SearchFactorKey, number][]).sort((a, b) => b[1] - a[1])
    : [], [row]);
  const balanceSheetScore = row ? Math.round(row.factorScores.quality * .65 + row.factorScores.value * .2 + row.factorScores.earnings * .15) : 0;

  return <div className="stock-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} className="stock-modal" role="dialog" aria-modal="true" aria-labelledby="stock-research-title">
      <header className="stock-modal-header">
        <div className="stock-modal-identity">
          <span className="ticker-mark modal-mark">{ticker.slice(0, 2)}</span>
          <div><span className="kicker">COMPANY RESEARCH</span><h2 id="stock-research-title">{row?.company || ticker}</h2>{row && <p>{row.ticker} · {row.sector} · {row.industry}</p>}</div>
        </div>
        <button ref={closeButton} type="button" className="stock-modal-close" onClick={onClose} aria-label="Close company research"><CloseIcon size={20}/></button>
      </header>

      {loading && <div className="stock-modal-loading"><span/><div><b>Building the research page for {ticker}</b><p>Collecting the latest universe record and factor evidence…</p></div></div>}
      {!loading && error && <div className="stock-modal-error"><ShieldIcon size={22}/><div><b>Research page unavailable</b><p>{error}</p></div></div>}

      {!loading && row && <div className="stock-modal-body">
        <main className="stock-modal-main">
          <section className="research-section company-overview">
            <div className="section-label"><span>01</span><b>Company overview</b></div>
            <p><strong>{row.company}</strong> operates in the {row.industry} industry within {row.sector}. It is {row.isAdr ? "an ADR representing a foreign-listed business" : "a US-listed common stock"} associated with {row.country} and ranks <strong>#{row.marketCapRank.toLocaleString()}</strong> in SignalForge&apos;s market-cap universe.</p>
            <div className="overview-facts">
              <div><small>PRICE</small><strong>{money(row.price)}</strong><span className={row.changePct >= 0 ? "positive" : "negative"}>{row.changePct >= 0 ? "+" : ""}{row.changePct}% session</span></div>
              <div><small>MARKET CAP</small><strong>{compactMoney(row.marketCap)}</strong><span>Universe rank #{row.marketCapRank}</span></div>
              <div><small>COMPOSITE</small><strong>{row.compositeScore}<em>/100</em></strong><span>Six searchable factors</span></div>
              <div><small>QUOTE MODE</small><strong className={row.factorStatus.momentum === "live" ? "positive" : "amber"}>{row.factorStatus.momentum}</strong><span>{row.provenance.momentum} source</span></div>
            </div>
          </section>

          <section className="research-section">
            <div className="section-label"><span>02</span><b>Fundamental health</b><small>Research scores, not reported accounting figures</small></div>
            <div className="fundamental-grid">
              <article><div><small>PROFITABILITY &amp; MOAT</small><b className={tone(row.factorScores.quality)}>{scoreLabel(row.factorScores.quality)}</b></div><strong>{row.factorScores.quality}</strong><span className="factor-bar"><i style={{width: `${row.factorScores.quality}%`}}/></span><p>Relative durability, profitability, and balance-sheet quality.</p></article>
              <article><div><small>EARNINGS DIRECTION</small><b className={tone(row.factorScores.earnings)}>{scoreLabel(row.factorScores.earnings)}</b></div><strong>{row.factorScores.earnings}</strong><span className="factor-bar"><i style={{width: `${row.factorScores.earnings}%`}}/></span><p>Direction and breadth of modeled forward estimate revisions.</p></article>
              <article><div><small>BALANCE-SHEET PROXY</small><b className={tone(balanceSheetScore)}>{scoreLabel(balanceSheetScore)}</b></div><strong>{balanceSheetScore}</strong><span className="factor-bar"><i style={{width: `${balanceSheetScore}%`}}/></span><p>Combined resilience proxy from quality, earnings, and valuation evidence.</p></article>
              <article><div><small>VALUATION SUPPORT</small><b className={tone(row.factorScores.value)}>{scoreLabel(row.factorScores.value)}</b></div><strong>{row.factorScores.value}</strong><span className="factor-bar"><i style={{width: `${row.factorScores.value}%`}}/></span><p>Relative cash-flow and earnings value versus comparable businesses.</p></article>
            </div>
          </section>

          <section className="research-section">
            <div className="section-label"><span>03</span><b>Financial analysis</b><small>SignalForge interpretation</small></div>
            <div className="analysis-list">{rankedFactors.map(([key, score]) => <article key={key}><div><span>{analysisLabels[key]}</span><small>{row.factorStatus[key]} · {row.provenance[key]}</small></div><span className="factor-bar"><i style={{width: `${score}%`}}/></span><strong>{score}</strong></article>)}</div>
            <p className="analysis-summary">{row.thesis}</p>
          </section>

          <section className="research-section good-bad-grid">
            <article className="case-card bull-case"><div className="case-title"><SparkIcon size={17}/><div><small>WHAT LOOKS GOOD</small><h3>Reasons the thesis could work</h3></div></div><ul>{rankedFactors.slice(0, 3).map(([key]) => <li key={key}>{factorCopy[key].good}</li>)}</ul></article>
            <article className="case-card bear-case"><div className="case-title"><ShieldIcon size={17}/><div><small>WHAT LOOKS BAD</small><h3>Reasons to be cautious</h3></div></div><ul>{rankedFactors.slice(-3).reverse().map(([key]) => <li key={key}>{factorCopy[key].bad}</li>)}<li>{row.risk}</li></ul></article>
          </section>

          <div className="research-method-note"><ShieldIcon size={17}/><p><b>Know what is modeled.</b> Company classification and market capitalization come from the security master. Factor scores and this written interpretation are research-model outputs unless explicitly marked live. They are not audited financial statements or investment advice.</p></div>
        </main>

        <aside className="stock-modal-side">
          <div className="modal-score-card"><small>COMPOSITE CONVICTION</small><strong>{row.compositeScore}<span>/100</span></strong><div className="modal-score-track"><i style={{width: `${row.compositeScore}%`}}/></div><p>{row.compositeScore >= 75 ? "Several independent signals agree." : row.compositeScore >= 60 ? "The evidence is constructive but mixed." : "Conviction is limited; examine the risks carefully."}</p></div>
          <div className="modal-factor-summary"><span className="kicker">FACTOR SNAPSHOT</span>{rankedFactors.map(([key, score]) => <div key={key}><span>{SEARCH_FACTOR_LABELS[key]}</span><b>{score}</b></div>)}</div>
          <button className="primary modal-trade" type="button" onClick={() => onTrade(row)}><PlusIcon size={16}/>{held ? "Trade existing position" : "Open paper trade ticket"}</button>
          <p className="modal-trade-note">Paper simulation only. The order ticket opens with the latest displayed price.</p>
        </aside>
      </div>}
    </section>
  </div>;
}
