# GAIL Implementation Guide - AI Trader's Shadow (Lapis 3)

Complete guide for implementing and deploying GAIL (Generative Adversarial Imitation Learning) for AI Trader's Shadow.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Data Flywheel](#data-flywheel)
4. [Database Setup](#database-setup)
5. [Expert Demonstration Collection](#expert-demonstration-collection)
6. [GAIL Training](#gail-training)
7. [Deployment](#deployment)
8. [API Usage](#api-usage)
9. [Monitoring](#monitoring)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### What is GAIL?

**GAIL (Generative Adversarial Imitation Learning)** is an advanced machine learning technique that learns expert behavior by observing successful demonstrations, rather than relying solely on rewards.

**Paper:** "Generative Adversarial Imitation Learning" (Ho & Ermon, 2016)

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Lapis 1: Heuristic Checks (Pre-Trade Safety)                  │
│  - Spread checks (< 50 bps)                                     │
│  - Liquidity verification (> $10,000)                           │
│  - Overtrading prevention (< 5 trades/hour)                     │
│  - Minimum order size enforcement (> $10)                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Lapis 2: PPO Baseline (Reinforcement Learning)                │
│  - Trained on historical market data                            │
│  - Learns from reward signal (P&L)                              │
│  - Foundation model for trading decisions                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Lapis 3: GAIL (Imitation Learning) ⭐ NEW                     │
│  - Learns from EXPERT human traders                             │
│  - Trained on profitable trade demonstrations                   │
│  - Data Flywheel: More expert trades → Better AI               │
└─────────────────────────────────────────────────────────────────┘
```

### Key Benefits

✅ **Learns from experts** - Mimics successful human traders
✅ **Data Flywheel** - Improves automatically as users trade
✅ **Better than pure RL** - Incorporates human intuition
✅ **Serverless training** - Runs on Modal.com weekly
✅ **Multi-model support** - Switch between PPO and GAIL via API

---

## Architecture

### GAIL Training Flow

```
1. PAPER TRADING (Users)
   ↓
2. PROFITABLE TRADES (P&L > 0.5%)
   ↓
3. EXPERT DEMONSTRATIONS (Database)
   - Observation (market state before trade)
   - Action (BUY/SELL)
   - Outcome (P&L, win rate)
   ↓
4. GAIL TRAINING (Modal.com, weekly)
   - Generator: PPO agent learns to imitate
   - Discriminator: Distinguishes expert vs agent
   ↓
5. TRAINED GAIL MODEL
   ↓
6. DEPLOYMENT (Modal/VPS)
   ↓
7. BETTER PREDICTIONS
   ↓
(LOOP: More expert trades collected)
```

### Components

**1. Database**
- Table: `expert_demonstrations`
- Stores: Observation (JSONB), Action, Reward, P&L, Win Rate

**2. Expert Collector Service**
- File: `backend/app/services/training/expert_collector.py`
- Automatically collects profitable trades
- Filters by profitability threshold (0.5%)
- Calculates expert score (0-100)

**3. GAIL Trainer**
- File: `backend/app/ml/train_gail.py`
- Fetches demonstrations from database
- Trains GAIL model using `imitation` library
- Saves model to Modal Volume or storage

**4. Prediction Service**
- File: `backend/app/services/ml_inference/prediction_service.py`
- Supports multiple models (PPO, GAIL)
- Switch via `strategy` parameter

**5. API Endpoints**
- `/api/v1/prediction/predict/{symbol}?strategy=GAIL`
- Multi-model prediction support

---

## Data Flywheel

### Concept

The **Data Flywheel** is a self-reinforcing cycle where:

1. Users make **profitable paper trades**
2. System **collects demonstrations** automatically
3. GAIL model **trains on demonstrations** weekly
4. **Better AI** predictions deployed
5. Users make **more profitable trades** with AI help
6. Cycle repeats → **Continuous improvement**

### Data Quality Criteria

Not all trades become expert demonstrations. Criteria:

| Metric | Threshold | Reason |
|--------|-----------|--------|
| **P&L** | > 0.5% | Must be profitable |
| **User Win Rate** | > 50% | User must be consistent |
| **Trades/Hour** | < 10 | Avoid overtrading noise |
| **Expert Score** | 70-100 | Quality metric |

### Expert Score Formula

```python
Expert Score (0-100) = Profitability (0-40) + Win Rate (0-30) + Consistency (0-30)

- Profitability: Based on P&L % (capped at 5%)
- Win Rate: User's historical win rate
- Consistency: Inverse variance of returns (lower variance = higher score)
```

**Example:**
- Trade P&L: 2% → Profitability score: 16
- User win rate: 60% → Win rate score: 18
- Consistency: High (low variance) → Consistency score: 25
- **Total Expert Score: 59** (marginal, needs improvement)

---

## Database Setup

### 1. Run Migration

**New Installation:**
```bash
# Schema includes expert_demonstrations table
psql $DATABASE_URL < database/schema.sql
```

**Existing Installation:**
```bash
# Run migration script
psql $DATABASE_URL < database/migrations/001_add_expert_demonstrations.sql
```

### 2. Verify Table

```sql
-- Check table exists
\dt expert_demonstrations

-- View schema
\d expert_demonstrations

-- Check indexes
\di expert_demonstrations*
```

**Expected output:**
- Table: `expert_demonstrations`
- Columns: `id`, `user_id`, `trade_id`, `symbol`, `action`, `reward`, `pnl`, `win_rate`, `is_expert_trade`, `expert_score`, `observation_data` (JSONB), etc.
- Indexes: user_id, created_at, is_expert (partial), symbol, expert_score, observation (GIN)

### 3. Sample Data Check

```sql
-- Count demonstrations
SELECT COUNT(*) FROM expert_demonstrations;

-- Count expert demonstrations
SELECT COUNT(*) FROM expert_demonstrations WHERE is_expert_trade = true;

-- View top demonstrations
SELECT id, user_id, symbol, action, pnl, expert_score, created_at
FROM expert_demonstrations
WHERE is_expert_trade = true
ORDER BY expert_score DESC
LIMIT 10;
```

---

## Expert Demonstration Collection

### Automatic Collection

Expert demonstrations are collected **automatically** when users execute profitable paper trades.

### How It Works

**1. User Executes Trade**
```python
# In trading endpoint
observation = await prediction_service._prepare_observation_data(symbol)  # BEFORE trade
# Execute trade
# Calculate P&L
```

**2. After Trade Settles**
```python
from app.services.training import expert_collector

# Collect demonstration
await expert_collector.collect_demonstration(
    db=db,
    user_id=user_id,
    trade_id=trade.id,
    symbol=symbol,
    action=1 if side == 'buy' else 2,  # 1=BUY, 2=SELL
    executed_price=price,
    pnl=realized_pnl,
    observation_data=observation,  # (50, 10) numpy array
    market_conditions={"volatility": vol, "spread": spread},
    strategy_used="manual",
)
```

**3. System Evaluates**
- Is P&L > 0.5%? ✓
- Is user win rate > 50%? ✓
- Recent trades < 10/hour? ✓
- **Result: `is_expert_trade = True`, `expert_score = 85`**

### Manual Collection

```python
from app.services.training import expert_collector

# Get dataset statistics
stats = expert_collector.get_dataset_statistics(db)
print(stats)
# {
#   'total_demonstrations': 1500,
#   'expert_demonstrations': 450,
#   'average_expert_score': 78.5,
#   'expert_percentage': 0.30
# }

# Retrieve expert demonstrations
demonstrations = expert_collector.get_expert_demonstrations(
    db=db,
    limit=1000,
    min_expert_score=70.0,
    symbols=["BTC-USDT"],
)
```

---

## GAIL Training

### Local Training (Development)

```bash
cd backend

# Ensure database connection
export DATABASE_URL="postgresql://user:pass@host:5432/ai_traders_shadow"

# Train GAIL model
python -m app.ml.train_gail

# Model saved to: backend/models/gail_crypto_model.zip
```

### Modal.com Training (Production)

**Option 1: Manual Trigger**

```bash
cd backend

# One-time training
modal run app.ml.train_gail::train_gail_with_modal \
    --database-url $DATABASE_URL \
    --symbol BTC-USDT \
    --total-timesteps 100000 \
    --min-expert-score 70.0
```

**Option 2: Scheduled Training (Weekly)**

Add to `modal_app.py`:

```python
@app.function(
    image=modal_image,
    secrets=secrets,
    schedule=modal.Cron("0 0 * * 0"),  # Every Sunday at midnight
    memory=4096,  # 4GB RAM for training
    cpu=4.0,      # 4 CPU cores
    timeout=3600,  # 1 hour timeout
)
def train_gail_weekly():
    """
    Scheduled GAIL training function.
    Runs every Sunday to retrain model with latest expert demonstrations.
    """
    import os
    from app.ml.train_gail import train_gail_with_modal

    database_url = os.getenv("DATABASE_URL")

    result = train_gail_with_modal(
        database_url=database_url,
        symbol="BTC-USDT",
        total_timesteps=100000,
        min_expert_score=70.0,
        model_save_path="/models/gail_crypto_model.zip",
    )

    logger.info(f"GAIL training result: {result}")

    return result
```

**Deploy:**
```bash
modal deploy app.modal_app
```

### Training Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `database_url` | Required | PostgreSQL connection string |
| `symbol` | BTC-USDT | Trading pair to train on |
| `total_timesteps` | 100,000 | Training duration |
| `min_expert_score` | 70.0 | Minimum demonstration quality |
| `min_demonstrations` | 100 | Minimum dataset size |

### Training Output

```
🚀 GAIL Training Started (Modal.com)
======================================================================
📥 Fetching expert demonstrations for BTC-USDT...
✅ Fetched 450 expert demonstrations
🔄 Preparing dataset from 450 demonstrations...
✅ Dataset prepared:
   Observations shape: (450, 50, 10)
   Actions shape: (450,)
   Rewards shape: (450,)
✅ Created 450 transitions for GAIL
🤖 Initializing PPO agent (generator)...
🎯 Initializing reward network (discriminator)...
🔥 Initializing GAIL trainer...
📚 Training GAIL model...
[Training progress logs...]
✅ GAIL training completed!
💾 Saving model to /models/gail_crypto_model.zip...
✅ Model saved successfully
======================================================================
✅ GAIL Training Completed in 845.3s
======================================================================
```

### Model Storage

**Modal Volume (Recommended for Modal deployment):**
```python
gail_volume = modal.Volume.from_name("gail-models", create_if_missing=True)

@app.function(
    image=modal_image,
    volumes={"/models": gail_volume},
)
def train_and_save():
    # Train model
    # Save to /models/gail_crypto_model.zip (persisted in volume)
```

**Cloud Storage (S3/B2/GCS):**
```python
import boto3

# After training
s3 = boto3.client('s3')
s3.upload_file(
    '/models/gail_crypto_model.zip',
    'ai-traders-models',
    'gail_crypto_model.zip'
)
```

---

## Deployment

### Load GAIL Model at Startup

**Update `main.py` lifespan:**

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("🤖 Loading ML models...")

    # Load PPO (Lapis 2)
    ppo_path = settings.MODEL_PATH + "/ppo_crypto_final.zip"
    ppo_loaded = prediction_service.load_model(ppo_path, model_type="PPO")

    if ppo_loaded:
        logger.info("✅ PPO model loaded")
    else:
        logger.warning("⚠️ PPO model not loaded")

    # Load GAIL (Lapis 3)
    gail_path = settings.MODEL_PATH + "/gail_crypto_model.zip"
    gail_loaded = prediction_service.load_model(gail_path, model_type="GAIL")

    if gail_loaded:
        logger.info("✅ GAIL model loaded")
    else:
        logger.warning("⚠️ GAIL model not loaded - only PPO available")

    logger.info(f"Available models: {prediction_service.get_available_models()}")

    yield

    # Shutdown
    logger.info("🛑 Shutting down...")
```

### Modal Deployment

```bash
cd backend

# Deploy with both models
modal deploy app.modal_app

# Models are bundled in Docker image via Dockerfile
# Or loaded from Modal Volume if using persistent storage
```

### Verify Deployment

```bash
# Check model health
curl https://your-modal-url/api/v1/prediction/model/health?strategy=GAIL

# Response:
{
  "status": "healthy",
  "model_loaded": true,
  "strategy": "GAIL",
  "available_models": ["PPO", "GAIL"],
  "service": "ML Prediction Service",
  "message": "GAIL model ready for predictions"
}
```

---

## API Usage

### Get Prediction (GAIL Model)

```bash
# Using GAIL strategy
curl "https://your-modal-url/api/v1/prediction/predict/BTC-USDT?strategy=GAIL&include_explanation=true"
```

**Response:**
```json
{
  "action_id": 1,
  "action_name": "BUY",
  "symbol": "BTC-USDT",
  "current_price": 45000.50,
  "confidence": null,
  "timestamp": "2024-01-13T12:00:00Z",
  "strategy": "GAIL",
  "model_version": "gail_v1",
  "explanation": "GAIL model identifies potential buying opportunity based on expert trader patterns..."
}
```

### Get Prediction (PPO Model)

```bash
# Using PPO strategy (default)
curl "https://your-modal-url/api/v1/prediction/predict/BTC-USDT?strategy=PPO"
```

**Response:**
```json
{
  "action_id": 0,
  "action_name": "HOLD",
  "symbol": "BTC-USDT",
  "current_price": 45000.50,
  "confidence": null,
  "timestamp": "2024-01-13T12:00:00Z",
  "strategy": "PPO",
  "model_version": "ppo_v1"
}
```

### Compare Predictions

```python
import requests

API_URL = "https://your-modal-url/api/v1"
symbol = "BTC-USDT"

# Get PPO prediction
ppo_pred = requests.get(f"{API_URL}/prediction/predict/{symbol}?strategy=PPO").json()

# Get GAIL prediction
gail_pred = requests.get(f"{API_URL}/prediction/predict/{symbol}?strategy=GAIL").json()

print(f"PPO:  {ppo_pred['action_name']}")
print(f"GAIL: {gail_pred['action_name']}")

# Example output:
# PPO:  HOLD
# GAIL: BUY  (learned from expert traders)
```

### Frontend Integration

**Update frontend to support strategy selection:**

```typescript
// frontend/app/components/AiRecommendation.tsx

const [strategy, setStrategy] = useState<'PPO' | 'GAIL'>('GAIL');

const fetchPrediction = async () => {
  const response = await axios.get(
    `${apiUrl}/api/v1/prediction/predict/${symbol}?strategy=${strategy}&include_explanation=true`
  );
  setPrediction(response.data);
};

// UI: Strategy selector
<select value={strategy} onChange={(e) => setStrategy(e.target.value)}>
  <option value="PPO">PPO (Baseline RL)</option>
  <option value="GAIL">GAIL (Expert Imitation)</option>
</select>
```

---

## Monitoring

### Dataset Statistics

```bash
# Via API (create endpoint in trading.py)
curl https://your-modal-url/api/v1/training/dataset/stats

# Response:
{
  "total_demonstrations": 1500,
  "expert_demonstrations": 450,
  "average_expert_score": 78.5,
  "expert_percentage": 0.30,
  "symbols": ["BTC-USDT", "ETH-USDT"],
  "date_range": {
    "oldest": "2024-01-01",
    "newest": "2024-01-13"
  }
}
```

### Training Logs

```bash
# Modal logs
modal app logs ai-traders-shadow-backend --follow | grep GAIL

# Filter for training events
modal app logs ai-traders-shadow-backend | grep "GAIL training"
```

### Model Performance

```sql
-- Compare PPO vs GAIL win rates
SELECT
  strategy_used,
  COUNT(*) as total_trades,
  AVG(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as win_rate,
  AVG(pnl) as avg_pnl
FROM trades_paper
WHERE strategy_used IN ('ppo', 'gail')
GROUP BY strategy_used;
```

---

## Troubleshooting

### Issue: Insufficient Demonstrations

**Error:**
```
Insufficient demonstrations: 50 < 100
```

**Solution:**
- Wait for more users to make profitable trades
- Lower `min_demonstrations` threshold
- Lower `min_expert_score` to include more data
- Manually create synthetic demonstrations for testing

### Issue: GAIL Model Not Loading

**Error:**
```
GAIL model not loaded - only PPO available
```

**Solution:**
```bash
# Check model file exists
ls backend/models/gail_crypto_model.zip

# Train model if missing
python -m app.ml.train_gail

# Verify modal deployment includes model
modal run app.modal_app
```

### Issue: Poor GAIL Performance

**Symptom:** GAIL predictions worse than PPO

**Possible Causes:**
1. **Low-quality demonstrations** - Lower expert users
2. **Insufficient data** - Need more demonstrations
3. **Overfitting** - Too many training timesteps

**Solutions:**
- Increase `min_expert_score` threshold (only best demonstrations)
- Collect more diverse demonstrations (multiple symbols, market conditions)
- Reduce training timesteps or add early stopping
- Evaluate on held-out test set

### Issue: Training Takes Too Long

**Symptom:** Training exceeds Modal timeout (1 hour)

**Solutions:**
- Reduce `total_timesteps` (try 50,000 instead of 100,000)
- Increase Modal resources:
  ```python
  @app.function(
      memory=8192,  # 8GB RAM
      cpu=8.0,       # 8 CPU cores
      # gpu="T4",    # Add GPU for faster training
  )
  ```
- Train on fewer demonstrations (limit=5000)

### Issue: Cold Starts Loading Both Models

**Symptom:** First API request slow (loading 2 models)

**Solution:**
```python
# In modal_app.py, increase container_idle_timeout
@app.function(
    container_idle_timeout=600,  # 10 minutes (keep models warm)
)
```

---

## Best Practices

1. **Start with high thresholds** - Only collect best demonstrations initially
2. **Monitor data quality** - Track expert_score distribution
3. **Retrain regularly** - Weekly training captures latest patterns
4. **A/B test models** - Compare PPO vs GAIL performance
5. **Validate before deployment** - Test GAIL on held-out data
6. **Log everything** - Track which model made which prediction
7. **Gradual rollout** - Start with 10% traffic to GAIL, increase if better

---

## Summary

**GAIL Implementation Checklist:**

- [x] Database schema updated (expert_demonstrations table)
- [x] Expert collector service created
- [x] GAIL training script implemented
- [x] PredictionService supports multi-model
- [x] API endpoints accept strategy parameter
- [x] Documentation complete

**Deployment Checklist:**

- [ ] Run database migration
- [ ] Collect expert demonstrations (wait for profitable trades)
- [ ] Train GAIL model (local or Modal)
- [ ] Update lifespan to load both models
- [ ] Deploy to Modal.com
- [ ] Test API endpoints with both strategies
- [ ] Update frontend to support strategy selection
- [ ] Monitor performance (PPO vs GAIL)
- [ ] Setup weekly automated training (cron)

**Next Steps:**

1. Collect 100+ expert demonstrations
2. Train initial GAIL model
3. Deploy and A/B test against PPO
4. Iterate based on performance
5. Scale data flywheel

---

**Congratulations! You've implemented Lapis 3 (GAIL) for AI Trader's Shadow! 🚀📈**

The Data Flywheel is now in motion. As users make profitable trades, your AI gets smarter automatically.
