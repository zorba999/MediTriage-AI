import React from 'react';

function ConnectScreen({ onConnect }) {
  return (
    <div className="connect-screen">
      <div className="pulse-rings">
        <div className="pring pring-1" />
        <div className="pring pring-2" />
        <div className="pring pring-3" />
        <div className="pring-icon">
          <svg viewBox="0 0 40 40" fill="none">
            <rect x="16" y="2" width="8" height="36" rx="3" fill="currentColor" />
            <rect x="2" y="16" width="36" height="8" rx="3" fill="currentColor" />
          </svg>
        </div>
      </div>
      <h2 className="connect-title">AI-Powered Medical<br />Triage On-Chain</h2>
      <p className="connect-desc">Describe your symptoms. 5+ AI validator nodes independently analyze and reach consensus. Result stored immutably on GenLayer.</p>
      <button className="btn-connect-primary" onClick={onConnect} style={{ margin: '0 auto 28px', display: 'flex' }}>
        Connect Wallet
      </button>
      <div className="connect-pills">
        <span className="cpill cpill-blue">Multi-model AI</span>
        <span className="cpill cpill-green">On-chain results</span>
        <span className="cpill cpill-purple">Any language</span>
      </div>
    </div>);

}

export { ConnectScreen };
