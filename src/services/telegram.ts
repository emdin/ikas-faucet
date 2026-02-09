import { config } from "../config.js";
import { getWallet, getFaucetBalance } from "./wallet.js";

let lastAlertAt = 0;
const ALERT_COOLDOWN = 60 * 60 * 1000; // 1 hour between alerts
let lastUpdateId = 0;
const POLL_INTERVAL = 5_000; // 5 seconds

async function sendMessage(chatId: string | number, text: string): Promise<void> {
  try {
    const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      console.error("Telegram send failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Telegram send error:", err);
  }
}

export async function checkAndAlertLowBalance(balanceIkas: number): Promise<void> {
  if (!config.telegramBotToken || !config.telegramChatId) return;
  if (balanceIkas >= config.lowBalanceThreshold) return;

  const now = Date.now();
  if (now - lastAlertAt < ALERT_COOLDOWN) return;
  lastAlertAt = now;

  const wallet = getWallet();
  const message =
    `⚠️ iKAS Faucet Low Balance\n\n` +
    `Balance: ${balanceIkas.toFixed(2)} iKAS\n` +
    `Threshold: ${config.lowBalanceThreshold} iKAS\n` +
    `Wallet: ${wallet.address}\n\n` +
    `Please refill the faucet.`;

  await sendMessage(config.telegramChatId, message);
}

async function handleCommand(chatId: number, command: string): Promise<void> {
  // Only respond to the configured admin chat
  if (String(chatId) !== config.telegramChatId) return;

  if (command === "/balance") {
    try {
      const balance = await getFaucetBalance();
      const wallet = getWallet();
      await sendMessage(chatId,
        `💰 Faucet Balance: ${balance} iKAS\n` +
        `Wallet: ${wallet.address}\n` +
        `Explorer: https://explorer.galleon.igralabs.com/address/${wallet.address}`
      );
    } catch (err) {
      await sendMessage(chatId, "❌ Failed to fetch balance");
    }
  } else if (command === "/address") {
    const wallet = getWallet();
    await sendMessage(chatId, wallet.address);
  } else if (command === "/start" || command === "/help") {
    await sendMessage(chatId,
      `iKAS Faucet Bot\n\n` +
      `/balance - Check faucet balance\n` +
      `/address - Get faucet L2 address\n` +
      `/help - Show this message`
    );
  }
}

async function pollUpdates(): Promise<void> {
  try {
    const url = `https://api.telegram.org/bot${config.telegramBotToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=0`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json() as { ok: boolean; result: Array<{ update_id: number; message?: { chat: { id: number }; text?: string } }> };
    if (!data.ok || !data.result.length) return;

    for (const update of data.result) {
      lastUpdateId = update.update_id;
      const msg = update.message;
      if (msg?.text?.startsWith("/")) {
        const command = msg.text.split(" ")[0].split("@")[0].toLowerCase();
        await handleCommand(msg.chat.id, command);
      }
    }
  } catch {
    // Silently ignore polling errors
  }
}

export function startBotPolling(): void {
  if (!config.telegramBotToken || !config.telegramChatId) return;
  console.log("Telegram bot polling started");
  // Clear pending updates on startup
  fetch(`https://api.telegram.org/bot${config.telegramBotToken}/getUpdates?offset=-1`)
    .then(() => {
      setInterval(pollUpdates, POLL_INTERVAL);
    })
    .catch(() => {
      setInterval(pollUpdates, POLL_INTERVAL);
    });
}
