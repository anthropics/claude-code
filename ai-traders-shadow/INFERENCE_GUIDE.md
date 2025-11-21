# 🧠 ML Inference Integration Guide

Panduan lengkap untuk mengintegrasikan trained PPO model ke production backend.

---

## 🎯 Overview

Model PPO yang sudah dilatih kini terintegrasi ke FastAPI server dan memberikan real-time trading recommendations melalui:

1. **REST API** - HTTP endpoints untuk predictions
2. **Telegram Bot** - `/status` command menampilkan AI recommendations
3. **WebSocket** - Real-time prediction streaming (future)

---

## 🚀 Quick Start

### 1. Train Model (jika belum)

```bash
cd backend
source venv/bin/activate
python -m app.ml.train_ppo
```

**Output:** `./models/ppo_crypto_final.zip`

### 2. Start Server

```bash
python -m app.main
```

**Server akan:**
- ✅ Load model saat startup
- ✅ Log model info
- ✅ Siap menerima prediction requests

**Expected output:**
```
🚀 Starting AI Trader's Shadow API...
🤖 Loading ML model...
✅ ML model loaded successfully
Model info: {'loaded': True, 'model_type': 'PPO', 'policy': 'MlpPolicy', ...}
```

### 3. Test Inference

**Option A: Test Script**
```bash
python test_inference.py
```

**Option B: API Request**
```bash
curl http://localhost:8000/api/v1/prediction/predict/BTC-USDT
```

**Option C: Interactive API Docs**

Open: http://localhost:8000/docs

Navigate to: `POST /api/v1/prediction/predict/{symbol}`

---

## 📐 Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    USER REQUESTS                            │
├─────────────────────────────────────────────────────────────┤
│  API Client  │  Telegram Bot  │  WebSocket (future)         │
└──────┬───────┴────────┬───────┴────────────────────────────┘
       │                │
       └────────────────┼─────────► PredictionService (Singleton)
                        │                    │
                        │                    ├─► load_model()
                        │                    │   - Load PPO model once
                        │                    │   - Cache in memory
                        │                    │
                        │                    ├─► get_predicted_action()
                        │                    │   │
                        │                    │   ├─► _prepare_observation_data()
                        │                    │   │   - Fetch 50 recent 1m bars
                        │                    │   │   - Normalize OHLCV
                        │                    │   │   - Shape: (50, 10)
                        │                    │   │
                        │                    │   ├─► model.predict(obs)
                        │                    │   │   - Returns: action (0/1/2)
                        │                    │   │
                        │                    │   └─► Map to HOLD/BUY/SELL
                        │                    │
                        │                    └─► get_action_explanation()
                        │                        - Human-readable text
                        │
                        ▼
        ┌───────────────────────────────────┐
        │  CCXT Service                      │
        │  - Fetch market data               │
        │  - Get current prices              │
        └───────────────────────────────────┘
```

### Key Components

**1. PredictionService (Singleton)**
- **Location:** `backend/app/services/ml_inference/prediction_service.py`
- **Purpose:** Centralized ML inference
- **Pattern:** Singleton (one instance, one model loaded)

**2. API Endpoints**
- **Location:** `backend/app/api/endpoints/prediction.py`
- **Routes:**
  - `GET /api/v1/prediction/predict/{symbol}` - Get prediction
  - `GET /api/v1/prediction/model/info` - Model metadata
  - `GET /api/v1/prediction/model/health` - Health check

**3. Telegram Integration**
- **Location:** `backend/app/services/telegram/telegram_bot.py`
- **Command:** `/status` - Shows Layer 1 (Mood) + Layer 2 (PPO)

---

## 🔧 API Reference

### Get Prediction

```http
GET /api/v1/prediction/predict/{symbol}?include_explanation=false
```

**Parameters:**
- `symbol` (path): Trading pair, e.g., "BTC-USDT", "BTC/USDT"
- `include_explanation` (query, optional): Include explanation text

**Response:**
```json
{
  "action_id": 1,
  "action_name": "BUY",
  "symbol": "BTC-USDT",
  "current_price": 45123.50,
  "confidence": null,
  "timestamp": "2024-01-15T10:30:00.123Z",
  "model_version": "ppo_v1",
  "explanation": null
}
```

**Action Mapping:**
- `0` = `HOLD` - No action, wait
- `1` = `BUY` - Buy signal
- `2` = `SELL` - Sell signal

**Example with cURL:**
```bash
# Basic prediction
curl http://localhost:8000/api/v1/prediction/predict/BTC-USDT

# With explanation
curl "http://localhost:8000/api/v1/prediction/predict/BTC-USDT?include_explanation=true"
```

**Example with Python:**
```python
import requests

response = requests.get("http://localhost:8000/api/v1/prediction/predict/BTC-USDT")
prediction = response.json()

print(f"Action: {prediction['action_name']}")
print(f"Price: ${prediction['current_price']:.2f}")
```

### Get Model Info

```http
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

### Check Health

```http
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

## 💬 Telegram Bot Integration

### Updated `/status` Command

Send `/status` ke bot untuk mendapat:

**Before (Layer 1 only):**
```
📊 Current Status

😎 Mood: Confident
Mood Score: 75/100

Recent Performance:
• P&L: $+3.45
• Win Rate: 62.5%
```

**After (Layer 1 + Layer 2):**
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
Good recent performance and stable market...

🧠 AI Recommendation (PPO Layer 2):
🟢 Action: BUY
• Current Price: $45,123.50
Model: ppo_v1

⚠️ This is for PAPER TRADING only.
```

**Action Emojis:**
- ⏸️ HOLD
- 🟢 BUY
- 🔴 SELL

---

## 🐍 Python Integration Examples

### In FastAPI Endpoint

```python
from fastapi import APIRouter, HTTPException
from app.services.ml_inference.prediction_service import prediction_service

router = APIRouter()

@router.get("/custom-prediction")
async def custom_prediction():
    # Check if model loaded
    if not prediction_service.is_model_loaded():
        raise HTTPException(503, "Model not available")

    # Get prediction
    pred = await prediction_service.get_predicted_action("BTC-USDT")

    if pred is None:
        raise HTTPException(500, "Prediction failed")

    # Custom logic
    if pred['action_name'] == 'BUY':
        # Execute paper trade
        # ...
        pass

    return pred
```

### In Background Worker

```python
import asyncio
from app.services.ml_inference.prediction_service import prediction_service

async def market_monitor():
    """Monitor market and send alerts."""
    while True:
        # Get predictions for multiple symbols
        for symbol in ["BTC/USDT", "ETH/USDT"]:
            pred = await prediction_service.get_predicted_action(symbol)

            if pred and pred['action_name'] == 'BUY':
                # Send alert via Telegram/email/WebSocket
                await send_alert(f"Buy signal: {symbol}")

        # Check every 5 minutes
        await asyncio.sleep(300)

# Run in background
asyncio.create_task(market_monitor())
```

### Direct Usage

```python
from app.services.ml_inference.prediction_service import prediction_service

# Load model (usually done at startup)
prediction_service.load_model("./models/ppo_crypto_final.zip")

# Get prediction
prediction = await prediction_service.get_predicted_action("BTC-USDT")

print(f"Action: {prediction['action_name']}")
# Output: Action: BUY

# Get explanation
explanation = await prediction_service.get_action_explanation(
    "BTC-USDT",
    prediction
)
print(explanation)
```

---

## 🧪 Testing

### Test Script

```bash
cd backend
python test_inference.py
```

**Tests:**
1. ✅ Model loading
2. ✅ Prediction generation
3. ✅ Explanation generation
4. ✅ Multiple predictions

**Expected output:**
```
🧪 Starting ML Inference Service Tests

================================================================================
TEST 1: Model Loading
================================================================================
✅ Model loaded successfully

================================================================================
TEST 2: Prediction Generation
================================================================================
✅ Prediction generated successfully

================================================================================
TEST SUMMARY
================================================================================
Model Loading: ✅ PASS
Prediction Generation: ✅ PASS
Explanation Generation: ✅ PASS
Multiple Predictions: ✅ PASS

Results: 4/4 tests passed
🎉 All tests passed!
```

### Manual Testing

```python
# Start Python REPL
python

>>> import asyncio
>>> from app.services.ml_inference.prediction_service import prediction_service

>>> # Load model
>>> prediction_service.load_model("./models/ppo_crypto_final.zip")
True

>>> # Get prediction
>>> pred = asyncio.run(prediction_service.get_predicted_action("BTC/USDT"))
>>> pred
{'action_id': 1, 'action_name': 'BUY', 'symbol': 'BTC/USDT', ...}
```

---

## 🐛 Troubleshooting

### Model Not Loading

**Problem:**
```
⚠️ ML model not loaded - predictions will be unavailable
```

**Solution:**
```bash
# Check if model exists
ls -lh models/ppo_crypto_final.zip

# If missing, train model:
python -m app.ml.train_ppo

# If file exists but won't load, check permissions:
chmod 644 models/ppo_crypto_final.zip
```

### Prediction Returns None

**Problem:** API returns 500 error, prediction is None

**Possible causes:**
1. Insufficient market data
2. CCXT connection error
3. Symbol not found

**Debug:**
```python
# Check logs
tail -f logs/app.log | grep prediction

# Test CCXT manually
from app.services.trading.ccxt_service import ccxt_service
import asyncio

ticker = asyncio.run(ccxt_service.fetch_ticker("BTC/USDT"))
print(ticker)
```

### Wrong Action Format

**Problem:** Telegram shows "Action: 1" instead of "Action: BUY"

**Cause:** Action mapping not applied

**Fix:** Already handled in code via:
```python
action_map = {0: 'HOLD', 1: 'BUY', 2: 'SELL'}
action_name = action_map[action]
```

---

## 📊 Performance

### Latency Benchmarks

| Operation | Latency | Notes |
|-----------|---------|-------|
| Model Loading | ~1-2s | One-time at startup |
| Data Fetching | ~100-300ms | CCXT API call |
| Inference | ~10-50ms | Model prediction |
| **Total** | **~150-400ms** | End-to-end |

### Memory Usage

- **Without model:** ~50-100 MB
- **With model loaded:** ~200-500 MB
- **Per request:** +1-5 MB (temporary)

### Optimization Tips

1. **Cache observations:**
   ```python
   # Cache for 30 seconds
   @lru_cache(maxsize=10)
   def get_cached_observation(symbol, minute):
       return fetch_observation(symbol)
   ```

2. **Batch predictions:**
   ```python
   # Predict multiple symbols at once
   symbols = ["BTC/USDT", "ETH/USDT", "BNB/USDT"]
   predictions = await asyncio.gather(*[
       prediction_service.get_predicted_action(s)
       for s in symbols
   ])
   ```

3. **Use GPU (if available):**
   - Model automatically uses GPU if CUDA available
   - 5-10x faster inference

---

## 🔒 Security

### Model File Integrity

```bash
# Generate checksum after training
sha256sum models/ppo_crypto_final.zip > models/ppo_crypto_final.zip.sha256

# Verify before loading
sha256sum -c models/ppo_crypto_final.zip.sha256
```

### Input Validation

```python
# Whitelist allowed symbols
ALLOWED_SYMBOLS = ["BTC-USDT", "ETH-USDT", "BNB-USDT"]

if symbol not in ALLOWED_SYMBOLS:
    raise ValueError(f"Invalid symbol: {symbol}")
```

### Rate Limiting

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.get("/api/v1/prediction/predict/{symbol}")
@limiter.limit("10/minute")  # Max 10 requests per minute
async def get_prediction(symbol: str):
    ...
```

---

## 🚀 Production Checklist

- [ ] Model trained and validated
- [ ] Model file backed up
- [ ] Server tested with model loaded
- [ ] API endpoints tested
- [ ] Telegram bot tested
- [ ] Error handling verified
- [ ] Logging configured
- [ ] Monitoring setup (latency, errors)
- [ ] Rate limiting enabled
- [ ] Input validation in place
- [ ] Model versioning tracked

---

## 📚 Related Documentation

- [ML Training Guide](backend/app/ml/README.md)
- [Quick Start ML](QUICKSTART_ML.md)
- [Inference Service Details](backend/app/services/ml_inference/README.md)
- [API Documentation](http://localhost:8000/docs)

---

**ML Inference terintegrasi dan siap production! 🧠🚀**
