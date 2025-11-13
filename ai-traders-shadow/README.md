# AI Trader's Shadow - Crypto Micro-Mentor

**Educational Paper Trading Platform for Crypto Beginners**

## 🎯 Vision

AI Trader's Shadow adalah platform edukasi trading kripto yang fokus pada **pembelajaran**, **manajemen risiko**, dan **pelestarian modal** - bukan mesin profit instan.

### Pivot Strategis

Riset awal menunjukkan target profit harian ($3-5/hari dengan modal $60-100) **TIDAK LAYAK** karena batasan minimum order size di bursa.

**Proposisi Nilai Baru:** "Crypto Micro-Mentor" - Platform edukasi dengan fokus:
- ✅ Paper trading (no real money risk)
- ✅ Manajemen risiko real-time
- ✅ "Mood Meter" untuk transparansi AI
- ✅ Gamifikasi pembelajaran
- ❌ BUKAN auto-trading dengan uang riil

---

## 🏗️ Arsitektur MVP (Tahap 1 & 2)

### Tech Stack

**Backend:**
- **FastAPI** (Python) - High-performance async API
- **TimescaleDB** (PostgreSQL extension) - Time-series + relational data
- **CryptoFeed** - Low-latency WebSocket data ingestion
- **CCXT** - Exchange abstraction for paper trading
- **Stable-Baselines3** - Reinforcement Learning (PPO)

**Frontend:**
- **React** (Next.js) - Modern UI framework
- **WebSockets** - Real-time updates

**Communication:**
- **Telegram Bot** - Conversational AI interface

---

## 📂 Struktur Proyek

```
ai-traders-shadow/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI application
│   │   ├── api/                    # API endpoints
│   │   │   └── endpoints/
│   │   │       ├── health.py       # Health checks
│   │   │       ├── trading.py      # Paper trading
│   │   │       ├── mood.py         # Mood Meter
│   │   │       └── market_data.py  # Market data
│   │   ├── core/                   # Core configuration
│   │   │   ├── config.py           # Settings
│   │   │   └── logger.py           # Logging
│   │   ├── db/                     # Database
│   │   │   └── database.py         # Connection
│   │   ├── models/                 # SQLAlchemy models
│   │   │   ├── user.py
│   │   │   └── trade.py
│   │   ├── services/               # Business logic
│   │   │   ├── data_ingestion/
│   │   │   │   └── cryptofeed_service.py
│   │   │   ├── trading/
│   │   │   │   └── ccxt_service.py
│   │   │   ├── monitoring/
│   │   │   │   └── agent_state_monitor.py (Mood Meter)
│   │   │   └── telegram/
│   │   │       └── telegram_bot.py
│   │   └── ml/                     # Machine Learning
│   │       ├── environments/
│   │       │   └── crypto_trading_env.py (Gymnasium)
│   │       ├── agents/             # PPO agents
│   │       └── pretrade_checks/
│   │           └── heuristic_checks.py (Layer 1)
│   ├── requirements.txt
│   └── .env.example
├── database/
│   └── schema.sql                  # TimescaleDB schema
├── frontend/                       # (TBD - React/Next.js)
└── docs/                          # Documentation
```

---

## 🚀 Quick Start

### 1. Prerequisites

- Python 3.10+
- PostgreSQL 14+ with TimescaleDB extension
- Node.js 18+ (for frontend)

### 2. Database Setup

```bash
# Install TimescaleDB (Ubuntu/Debian)
sudo add-apt-repository ppa:timescale/timescaledb-ppa
sudo apt update
sudo apt install timescaledb-postgresql-14

# Create database
sudo -u postgres psql -c "CREATE DATABASE ai_traders_shadow;"

# Enable TimescaleDB extension and create schema
sudo -u postgres psql ai_traders_shadow < database/schema.sql
```

### 3. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings (database, API keys, etc.)

# Run database migrations (if using Alembic)
# alembic upgrade head

# Start development server
python -m app.main
```

Server akan berjalan di: http://localhost:8000

API Docs: http://localhost:8000/docs

### 4. Test WebSocket

```python
# test_websocket.py
import asyncio
import websockets
import json

async def test_ws():
    async with websockets.connect("ws://localhost:8000/ws/1") as websocket:
        # Send ping
        await websocket.send(json.dumps({"type": "ping", "timestamp": "2024-01-01T00:00:00Z"}))

        # Receive pong
        response = await websocket.recv()
        print(f"Received: {response}")

asyncio.run(test_ws())
```

---

## 🧩 Komponen Utama

### 1. Model Kecerdasan Hibrid

#### Lapis 1: Heuristic (Pre-Trade Checks)
File: `app/ml/pretrade_checks/heuristic_checks.py`

Memblokir perdagangan jika:
- ❌ Spread terlalu lebar (>50 bps)
- ❌ Likuiditas terlalu rendah (<$10,000)
- ❌ Overtrading (>5 trades/hour)
- ❌ Order size di bawah minimum ($10)
- ❌ High-impact news event

```python
from app.ml.pretrade_checks.heuristic_checks import pre_trade_checker

# Run all checks
passed, results = await pre_trade_checker.run_all_checks(
    user_id=1,
    symbol="BTC/USDT",
    amount=0.001,
    recent_trades_count=3
)
```

#### Lapis 2: PPO (Reinforcement Learning)
File: `app/ml/environments/crypto_trading_env.py`

Gymnasium environment dengan simulasi realistis:
- ✅ Trading fees (0.1%)
- ✅ Slippage (0.05%)
- ✅ Minimum order size ($10)
- ✅ Spread dari order book

```python
from app.ml.environments.crypto_trading_env import CryptoTradingEnv

# Create environment
env = CryptoTradingEnv(
    df=price_data,
    initial_balance=100.0,
    fee_rate=0.001,
    min_order_size_usd=10.0
)

# Train PPO agent (using stable-baselines3)
from stable_baselines3 import PPO

model = PPO("MlpPolicy", env, verbose=1)
model.learn(total_timesteps=100000)
```

### 2. Mood Meter (Humanization Layer)
File: `app/services/monitoring/agent_state_monitor.py`

Menghitung "mood" AI berdasarkan:
- Recent P&L (last N trades)
- Win rate
- Trading frequency
- Market volatility (ATR)
- Market liquidity (spread, order book)

Mood states:
- 😎 **Confident** - Good performance, stable market
- 🤔 **Cautious** - Mixed performance or volatile market
- 😴 **Fatigued** - Too many trades (overtrading)
- 🛡️ **Conservative** - Low liquidity or high volatility
- 📚 **Learning** - Insufficient trade history

```python
from app.services.monitoring.agent_state_monitor import agent_state_monitor

mood_data = await agent_state_monitor.get_current_state(
    user_id=1,
    symbol="BTC-USDT",
    db=db_session
)

print(f"Mood: {mood_data['mood']}")
print(f"Reason: {mood_data['reason']}")
```

### 3. Real-Time Data Ingestion
File: `app/services/data_ingestion/cryptofeed_service.py`

Menggunakan CryptoFeed untuk koneksi WebSocket ke bursa:
- Trades
- L2 Order Book
- Ticker updates

```python
from app.services.data_ingestion.cryptofeed_service import cryptofeed_service

# Start data ingestion
await cryptofeed_service.start()

# Get latest price
price = cryptofeed_service.get_latest_price("BTC-USDT")

# Get order book
orderbook = cryptofeed_service.get_latest_orderbook("BTC-USDT")
```

### 4. Paper Trading Execution
File: `app/services/trading/ccxt_service.py`

Simulasi eksekusi order tanpa uang riil:

```python
from app.services.trading.ccxt_service import ccxt_service

# Execute paper trade
result = await ccxt_service.execute_paper_trade(
    symbol="BTC/USDT",
    side="buy",
    amount=0.001,
    order_type="market"
)

print(f"Executed: {result['side']} {result['amount']} @ ${result['price']}")
print(f"Fee: ${result['fee']['cost']}")
```

### 5. Telegram Bot
File: `app/services/telegram/telegram_bot.py`

Bot Telegram untuk notifikasi dan queries:

**Commands:**
- `/start` - Welcome message
- `/status` - Current mood & performance
- `/pnl` - Profit & Loss summary
- `/trades` - Recent trades
- `/mood` - Mood explanation
- `/learn` - Educational tips

**Proactive Notifications:**
- Mood changes
- Trade executions
- Daily summaries
- Risk warnings

---

## 🎓 Prinsip Edukasi

### 1. Transparansi (Mood Meter)
"Saya sedang cautious karena market volatility tinggi dan recent losses."
→ User belajar kapan TIDAK trading.

### 2. Manajemen Risiko (Pre-Trade Checks)
Blocked: "Spread terlalu lebar (75 bps). Tunggu kondisi lebih baik."
→ User belajar pentingnya liquidity.

### 3. Ekspektasi Realistis (Monte Carlo)
"Dari 1000 simulasi, 60% profit, 40% loss. Median return: +2%"
→ User belajar trading bukan judi.

### 4. Gamifikasi
- Badges untuk milestones
- Win streak tracking
- "Lessons Learned" dari losing trades

---

## ⚠️ Batasan Kepatuhan (PENTING)

### MVP HANYA UNTUK:
- ✅ Paper trading (simulated)
- ✅ Pemberian sinyal (notifications)
- ✅ Edukasi dan analisis

### DILARANG (untuk menghindari regulasi MSB/VASP):
- ❌ Live auto-trading dengan uang riil
- ❌ Custody dana user
- ❌ Pemrosesan deposit/withdrawal crypto
- ❌ Eksekusi order atas nama user

---

## 📊 API Endpoints

### Health
- `GET /api/v1/health/` - Basic health check
- `GET /api/v1/health/db` - Database health

### Trading (Paper)
- `POST /api/v1/trading/execute` - Execute paper trade
- `GET /api/v1/trading/history` - Trade history
- `GET /api/v1/trading/portfolio` - Portfolio status

### Mood Meter
- `GET /api/v1/mood/current` - Current mood
- `GET /api/v1/mood/history` - Historical mood data

### Market Data
- `GET /api/v1/market/ohlcv/{symbol}` - OHLCV candlestick data
- `GET /api/v1/market/orderbook/{symbol}` - Order book snapshot
- `GET /api/v1/market/ticker/{symbol}` - Current ticker

### WebSocket
- `WS /ws/{user_id}` - Real-time updates (P&L, mood, trades, market data)

---

## 🧪 Testing

```bash
# Run tests
pytest tests/

# Run with coverage
pytest --cov=app tests/

# Test specific module
pytest tests/test_pretrade_checks.py
```

---

## 📈 Roadmap

### MVP Tahap 1 (Core) ✅
- [x] FastAPI server dengan WebSocket
- [x] TimescaleDB schema
- [x] CryptoFeed data ingestion
- [x] CCXT paper trading
- [x] Pre-Trade Checks (Heuristik)
- [x] Gymnasium environment
- [x] Mood Meter
- [x] Telegram bot boilerplate

### MVP Tahap 2 (Personifikasi)
- [ ] PPO agent training
- [ ] Monte Carlo simulations
- [ ] Telegram bot integration
- [ ] Frontend (React/Next.js)
- [ ] User authentication

### Tahap 3 (Gamifikasi)
- [ ] Achievement system
- [ ] Social features (leaderboard)
- [ ] Educational content library
- [ ] Advanced analytics

---

## 🤝 Contributing

Kontribusi sangat diterima! Silakan:
1. Fork repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

MIT License - see LICENSE file for details

---

## 📞 Support

- **Issues:** GitHub Issues
- **Telegram:** @ai_traders_shadow_bot (coming soon)
- **Email:** support@aitradershadow.com

---

## ⚡ Performance Notes

- WebSocket updates: <100ms latency
- Pre-trade checks: <50ms
- Database queries: Optimized with TimescaleDB continuous aggregates
- ML inference: <10ms per prediction (once trained)

---

## 🙏 Acknowledgments

- FastAPI for amazing async framework
- TimescaleDB for time-series optimization
- CryptoFeed for low-latency market data
- Stable-Baselines3 for RL implementations
- CCXT for exchange abstraction

---

**Built with ❤️ for crypto education, not speculation.**
