# ML Inference Service

Service untuk real-time inference menggunakan trained PPO model.

---

## 🎯 Overview

`PredictionService` adalah singleton service yang:
- ✅ Memuat model PPO saat server startup
- ✅ Menyediakan real-time action predictions
- ✅ Mempersiapkan observation data yang match dengan training environment
- ✅ Terintegrasi dengan FastAPI endpoints dan Telegram bot

---

## 🚀 Quick Start

### 1. Train Model (jika belum)

```bash
cd backend
python -m app.ml.train_ppo
```

Model akan tersimpan di: `./models/ppo_crypto_final.zip`

### 2. Start FastAPI Server

```bash
python -m app.main
```

Server akan otomatis load model saat startup:
```
🚀 Starting AI Trader's Shadow API...
🤖 Loading ML model...
✅ ML model loaded successfully
Model info: {'loaded': True, 'model_type': 'PPO', ...}
```

### 3. Test Prediction via API

```bash
# Check model health
curl http://localhost:8000/api/v1/prediction/model/health

# Get prediction
curl http://localhost:8000/api/v1/prediction/predict/BTC-USDT

# Get prediction with explanation
curl http://localhost:8000/api/v1/prediction/predict/BTC-USDT?include_explanation=true
```

### 4. Test via Telegram Bot

Send `/status` command ke bot Anda:

```
📊 AI Trader's Shadow Status

😎 Mood (Layer 1 - Heuristic):
• Status: Confident
• Score: 75/100

Recent Performance:
• P&L: $+3.45
• Win Rate: 62.5%
• Trades (1h): 2

Market Conditions:
• Volatility: 850
• Liquidity: 85/100

Analysis:
Recent wins and stable market conditions...

🧠 AI Recommendation (PPO Layer 2):
🟢 Action: BUY
• Current Price: $45,123.50
Model: ppo_v1

⚠️ This is for PAPER TRADING only.
```

---

## 📐 Architecture

### Singleton Pattern

```python
from app.services.ml_inference.prediction_service import prediction_service

# Instance already created (singleton)
# Use directly:
prediction = await prediction_service.get_predicted_action("BTC-USDT")
```

### Observation Preparation

**CRITICAL:** Observation data MUST match training environment format.

```python
# Training format (from CryptoTradingEnv):
observation = np.array([
    [normalized_open[0], normalized_high[0], ..., position_ratio],
    [normalized_open[1], normalized_high[1], ..., position_ratio],
    ...  # 50 timesteps
    [normalized_open[49], normalized_high[49], ..., position_ratio],
])
# Shape: (50, 10)

# Inference format (from PredictionService):
# Must be EXACTLY the same!
```

### Data Flow

```
1. API Request: GET /api/v1/prediction/predict/BTC-USDT

2. PredictionService.get_predicted_action()
   ↓
3. _prepare_observation_data()
   - Fetch 50 recent 1-minute bars from CCXT
   - Normalize OHLCV (same as training)
   - Add position state (0 for inference)
   - Shape: (50, 10)
   ↓
4. model.predict(observation)
   - Returns action_id: 0/1/2
   ↓
5. Map to action_name: HOLD/BUY/SELL
   ↓
6. Return prediction dict
```

---

## 🔧 API Endpoints

### Get Prediction

```
GET /api/v1/prediction/predict/{symbol}
```

**Parameters:**
- `symbol` (path): Trading pair (e.g., "BTC-USDT" or "BTC/USDT")
- `include_explanation` (query, optional): Include human-readable explanation

**Response:**
```json
{
  "action_id": 1,
  "action_name": "BUY",
  "symbol": "BTC-USDT",
  "current_price": 45123.50,
  "confidence": null,
  "timestamp": "2024-01-15T10:30:00Z",
  "model_version": "ppo_v1",
  "explanation": "Model identifies potential buying opportunity..."
}
```

### Get Model Info

```
GET /api/v1/prediction/model/info
```

**Response:**
```json
{
  "loaded": true,
  "model_type": "PPO",
  "policy": "MlpPolicy",
  "observation_space": "Box(50, 10)",
  "action_space": "Discrete(3)",
  "window_size": 50,
  "num_features": 10
}
```

### Check Model Health

```
GET /api/v1/prediction/model/health
```

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "service": "ML Prediction Service",
  "message": "Model ready for predictions"
}
```

---

## 🐍 Python Usage

### In API Endpoint

```python
from app.services.ml_inference.prediction_service import prediction_service

@router.get("/my-endpoint")
async def my_endpoint():
    # Check if model loaded
    if not prediction_service.is_model_loaded():
        raise HTTPException(503, "Model not loaded")

    # Get prediction
    prediction = await prediction_service.get_predicted_action("BTC-USDT")

    if prediction is None:
        raise HTTPException(500, "Prediction failed")

    return prediction
```

### In Background Task

```python
import asyncio
from app.services.ml_inference.prediction_service import prediction_service

async def monitor_market():
    while True:
        prediction = await prediction_service.get_predicted_action("BTC-USDT")

        if prediction and prediction['action_name'] == 'BUY':
            # Send alert
            await send_alert(f"Buy signal detected @ ${prediction['current_price']}")

        await asyncio.sleep(60)  # Check every minute
```

### In Telegram Bot

```python
from app.services.ml_inference.prediction_service import prediction_service

async def status_command(update, context):
    symbol = "BTC-USDT"

    # Get prediction
    prediction = await prediction_service.get_predicted_action(symbol)

    if prediction:
        action = prediction['action_name']
        await update.message.reply_text(f"AI recommends: {action}")
```

---

## 🔍 Troubleshooting

### Model Not Loading

**Problem:** `⚠️ ML model not loaded`

**Causes:**
1. Model file not found at `./models/ppo_crypto_final.zip`
2. Model file corrupted
3. Wrong model format

**Solutions:**
```bash
# Check if model exists
ls -lh models/ppo_crypto_final.zip

# If not, train model:
python -m app.ml.train_ppo

# Or download pre-trained model (if available)
wget https://example.com/ppo_crypto_final.zip -O models/ppo_crypto_final.zip
```

---

### Prediction Returns None

**Problem:** `prediction = None`

**Causes:**
1. Insufficient market data (< 50 bars)
2. CCXT connection error
3. Symbol format mismatch

**Solutions:**
```python
# Check logs for detailed error
tail -f logs/app.log | grep "prediction"

# Test CCXT connection
from app.services.trading.ccxt_service import ccxt_service
ticker = await ccxt_service.fetch_ticker("BTC/USDT")
print(ticker)

# Test data fetching
ohlcv = await ccxt_service.exchange.fetch_ohlcv("BTC/USDT", "1m", limit=50)
print(f"Got {len(ohlcv)} bars")
```

---

### Observation Shape Mismatch

**Problem:** `ValueError: observation shape mismatch`

**Causes:**
- Observation preparation doesn't match training environment

**Solutions:**
```python
# Verify observation shape
observation = await prediction_service._prepare_observation_data("BTC-USDT")
print(f"Observation shape: {observation.shape}")
# Should be: (50, 10)

# If mismatch, check:
# 1. window_size == 50
# 2. num_features == 10
# 3. Normalization method matches training
```

---

## 📊 Performance Monitoring

### Prediction Latency

```python
import time

start = time.time()
prediction = await prediction_service.get_predicted_action("BTC-USDT")
latency = time.time() - start

print(f"Prediction latency: {latency*1000:.2f}ms")
# Target: < 100ms
```

### Model Load Time

```
# Check startup logs
🤖 Loading ML model...
✅ ML model loaded successfully
# Should be: < 2 seconds
```

### Memory Usage

```python
import psutil
import os

process = psutil.Process(os.getpid())
memory_mb = process.memory_info().rss / 1024 / 1024

print(f"Memory usage: {memory_mb:.2f} MB")
# Typical: 200-500 MB with model loaded
```

---

## 🔐 Security Considerations

### Model File Security

**Risks:**
- Model file could be replaced with malicious code
- Pickle files can execute arbitrary code

**Mitigations:**
```bash
# Verify model file checksum
sha256sum models/ppo_crypto_final.zip
# Compare with known-good hash

# Restrict model directory permissions
chmod 755 models/
chmod 644 models/*.zip

# Use read-only filesystem in production (Docker)
```

### Input Validation

**Always validate symbol input:**
```python
ALLOWED_SYMBOLS = ["BTC-USDT", "ETH-USDT", "BNB-USDT"]

if symbol not in ALLOWED_SYMBOLS:
    raise ValueError(f"Invalid symbol: {symbol}")
```

---

## 🚀 Production Deployment

### Best Practices

1. **Model Versioning:**
   ```python
   # Store model version in metadata
   model_path = f"./models/ppo_crypto_{version}.zip"

   # Track which model is in production
   with open("models/production.txt", "w") as f:
       f.write(f"ppo_crypto_{version}")
   ```

2. **Graceful Degradation:**
   ```python
   # If model fails, fall back to heuristic
   if not prediction_service.is_model_loaded():
       # Use Layer 1 heuristic checks only
       return {"action_name": "HOLD", "source": "heuristic_fallback"}
   ```

3. **Monitoring & Alerting:**
   ```python
   # Log all predictions for analysis
   logger.info(
       f"Prediction: {action_name} for {symbol} @ {price}",
       extra={"prediction_id": uuid.uuid4()}
   )

   # Alert on prediction failures
   if prediction is None:
       send_alert("Prediction service failing!")
   ```

4. **A/B Testing:**
   ```python
   # Route 10% of traffic to new model
   if random.random() < 0.1:
       model_path = "./models/ppo_crypto_v2.zip"
   else:
       model_path = "./models/ppo_crypto_v1.zip"
   ```

---

## 📚 Related Documentation

- [ML Training Guide](../../ml/README.md) - Train new models
- [Quick Start ML](../../../../QUICKSTART_ML.md) - Fast training setup
- [API Documentation](http://localhost:8000/docs) - Interactive API docs
- [Telegram Bot](../telegram/telegram_bot.py) - Bot integration

---

## 🎯 Future Enhancements

### Planned Features

1. **Multi-Model Ensemble:**
   ```python
   predictions = [
       model1.predict(obs),
       model2.predict(obs),
       model3.predict(obs),
   ]
   # Majority vote
   final_action = max(set(predictions), key=predictions.count)
   ```

2. **Confidence Scores:**
   ```python
   # Use policy probabilities
   action_probs = model.policy.get_distribution(obs).distribution.probs
   confidence = action_probs[predicted_action]
   ```

3. **Explainability:**
   ```python
   # Feature importance via SHAP
   import shap
   explainer = shap.Explainer(model)
   shap_values = explainer(observation)
   ```

4. **Online Learning:**
   ```python
   # Update model with recent trades
   if len(recent_trades) > 1000:
       model.learn(total_timesteps=10000, reset_num_timesteps=False)
   ```

---

**Inference service siap digunakan! 🚀**
