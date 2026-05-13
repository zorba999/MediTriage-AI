import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { Buffer } from 'buffer';

import { AnimatedBg, Header, DisclaimerBanner, SiteFooter } from './components/Layout';
import { ConnectScreen } from './components/ConnectScreen';
import { TriageForm } from './components/TriageForm';
import { ConsensusTracker } from './components/Consensus';
import { TriageResult } from './components/TriageResult';
import { HistoryList } from './components/HistoryList';
import { HowItWorks } from './components/HowItWorks';

// Polyfill Buffer for browser (needed by parseTriageFromTx)
if (typeof window !== 'undefined' && !window.Buffer) window.Buffer = Buffer;

// ─── Config ───────────────────────────────────────────────────────────────────
const CONTRACT_ADDRESS  = import.meta.env.VITE_CONTRACT_ADDRESS;
const FAUCET_URL        = "https://testnet-faucet.genlayer.foundation";
const BRADBURY_CHAIN_ID = "0x107d";
const EXPLORER_URL      = "https://explorer-bradbury.genlayer.com";

const BRADBURY_NETWORK = {
  chainId: BRADBURY_CHAIN_ID,
  chainName: "GenLayer Bradbury",
  rpcUrls: ["https://rpc-bradbury.genlayer.com"],
  nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
  blockExplorerUrls: [EXPLORER_URL],
};

// ─── Parse result from transaction eqBlocksOutputs (UNCHANGED from main.js) ──
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

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const clientRef = useRef(null);

  const [walletAddress,   setWalletAddress]   = useState(null);
  const [isLoading,       setIsLoading]       = useState(false);
  const [currentResult,   setCurrentResult]   = useState(null);
  const [history,         setHistory]         = useState([]);
  const [totalTriages,    setTotalTriages]    = useState(0);
  const [txHash,          setTxHash]          = useState(null);
  const [txStep,          setTxStep]          = useState(0);
  const [screen,          setScreen]          = useState('connect');
  const [validatorStates, setValidatorStates] = useState(['idle','idle','idle','idle','idle']);

  // ─── Contract Reads ─────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !CONTRACT_ADDRESS) return;
    try {
      const r = await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_my_history",
        args: [],
      });
      setHistory(Array.isArray(r) ? r : []);
    } catch (e) {
      console.error("history:", e.message);
      setHistory([]);
    }
  }, []);

  const loadStats = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !CONTRACT_ADDRESS) return;
    try {
      const t = await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_total_triages",
        args: [],
      });
      setTotalTriages(Number(t) || 0);
    } catch (e) { console.error("stats:", e.message); }
  }, []);

  // ─── Connect Wallet ─────────────────────────────────────────────────────────
  const handleConnect = useCallback(async () => {
    if (!window.ethereum) {
      alert("MetaMask is required. Please install MetaMask extension.");
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const address = accounts[0];

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

      // Create client with MetaMask address — genlayer-js uses window.ethereum for signing
      clientRef.current = createClient({
        chain: testnetBradbury,
        account: address,
      });

      setWalletAddress(address);
      setScreen('form');

      // Listen for account changes
      window.ethereum.on("accountsChanged", async (accs) => {
        if (!accs.length) {
          handleDisconnect();
        } else {
          clientRef.current = createClient({ chain: testnetBradbury, account: accs[0] });
          setWalletAddress(accs[0]);
          await Promise.all([loadHistory(), loadStats()]);
        }
      });

      await Promise.all([loadHistory(), loadStats()]);
    } catch (err) {
      console.error("connectWallet:", err);
      alert("Connection failed: " + (err.message || err));
    }
  }, [loadHistory, loadStats]);

  const handleDisconnect = useCallback(() => {
    clientRef.current = null;
    setWalletAddress(null);
    setHistory([]);
    setCurrentResult(null);
    setTotalTriages(0);
    setTxHash(null);
    setTxStep(0);
    setValidatorStates(['idle','idle','idle','idle','idle']);
    setScreen('connect');
  }, []);

  // ─── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async ({ symptoms, age, language }) => {
    const client = clientRef.current;
    if (!symptoms)                    { alert("Please describe your symptoms."); return; }
    if (!age || age < 0 || age > 120) { alert("Please enter a valid age (0-120)."); return; }
    if (!client)                      { alert("Please connect your wallet first."); return; }
    if (!CONTRACT_ADDRESS)            { alert("Contract not deployed."); return; }

    setIsLoading(true);
    setCurrentResult(null);
    setTxHash(null);
    setTxStep(1);
    setScreen('submitting');
    setValidatorStates(['idle','idle','idle','idle','idle']);

    // Start validator node animation in parallel with TX
    const animTimers = [];
    [600, 1100, 1700, 2400, 3100].forEach((ms, i) => {
      animTimers.push(setTimeout(() => {
        setValidatorStates(p => { const n = [...p]; n[i] = 'analyzing'; return n; });
      }, ms));
    });
    [4000, 5500, 7000, 8500, 10000].forEach((ms, i) => {
      animTimers.push(setTimeout(() => {
        setValidatorStates(p => { const n = [...p]; n[i] = 'agreed'; return n; });
      }, ms));
    });

    try {
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "submit_symptoms",
        args: [symptoms, age, language],
        value: BigInt(0),
      });

      setTxHash(hash);
      setTxStep(2);

      // Wait for ACCEPTED — result is available in eqBlocksOutputs
      await client.waitForTransactionReceipt({
        hash,
        status: "ACCEPTED",
        retries: 120,
        interval: 5000,
      });

      setTxStep(3);

      // Mark all validators as agreed (consensus reached)
      setValidatorStates(['consensus','consensus','consensus','consensus','consensus']);

      // Parse result directly from transaction data
      const tx = await client.getTransaction({ hash });
      const parsed = parseTriageFromTx(tx);

      if (parsed && parsed.triage_level) {
        setCurrentResult(parsed);
      } else {
        // Fallback: poll history briefly
        await new Promise(r => setTimeout(r, 5000));
        await loadHistory();
        // Use latest from history if parse failed
        setHistory(currentHistory => {
          if (currentHistory.length > 0) {
            try {
              const latest = JSON.parse(currentHistory[currentHistory.length - 1]);
              setCurrentResult(latest);
            } catch (e) { console.error("parse history:", e); }
          }
          return currentHistory;
        });
      }

      await loadHistory();
      await loadStats();
      setScreen('result');
    } catch (err) {
      console.error("submit:", err);
      alert("Transaction failed: " + (err?.shortMessage || err?.message || "Unknown error"));
      setScreen('form');
    } finally {
      animTimers.forEach(clearTimeout);
      setIsLoading(false);
      setTxStep(0);
    }
  }, [loadHistory, loadStats]);

  return (
    <div className="app">
      <AnimatedBg />
      <Header
        walletAddress={walletAddress}
        totalTriages={totalTriages}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />
      <main className="main">
        <div className="container">
          <DisclaimerBanner />

          {screen === 'connect' && <ConnectScreen onConnect={handleConnect} />}

          {(screen === 'form' || screen === 'result') && (
            <TriageForm onSubmit={handleSubmit} isLoading={isLoading} />
          )}

          {screen === 'submitting' && (
            <ConsensusTracker txStep={txStep} txHash={txHash} validatorStates={validatorStates} />
          )}

          {currentResult && screen === 'result' && (
            <TriageResult result={currentResult} txHash={txHash} />
          )}

          <HistoryList history={history} />
          <HowItWorks />
        </div>
      </main>
      <SiteFooter faucetUrl={FAUCET_URL} />
    </div>
  );
}
