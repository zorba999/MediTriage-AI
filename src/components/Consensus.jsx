import React from 'react';
import { VALIDATOR_POSITIONS, VALIDATOR_LABELS } from '../constants';

// ── VALIDATOR NETWORK ─────────────────────────────────────────────────────────

function ValidatorNetwork({ states }) {
  const pos = VALIDATOR_POSITIONS;
  const lbl = VALIDATOR_LABELS;

  // All pairs of lines (10 pairs for 5 nodes)
  const pairs = [];
  for (let i = 0; i < pos.length; i++)
    for (let j = i + 1; j < pos.length; j++)
      pairs.push([i, j]);

  return (
    <div className="vnet">
      {/* SVG lines */}
      <svg className="vnet-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        {pairs.map(([i, j]) => {
          const agreed = (states[i] === 'agreed' || states[i] === 'consensus') &&
                         (states[j] === 'agreed' || states[j] === 'consensus');
          const active = states[i] !== 'idle' && states[j] !== 'idle';
          return (
            <line key={`${i}-${j}`}
              x1={pos[i].x} y1={pos[i].y}
              x2={pos[j].x} y2={pos[j].y}
              className={`vline ${active ? 'vline-on' : ''} ${agreed ? 'vline-agreed' : ''}`}
            />
          );
        })}
      </svg>

      {/* Nodes */}
      {pos.map((p, i) => {
        const s = states[i];
        return (
          <div key={i}
            className={`vnode vnode-${s}`}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}>
            {(s === 'agreed' || s === 'consensus')
              ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 7l3.5 3.5 5.5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              : <span className="vnode-lbl">{lbl[i]}</span>
            }
            {s === 'analyzing' && <div className="vnode-ping" />}
          </div>
        );
      })}
    </div>
  );
}

// ── CONSENSUS TRACKER ─────────────────────────────────────────────────────────

function ConsensusTracker({ txStep, txHash, validatorStates }) {
  const agreedCount = validatorStates.filter(s => s === 'agreed' || s === 'consensus').length;
  const explorerUrl = 'https://explorer-bradbury.genlayer.com';

  const steps = [
    { label: 'Transaction submitted to GenLayer',    done: txStep >= 1 },
    { label: 'AI validators analyzing symptoms',     done: txStep >= 2 },
    { label: 'Consensus reached — parsing result',  done: txStep >= 3 },
  ];

  return (
    <div className="card consensus-card">
      {/* Header row */}
      <div className="consensus-hd">
        <div>
          <h2>AI Consensus in Progress</h2>
          <p className="card-sub">Multiple validator nodes analyzing independently</p>
        </div>
        <div className="consensus-counter">
          <span className="cc-num">{agreedCount}</span>
          <span className="cc-denom">/5</span>
          <span className="cc-label">agreed</span>
        </div>
      </div>

      {/* Validator network visualization */}
      <ValidatorNetwork states={validatorStates} />

      {/* Progress steps */}
      <div className="csteps">
        {steps.map((s, i) => (
          <div key={i} className={`cstep ${s.done ? 'cstep-done' : ''} ${(i === 1 && txStep === 2) ? 'cstep-active' : ''}`}>
            <div className="cstep-dot" />
            <span className="cstep-label">{s.label}</span>
            {i === 0 && txHash && (
              <a className="tx-link" href={`${explorerUrl}/tx/${txHash}`} target="_blank" rel="noreferrer">
                View TX ↗
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export { ValidatorNetwork, ConsensusTracker };
