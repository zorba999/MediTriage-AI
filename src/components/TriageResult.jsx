import React, { useState, useEffect } from 'react';
import { TRIAGE_CFG } from '../constants';

// ── SEVERITY GAUGE ────────────────────────────────────────────────────────────

function SeverityGauge({ severity, colorKey }) {
  const targetPct = severity * 25; // 25 | 50 | 75 | 100
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let raf;
    let start = null;
    const dur = 900;
    function tick(ts) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setPct(Math.round(targetPct * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetPct]);

  const deg = pct * 3.6; // 0→360
  const labels = ['', 'Low', 'Moderate', 'High', 'Critical'];

  return (
    <div className="gauge" style={{ '--gdeg': `${deg}deg`, '--gcolor': `var(--c-${colorKey})` }}>
      <div className="gauge-track" />
      <div className="gauge-fill" />
      <div className="gauge-inner">
        <span className="gauge-n">{severity}</span>
        <span className="gauge-d">/4</span>
      </div>
      <span className="gauge-label">{labels[severity]}</span>
    </div>
  );
}

// ── TRIAGE RESULT ─────────────────────────────────────────────────────────────

function TriageResult({ result, txHash }) {
  const explorerUrl = 'https://explorer-bradbury.genlayer.com';
  const cfg = TRIAGE_CFG[result.triage_level] || TRIAGE_CFG.SOON;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`card result-card result-${cfg.colorKey} ${visible ? 'result-in' : ''}`}>

      {/* Top: level + gauge */}
      <div className="result-top">
        <div className="result-left">
          <div className={`result-badge badge-${cfg.colorKey}`}>
            <span className="result-badge-text">{cfg.label}</span>
          </div>
          <p className="result-action">{cfg.action}</p>
        </div>
        <SeverityGauge severity={cfg.severity} colorKey={cfg.colorKey} />
      </div>

      {/* Body: concern + advice + flags */}
      <div className="result-body">
        <div className="result-row">
          <span className="result-row-label">Key Concern</span>
          <p className="result-row-text">{result.key_concern || '—'}</p>
        </div>
        <div className="result-row">
          <span className="result-row-label">Recommended Action</span>
          <p className="result-row-text">{result.advice || '—'}</p>
        </div>
        {result.red_flags?.length > 0 && (
          <div className="result-row">
            <span className="result-row-label">Concerning Symptoms</span>
            <div className="flags">
              {result.red_flags.map((f, i) => (
                <span key={i} className={`flag flag-${cfg.colorKey}`}>{f}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer: blockchain badge */}
      <div className="result-foot">
        <div className="verified-badge">
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
            <path d="M10 1.5l2.2 5h5.3l-4.3 3.3 1.7 5.2L10 12l-4.9 3 1.7-5.2L2.5 6.5h5.3z"
              fill="currentColor"/>
          </svg>
          Verified by AI Consensus on GenLayer
        </div>
        {txHash && (
          <a className="tx-link" href={`${explorerUrl}/tx/${txHash}`}
            target="_blank" rel="noreferrer">View on Explorer ↗</a>
        )}
      </div>
    </div>
  );
}

export { SeverityGauge, TriageResult };
