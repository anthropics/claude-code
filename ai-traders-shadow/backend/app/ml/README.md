# Machine Learning Training Guide

Panduan lengkap untuk melatih dan menggunakan model PPO (Proximal Policy Optimization) untuk trading crypto.

---

## 📋 Prerequisites

1. **Backend Setup Selesai:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Koneksi Internet:**
   - Dibutuhkan untuk fetch historical data dari Binance

3. **Storage:**
   - Minimal 500MB untuk model checkpoints dan logs

---

## 🚀 Quick Start

### 1. Train Model (First Time)

```bash
# Dari directory backend/
python -m app.ml.train_ppo
```

**Apa yang terjadi:**
- Mengunduh 100,000 bar (1-minute candles) BTC/USDT dari Binance (~69 hari data)
- Split data: 80% training, 20% testing
- Melatih model PPO untuk 200,000 timesteps (~2-4 jam di CPU)
- Menyimpan checkpoints setiap 10,000 steps
- Evaluasi model setiap 5,000 steps
- Simpan model final ke `./models/ppo_crypto_final.zip`

**Output:**
```
ai-traders-shadow/backend/
├── models/
│   ├── ppo_crypto_final.zip        # Model final
│   ├── best_model.zip              # Best model (highest eval score)
│   ├── checkpoints/
│   │   ├── ppo_crypto_10000_steps.zip
│   │   ├── ppo_crypto_20000_steps.zip
│   │   └── ...
│   └── logs/
│       ├── train/                  # Training logs
│       ├── test/                   # Evaluation logs
│       └── tensorboard/            # TensorBoard logs
```

### 2. Monitor Training (TensorBoard)

Di terminal baru:
```bash
pip install tensorboard
tensorboard --logdir ./models/logs/tensorboard/
```

Buka: http://localhost:6006

**Metrics yang bisa dilihat:**
- Episode reward over time
- Episode length
- Learning rate
- Value loss
- Policy loss

### 3. Evaluate Trained Model

```bash
python -m app.ml.evaluate_ppo \
    --model ./models/ppo_crypto_final.zip \
    --episodes 10 \
    --balance 100.0
```

**Output:**
```
📊 EVALUATION SUMMARY
========================
💰 P&L Statistics:
  Mean P&L:     $  +2.34 ± $1.45
  Median P&L:   $  +1.87
  Min P&L:      $  -0.55
  Max P&L:      $  +5.12
  Profit Prob:  70.0%

📊 Trading Statistics:
  Mean Trades:  12.3
  Mean WinRate: 58.3%
  Total Fees:   $0.15
```

### 4. Interactive Testing

```bash
python -m app.ml.test_model_interactive
```

Ini akan menjalankan satu episode lengkap dengan output step-by-step.

---

## ⚙️ Configuration

### Training Parameters

Edit `train_ppo.py` untuk customize:

```python
# Data Configuration
SYMBOL = "BTC/USDT"          # Trading pair
TIMEFRAME = "1m"             # Candle timeframe
N_BARS = 100000              # Number of historical bars

# Training Configuration
TOTAL_TIMESTEPS = 200000     # Training steps
INITIAL_BALANCE = 100.0      # Starting balance

# Environment Configuration (dalam CryptoTradingEnv)
fee_rate = 0.001             # 0.1% trading fee
min_order_size_usd = 10.0    # Minimum order $10
slippage_bps = 5.0           # 0.05% slippage
window_size = 50             # Observation window (bars)
```

### PPO Hyperparameters

Dalam `create_model()`:

```python
model = PPO(
    policy="MlpPolicy",
    env=env,
    learning_rate=3e-4,      # Learning rate
    n_steps=2048,            # Steps per update
    batch_size=64,           # Batch size
    n_epochs=10,             # Epochs per update
    gamma=0.99,              # Discount factor
    gae_lambda=0.95,         # GAE lambda
    clip_range=0.2,          # PPO clip range
    ent_coef=0.01,           # Entropy coefficient (exploration)
)
```

**Tips untuk tuning:**
- **Learning rate terlalu tinggi?** Model tidak konvergen → Turunkan ke 1e-4
- **Model terlalu konservatif?** Tidak trade → Naikkan `ent_coef` untuk lebih explore
- **Training lambat?** Turunkan `n_steps` atau `batch_size`

---

## 📊 Understanding the Environment

### Observation Space

Model menerima window data 50 bars terakhir dengan features:
- **OHLCV normalized** (5 features)
- **Position ratio** (current holdings / initial balance)

Total: 6 features x 50 timesteps = shape (50, 6)

### Action Space

Model bisa memilih 3 actions:
- `0`: **HOLD** - Tidak melakukan apa-apa
- `1`: **BUY** - Market buy order (90% dari balance)
- `2`: **SELL** - Market sell order (tutup posisi)

### Reward Function

```python
# Per step:
reward = realized_pnl / initial_balance

# Penalties:
- Invalid action (e.g., buy when already long): -0.1
- Order below minimum ($10): -1.0
- Account bust (equity <= 0): -100
```

### Realistic Frictions

Model belajar dengan kondisi realistis:

1. **Trading Fees (0.1%):**
   ```python
   fee = order_value * 0.001
   balance -= fee
   ```

2. **Slippage (0.05%):**
   ```python
   execution_price_buy = market_price * 1.0005
   execution_price_sell = market_price * 0.9995
   ```

3. **Minimum Order Size ($10):**
   ```python
   if order_value < 10.0:
       return penalty
   ```

Ini memastikan strategi yang profitable di simulation akan viable di real market.

---

## 🎯 Training Tips

### 1. Data Quality

**Good:**
- Recent data (last 3-6 months)
- Include different market conditions (bull, bear, sideways)
- Clean data (no gaps, outliers removed)

**Bad:**
- Only bull market data → Model tidak bisa handle crash
- Very old data (2 years+) → Market dynamics berubah

### 2. Training Duration

**Underfitting (too short):**
- < 100k timesteps
- Model belum belajar patterns
- Random actions, low win rate

**Optimal:**
- 200k - 500k timesteps
- Model converges
- Stable performance

**Overfitting (too long):**
- > 1M timesteps on same data
- Model memorizes training set
- Poor performance on test set

**Solution:** Monitor test set performance via `EvalCallback`

### 3. Evaluation

**During Training:**
- Check TensorBoard for learning curve
- Episode reward harus trending up
- Evaluation reward harus improving

**After Training:**
- Run evaluation on unseen data (different time period)
- Check multiple metrics: P&L, win rate, drawdown, Sharpe ratio
- Compare against buy-and-hold baseline

### 4. Common Issues

**Problem:** Model hanya HOLD, tidak pernah trade

**Causes:**
- Reward function tidak incentivize trading
- Minimum order size terlalu tinggi relatif balance
- Entropy coefficient terlalu rendah (tidak explore)

**Solutions:**
```python
# Increase exploration
ent_coef=0.02  # from 0.01

# Add trading bonus to reward
if action != 0:  # Not holding
    reward += 0.01  # Small bonus for taking action
```

---

**Problem:** Model trade terlalu sering (overtrading)

**Causes:**
- Tidak ada penalty untuk trading fees
- Entropy terlalu tinggi

**Solutions:**
```python
# Make sure fees are deducted
fee = order_value * 0.001
balance -= fee

# Reduce exploration
ent_coef=0.005  # from 0.01

# Add overtrading penalty
if trades_in_last_hour > 5:
    reward -= 0.1
```

---

**Problem:** Model profitable pada training tapi loss di test

**Causes:**
- Overfitting
- Different market regime (train=bull, test=bear)

**Solutions:**
- Use more diverse training data
- Add regularization (higher entropy)
- Use ensemble of models trained on different periods

---

## 📈 Performance Benchmarks

### Baseline (Random Actions)

```
Mean P&L:     $  -5.00 (lots of fees from random trading)
Win Rate:     ~33%
Drawdown:     >50%
```

### Naive Strategy (Buy and Hold)

```
Mean P&L:     ~market return (e.g., +2% if BTC +2%)
Win Rate:     N/A
Drawdown:     ~market drawdown
```

### Good Trained PPO Model

```
Mean P&L:     $  +3.00 to +8.00
Win Rate:     55-65%
Drawdown:     <30%
Sharpe Ratio: >0.5
```

### Excellent Model (Hard to Achieve)

```
Mean P&L:     > $10.00
Win Rate:     >70%
Drawdown:     <20%
Sharpe Ratio: >1.0
```

---

## 🔬 Advanced Topics

### 1. Multi-Symbol Training

Train on multiple trading pairs:

```python
symbols = ["BTC/USDT", "ETH/USDT", "BNB/USDT"]

for symbol in symbols:
    df = fetch_data(symbol)
    # Train separate model or use shared model
```

### 2. Transfer Learning

Pre-train on one symbol, fine-tune on another:

```python
# Pre-train on BTC
model = PPO("MlpPolicy", btc_env)
model.learn(total_timesteps=200000)

# Fine-tune on ETH
model.set_env(eth_env)
model.learn(total_timesteps=50000)
```

### 3. Ensemble Methods

Combine multiple models:

```python
models = [
    PPO.load("model1.zip"),
    PPO.load("model2.zip"),
    PPO.load("model3.zip"),
]

# Vote on action
actions = [m.predict(obs)[0] for m in models]
final_action = max(set(actions), key=actions.count)
```

### 4. Hyperparameter Tuning

Use Optuna for automated tuning:

```python
import optuna

def objective(trial):
    lr = trial.suggest_float("lr", 1e-5, 1e-3, log=True)
    ent_coef = trial.suggest_float("ent_coef", 0.001, 0.1, log=True)

    model = PPO("MlpPolicy", env, learning_rate=lr, ent_coef=ent_coef)
    model.learn(total_timesteps=50000)

    # Evaluate
    mean_reward = evaluate_model(model)
    return mean_reward

study = optuna.create_study(direction="maximize")
study.optimize(objective, n_trials=50)
```

---

## 🚨 Important Warnings

### 1. **NO GUARANTEES**

Past performance ≠ Future results. Model trained on historical data may not work in live market.

### 2. **Paper Trading Only (MVP)**

Current implementation is for **educational purposes only**. Do NOT use for live trading without:
- Extensive backtesting on out-of-sample data
- Forward testing on paper trading
- Risk management systems
- Circuit breakers

### 3. **Market Regime Changes**

Model trained on 2024 data may not work in 2025 if:
- Market structure changes (e.g., new regulations)
- Volatility regime shifts
- Correlation breakdowns

**Solution:** Retrain periodically (e.g., monthly) on recent data.

### 4. **Computational Costs**

Training on CPU:
- 200k timesteps: ~2-4 hours
- 500k timesteps: ~6-10 hours

Consider using GPU or cloud compute for faster training.

---

## 📚 Resources

**Reinforcement Learning:**
- [Stable-Baselines3 Docs](https://stable-baselines3.readthedocs.io/)
- [PPO Paper](https://arxiv.org/abs/1707.06347)
- [Spinning Up in Deep RL](https://spinningup.openai.com/)

**Algorithmic Trading:**
- [Advances in Financial ML](https://www.wiley.com/en-us/Advances+in+Financial+Machine+Learning-p-9781119482086) - Marcos López de Prado
- [QuantStart Tutorials](https://www.quantstart.com/)

**Gymnasium (OpenAI Gym):**
- [Gymnasium Documentation](https://gymnasium.farama.org/)
- [Creating Custom Environments](https://gymnasium.farama.org/tutorials/gymnasium_basics/environment_creation/)

---

## 🤝 Contributing

Improvements to ML pipeline welcomed:

**Ideas:**
- Better reward shaping
- Additional features (technical indicators, order flow)
- Multi-timeframe observations
- Recurrent policies (LSTM)
- Attention mechanisms

**Submit PR with:**
- Clear description of changes
- Benchmark results (before/after)
- Updated documentation

---

**Happy Training! 🚀**

Remember: The goal is **learning**, not get-rich-quick. Focus on understanding why the model makes decisions, not just chasing profits.
