# AI Trader's Shadow - PPO Reinforcement Learning

Sistema pelatihan model **PPO (Proximal Policy Optimization)** untuk trading cryptocurrency menggunakan Reinforcement Learning.

## 📋 Deskripsi

Project ini mengimplementasikan:
- **CryptoTradingEnv**: Custom Gym environment untuk simulasi trading crypto
- **train_ppo.py**: Script pelatihan model PPO dengan data real dari Bybit
- **Data pipeline**: Integrasi dengan CCXT untuk fetching data OHLCV

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Train Model Pertama (Basic)

```bash
# Training dengan default settings (BTC/USDT, 100K candles, 200K timesteps)
python -m app.ml.train_ppo
```

### 3. Training Custom

```bash
# Training untuk ETH/USDT dengan 5 menit timeframe
python -m app.ml.train_ppo \
    --symbol ETH/USDT \
    --timeframe 5m \
    --num-candles 50000 \
    --total-timesteps 500000 \
    --n-envs 8 \
    --learning-rate 0.0001
```

### 4. Monitor Training (TensorBoard)

```bash
tensorboard --logdir=logs/tensorboard/
```

Buka browser: `http://localhost:6006`

## 📊 Parameters

### Training Parameters

| Parameter | Default | Deskripsi |
|-----------|---------|-----------|
| `--symbol` | BTC/USDT | Trading pair (e.g., ETH/USDT, SOL/USDT) |
| `--timeframe` | 1m | Candle timeframe (1m, 5m, 15m, 1h) |
| `--num-candles` | 100000 | Jumlah historical candles |
| `--initial-balance` | 100.0 | Starting capital (USDT) |
| `--total-timesteps` | 200000 | Total training timesteps |
| `--n-envs` | 4 | Jumlah parallel environments |
| `--learning-rate` | 3e-4 | Learning rate PPO |
| `--batch-size` | 64 | Batch size untuk training |
| `--n-epochs` | 10 | Epochs per update |
| `--save-path` | models/ppo_crypto_model | Path untuk save model |
| `--log-dir` | logs/ | Directory untuk logs |

### Environment Settings

Di `CryptoTradingEnv.__init__()`:
- `commission`: Trading fee (default: 0.0004 = 0.04%)
- `max_position_size`: Max leverage (default: 1.0 = 100%)
- `lookback_window`: Historical candles in observation (default: 20)
- `reward_scaling`: Reward scaling factor (default: 1e-4)

## 🎯 Action Space

Model dapat melakukan 4 aksi:
- **0**: HOLD - Tidak melakukan apa-apa
- **1**: BUY - Open long position
- **2**: SELL - Open short position
- **3**: CLOSE - Close current position

## 📈 Observation Space

Features yang diberikan ke model:
1. **OHLCV normalized** (5 features)
2. **Technical Indicators**:
   - RSI (Relative Strength Index)
   - MACD (Moving Average Convergence Divergence)
   - Bollinger Bands (position & width)
   - ATR (Average True Range)
   - EMA (Exponential Moving Average)
   - Volume ratio
   - Momentum
3. **Portfolio State**:
   - Balance (normalized)
   - Current position (-1, 0, 1)
   - Unrealized PnL
   - Total PnL
   - Max drawdown

Total: `15 features × lookback_window + 5 portfolio features`

## 💰 Reward Function

Reward dihitung berdasarkan:
1. ✅ **Realized PnL** dari closed positions (high weight)
2. ✅ **Unrealized PnL** dari open positions (low weight)
3. ❌ **Penalty** untuk holding losing positions
4. ❌ **Penalty** untuk excessive inactivity
5. ❌ **Big penalty** untuk account blow-up (>50% loss)

## 📁 Output Files

Setelah training, akan menghasilkan:

```
models/ppo_crypto_model/
├── checkpoints/           # Checkpoints setiap 10K steps
│   ├── ppo_model_10000_steps.zip
│   ├── ppo_model_20000_steps.zip
│   └── ...
├── best/                  # Best model berdasarkan eval
│   └── best_model.zip
└── ppo_crypto_model_final.zip  # Final trained model

logs/
├── tensorboard/           # TensorBoard logs
├── eval/                  # Evaluation results
└── env_0/, env_1/, ...   # Per-environment logs

data/
└── test_data.csv         # Test dataset untuk backtesting

ppo_training.log          # Training log file
```

## 🧪 Testing Environment

Test apakah environment works:

```bash
python -m app.ml.environments.crypto_trading_env
```

Output expected:
```
✅ CryptoTradingEnv test completed successfully!
```

## 🔥 Advanced Usage

### 1. Training dengan GPU

```bash
# PyTorch akan otomatis detect GPU
python -m app.ml.train_ppo --n-envs 8 --total-timesteps 1000000
```

### 2. Resume dari Checkpoint

```python
from stable_baselines3 import PPO

# Load checkpoint
model = PPO.load("models/ppo_crypto_model/checkpoints/ppo_model_50000_steps.zip")

# Continue training
model.learn(total_timesteps=100000)
```

### 3. Backtesting

```python
from stable_baselines3 import PPO
import pandas as pd
from app.ml.environments.crypto_trading_env import CryptoTradingEnv

# Load model
model = PPO.load("models/ppo_crypto_model/ppo_crypto_model_final.zip")

# Load test data
test_df = pd.read_csv("data/test_data.csv")
test_df['timestamp'] = pd.to_datetime(test_df['timestamp'])

# Create environment
env = CryptoTradingEnv(test_df, initial_balance=100.0)

# Run backtest
obs, info = env.reset()
done = False
total_reward = 0

while not done:
    action, _states = model.predict(obs, deterministic=True)
    obs, reward, terminated, truncated, info = env.step(action)
    total_reward += reward
    done = terminated or truncated

print(f"Final balance: ${info['balance']:.2f}")
print(f"Total PnL: ${info['total_pnl']:.2f}")
print(f"Win rate: {info['win_rate']*100:.1f}%")
print(f"Total trades: {info['total_trades']}")
```

## 🎓 Training Tips

### Untuk Hasil Optimal:

1. **Data Quality**
   - Gunakan minimal 50K candles untuk training
   - Pastikan data mencakup berbagai market conditions (bull, bear, sideways)
   - Clean data dari anomalies

2. **Hyperparameter Tuning**
   - Start dengan default params
   - Jika model tidak learn: increase `learning_rate` (e.g., 1e-3)
   - Jika model unstable: decrease `learning_rate` (e.g., 1e-4)
   - Increase `n_envs` untuk faster training (jika CPU/RAM cukup)

3. **Training Duration**
   - Minimum 200K timesteps untuk convergence
   - Optimal: 500K - 1M timesteps
   - Monitor di TensorBoard: jika reward sudah plateau, bisa stop

4. **Environment Settings**
   - Adjust `commission` sesuai exchange (Bybit taker: 0.055%, maker: 0.02%)
   - Adjust `max_position_size` untuk risk tolerance
   - Increase `lookback_window` untuk long-term patterns (tapi slower training)

## 🐛 Troubleshooting

### Error: "No module named 'backend'"

```bash
# Set PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:/path/to/claude-code"

# Or run from project root
cd /path/to/claude-code
python -m backend.app.ml.train_ppo
```

### Error: CCXT RateLimitExceeded

```bash
# Script sudah handle retry, tapi jika masih error:
# Reduce num_candles atau increase sleep time di fetch_ohlcv_data()
```

### Training Terlalu Lambat

```bash
# Reduce n_envs (memory intensive)
python -m app.ml.train_ppo --n-envs 2

# Atau reduce num_candles
python -m app.ml.train_ppo --num-candles 30000
```

### Model Tidak Learn (Reward = 0)

- Check apakah data valid (tidak ada NaN/inf)
- Increase learning rate: `--learning-rate 0.001`
- Check reward function di environment
- Increase total_timesteps (beri waktu lebih untuk explore)

## 📚 References

- [Stable Baselines3 Docs](https://stable-baselines3.readthedocs.io/)
- [PPO Paper](https://arxiv.org/abs/1707.06347)
- [CCXT Documentation](https://docs.ccxt.com/)
- [Gymnasium Documentation](https://gymnasium.farama.org/)

## 📝 Next Steps

Setelah model trained:

1. ✅ Backtest di test data (lihat section Backtesting)
2. ✅ Tune hyperparameters untuk improve performance
3. ✅ Deploy model untuk paper trading
4. ✅ Integrate dengan webhook system (jika ada)
5. ✅ Monitor performance real-time

## 🤝 Contributing

Untuk improve model:
- Tambah technical indicators di `_calculate_features()`
- Tune reward function di `_calculate_reward()`
- Experiment dengan policy networks (CNN, LSTM, etc.)
- Add risk management features (max drawdown stop, etc.)

---

**Created by**: AI Trader's Shadow Team
**Date**: 2024-11-13
**License**: MIT
