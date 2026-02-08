import "dotenv/config";
import express from "express";
import { config } from "./config.js";
import { initWallet } from "./services/wallet.js";
import { loadState, startPeriodicFlush } from "./services/rateLimit.js";
import faucetRoutes from "./routes/faucet.js";

const app = express();
app.use(express.json());
app.use("/api", faucetRoutes);

// Health check
app.get("/", (_req, res) => {
  res.json({ service: "iKAS Faucet", network: "IGRA Galleon Test Mainnet" });
});

async function start() {
  const wallet = initWallet();
  console.log(`Faucet wallet: ${wallet.address}`);

  loadState();
  startPeriodicFlush();

  app.listen(config.port, () => {
    console.log(`iKAS Faucet running on http://localhost:${config.port}`);
    console.log(`Network: IGRA Galleon Test Mainnet (Chain ID ${config.chainId})`);
    console.log(`RPC: ${config.rpcUrl}`);
    console.log(`Drip: ${config.dripAmount} iKAS per request, ${config.dailyLimit}/day limit`);
  });
}

start().catch((err) => {
  console.error("Failed to start faucet:", err);
  process.exit(1);
});
