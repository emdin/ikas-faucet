import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { config } from "../config.js";
import crypto from "crypto";

interface State {
  usage: Record<string, number[]>;
  usedChallenges: Record<string, boolean>;
}

const challenges = new Map<string, { address: string; expiresAt: number }>();
let state: State = { usage: {}, usedChallenges: {} };

export function loadState(): void {
  if (existsSync(config.stateFile)) {
    try {
      const raw = readFileSync(config.stateFile, "utf-8");
      state = JSON.parse(raw);
    } catch {
      state = { usage: {}, usedChallenges: {} };
    }
  }
}

export function flushState(): void {
  const dir = dirname(config.stateFile);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(config.stateFile, JSON.stringify(state, null, 2));
}

export function startPeriodicFlush(): void {
  setInterval(flushState, config.flushInterval);
}

export function generateChallenge(address: string): {
  challenge: string;
  expiresIn: number;
} {
  const timestamp = Math.floor(Date.now() / 1000);
  const uuid = crypto.randomUUID();
  const challenge = `${config.domain}:${timestamp}:${uuid}:drip:${address}`;
  challenges.set(uuid, {
    address: address.toLowerCase(),
    expiresAt: Date.now() + config.challengeTTL * 1000,
  });
  return { challenge, expiresIn: config.challengeTTL };
}

export function validateChallenge(
  challenge: string,
  address: string
): { valid: boolean; error?: string } {
  const parts = challenge.split(":");
  if (parts.length !== 5) return { valid: false, error: "Malformed challenge" };

  const [domain, , uuid, action, challengeAddr] = parts;
  if (domain !== config.domain) return { valid: false, error: "Wrong domain" };
  if (action !== "drip") return { valid: false, error: "Wrong action" };
  if (challengeAddr.toLowerCase() !== address.toLowerCase())
    return { valid: false, error: "Address mismatch" };

  const stored = challenges.get(uuid);
  if (!stored) return { valid: false, error: "Challenge not found or expired" };
  if (stored.expiresAt < Date.now())
    return { valid: false, error: "Challenge expired" };
  if (stored.address !== address.toLowerCase())
    return { valid: false, error: "Address mismatch" };

  // Mark as used
  challenges.delete(uuid);
  state.usedChallenges[uuid] = true;

  return { valid: true };
}

export function checkRateLimit(address: string): {
  allowed: boolean;
  remaining: number;
  error?: string;
} {
  const key = address.toLowerCase();
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  if (!state.usage[key]) state.usage[key] = [];

  // Filter to last 24h
  state.usage[key] = state.usage[key].filter((ts) => now - ts < dayMs);

  const used = state.usage[key].length;
  const remaining = config.dailyLimit - used;

  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      error: `Daily limit reached (${config.dailyLimit} iKAS). Try again later.`,
    };
  }

  return { allowed: true, remaining };
}

export function recordUsage(address: string): void {
  const key = address.toLowerCase();
  if (!state.usage[key]) state.usage[key] = [];
  state.usage[key].push(Date.now());
}

// Cleanup expired challenges every 60s
setInterval(() => {
  const now = Date.now();
  for (const [uuid, data] of challenges) {
    if (data.expiresAt < now) challenges.delete(uuid);
  }
}, 60_000);
