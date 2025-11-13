# 🚀 Quick Start: ML Training

Panduan cepat untuk melatih model PPO pertama Anda.

---

## ⚡ Super Quick Start (5 Menit)

### 1. Setup Environment

```bash
cd ai-traders-shadow/backend

# Create venv (jika belum)
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Train Model

```bash
# Jalankan training (akan download data otomatis)
python -m app.ml.train_ppo
```

**Output:**
```
🚀 STARTING PPO TRAINING
================================================================================

📊 STEP 1: Fetching historical data...
Fetching 100000 bars of BTC/USDT 1m data...
Fetching batch 1/100...
✅ Fetched 100000 bars from 2024-08-01 to 2024-10-09

🔧 STEP 2: Preprocessing data...
✅ Data preprocessed

✂️ STEP 3: Splitting data...
Train set: 80000 bars
Test set: 20000 bars

🌍 STEP 4: Creating environments...
✅ Environments created

🤖 STEP 5: Creating PPO model...
✅ PPO model created

📞 STEP 6: Setting up callbacks...
✅ Callbacks configured

🏋️ STEP 7: Training model...
Total timesteps: 200,000
This may take a while... ☕

[Progress bar akan muncul di sini]

✅ Training completed in 2:34:15

💾 STEP 8: Saving final model...
✅ Model saved to: ./models/ppo_crypto_final.zip

📈 STEP 9: Final evaluation on test set...
Episode 1/10: Reward=15.23, P&L=$+3.45, Trades=8, Win Rate=62.5%
...

🎉 TRAINING PIPELINE COMPLETE!
```

### 3. Evaluate Model

```bash
python -m app.ml.evaluate_ppo --model ./models/ppo_crypto_final.zip
```

**Output:**
```
📊 EVALUATION RESULTS
================================================================================
Mean P&L: $+2.34 ± $1.45
Mean Win Rate: 58.3%
Total Trades: 12.3
================================================================================
```

---

## 📁 Files Created After Training

```
backend/
└── models/
    ├── ppo_crypto_final.zip         # ← Model utama (gunakan ini!)
    ├── best_model.zip               # Model terbaik dari evaluation
    ├── checkpoints/
    │   ├── ppo_crypto_10000_steps.zip
    │   ├── ppo_crypto_20000_steps.zip
    │   ├── ...
    │   └── ppo_crypto_190000_steps.zip
    └── logs/
        ├── train/
        ├── test/
        └── tensorboard/              # Untuk monitoring
```

---

## 🎮 Using the Trained Model

### Option 1: Evaluate Performance

```bash
python -m app.ml.evaluate_ppo \
    --model ./models/ppo_crypto_final.zip \
    --episodes 20 \
    --save-results evaluation_results.csv
```

### Option 2: Interactive Testing

```bash
python -m app.ml.test_model_interactive
```

Ini akan menjalankan 1 episode dengan output step-by-step.

### Option 3: Load in Python Script

```python
from stable_baselines3 import PPO
import pandas as pd
from app.ml.environments.crypto_trading_env import CryptoTradingEnv

# Load model
model = PPO.load("./models/ppo_crypto_final")

# Prepare data
df = pd.read_csv("your_data.csv")

# Create environment
env = CryptoTradingEnv(df, initial_balance=100.0)

# Run prediction
obs, _ = env.reset()
done = False

while not done:
    action, _ = model.predict(obs, deterministic=True)
    obs, reward, terminated, truncated, info = env.step(action)
    done = terminated or truncated

print(f"Final P&L: ${info['pnl']:.2f}")
```

---

## 📊 Monitoring Training (TensorBoard)

Di terminal baru (sambil training berjalan):

```bash
cd backend
source venv/bin/activate

# Install tensorboard jika belum
pip install tensorboard

# Start TensorBoard
tensorboard --logdir ./models/logs/tensorboard/
```

Buka browser: http://localhost:6006

**Metrics yang bisa dilihat:**
- Episode reward (trending up = good!)
- Episode length
- Policy loss
- Value loss
- Explained variance

---

## ⚙️ Customization

### Ubah Data Source

Edit `train_ppo.py`:

```python
# Di main():
SYMBOL = "ETH/USDT"    # Change trading pair
N_BARS = 50000         # Less data (faster training)
```

### Ubah Training Duration

```python
TOTAL_TIMESTEPS = 100000   # Faster (50k = ~1 hour)
# atau
TOTAL_TIMESTEPS = 500000   # Better model (500k = ~10 hours)
```

### Ubah Hyperparameters

Edit `create_model()` dalam `train_ppo.py`:

```python
model = PPO(
    policy="MlpPolicy",
    env=env,
    learning_rate=1e-4,     # Lower LR untuk stability
    ent_coef=0.02,          # Lebih exploration
    # ... other params
)
```

---

## 🐛 Troubleshooting

### Error: "Module not found"

```bash
# Pastikan venv aktif
source venv/bin/activate

# Re-install dependencies
pip install -r requirements.txt
```

### Error: "CCXT rate limit"

```bash
# CCXT membatasi request rate
# Script sudah handle ini dengan sleep()
# Jika masih error, tunggu beberapa menit dan retry
```

### Training sangat lambat (>8 hours untuk 200k steps)

```bash
# Reduce data size
N_BARS = 50000  # Instead of 100000

# Reduce timesteps
TOTAL_TIMESTEPS = 100000  # Instead of 200000

# Or use GPU (jika ada)
# Model akan otomatis detect CUDA
```

### Model tidak profitable (P&L negatif)

**Normal!** Model pertama jarang langsung profitable. Try:

1. **Train lebih lama**: 500k timesteps
2. **Tune hyperparameters**: Lihat ML README
3. **Better data**: Gunakan data dari berbagai market conditions
4. **Add features**: Technical indicators ke environment

---

## 📈 What's Next?

After training pertama berhasil:

### 1. Improve Model
- [ ] Add technical indicators (RSI, MACD, Bollinger Bands)
- [ ] Tune hyperparameters dengan Optuna
- [ ] Train dengan lebih banyak data (200k+ bars)
- [ ] Ensemble multiple models

### 2. Better Evaluation
- [ ] Monte Carlo simulation
- [ ] Walk-forward analysis
- [ ] Different market regimes (bull, bear, sideways)

### 3. Integration
- [ ] Integrate model ke FastAPI backend
- [ ] Real-time prediction via WebSocket
- [ ] Telegram bot notifications untuk signals
- [ ] Frontend UI untuk model performance

### 4. Research
- [ ] Multi-symbol training
- [ ] Transfer learning
- [ ] LSTM/Attention policies
- [ ] Multi-timeframe features

---

## 📚 Resources

**Read First:**
- `backend/app/ml/README.md` - Comprehensive ML guide
- `ARCHITECTURE.md` - System architecture

**External:**
- [Stable-Baselines3 Docs](https://stable-baselines3.readthedocs.io/)
- [RL in Trading (QuantStart)](https://www.quantstart.com/)
- [PPO Paper](https://arxiv.org/abs/1707.06347)

---

## ⏱️ Expected Time

| Task | CPU | GPU |
|------|-----|-----|
| Data fetching | ~5 min | ~5 min |
| Training (200k steps) | ~2-4 hours | ~30-60 min |
| Evaluation (10 episodes) | ~1 min | ~30 sec |

**Total first training:** ~2.5-4.5 hours on CPU

---

## 💡 Tips

1. **Start small**: Train dengan 100k steps pertama untuk verify setup
2. **Monitor TensorBoard**: Check bahwa reward trending up
3. **Save checkpoints**: Jangan buang checkpoint - might be better than final!
4. **Document experiments**: Catat hyperparameters dan results
5. **Be patient**: ML training is iterative - first model rarely perfect

---

**Happy Training! 🚀**

Remember: Goal adalah **learning**, bukan instant profits. Focus on understanding model behavior.

---

## 🆘 Need Help?

1. Check `backend/app/ml/README.md` untuk detailed guide
2. Check GitHub Issues
3. Join Telegram community (coming soon!)

**Common Questions:**

**Q: Berapa lama training?**
A: 200k steps = ~2-4 jam di CPU modern, ~30-60 min di GPU

**Q: Butuh GPU?**
A: Tidak wajib. CPU cukup untuk MVP, tapi GPU jauh lebih cepat.

**Q: Model saya loss, kenapa?**
A: Normal! First model jarang profitable. Ini pembelajaran, bukan judi. Try tune hyperparameters dan train lebih lama.

**Q: Bisa train di cloud?**
A: Ya! Google Colab (free GPU), AWS, GCP, atau DigitalOcean semua support.
