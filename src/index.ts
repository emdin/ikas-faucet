import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { initWallet } from "./services/wallet.js";
import { loadState, startPeriodicFlush } from "./services/rateLimit.js";
import faucetRoutes from "./routes/faucet.js";
import { startBotPolling } from "./services/telegram.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "16kb" }));

// Serve skill.md and contract artifacts for other agents
app.get("/skill.md", (_req, res) => {
  res.type("text/markdown").sendFile(join(rootDir, "skill.md"));
});
app.use("/contracts", express.static(join(rootDir, "contracts"), {
  setHeaders: (res, path) => {
    if (path.endsWith(".json")) res.type("application/json");
  },
}));

app.use("/api", faucetRoutes);

app.get("/", (_req, res) => {
  res.json({ service: "iKAS Faucet", network: "IGRA Galleon Test Mainnet", skill: "/skill.md" });
});

async function start() {
  const wallet = initWallet();
  console.log(`Faucet wallet: ${wallet.address}`);

  loadState();
  startPeriodicFlush();
  startBotPolling();

  app.listen(config.port, () => {
    console.log(`iKAS Faucet running on port ${config.port}`);
    console.log(`Network: IGRA Galleon Test Mainnet (Chain ID ${config.chainId})`);
  });
}

start().catch((err) => {
  console.error("Failed to start faucet:", err.message);
  process.exit(1);
});
