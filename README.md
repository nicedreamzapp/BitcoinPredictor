# ████████ BitTrader Pro ████████

```
    ╔═══════════════════════════════════════╗
    ║  ◉ ○ ○     BITCOIN TRADING SYSTEM    ║
    ╠═══════════════════════════════════════╣
    ║                                       ║
    ║   █▀▀▀█ █▀▀▀█ █▀▀▀█ █▀▀▀█ █▀▀▀█    ║
    ║   █   █ █   █ █   █ █   █ █   █    ║
    ║   █▄▄▄█ █▄▄▄█ █▄▄▄█ █▄▄▄█ █▄▄▄█    ║
    ║                                       ║
    ║   YOUR CRYPTOCURRENCY TRADING ALLY    ║
    ╚═══════════════════════════════════════╝
```

**A full-stack Bitcoin dashboard that pulls the live BTC price, scores it with technical indicators, and prints long/short signals with a confidence score, stop-loss and take-profit.**

![BitTrader UI](https://github.com/nicedreamzapp/BitcoinPredictor/blob/main/BitTraderUiScreen.png?raw=true)

---

## ░░░ WELCOME TO THE FUTURE OF CRYPTO ░░░

**BitTrader Pro** turns the chaotic world of Bitcoin charts into one screen you can read at a glance.
Think of it as a robot friend who never sleeps, constantly watching Bitcoin prices and whispering:
👉 *“Long here.”*
👉 *“Short here.”*
👉 *“Nothing clear, stay flat.”*

It is a research and paper-trading tool. It does not place real orders.

---

## ▓▓▓ WHAT DOES IT DO? ▓▓▓

Not just another chart with squiggly lines. **BitTrader Pro**:

* Pulls the **live BTC/USD price from CoinGecko** every 30 seconds and streams updates to the browser over a **WebSocket** (`/ws`)
* Computes **RSI, MACD, EMA/SMA** and volume/volatility factors, then blends them into a **confidence score** (momentum 35%, volume 30%, trend 18%, volatility 17%)
* Generates **LONG / SHORT signals** with a stop-loss and take-profit every 30 seconds, and stays silent when confidence is in the neutral 40 to 60% zone
* Runs **backtests** through an API endpoint and reports total return, win rate and max drawdown
* Optionally asks **OpenAI (gpt-4-turbo)** for a market read, and falls back to its own math when no API key is set
* Has an **emergency stop** that halts the signal generator and deactivates open signals

---

## 🛠️ What I built (Matt Macosko)

* **Confidence and signal engine**: [`server/services/trading-engine.ts`](server/services/trading-engine.ts), [`server/services/signal-generator.ts`](server/services/signal-generator.ts)
* **Price feed** (CoinGecko polling + per-second ticks): [`server/services/price-feed.ts`](server/services/price-feed.ts)
* **Backtesting engine**: [`server/services/backtesting-engine.ts`](server/services/backtesting-engine.ts)
* **AI market analysis with math fallback**: [`server/services/ml-predictor.ts`](server/services/ml-predictor.ts)
* **Paper-trade position manager** (2% risk per trade, max 3 positions, trailing stops): [`server/services/trade-execution-engine.ts`](server/services/trade-execution-engine.ts) (written, not yet wired into the API)
* **REST API + WebSocket server**: [`server/routes.ts`](server/routes.ts)
* **Database schema** (price data, indicators, signals, trades, backtest results): [`shared/schema.ts`](shared/schema.ts), [`server/storage.ts`](server/storage.ts)
* **Trading dashboard UI**: [`client/src/pages/trading-dashboard.tsx`](client/src/pages/trading-dashboard.tsx) and [`client/src/components/trading/`](client/src/components/trading/)
* **One-command launcher**: [`start-bittrader.sh`](start-bittrader.sh)

Upstream: React, Vite, Express, Radix UI + shadcn/ui, Drizzle ORM, TanStack Query, the Neon serverless Postgres driver, the OpenAI API and CoinGecko's public price API. See [CREDITS.md](CREDITS.md).

---

## ▓▓▓ FOR CRYPTO BEGINNERS ▓▓▓

Even if you’re new to crypto, BitTrader Pro keeps it simple:

* **Green = Long signal**
* **Red = Short signal**
* **Confidence Score** shows how strongly the indicators agree

Start small, learn the patterns, and treat the signals as a second opinion, not a promise.

---

## 🚀 Getting Started

You need **Node.js 20+** and a **PostgreSQL database URL** (the server uses the Neon serverless driver, so a [Neon](https://neon.tech) database is the easiest fit). The server will not start without `DATABASE_URL`.

### 1. Clone the Repository

```bash
git clone https://github.com/nicedreamzapp/BitcoinPredictor.git
cd BitcoinPredictor
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create a `.env` file in the root directory:

```
DATABASE_URL=postgresql://user:password@host/dbname
OPENAI_API_KEY=your_openai_api_key_here   # optional
```

### 4. Create the Database Tables

```bash
npm run db:push
```

### 5. Run in Development

```bash
./start-bittrader.sh
# or
set -a; source .env; set +a; npm run dev
```

Visit `http://localhost:3001`. Keep the port at 3001: the browser's WebSocket client is hard-coded to `ws://localhost:3001/ws`.

### 6. Build for Production

```bash
npm run build
npm start
```

---

## 🕹️ How to Use BitTrader Pro

1. **Open the dashboard** → no sign-up needed.
2. **Watch the price header** → live Bitcoin price, 24h change and volume.
3. **Read the signals**:

   * **Trade Signals:** LONG or SHORT, with stop-loss and take-profit levels
   * **Confidence Score** (%) and the four factor scores behind it
   * **Technical indicators** panel (RSI, MACD, moving averages)
4. **Risk panel** → try position size, stop-loss and take-profit settings, and set up backtests.
5. **Emergency Stop** → one click halts signal generation.

---

## ⚠️ Known Limits (read this)

* **No real trading.** There is no exchange connection and no login. Trades are simulated.
* **Price ticks between CoinGecko polls are simulated.** The real price is fetched every 30 seconds; the per-second movement in between is a small random walk around it, and 24h high/low are estimates (±2%).
* **Backtests use synthetic data** when the database doesn't have enough stored history, so backtest results are not evidence of real-world performance.
* **Risk panel settings live in the browser** and are not enforced by the server.
* **Signals are not financial advice.** No win-rate or accuracy claim is made here.
* `start-bittrader.sh` uses macOS `open` to launch the browser; on Linux just open the URL yourself.

---

## ❓ FAQ / Troubleshooting

* **App won’t start with "DATABASE_URL must be set"?** → Add it to `.env` and make sure it's loaded into the shell (the launcher script does this).
* **No trade signals?** → The engine needs at least 20 stored price points first, and it skips anything in the neutral 40 to 60% confidence zone. Give it a few minutes.
* **Price stuck or flat?** → Check your internet connection; CoinGecko's free API can rate-limit.
* **Live updates not arriving?** → The server must be on port 3001, since the WebSocket URL is hard-coded.

For more help, open an issue on GitHub.

---

## 🤝 Contributing

Pull requests are welcome! For major changes, open an issue first to discuss what you’d like to change.

---

## 📜 License

MIT

---

*Happy Trading! 🚀*
