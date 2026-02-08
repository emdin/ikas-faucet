import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "./config.js";
import { initWallet } from "./services/wallet.js";
import { loadState, startPeriodicFlush } from "./services/rateLimit.js";
import faucetRoutes from "./routes/faucet.js";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "16kb" }));

app.use("/api", faucetRoutes);

app.get("/", (_req, res) => {
  res.json({ service: "iKAS Faucet", network: "IGRA Galleon Test Mainnet" });
});

async function start() {
  const wallet = initWallet();
  console.log(`Faucet wallet: ${wallet.address}`);

  loadState();
  startPeriodicFlush();

  app.listen(config.port, () => {
    console.log(`iKAS Faucet running on port ${config.port}`);
    console.log(`Network: IGRA Galleon Test Mainnet (Chain ID ${config.chainId})`);
  });
}

start().catch((err) => {
  console.error("Failed to start faucet:", err.message);
  process.exit(1);
});
