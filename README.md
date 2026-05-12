# 🩺 MediTriage AI

**Decentralized Medical Triage on [GenLayer](https://genlayer.com) Bradbury Testnet**

A multi-model AI consensus dApp that classifies medical symptom urgency into four triage levels:
`EMERGENCY`, `URGENT`, `SOON`, `HOME_CARE`.

Users describe their symptoms in any language. The Intelligent Contract runs the prompt through
multiple validator nodes (each with a different LLM), reaches consensus via GenLayer's Optimistic
Democracy, and returns a verified triage recommendation on-chain.

> **Disclaimer:** This tool provides triage guidance only — not medical diagnosis.
> Always consult a qualified healthcare professional.

---

## ✨ Features

- 🧠 **Multi-model AI consensus** — 5+ validator nodes with different LLMs independently analyze symptoms
- 🌍 **Any language** — English, French, Arabic, Spanish, Portuguese, German, Chinese
- 🦊 **MetaMask integration** — automatic Bradbury network setup, user-controlled signing
- ⛓️ **On-chain history** — every triage is stored immutably, auditable by anyone
- 🎯 **4 urgency levels** — clear, actionable output with advice and red flags

---

## 🏗️ Architecture

```
User → MetaMask → GenLayerJS SDK → Bradbury Testnet
                                         ↓
                                  Intelligent Contract (Python)
                                         ↓
                                  5+ AI Validators (Optimistic Democracy)
                                         ↓
                                  Consensus Result → On-chain
```

- **Contract:** `contracts/medical_triage.py` — Python Intelligent Contract using `gl.nondet.exec_prompt`
- **Frontend:** Vanilla JS + Vite, no framework bloat
- **SDK:** [`genlayer-js`](https://www.npmjs.com/package/genlayer-js) for contract interaction
- **Signing:** MetaMask via `window.ethereum` (EVM wallet)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MetaMask browser extension
- Test GEN from the [Bradbury faucet](https://testnet-faucet.genlayer.foundation)

### Installation

```bash
git clone https://github.com/zorba999/MediTriage-AI.git
cd MediTriage-AI
npm install
```

### Configuration

```bash
cp .env.example .env
# Edit .env and add your private key (used for deploy script)
```

> ⚠️ **Never commit your `.env` file.** Use a dedicated testnet wallet.

### Deploy the contract

```bash
npm run deploy
```

This deploys `contracts/medical_triage.py` to Bradbury testnet and saves the contract address
to `.env` automatically.

### Run the frontend

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), connect MetaMask, and submit symptoms.

---

## 📋 How It Works

### 1. User submits symptoms

The user fills out the form with symptoms, age, and language. The frontend calls the contract's
`submit_symptoms` method via MetaMask.

### 2. AI validators analyze

GenLayer's validator network picks up the transaction. A leader node runs the LLM prompt, then
multiple validators independently verify the result using the **Equivalence Principle**:

```python
def validator_fn(leaders_res) -> bool:
    my_result = leader_fn()  # run same prompt
    # Accept if within 1 level of difference (e.g. URGENT vs SOON)
    levels = ["HOME_CARE", "SOON", "URGENT", "EMERGENCY"]
    return abs(levels.index(leaders_res.calldata["triage_level"])
               - levels.index(my_result["triage_level"])) <= 1
```

### 3. Consensus & on-chain storage

If majority of validators agree, the transaction is `ACCEPTED`. The result is extracted from the
transaction's `eqBlocksOutputs` field (CBOR-encoded) and displayed to the user.

### 4. Verified result

The result appears with:
- **Triage level** (color-coded card)
- **Key concern** — main reason for classification
- **Advice** — what to do next
- **Red flags** — concerning symptoms to watch for

---

## 📁 Project Structure

```
├── contracts/
│   └── medical_triage.py    # Intelligent Contract (Python)
├── src/
│   ├── main.js              # Frontend logic + wallet integration
│   └── style.css            # Dark theme UI
├── scripts/
│   └── deploy.js            # Contract deployment script
├── index.html
├── package.json
├── vite.config.js
└── .env.example
```

---

## 🔐 Contract Methods

| Method | Type | Description |
|--------|------|-------------|
| `submit_symptoms(symptoms, age, language)` | write | Submit symptoms for AI triage |
| `get_my_history()` | view | Get triage history for caller |
| `get_total_triages()` | view | Total triages ever submitted |
| `get_disclaimer()` | view | Medical disclaimer text |

---

## 🧪 Triage Levels

| Level | Icon | Action |
|-------|------|--------|
| `EMERGENCY` | 🚨 | Go to Emergency Room immediately |
| `URGENT` | ⚠️ | See a doctor within 24-48 hours |
| `SOON` | 📅 | Schedule an appointment this week |
| `HOME_CARE` | 🏠 | Rest at home and monitor |

---

## 🌐 Networks

Currently deployed to **GenLayer Bradbury Testnet**:

- Chain ID: `4221` (0x107d)
- RPC: `https://rpc-bradbury.genlayer.com`
- Explorer: [explorer-bradbury.genlayer.com](https://explorer-bradbury.genlayer.com)
- Faucet: [testnet-faucet.genlayer.foundation](https://testnet-faucet.genlayer.foundation)

---

## 📜 License

MIT

---

## 🙏 Acknowledgments

Built on [GenLayer](https://genlayer.com) — the first AI-native blockchain.
