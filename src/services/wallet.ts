import { Wallet, JsonRpcProvider, parseEther } from "ethers";
import { config } from "../config.js";

const provider = new JsonRpcProvider(config.rpcUrl, {
  name: "igra-galleon-test-mainnet",
  chainId: config.chainId,
});

let faucetWallet: Wallet;

// Simple mutex to serialize transactions and prevent nonce collisions
let txQueue: Promise<void> = Promise.resolve();

export function initWallet(): Wallet {
  const key = process.env.FAUCET_PRIVATE_KEY;
  if (!key) throw new Error("FAUCET_PRIVATE_KEY is not set");
  faucetWallet = new Wallet(key, provider);
  return faucetWallet;
}

export function getWallet(): Wallet {
  if (!faucetWallet) throw new Error("Wallet not initialized");
  return faucetWallet;
}

export function sendDrip(to: string): Promise<string> {
  return new Promise((resolve, reject) => {
    txQueue = txQueue
      .then(async () => {
        const wallet = getWallet();
        const gasPrice = (await provider.getFeeData()).gasPrice;
        const nonce = await wallet.getNonce("pending");
        const tx = await wallet.sendTransaction({
          to,
          value: parseEther(config.dripAmount),
          type: 0,
          gasPrice,
          nonce,
        });
        resolve(tx.hash);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

export async function getFaucetBalance(): Promise<string> {
  const wallet = getWallet();
  const balance = await provider.getBalance(wallet.address);
  const ethBalance = Number(balance) / 1e18;
  return ethBalance.toFixed(4);
}
