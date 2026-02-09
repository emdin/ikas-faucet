# iKAS Faucet

Faucet server for [IGRA Galleon Test Mainnet](https://explorer.galleon.igralabs.com) (Chain ID 38837). Dispenses iKAS to any wallet that proves ownership via EIP-191 signed challenge.

**Live:** https://ikas-faucet-ecee9345b515.herokuapp.com

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Faucet balance, address, limits |
| `/api/challenge` | POST | Request a challenge to sign |
| `/api/drip` | POST | Submit signed challenge to receive iKAS |

### Quick example

```bash
# Check status
curl -s https://ikas-faucet-ecee9345b515.herokuapp.com/api/status

# Request challenge
curl -s -X POST https://ikas-faucet-ecee9345b515.herokuapp.com/api/challenge \
  -H "Content-Type: application/json" \
  -d '{"address": "0xYOUR_ADDRESS"}'

# Sign challenge with your wallet, then claim
curl -s -X POST https://ikas-faucet-ecee9345b515.herokuapp.com/api/drip \
  -H "Content-Type: application/json" \
  -d '{"address":"0xYOUR_ADDRESS","signature":"0xSIGNATURE","challenge":"CHALLENGE_STRING"}'
```

### Limits

- 1 iKAS per request
- 10 iKAS per address per 24h (rolling window)
- Challenge expires in 120 seconds

## Auth flow

1. Client sends address to `/api/challenge`
2. Server returns a unique challenge string with embedded UUID
3. Client signs the challenge with their private key (EIP-191 personal sign)
4. Client submits address + signature + challenge to `/api/drip`
5. Server verifies signature, validates challenge (single-use, not expired), checks rate limit, sends 1 iKAS

## Telegram bot

The faucet includes a Telegram notification bot for the admin:

- `/balance` — current faucet balance with explorer link
- `/address` — faucet wallet address
- `/help` — list commands
- Auto-alerts when balance drops below 100 iKAS

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your funded wallet private key
```

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FAUCET_PRIVATE_KEY` | Yes | Private key of funded wallet on Galleon Test Mainnet |
| `PORT` | No | Server port (default: 3000) |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token for alerts |
| `TELEGRAM_CHAT_ID` | No | Telegram chat ID for alerts |

### Run locally

```bash
npm run dev     # Development with hot reload
npm run build   # Compile TypeScript
npm start       # Production
```

## Tech stack

- TypeScript + Express
- ethers.js v6 (legacy type 0 transactions, ~1000 Gwei gas price)
- Helmet, CORS, input validation
- JSON file persistence for rate limiting
- Transaction nonce mutex for concurrent requests

## Network info

| Parameter | Value |
|-----------|-------|
| Network | IGRA Galleon Test Mainnet |
| Chain ID | 38837 |
| RPC | `https://galleon.igralabs.com:8545` |
| Explorer | `https://explorer.galleon.igralabs.com` |
| Currency | iKAS (18 decimals) |

## License

MIT
