import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  rpcUrl: "https://galleon.igralabs.com:8545",
  chainId: 38837,
  dripAmount: "1.0",
  dailyLimit: 10,
  challengeTTL: 120,
  domain: "igra-faucet",
  stateFile: join(__dirname, "..", "store", "state.json"),
  flushInterval: 60_000,
};
