import React, { useState } from 'react';
import { TRIAGE_CFG } from '../constants';

function HistoryList({ history }) {
  const [open, setOpen] = useState(true);
  if (!history.length) return null;
  return (
    <div className="card">
      <button className="history-toggle" onClick={() => setOpen((o) => !o)}>
        <h2>Your Triage History <span className="history-count">{history.length}</span></h2>
        <span className={`chevron ${open ? 'chevron-up' : ''}`}>›</span>
      </button>
      {open &&
      <div className="history-list">
          {[...history].reverse().map((entry, i) => {
          const d = typeof entry === 'string' ? JSON.parse(entry) : entry;
          const lvl = d.triage_level || 'SOON';
          const ck = (TRIAGE_CFG[lvl] || TRIAGE_CFG.SOON).colorKey;
          return (
            <div key={i} className="history-item">
                <div className={`h-dot dot-${ck}`} />
                <div className="h-content">
                  <span className={`h-badge badge-${ck}`}>{lvl.replace('_', ' ')}</span>
                  <p className="h-symp">{(d.symptoms_input || '').slice(0, 90)}{(d.symptoms_input || '').length > 90 ? '…' : ''}</p>
                </div>
              </div>);

        })}
        </div>
      }
    </div>);

}

export { HistoryList };
