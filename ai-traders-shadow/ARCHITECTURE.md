# Arsitektur AI Trader's Shadow

## 📐 Arsitektur Sistem

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACES                          │
├─────────────────────────────────────────────────────────────────┤
│  Web UI (React)  │  Telegram Bot  │  WebSocket Client           │
└────────┬─────────┴────────┬───────┴───────────┬─────────────────┘
         │                  │                   │
         │                  │                   │
┌────────▼──────────────────▼───────────────────▼─────────────────┐
│                     FastAPI Backend                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  REST API   │  │  WebSocket   │  │  Telegram Bot Service  │ │
│  └──────┬──────┘  └──────┬───────┘  └───────────┬────────────┘ │
│         │                │                       │              │
├─────────┼────────────────┼───────────────────────┼──────────────┤
│         │      SERVICE LAYER                     │              │
│  ┌──────▼──────┐  ┌──────▼─────────┐  ┌─────────▼──────────┐   │
│  │  Trading    │  │  Monitoring    │  │  Data Ingestion    │   │
│  │  (CCXT)     │  │  (Mood Meter)  │  │  (CryptoFeed)      │   │
│  └──────┬──────┘  └──────┬─────────┘  └─────────┬──────────┘   │
│         │                │                       │              │
├─────────┼────────────────┼───────────────────────┼──────────────┤
│         │      ML LAYER                          │              │
│  ┌──────▼───────────┐  ┌─────────────────────┐  │              │
│  │  Pre-Trade       │  │  PPO RL Agent       │  │              │
│  │  Checks          │  │  (Gymnasium Env)    │  │              │
│  │  (Heuristic)     │  │                     │  │              │
│  └──────────────────┘  └─────────────────────┘  │              │
│                                                  │              │
└──────────────────────────────────────────────────┼──────────────┘
                                                   │
         ┌─────────────────────────────────────────┼──────────┐
         │                 DATA LAYER               │          │
         │  ┌───────────────────────────┐  ┌────────▼───────┐ │
         │  │  TimescaleDB              │  │  Exchange      │ │
         │  │  (PostgreSQL)             │  │  WebSocket     │ │
         │  │  - Users                  │  │  (Binance)     │ │
         │  │  - Trades (Paper)         │  └────────────────┘ │
         │  │  - Market Data (OHLCV)    │                     │
         │  │  - Order Book Snapshots   │                     │
         │  │  - Agent Status Log       │                     │
         │  └───────────────────────────┘                     │
         └────────────────────────────────────────────────────┘
```

---

## 🧩 Komponen Detail

### 1. API Layer (FastAPI)

**File:** `backend/app/main.py`

**Responsibilities:**
- HTTP REST endpoints
- WebSocket real-time connections
- Request validation (Pydantic)
- CORS handling
- Error handling

**Key Features:**
- Async/await untuk high concurrency
- Automatic OpenAPI (Swagger) documentation
- Connection manager untuk WebSocket clients

**Endpoints:**
```
GET  /                           - Health check
GET  /api/v1/health/            - Health status
GET  /api/v1/health/db          - Database health

POST /api/v1/trading/execute    - Execute paper trade
GET  /api/v1/trading/history    - Trade history
GET  /api/v1/trading/portfolio  - Portfolio status

GET  /api/v1/mood/current       - Current mood
GET  /api/v1/mood/history       - Mood history

GET  /api/v1/market/ohlcv/{symbol}      - OHLCV data
GET  /api/v1/market/orderbook/{symbol}  - Order book
GET  /api/v1/market/ticker/{symbol}     - Ticker

WS   /ws/{user_id}              - WebSocket real-time stream
```

---

### 2. Service Layer

#### 2.1 Trading Service (CCXT)

**File:** `backend/app/services/trading/ccxt_service.py`

**Responsibilities:**
- Paper trade execution simulation
- Market price fetching
- Order book retrieval
- Minimum order size validation

**Key Methods:**
```python
async def execute_paper_trade(symbol, side, amount, order_type, price)
async def fetch_ticker(symbol)
async def fetch_order_book(symbol, limit)
async def check_minimum_order_size(symbol, amount)
```

**Simulated Friction:**
- Trading fee: 0.1%
- Slippage: 0.05% (market orders)
- Minimum order: $10 USD

#### 2.2 Monitoring Service (Mood Meter)

**File:** `backend/app/services/monitoring/agent_state_monitor.py`

**Responsibilities:**
- Calculate agent "mood" based on performance + market
- Provide human-readable explanations
- Track mood history

**Mood Calculation:**
```python
score = base_score (50)
  + P&L factor (-20 to +20)
  + Win rate factor (-15 to +15)
  - Overtrading penalty (-30 if > max trades)
  + Market conditions (-15 to +10)
```

**Mood States:**
- `confident` (70-100): Good performance, stable market
- `cautious` (40-69): Mixed conditions
- `conservative` (0-39): High risk
- `fatigued`: Too many trades
- `learning`: < 5 trades total

#### 2.3 Data Ingestion Service (CryptoFeed)

**File:** `backend/app/services/data_ingestion/cryptofeed_service.py`

**Responsibilities:**
- Real-time WebSocket connections to exchanges
- Market data streaming (trades, L2 book, ticker)
- Data caching for quick access
- TimescaleDB storage

**Callbacks:**
```python
async def trade_callback(trade, receipt_timestamp)
async def orderbook_callback(orderbook, receipt_timestamp)
async def ticker_callback(ticker, receipt_timestamp)
```

**Data Flow:**
```
Exchange WS → CryptoFeed → Callback → Cache + DB → WebSocket Clients
```

#### 2.4 Telegram Bot Service

**File:** `backend/app/services/telegram/telegram_bot.py`

**Responsibilities:**
- Proactive notifications (mood, trades, alerts)
- Reactive queries (status, P&L, history)
- Educational tips

**Commands:**
- `/start` - Welcome
- `/status` - Current mood + performance
- `/pnl` - P&L summary
- `/trades` - Recent trades
- `/mood` - Mood explanation
- `/learn` - Educational tip

---

### 3. ML Layer

#### 3.1 Pre-Trade Checks (Heuristic - Layer 1)

**File:** `backend/app/ml/pretrade_checks/heuristic_checks.py`

**Responsibilities:**
- Block unsafe trades BEFORE execution
- Protect users from unfavorable conditions

**Checks:**
1. **Spread Check**: Block if spread > 50 bps
2. **Liquidity Check**: Block if insufficient liquidity
3. **Minimum Order Size**: Enforce $10 minimum
4. **Overtrading**: Block if > 5 trades/hour
5. **News Filter**: Block during high-impact events (TODO)

**Usage:**
```python
passed, results = await pre_trade_checker.run_all_checks(
    user_id=1,
    symbol="BTC/USDT",
    amount=0.001,
    recent_trades_count=3
)

if not passed:
    # Block trade, show reason to user
    failed_checks = [r for r in results if not r.passed]
```

#### 3.2 PPO RL Agent (Layer 2)

**File:** `backend/app/ml/environments/crypto_trading_env.py`

**Responsibilities:**
- Gymnasium-compatible environment for RL training
- Realistic market friction simulation
- Reward shaping for profitable behavior

**Environment Design:**

**Observation Space:**
- Price data (OHLCV) over window (e.g., 50 bars)
- Technical indicators (TODO: RSI, MACD, etc.)
- Position state (holdings, P&L)

**Action Space:**
- 0: Hold (no action)
- 1: Buy (market order)
- 2: Sell (market order)

**Reward Function:**
```python
reward = realized_pnl / initial_balance  # Normalized

# Penalties:
- Invalid action: -0.1
- Order below minimum: -1.0
- Account bust: -100
```

**Simulated Friction:**
```python
execution_price_buy = price * (1 + slippage_bps)
execution_price_sell = price * (1 - slippage_bps)
fee = order_value * fee_rate  # 0.1%
min_order_size_usd = 10.0
```

**Training Process:**
```python
# 1. Load historical data
df = load_market_data()

# 2. Create environment
env = CryptoTradingEnv(df, initial_balance=100.0)

# 3. Train PPO agent
model = PPO("MlpPolicy", env)
model.learn(total_timesteps=500000)

# 4. Evaluate on test data
obs, _ = env.reset()
while not done:
    action, _ = model.predict(obs)
    obs, reward, done, _, info = env.step(action)
```

---

### 4. Data Layer

#### 4.1 TimescaleDB Schema

**File:** `database/schema.sql`

**Hypertables (Time-Series):**

1. **market_data_1m**
   - OHLCV candles (1-minute)
   - Partitioned by time
   - Retention: 30 days

2. **order_book_snapshots**
   - L2 order book snapshots
   - Bid/ask price, quantity, spread
   - Retention: 7 days

3. **agent_status_log**
   - Mood meter history
   - Mood, score, metrics, reason
   - Retention: 90 days

4. **pre_trade_checks_log**
   - Pre-trade check results
   - Check type, passed/failed, details
   - Retention: 60 days

**Regular Tables:**

5. **users**
   - User accounts
   - Paper trading balance
   - Telegram chat_id

6. **trades_paper**
   - Paper trading trades
   - Symbol, side, price, quantity, P&L
   - Strategy signal (e.g., "ppo_agent")

7. **monte_carlo_simulations**
   - Simulation results
   - Distribution data, percentiles
   - Risk metrics

8. **rl_training_episodes**
   - RL training metadata
   - Episode rewards, metrics
   - Model checkpoint paths

**Continuous Aggregates:**

9. **market_data_5m** (materialized view)
   - 5-minute OHLCV from 1m data
   - Auto-refresh

10. **agent_performance_1h** (materialized view)
    - Hourly agent performance metrics
    - Auto-refresh

**Helper Functions:**
```sql
get_paper_balance(user_id)        -- Current balance + realized P&L
get_latest_mood(user_id)          -- Latest mood state
```

---

## 🔄 Data Flow Examples

### Example 1: Paper Trade Execution

```
1. User → POST /api/v1/trading/execute
   {symbol: "BTC-USDT", side: "buy", quantity: 0.001}

2. API → Pre-Trade Checker
   ✓ Spread OK (15 bps < 50 bps)
   ✓ Liquidity OK ($50k > $10k)
   ✓ Order size OK (0.001 * $45k = $45 > $10)
   ✓ Not overtrading (2 trades/hour < 5)

3. API → CCXT Service
   - Fetch current price: $45,000
   - Calculate execution: $45,022.50 (with slippage)
   - Calculate fee: $0.045 (0.1%)
   - Simulate fill

4. API → Database
   - INSERT INTO trades_paper (...)
   - Update user balance

5. API → WebSocket Manager
   - Broadcast to user's connections
   {type: "trade_execution", data: {...}}

6. API → Mood Monitor
   - Recalculate mood based on new trade

7. API → Telegram Bot
   - Send notification: "🟢 BUY executed..."

8. Response → User
   {id: 123, status: "filled", price: 45022.50, ...}
```

### Example 2: Real-Time Market Data

```
1. Exchange → CryptoFeed WebSocket
   Trade: BTC-USDT @ $45,100

2. CryptoFeed → trade_callback()
   - Update cache: latest_trades["BTC-USDT"]
   - Aggregate to 1m candle
   - Store to market_data_1m

3. CryptoFeed → WebSocket Manager
   - Broadcast to subscribed clients
   {type: "market_data", symbol: "BTC-USDT", price: 45100}

4. Connected Clients → Update UI
   - Update price chart
   - Update ticker display
```

### Example 3: Mood Update

```
1. Background Task (every 60s)

2. AgentStateMonitor.get_current_state(user_id, symbol)
   a. Query recent trades → calculate P&L, win_rate
   b. Get market data → calculate volatility, liquidity
   c. Calculate mood_score (0-100)
   d. Determine mood state (confident/cautious/etc.)
   e. Generate human-readable reason

3. Check if mood changed significantly
   IF mood_change > threshold:

4. WebSocket Manager → Broadcast
   {type: "mood_update", mood: "cautious", reason: "..."}

5. Telegram Bot → Send notification
   "🤔 Mood Update: My mood changed to Cautious..."

6. Database → INSERT INTO agent_status_log
```

---

## 🔐 Security & Compliance

### Paper Trading Only (MVP)

**What is ALLOWED:**
✅ Simulated trading (no real money)
✅ Signal generation (notifications)
✅ Educational content
✅ Performance tracking (simulated)

**What is FORBIDDEN:**
❌ Auto-execution with real funds
❌ Custody of user crypto assets
❌ Processing deposits/withdrawals
❌ Acting as money transmitter

**Why?**
- Avoid MSB (Money Services Business) regulation
- Avoid VASP (Virtual Asset Service Provider) licensing
- Focus on education, not financial services

### Data Protection

**Sensitive Data:**
- User credentials (hashed with bcrypt)
- Telegram chat IDs
- API keys (encrypted at rest)

**Non-Sensitive Data:**
- Paper trading performance (can be public/gamified)
- Market data (public)
- Educational content

---

## 📊 Performance Considerations

### Database Optimization

**TimescaleDB Features:**
- Automatic partitioning by time
- Compression of old data
- Continuous aggregates (pre-computed views)
- Retention policies (auto-delete old data)

**Query Optimization:**
```sql
-- Use time-bucket for aggregation
SELECT time_bucket('5 minutes', time) AS bucket,
       symbol,
       first(open, time) AS open,
       max(high) AS high,
       min(low) AS low,
       last(close, time) AS close
FROM market_data_1m
WHERE symbol = 'BTC-USDT'
  AND time > NOW() - INTERVAL '24 hours'
GROUP BY bucket, symbol
ORDER BY bucket DESC;
```

### WebSocket Scaling

**Connection Manager:**
- In-memory dict: `user_id → Set[WebSocket]`
- For production: Use Redis pub/sub
- Horizontal scaling: Sticky sessions or Redis adapter

### CryptoFeed Performance

- Use L2 book deltas (not full snapshots)
- Rate limiting: Max updates per second
- Batch database inserts

### ML Inference

- Model loaded once at startup
- Inference < 10ms (CPU)
- Consider batching for multiple users

---

## 🎯 Future Enhancements

### Scalability

1. **Redis Integration**
   - Cache hot data (latest prices, mood states)
   - Pub/sub for WebSocket scaling
   - Session storage

2. **Message Queue (Celery/RabbitMQ)**
   - Async task processing
   - RL training jobs
   - Monte Carlo simulations
   - Daily report generation

3. **Load Balancing**
   - Multiple FastAPI instances
   - NGINX reverse proxy
   - Sticky sessions for WebSocket

### Advanced Features

1. **Multi-Symbol Support**
   - Track multiple trading pairs
   - Portfolio allocation
   - Correlation analysis

2. **Advanced RL**
   - Multi-agent RL (ensemble)
   - Transfer learning across symbols
   - Meta-learning for fast adaptation

3. **Risk Analytics**
   - Monte Carlo simulations
   - Value at Risk (VaR)
   - Sharpe ratio optimization
   - Drawdown analysis

4. **Social Features**
   - Leaderboard (paper trading)
   - Trade sharing
   - Strategy marketplace
   - Mentorship matching

---

## 📚 Technology Choices Rationale

### Why FastAPI?
- **Performance**: Async/await, faster than Flask/Django
- **Type Safety**: Pydantic validation
- **Auto Docs**: Built-in Swagger UI
- **WebSocket**: Native support
- **Modern**: Python 3.10+ features

### Why TimescaleDB?
- **Hybrid**: Time-series + relational in one DB
- **Performance**: 10-100x faster for time-series queries
- **Features**: Continuous aggregates, compression, retention
- **Postgres**: Full SQL support, ecosystem compatibility

### Why CryptoFeed?
- **Speed**: Direct WebSocket, lower latency than REST polling
- **Multi-Exchange**: Unified API for all exchanges
- **Reliability**: Auto-reconnection, error handling
- **Features**: L2/L3 book, trades, funding rates, etc.

### Why CCXT?
- **Coverage**: 100+ exchanges
- **Abstraction**: Unified API
- **Paper Trading**: Testnet support
- **Community**: Active development

### Why Gymnasium (not Gym)?
- **Maintained**: Gym is deprecated
- **API**: Cleaner, more consistent
- **Compatibility**: stable-baselines3 support

### Why PPO (not DQN/A3C)?
- **Sample Efficient**: Works with limited data
- **Stable**: Less hyperparameter sensitive
- **Continuous**: Easy to extend to continuous actions
- **Popular**: Well-tested in finance domain

---

**Arsitektur ini dirancang untuk:**
1. ✅ Pembelajaran dan edukasi pengguna
2. ✅ Transparansi keputusan AI
3. ✅ Manajemen risiko yang ketat
4. ✅ Skalabilitas untuk pertumbuhan
5. ✅ Kepatuhan regulasi (paper trading only)
