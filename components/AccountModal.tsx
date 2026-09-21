"use client";

import { useEffect, useState } from "react";
import type { AuthUser, PaperPortfolioAccount, SavedPortfolio } from "@/lib/types";
import { CloseIcon, RadarIcon, ShieldIcon } from "./Icons";

type Props = {
  open: boolean;
  user: AuthUser | null;
  storageReady: boolean;
  importedAccount: PaperPortfolioAccount | null;
  onClose: () => void;
  onAuthenticated: (user: AuthUser, portfolio?: SavedPortfolio) => void;
  onLogout: () => void;
};

export default function AccountModal({ open, user, storageReady, importedAccount, onClose, onAuthenticated, onLogout }: Props) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/${mode === "register" ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, importedAccount: mode === "register" ? importedAccount : undefined })
      });
      const result = await response.json() as { user?: AuthUser; portfolio?: SavedPortfolio; error?: string };
      if (!response.ok || !result.user) throw new Error(result.error || "Account request failed.");
      onAuthenticated(result.user, result.portfolio);
      setPassword("");
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Account request failed.");
    } finally { setPending(false); }
  }

  async function logout() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    setPending(false);
    onLogout();
    onClose();
  }

  return <div className="auth-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="auth-modal-header"><span className="brand-mark"><RadarIcon size={20}/></span><div><span className="kicker">SIGNALFORGE ACCOUNT</span><h2 id="auth-title">{user ? `Welcome, ${user.name}` : mode === "register" ? "Keep every portfolio." : "Welcome back."}</h2></div><button className="auth-close" aria-label="Close account dialog" onClick={onClose}><CloseIcon size={18}/></button></div>
      {user ? <div className="account-profile">
        <div className="profile-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
        <div><b>{user.name}</b><span>{user.email}</span></div>
        <div className="account-benefits"><span><ShieldIcon size={15}/> Portfolios are saved in your private cloud account.</span><span><RadarIcon size={15}/> Your enabled AI agents continue on scheduled market scans.</span></div>
        <button className="secondary-button" disabled={pending} onClick={logout}>Sign out</button>
      </div> : <>
        <p className="auth-intro">{mode === "register" ? "Create a private account to sync multiple paper portfolios across devices and keep them through every SignalForge release." : "Sign in to load your saved portfolios and AI-agent settings."}</p>
        {!storageReady && <div className="auth-warning"><ShieldIcon size={17}/> Persistent storage is not connected yet. Account creation will become available after deployment setup.</div>}
        <div className="auth-tabs"><button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Create account</button><button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Sign in</button></div>
        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && <label>NAME<input autoFocus autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" required minLength={2}/></label>}
          <label>EMAIL<input autoFocus={mode === "login"} autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required/></label>
          <label>PASSWORD<input autoComplete={mode === "register" ? "new-password" : "current-password"} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="10+ characters" required minLength={10}/></label>
          {mode === "register" && <small>Use at least 10 characters with a letter and a number.{importedAccount ? " Your current local portfolio will be imported automatically." : ""}</small>}
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="primary auth-submit" type="submit" disabled={pending || !storageReady}>{pending ? "Please wait…" : mode === "register" ? "Create secure account" : "Sign in"}</button>
        </form>
      </>}
    </section>
  </div>;
}
