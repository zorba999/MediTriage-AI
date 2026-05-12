import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import "./style.css";

// ─── Config ───────────────────────────────────────────────────────────────────
const CONTRACT_ADDRESS  = import.meta.env.VITE_CONTRACT_ADDRESS;
const FAUCET_URL        = "https://testnet-faucet.genlayer.foundation";
const BRADBURY_CHAIN_ID = "0x107d";
const EXPLORER_URL      = "https://explorer-bradbury.genlayer.com";

// ─── State ────────────────────────────────────────────────────────────────────
let client        = null;
let walletAddress = null;
let isLoading     = false;
let currentResult = null;
let history       = [];
let totalTriages  = 0;
let txHash        = null;
let txStatus      = null;
let txStep        = 0;

// ─── Bradbury Network ─────────────────────────────────────────────────────────
const BRADBURY_NETWORK = {
  chainId: BRADBURY_CHAIN_ID,
  chainName: "GenLayer Bradbury",
  rpcUrls: ["https://rpc-bradbury.genlayer.com"],
  nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
  blockExplorerUrls: [EXPLORER_URL],
};

// ─── Connect Wallet ───────────────────────────────────────────────────────────
async function connectWallet() {
  if (!window.ethereum) {
    alert("MetaMask is required. Please install MetaMask extension.");
    return;
  }

  try {
    // 1. Request MetaMask accounts
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    walletAddress = accounts[0];

    // 2. Switch / add Bradbury network
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BRADBURY_CHAIN_ID }],
      });
    } catch (e) {
      if (e.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [BRADBURY_NETWORK],
        });
      } else throw e;
    }

    // 3. Create client with MetaMask address (string) — genlayer-js uses
    //    window.ethereum automatically for signing when account is a string
    client = createClient({
      chain: testnetBradbury,
      account: walletAddress,   // ← string address = MetaMask signs
    });

    // 4. Listen for account changes
    window.ethereum.on("accountsChanged", async (accs) => {
      if (!accs.length) {
        disconnectWallet();
      } else {
        walletAddress = accs[0];
        client = createClient({ chain: testnetBradbury, account: walletAddress });
        await Promise.all([loadHistory(), loadStats()]);
        render();
      }
    });

    await Promise.all([loadHistory(), loadStats()]);
    render();

  } catch (err) {
    console.error("connectWallet:", err);
    alert("Connection failed: " + (err.message || err));
  }
}

function disconnectWallet() {
  client = null; walletAddress = null;
  history = []; currentResult = null;
  totalTriages = 0; txHash = null; txStatus = null; txStep = 0;
  render();
}

// ─── Parse result from transaction eqBlocksOutputs ───────────────────────────
function parseTriageFromTx(tx) {
  try {
    const hex = (tx.eqBlocksOutputs || "").replace("0x", "");
    if (!hex || hex === "c0") return null;

    const buf = Buffer.from(hex, "hex");

    // Helper: find field by ASCII name, skip length-prefix bytes, read text until control char
    function extractField(fieldName) {
      const nameBytes = Buffer.from(fieldName, "ascii");
      const idx = buf.indexOf(nameBytes);
      if (idx === -1) return "";
      let pos = idx + nameBytes.length;
      // Skip non-printable length-prefix bytes (CBOR-like encoding)
      while (pos < buf.length && (buf[pos] < 0x20 || buf[pos] > 0x7E)) pos++;
      // Read printable bytes
      let end = pos;
      while (end < buf.length && buf[end] >= 0x20) end++;
      return buf.slice(pos, end).toString("utf8").trim();
    }

    // triage_level: appears as "triage_level$SOON" or "triage_levelLHOME_CARE"
    // The byte before the value is a length byte (e.g. 0x24='$', 0x4C='L')
    // We need to skip that single length byte
    function extractTriageLevel() {
      const nameBytes = Buffer.from("triage_level", "ascii");
      const idx = buf.indexOf(nameBytes);
      if (idx === -1) return "SOON";
      let pos = idx + nameBytes.length;
      // Skip exactly 1 length byte
      pos++;
      // Read uppercase letters and underscores only
      let end = pos;
      while (end < buf.length && (
        (buf[end] >= 0x41 && buf[end] <= 0x5A) || buf[end] === 0x5F
      )) end++;
      return buf.slice(pos, end).toString("ascii") || "SOON";
    }

    // key_concern: contract stores as "key_concern" field
    function extractConcern() {
      // Try "key_concern" first
      const kc = extractField("key_concern");
      if (kc.length > 5) return kc;
      // Fallback: try standalone "concern"
      const nameBytes = Buffer.from("concern", "ascii");
      let searchFrom = 0;
      while (searchFrom < buf.length) {
        const idx = buf.indexOf(nameBytes, searchFrom);
        if (idx === -1) break;
        if (idx === 0 || buf[idx - 1] < 0x20) {
          let pos = idx + nameBytes.length;
          while (pos < buf.length && (buf[pos] < 0x20 || buf[pos] > 0x7E)) pos++;
          let end = pos;
          while (end < buf.length && buf[end] >= 0x20) end++;
          const text = buf.slice(pos, end).toString("utf8").trim();
          if (text.length > 10) return text;
        }
        searchFrom = idx + 1;
      }
      return "";
    }

    const triage_level = extractTriageLevel();
    const advice       = extractField("advice");
    const key_concern  = extractConcern();

    // red_flags: custom encoding between "red_flags" and "triage_level"
    // Separator bytes between flags include 0x54 ('T') and multi-byte sequences
    const red_flags = [];
    const rfNameBuf = Buffer.from("red_flags", "ascii");
    const rfIdx = buf.indexOf(rfNameBuf);
    if (rfIdx !== -1) {
      const triageBuf = Buffer.from("triage_level", "ascii");
      const triageIdx = buf.indexOf(triageBuf, rfIdx);
      const endPos = triageIdx !== -1 ? triageIdx : Math.min(rfIdx + 400, buf.length);

      // Get the raw section as string, then split smartly
      // Skip the first few non-printable bytes after "red_flags"
      let pos = rfIdx + rfNameBuf.length;
      // Skip up to 4 header bytes
      let headerSkip = 0;
      while (pos < endPos && headerSkip < 4 && (buf[pos] < 0x41 || buf[pos] > 0x7A)) {
        pos++; headerSkip++;
      }

      // Now read the section as UTF-8 and split on non-letter/space boundaries
      const section = buf.slice(pos, endPos).toString("utf8");

      // Split on sequences of non-word chars (control chars + single uppercase letters used as separators)
      // The pattern: text ends, then 1-3 bytes of garbage, then next text starts
      const flagCandidates = section.split(/[\x00-\x1f\x80-\xff]+/);

      for (const candidate of flagCandidates) {
        // Clean printable only
        const clean = candidate.replace(/[^\x20-\x7E]/g, "").trim();
        // A valid flag: has lowercase letters, reasonable length, not just uppercase
        if (clean.length >= 6 && /[a-z]{3}/.test(clean) && !/^[A-Z_]+$/.test(clean)) {
          // Further split on uppercase letter that acts as separator (e.g. "breathingTchest")
          const subParts = clean.split(/(?<=[a-z])T(?=[a-z])/);
          for (const part of subParts) {
            const p = part.trim();
            if (p.length >= 6 && /[a-z]{3}/.test(p)) {
              red_flags.push(p);
              if (red_flags.length >= 6) break;
            }
          }
        }
        if (red_flags.length >= 6) break;
      }
    }

    return { triage_level, advice, key_concern, red_flags };
  } catch (e) {
    console.error("parseTriageFromTx:", e);
    return null;
  }
}

// ─── Contract Reads ───────────────────────────────────────────────────────────
async function loadHistory() {
  if (!client || !CONTRACT_ADDRESS) return;
  try {
    const r = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_my_history",
      args: [],
    });
    history = Array.isArray(r) ? r : [];
  } catch (e) { console.error("history:", e.message); history = []; }
}

async function loadStats() {
  if (!client || !CONTRACT_ADDRESS) return;
  try {
    const t = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_total_triages",
      args: [],
    });
    totalTriages = Number(t) || 0;
  } catch (e) { console.error("stats:", e.message); }
}

// ─── Poll for result ──────────────────────────────────────────────────────────
// Keeps polling history until a new entry appears (handles FINALIZED delay)
async function pollForResult(prevCount, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 5000));
    await loadHistory();
    if (history.length > prevCount) return true;
  }
  return false;
}

// ─── Submit ───────────────────────────────────────────────────────────────────
window.handleSubmit = async function () {
  const symptoms = document.getElementById("symptoms")?.value?.trim();
  const age      = parseInt(document.getElementById("age")?.value);
  const language = document.getElementById("language")?.value;

  if (!symptoms)                    { alert("Please describe your symptoms."); return; }
  if (!age || age < 0 || age > 120) { alert("Please enter a valid age (0-120)."); return; }
  if (!client)                      { alert("Please connect your wallet first."); return; }
  if (!CONTRACT_ADDRESS)            { alert("Contract not deployed."); return; }

  isLoading = true; currentResult = null;
  txHash = null; txStatus = "Submitting..."; txStep = 1;
  render();

  try {
    const hash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "submit_symptoms",
      args: [symptoms, age, language],
      value: BigInt(0),
    });

    txHash = hash;
    txStatus = "Waiting for AI consensus (~2 min)...";
    txStep = 2;
    render();

    // Wait for ACCEPTED — result is available in eqBlocksOutputs
    const receipt = await client.waitForTransactionReceipt({
      hash,
      status: "ACCEPTED",
      retries: 120,
      interval: 5000,
    });

    txStatus = "Accepted! Parsing result...";
    txStep = 3;
    render();

    // Parse result directly from transaction data (no need for FINALIZED)
    const tx = await client.getTransaction({ hash });
    const parsed = parseTriageFromTx(tx);

    if (parsed && parsed.triage_level) {
      currentResult = parsed;
    } else {
      // Fallback: try get_my_history after a short wait
      await new Promise(r => setTimeout(r, 5000));
      await loadHistory();
      if (history.length > 0) {
        try { currentResult = JSON.parse(history[history.length - 1]); }
        catch (e) { console.error("parse history:", e); }
      }
    }

    await loadStats();
    txStatus = null; txStep = 0;
  } catch (err) {
    console.error("submit:", err);
    txStatus = null; txStep = 0;
    alert("Transaction failed: " + (err?.shortMessage || err?.message || "Unknown error"));
  } finally {
    isLoading = false;
    render();
  }
};

window.connectWallet    = connectWallet;
window.disconnectWallet = disconnectWallet;

// ─── Render ───────────────────────────────────────────────────────────────────
function render() {
  document.getElementById("app").innerHTML = `
    <div class="app">
      ${renderHeader()}
      <main class="main">
        <div class="container">
          ${renderInfoBanner()}
          ${walletAddress ? renderForm() : renderConnectCard()}
          ${currentResult ? renderResult(currentResult) : ""}
          ${history.length > 0 ? renderHistory() : ""}
          ${renderHowItWorks()}
        </div>
      </main>
      ${renderFooter()}
    </div>
  `;
}

function renderHeader() {
  return `
    <header class="header">
      <div class="header-inner">
        <div class="logo">
          <span class="logo-icon">🩺</span>
          <div><h1>MediTriage AI</h1><p>Decentralized Medical Triage on GenLayer</p></div>
        </div>
        <div class="header-right">
          <div class="stat">
            <span class="stat-value">${totalTriages}</span>
            <span class="stat-label">Total Triages</span>
          </div>
          ${walletAddress
            ? `<div class="wallet-connected">
                <span class="wallet-dot"></span>
                <span class="wallet-addr">${walletAddress.slice(0,6)}...${walletAddress.slice(-4)}</span>
                <button class="disconnect-btn" onclick="window.disconnectWallet()">Disconnect</button>
               </div>`
            : `<button class="connect-btn" onclick="window.connectWallet()">🦊 Connect Wallet</button>`
          }
        </div>
      </div>
    </header>
  `;
}

function renderConnectCard() {
  return `
    <div class="card connect-card">
      <div class="connect-icon">🩺</div>
      <h2>Connect to Start</h2>
      <p>Connect your wallet to submit symptoms and get AI-powered triage on GenLayer Bradbury testnet.</p>
      <button class="submit-btn" onclick="window.connectWallet()" style="max-width:260px;margin:0 auto 24px;">
        🦊 Connect Wallet
      </button>
      <div class="connect-steps">
        <div class="connect-step"><span>1.</span> Install <a href="https://metamask.io" target="_blank">MetaMask</a> (optional)</div>
        <div class="connect-step"><span>2.</span> Click Connect — Bradbury network added automatically</div>
        <div class="connect-step"><span>3.</span> Get test GEN from <a href="${FAUCET_URL}" target="_blank">faucet</a> if needed</div>
      </div>
    </div>
  `;
}

function renderInfoBanner() {
  return `
    <div class="info-banner">
      <span class="info-icon">ℹ️</span>
      <p><strong>Triage guidance only</strong> — not medical diagnosis. Powered by multi-model AI consensus on GenLayer. Always consult a qualified healthcare professional.</p>
    </div>
  `;
}

function renderForm() {
  return `
    <div class="card form-card">
      <h2>Describe Your Symptoms</h2>
      <p class="card-subtitle">Be as specific as possible for better accuracy</p>
      <div class="form-group">
        <label for="symptoms">Symptoms <span class="required">*</span></label>
        <textarea id="symptoms" placeholder="e.g. I have had a fever of 38.5°C for 2 days, with a dry cough and fatigue..." rows="4"></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="age">Patient Age <span class="required">*</span></label>
          <input type="number" id="age" placeholder="e.g. 35" min="0" max="120" />
        </div>
        <div class="form-group">
          <label for="language">Language</label>
          <select id="language">
            <option value="english">English</option>
            <option value="french">Français</option>
            <option value="arabic">العربية</option>
            <option value="spanish">Español</option>
            <option value="portuguese">Português</option>
            <option value="german">Deutsch</option>
            <option value="chinese">中文</option>
          </select>
        </div>
      </div>
      <button class="submit-btn ${isLoading ? "loading" : ""}" ${isLoading ? "disabled" : ""} onclick="window.handleSubmit()">
        ${isLoading ? `<span class="spinner"></span> Analyzing...` : `🔍 Analyze Symptoms`}
      </button>
      ${isLoading ? renderProgress() : ""}
    </div>
  `;
}

function renderProgress() {
  const steps = [
    { label: "Transaction submitted to GenLayer", active: txStep >= 1 },
    { label: "AI validators analyzing symptoms",  active: txStep >= 2 },
    { label: txStatus || "Finalizing result...",  active: txStep >= 3 },
  ];
  return `
    <div class="consensus-info">
      ${steps.map((s, i) => `
        <div class="consensus-step ${s.active ? "active" : ""}">
          <span class="step-dot"></span>
          ${s.label}
          ${i === 0 && txHash ? `<a href="${EXPLORER_URL}/tx/${txHash}" target="_blank" class="tx-link">View TX ↗</a>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function renderResult(result) {
  const map = {
    EMERGENCY: { color: "red",    icon: "🚨", title: "EMERGENCY",       sub: "Go to Emergency Room immediately" },
    URGENT:    { color: "orange", icon: "⚠️", title: "URGENT",          sub: "See a doctor within 24-48 hours" },
    SOON:      { color: "yellow", icon: "📅", title: "SEE DOCTOR SOON", sub: "Schedule an appointment this week" },
    HOME_CARE: { color: "green",  icon: "🏠", title: "HOME CARE",       sub: "Rest at home and monitor symptoms" },
  };
  const cfg = map[result.triage_level] || map.SOON;
  return `
    <div class="card result-card result-${cfg.color}">
      <div class="result-header">
        <span class="result-icon">${cfg.icon}</span>
        <div>
          <h2 class="result-title">${cfg.title}</h2>
          <p class="result-subtitle">${cfg.sub}</p>
        </div>
      </div>
      <div class="result-body">
        <div class="result-section"><h3>Key Concern</h3><p>${result.key_concern || "—"}</p></div>
        <div class="result-section"><h3>Recommended Action</h3><p>${result.advice || "—"}</p></div>
        ${result.red_flags?.length ? `
        <div class="result-section">
          <h3>Concerning Symptoms</h3>
          <div class="flags">${result.red_flags.map(f => `<span class="flag">${f}</span>`).join("")}</div>
        </div>` : ""}
      </div>
      <div class="result-footer">
        <span class="blockchain-badge">✅ Verified by AI Consensus on GenLayer</span>
      </div>
    </div>
  `;
}

function renderHistory() {
  const icons = { EMERGENCY: "🚨", URGENT: "⚠️", SOON: "📅", HOME_CARE: "🏠" };
  return `
    <div class="card history-card">
      <h2>Your Triage History</h2>
      <div class="history-list">
        ${[...history].reverse().map(entry => {
          try {
            const d = JSON.parse(entry);
            const lvl = d.triage_level || "SOON";
            return `
              <div class="history-item history-${lvl.toLowerCase().replace("_","-")}">
                <span class="history-icon">${icons[lvl] || "📋"}</span>
                <div class="history-content">
                  <strong>${lvl.replace("_"," ")}</strong>
                  <p>${(d.symptoms_input||"").slice(0,80)}${(d.symptoms_input||"").length>80?"...":""}</p>
                </div>
              </div>`;
          } catch { return ""; }
        }).join("")}
      </div>
    </div>
  `;
}

function renderHowItWorks() {
  return `
    <div class="card how-card">
      <h2>How It Works</h2>
      <div class="steps">
        <div class="step"><div class="step-num">1</div><div><h3>Connect Wallet</h3><p>Connect MetaMask — Bradbury network added automatically.</p></div></div>
        <div class="step"><div class="step-num">2</div><div><h3>Submit Symptoms</h3><p>Describe symptoms in any language. Transaction goes on-chain.</p></div></div>
        <div class="step"><div class="step-num">3</div><div><h3>AI Consensus</h3><p>5+ validator nodes with different AI models independently analyze.</p></div></div>
        <div class="step"><div class="step-num">4</div><div><h3>Verified Result</h3><p>Majority consensus determines triage level. Immutable on-chain.</p></div></div>
      </div>
    </div>
  `;
}

function renderFooter() {
  return `
    <footer class="footer">
      <p>
        Built on <a href="https://genlayer.com" target="_blank">GenLayer</a> Bradbury Testnet ·
        <a href="${FAUCET_URL}" target="_blank">Get Test GEN</a> ·
        Contract: <code>${CONTRACT_ADDRESS ? CONTRACT_ADDRESS.slice(0,10)+"..." : "Not deployed"}</code>
      </p>
    </footer>
  `;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
render();
