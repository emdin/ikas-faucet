import { Router, Request, Response } from "express";
import { verifyMessage } from "ethers";
import { config } from "../config.js";
import { sendDrip, getWallet, getFaucetBalance } from "../services/wallet.js";
import { checkAndAlertLowBalance } from "../services/telegram.js";
import {
  generateChallenge,
  validateChallenge,
  checkRateLimit,
  recordUsage,
} from "../services/rateLimit.js";

const router = Router();
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const SIG_RE = /^0x[a-fA-F0-9]{130}$/;
const MAX_CHALLENGE_LEN = 256;

router.get("/status", async (_req: Request, res: Response) => {
  try {
    const wallet = getWallet();
    const balance = await getFaucetBalance();
    res.json({
      faucetAddress: wallet.address,
      balance: `${balance} iKAS`,
      chainId: config.chainId,
      network: "IGRA Galleon Test Mainnet",
      limits: {
        perRequest: `${config.dripAmount} iKAS`,
        dailyPerAddress: `${config.dailyLimit} iKAS`,
      },
    });
  } catch (err: unknown) {
    console.error("Status error:", err);
    res.status(503).json({ error: "Service temporarily unavailable" });
  }
});

router.post("/challenge", (req: Request, res: Response) => {
  const { address } = req.body;
  if (typeof address !== "string" || !ADDRESS_RE.test(address)) {
    res.status(400).json({ error: "Invalid address format" });
    return;
  }
  const result = generateChallenge(address);
  res.json(result);
});

router.post("/drip", async (req: Request, res: Response) => {
  try {
    const { address, signature, challenge } = req.body;

    // Validate types and formats
    if (typeof address !== "string" || !ADDRESS_RE.test(address)) {
      res.status(400).json({ error: "Invalid address format" });
      return;
    }
    if (typeof signature !== "string" || !SIG_RE.test(signature)) {
      res.status(400).json({ error: "Invalid signature format" });
      return;
    }
    if (
      typeof challenge !== "string" ||
      challenge.length > MAX_CHALLENGE_LEN ||
      challenge.length === 0
    ) {
      res.status(400).json({ error: "Invalid challenge format" });
      return;
    }

    // Verify signature
    let recovered: string;
    try {
      recovered = verifyMessage(challenge, signature);
    } catch {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    if (recovered.toLowerCase() !== address.toLowerCase()) {
      res.status(401).json({ error: "Signature does not match address" });
      return;
    }

    // Validate challenge (freshness, replay, domain)
    const challengeResult = validateChallenge(challenge, address);
    if (!challengeResult.valid) {
      res.status(401).json({ error: challengeResult.error });
      return;
    }

    // Check rate limit
    const rateResult = checkRateLimit(address);
    if (!rateResult.allowed) {
      res.status(429).json({ error: rateResult.error, dailyRemaining: 0 });
      return;
    }

    // Send drip
    const txHash = await sendDrip(address);
    recordUsage(address);

    res.json({
      txHash,
      amount: `${config.dripAmount} iKAS`,
      dailyRemaining: rateResult.remaining - 1,
      explorer: `https://explorer.galleon.igralabs.com/tx/${txHash}`,
    });

    // Check balance and alert if low (fire-and-forget)
    getFaucetBalance()
      .then((bal) => checkAndAlertLowBalance(parseFloat(bal)))
      .catch(() => {});
  } catch (err: unknown) {
    console.error("Drip error:", err);
    res.status(500).json({ error: "Transaction failed. Try again later." });
  }
});

export default router;
