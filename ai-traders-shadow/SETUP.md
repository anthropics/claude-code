# Setup Guide - AI Trader's Shadow

Panduan lengkap untuk setup development environment.

---

## 🐳 Cara Tercepat: Docker Compose

### 1. Jalankan Database

```bash
# Di root directory proyek
docker-compose up -d

# Cek status
docker-compose ps

# Lihat logs
docker-compose logs -f timescaledb
```

Database akan tersedia di: `localhost:5432`
- User: `postgres`
- Password: `password`
- Database: `ai_traders_shadow`

Schema SQL akan otomatis dijalankan saat pertama kali start.

### 2. Setup Backend

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Edit .env (sudah pre-configured untuk Docker)
# Tidak perlu edit jika menggunakan default Docker settings
```

### 3. Jalankan Backend

```bash
# Pastikan venv aktif
source venv/bin/activate

# Jalankan server
python -m app.main
```

Server akan berjalan di: http://localhost:8000

### 4. Test API

Buka browser ke: http://localhost:8000/docs

Anda akan melihat interactive API documentation (Swagger UI).

### 5. Test WebSocket

```bash
# Install wscat (jika belum ada)
npm install -g wscat

# Connect ke WebSocket
wscat -c ws://localhost:8000/ws/1

# Send ping
> {"type": "ping", "timestamp": "2024-01-01T00:00:00Z"}

# Anda akan menerima pong
```

---

## 🔧 Manual Setup (Tanpa Docker)

### 1. Install PostgreSQL + TimescaleDB

#### Ubuntu/Debian

```bash
# Add TimescaleDB PPA
sudo add-apt-repository ppa:timescale/timescaledb-ppa
sudo apt update

# Install TimescaleDB
sudo apt install timescaledb-postgresql-14

# Configure TimescaleDB
sudo timescaledb-tune

# Restart PostgreSQL
sudo systemctl restart postgresql
```

#### macOS

```bash
# Install PostgreSQL
brew install postgresql@14

# Install TimescaleDB
brew tap timescale/tap
brew install timescaledb

# Configure
timescaledb-tune

# Start PostgreSQL
brew services start postgresql@14
```

#### Windows

Download installer dari: https://www.timescale.com/download

### 2. Create Database

```bash
# Login sebagai postgres
sudo -u postgres psql

# Create database
CREATE DATABASE ai_traders_shadow;

# Exit
\q

# Run schema
sudo -u postgres psql ai_traders_shadow < database/schema.sql
```

### 3. Configure Backend

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy .env
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/ai_traders_shadow
```

### 4. Run Backend

```bash
python -m app.main
```

---

## 🧪 Testing Setup

### 1. Verify Database Connection

```bash
python -c "
from app.db.database import engine
from sqlalchemy import text
with engine.connect() as conn:
    result = conn.execute(text('SELECT 1'))
    print('Database connected:', result.fetchone())
"
```

### 2. Test CryptoFeed (Real Market Data)

```bash
python -c "
import asyncio
from app.services.data_ingestion.cryptofeed_service import cryptofeed_service

async def test():
    await asyncio.sleep(5)  # Let it collect some data
    price = cryptofeed_service.get_latest_price('BTC-USDT')
    print(f'Latest BTC price: ${price}')

asyncio.run(cryptofeed_service.start())
asyncio.run(test())
"
```

### 3. Test CCXT (Exchange Connection)

```bash
python -c "
import asyncio
from app.services.trading.ccxt_service import ccxt_service

async def test():
    ticker = await ccxt_service.fetch_ticker('BTC/USDT')
    print(f'BTC/USDT Ticker: {ticker}')

asyncio.run(test())
"
```

### 4. Test Pre-Trade Checks

```bash
python -c "
import asyncio
from app.ml.pretrade_checks.heuristic_checks import pre_trade_checker

async def test():
    passed, results = await pre_trade_checker.run_all_checks(
        user_id=1,
        symbol='BTC/USDT',
        amount=0.001,
        recent_trades_count=2
    )
    print(f'Pre-trade checks passed: {passed}')
    for r in results:
        print(f'  - {r.check_type}: {r.reason}')

asyncio.run(test())
"
```

### 5. Test Gymnasium Environment

```bash
cd backend
python app/ml/environments/crypto_trading_env.py
```

Ini akan menjalankan test episode dengan random actions.

---

## 🤖 Setup Telegram Bot

### 1. Create Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot`
3. Follow instructions to create bot
4. Copy the token

### 2. Configure Bot

Edit `.env`:
```env
TELEGRAM_BOT_TOKEN=your_token_here
TELEGRAM_ADMIN_CHAT_ID=your_chat_id
```

### 3. Get Your Chat ID

1. Search for `@userinfobot` di Telegram
2. Send `/start`
3. Copy your chat ID

### 4. Test Bot

```bash
python -c "
import asyncio
from app.services.telegram.telegram_bot import telegram_bot

async def test():
    await telegram_bot.start()
    # Keep running
    await asyncio.sleep(3600)

asyncio.run(test())
"
```

Buka Telegram dan kirim `/start` ke bot Anda.

---

## 🎓 Training RL Agent (PPO)

### 1. Prepare Training Data

```python
# fetch_training_data.py
import pandas as pd
from app.services.trading.ccxt_service import ccxt_service
import asyncio

async def fetch_historical_data():
    # Fetch OHLCV data from exchange
    ohlcv = await ccxt_service.exchange.fetch_ohlcv(
        'BTC/USDT',
        timeframe='1m',
        limit=10000
    )

    df = pd.DataFrame(
        ohlcv,
        columns=['timestamp', 'open', 'high', 'low', 'close', 'volume']
    )

    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
    df.to_csv('training_data.csv', index=False)
    print(f"Saved {len(df)} candles to training_data.csv")

asyncio.run(fetch_historical_data())
```

### 2. Train PPO Agent

```python
# train_agent.py
import pandas as pd
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import CheckpointCallback
from app.ml.environments.crypto_trading_env import CryptoTradingEnv

# Load data
df = pd.read_csv('training_data.csv')

# Create environment
env = CryptoTradingEnv(
    df=df,
    initial_balance=100.0,
    fee_rate=0.001,
    min_order_size_usd=10.0
)

# Create PPO agent
model = PPO(
    "MlpPolicy",
    env,
    verbose=1,
    learning_rate=3e-4,
    n_steps=2048,
    batch_size=64,
    n_epochs=10,
    gamma=0.99,
    tensorboard_log="./logs/tensorboard/"
)

# Setup checkpoint callback
checkpoint_callback = CheckpointCallback(
    save_freq=10000,
    save_path="./models/checkpoints/",
    name_prefix="ppo_crypto_trader"
)

# Train
model.learn(
    total_timesteps=500000,
    callback=checkpoint_callback
)

# Save final model
model.save("./models/ppo_crypto_trader_final")
print("Training complete!")
```

### 3. Evaluate Agent

```python
# evaluate_agent.py
import pandas as pd
from stable_baselines3 import PPO
from app.ml.environments.crypto_trading_env import CryptoTradingEnv

# Load model
model = PPO.load("./models/ppo_crypto_trader_final")

# Load test data
df = pd.read_csv('test_data.csv')

# Create environment
env = CryptoTradingEnv(df=df, initial_balance=100.0)

# Run evaluation episode
obs, info = env.reset()
done = False

while not done:
    action, _ = model.predict(obs, deterministic=True)
    obs, reward, terminated, truncated, info = env.step(action)
    done = terminated or truncated

print(f"Final P&L: ${info['pnl']:.2f}")
print(f"Win Rate: {info['win_rate']:.2%}")
print(f"Total Trades: {info['trades']}")
```

---

## 📊 Monitoring & Debugging

### View Logs

```bash
# Backend logs
tail -f backend/logs/app.log

# Error logs
tail -f backend/logs/error.log
```

### Database Queries

```bash
# Connect to database
docker-compose exec timescaledb psql -U postgres -d ai_traders_shadow

# Example queries
SELECT * FROM users LIMIT 10;
SELECT * FROM trades_paper ORDER BY executed_at DESC LIMIT 10;
SELECT * FROM agent_status_log ORDER BY time DESC LIMIT 10;

# Check hypertables
SELECT * FROM timescaledb_information.hypertables;
```

### TensorBoard (for RL training)

```bash
# Install tensorboard
pip install tensorboard

# View training logs
tensorboard --logdir backend/logs/tensorboard/
```

Open: http://localhost:6006

---

## 🚨 Troubleshooting

### Database Connection Error

**Problem:** `connection refused` atau `could not connect`

**Solution:**
```bash
# Check if PostgreSQL running
docker-compose ps
# atau
sudo systemctl status postgresql

# Check database exists
docker-compose exec timescaledb psql -U postgres -l
```

### CryptoFeed Connection Error

**Problem:** `WebSocket connection failed`

**Solution:**
- Check internet connection
- Verify symbol format (e.g., `BTC-USDT` untuk Binance)
- Check exchange is not blocked in your region

### CCXT Rate Limit Error

**Problem:** `ExchangeError: rate limit exceeded`

**Solution:**
```python
# Add delay between requests
import time
time.sleep(1)

# Or enable rate limiting in config
exchange_class({"enableRateLimit": True})
```

### Gymnasium Environment Error

**Problem:** `observation space mismatch`

**Solution:**
- Check `num_features` matches actual features
- Verify data has required columns (open, high, low, close, volume)

---

## 🎯 Next Steps

1. **Frontend Development**
   - Setup Next.js project
   - Integrate WebSocket client
   - Build Mood Meter UI
   - Create trading dashboard

2. **Monte Carlo Simulations**
   - Implement simulation engine
   - Create visualization
   - Add to API endpoints

3. **Production Deployment**
   - Setup CI/CD
   - Configure production database
   - Setup monitoring (Sentry, DataDog)
   - Deploy to cloud (AWS, GCP, or DigitalOcean)

---

## 📚 Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [TimescaleDB Docs](https://docs.timescale.com/)
- [CryptoFeed GitHub](https://github.com/bmoscon/cryptofeed)
- [CCXT Documentation](https://docs.ccxt.com/)
- [Stable-Baselines3 Docs](https://stable-baselines3.readthedocs.io/)
- [Gymnasium Documentation](https://gymnasium.farama.org/)

---

**Happy Coding! 🚀**
