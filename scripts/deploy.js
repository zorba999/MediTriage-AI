import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

// Fix SSL certificate issues on some systems
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load private key from .env file (never hardcode!)
function loadPrivateKey() {
  const envPath = path.resolve(__dirname, "../.env");
  if (!existsSync(envPath)) {
    throw new Error(".env file not found. Copy .env.example to .env and add your private key.");
  }
  const envContent = readFileSync(envPath, "utf8");
  const match = envContent.match(/VITE_PRIVATE_KEY=(0x[a-fA-F0-9]{64})/);
  if (!match) {
    throw new Error("VITE_PRIVATE_KEY not found in .env file.");
  }
  return match[1];
}

const PRIVATE_KEY = loadPrivateKey();

async function main() {
  console.log("🚀 Deploying MedicalTriage contract to Bradbury testnet...\n");

  const account = createAccount(PRIVATE_KEY);
  const client = createClient({
    chain: testnetBradbury,
    account,
  });

  console.log("📍 Deployer address:", account.address);

  // Read contract code
  const contractPath = path.resolve(__dirname, "../contracts/medical_triage.py");
  const contractCode = new Uint8Array(readFileSync(contractPath));

  console.log("📄 Contract loaded:", contractPath);
  console.log("⏳ Sending deploy transaction...\n");

  // Deploy
  const txHash = await client.deployContract({
    code: contractCode,
    args: [],
  });

  console.log("📨 Transaction hash:", txHash);
  console.log("⏳ Waiting for consensus (this may take 1-2 minutes)...\n");

  // Wait for ACCEPTED first (faster ~1-2 min), then contract address is available
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: "ACCEPTED",
    retries: 100,
    interval: 5000,
  });

  const contractAddress =
    receipt?.data?.contract_address ||
    receipt?.txDataDecoded?.contractAddress;

  if (!contractAddress) {
    console.error("❌ Deploy failed. Receipt:", JSON.stringify(receipt, null, 2));
    process.exit(1);
  }

  console.log("✅ Contract deployed successfully!");
  console.log("📍 Contract address:", contractAddress);

  // Save address to .env
  const envPath = path.resolve(__dirname, "../.env");
  let envContent = readFileSync(envPath, "utf8");
  envContent = envContent.replace(
    /VITE_CONTRACT_ADDRESS=.*/,
    `VITE_CONTRACT_ADDRESS=${contractAddress}`
  );
  writeFileSync(envPath, envContent);

  console.log("\n✅ Contract address saved to .env");
  console.log("🎉 Ready! Run: npm run dev");
}

main().catch((err) => {
  console.error("❌ Deploy error:", err);
  process.exit(1);
});
