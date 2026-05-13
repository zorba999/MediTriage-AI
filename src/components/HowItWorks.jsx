import React from 'react';

function HowItWorks() {
  const steps = [
  { n: '01', title: 'Connect Wallet', body: 'MetaMask connects to GenLayer Bradbury testnet automatically — no manual network config.' },
  { n: '02', title: 'Submit Symptoms', body: 'Describe symptoms in any language. Signed transaction goes on-chain immutably.' },
  { n: '03', title: 'AI Consensus', body: '5+ validator nodes with different LLMs independently analyze and vote on triage level.' },
  { n: '04', title: 'Verified Result', body: 'Majority consensus determines triage level. Auditable by anyone on GenLayer explorer.' }];

  return (
    <div className="card how-card">
      <h2>How It Works</h2>
      <div className="how-grid">
        {steps.map((s, i) =>
        <div key={i} className="how-step">
            <span className="how-num">{s.n}</span>
            <div>
              <h3 className="how-title">{s.title}</h3>
              <p className="how-body">{s.body}</p>
            </div>
          </div>
        )}
      </div>
    </div>);

}

export { HowItWorks };
