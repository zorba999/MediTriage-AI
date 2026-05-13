import React from 'react';

// ── ECG LINE ──────────────────────────────────────────────────────────────────

function EcgLine() {
  return (
    <svg className="ecg-svg" viewBox="0 0 240 32" preserveAspectRatio="none">
      <path className="ecg-path"
      d="M0,16 L30,16 L38,16 L42,4 L46,28 L50,4 L54,16 L62,16 L66,12 L70,16 L100,16 L108,16 L112,4 L116,28 L120,4 L124,16 L132,16 L136,12 L140,16 L170,16 L178,16 L182,4 L186,28 L190,4 L194,16 L202,16 L206,12 L210,16 L240,16" />

    </svg>);

}

// ── ANIMATED BACKGROUND ───────────────────────────────────────────────────────

function AnimatedBg() {
  return (
    <div className="bg-canvas" aria-hidden="true">
      <div className="bg-blob bg-blob-1" />
      <div className="bg-blob bg-blob-2" />
      <div className="bg-grid" />
    </div>);

}

// ── HEADER ────────────────────────────────────────────────────────────────────

function Header({ walletAddress, totalTriages, onConnect, onDisconnect }) {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 28 28" fill="none">
              <rect x="11" y="2" width="6" height="24" rx="2" fill="currentColor" />
              <rect x="2" y="11" width="24" height="6" rx="2" fill="currentColor" />
            </svg>
          </div>
          <div className="logo-text-wrap">
            <span className="logo-name">MediTriage<span className="logo-ai"> AI</span></span>
            <span className="logo-tagline">Decentralized · GenLayer</span>
          </div>
          <div className="logo-ecg"><EcgLine /></div>
        </div>

        <div className="header-right">
          <div className="stat-chip">
            <span className="stat-n">{totalTriages.toLocaleString()}</span>
            <span className="stat-l">triages</span>
          </div>
          {walletAddress ?
          <div className="wallet-pill">
              <span className="wallet-dot" />
              <span className="wallet-addr">{walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</span>
              <button className="wallet-x" onClick={onDisconnect} title="Disconnect">✕</button>
            </div> :

          <button className="btn-connect-sm" onClick={onConnect}>
              Connect
            </button>
          }
        </div>
      </div>
    </header>);

}

// ── DISCLAIMER BANNER ─────────────────────────────────────────────────────────

function DisclaimerBanner() {
  return (
    <div className="disclaimer">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, marginTop: '1px' }}>
        <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10 6.5v4.5M10 13.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <p><strong>Triage guidance only — not a medical diagnosis.</strong> Powered by multi-model AI consensus on GenLayer. Always consult a qualified healthcare professional.</p>
    </div>);

}

// ── FOOTER ────────────────────────────────────────────────────────────────────

function SiteFooter({ faucetUrl }) {
  return (
    <footer className="site-footer">
      <span>Built on <a href="https://genlayer.com" target="_blank" rel="noreferrer">GenLayer</a> Bradbury Testnet</span>
      <span className="fsep">·</span>
      <a href={faucetUrl} target="_blank" rel="noreferrer">Get Test GEN</a>
      <span className="fsep">·</span>
      <span>Not medical advice</span>
    </footer>);

}

export { EcgLine, AnimatedBg, Header, DisclaimerBanner, SiteFooter };
