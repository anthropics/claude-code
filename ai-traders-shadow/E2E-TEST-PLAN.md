# 🧪 End-to-End Test Plan: Data Flywheel Validation

**Project:** AI Trader's Shadow - Multi-Model AI System
**Feature:** Freemium Strategy Selector + GAIL Data Flywheel
**Test Type:** End-to-End Integration Testing
**QA Engineer:** [Your Name]
**Date:** 2025-01-XX
**Version:** 1.0

---

## 📋 Table of Contents

1. [Test Plan Overview](#test-plan-overview)
2. [Test Environment Setup](#test-environment-setup)
3. [Test Scenarios](#test-scenarios)
4. [Detailed Test Cases](#detailed-test-cases)
5. [Edge Cases & Negative Testing](#edge-cases--negative-testing)
6. [Performance Testing](#performance-testing)
7. [Automation Recommendations](#automation-recommendations)
8. [Test Data Requirements](#test-data-requirements)
9. [Rollback & Recovery Procedures](#rollback--recovery-procedures)
10. [Sign-off Criteria](#sign-off-criteria)

---

## 📖 Test Plan Overview

### Objective
Validate the complete "Data Flywheel" workflow from frontend user interaction to GAIL model training and inference, ensuring:
- Frontend strategy selection works correctly
- Expert demonstrations are collected accurately
- GAIL training pipeline functions end-to-end
- Multi-model inference (PPO vs GAIL) returns distinct results

### Scope
**In Scope:**
- ✅ Frontend strategy selector UI (freemium logic)
- ✅ PPO trade execution and expert data collection
- ✅ Database storage of expert demonstrations
- ✅ GAIL training pipeline (local and Modal)
- ✅ Multi-model prediction API (PPO and GAIL)
- ✅ Strategy parameter propagation through all layers

**Out of Scope:**
- ❌ Real money trading (paper trading only)
- ❌ User authentication and subscription system (mock-up only)
- ❌ Production payment gateway integration
- ❌ Load testing beyond 100 concurrent users

### Test Environments

| Environment | Backend URL | Frontend URL | Database | Purpose |
|------------|------------|--------------|----------|---------|
| **Local** | http://localhost:8000 | http://localhost:3000 | PostgreSQL (localhost:5432) | Development testing |
| **Modal** | https://[app-id].modal.run | http://localhost:3000 | Supabase/Cloud DB | Serverless integration |
| **Staging** | https://staging-api.example.com | https://staging.example.com | Cloud DB (staging) | Pre-production validation |

---

## 🛠️ Test Environment Setup

### Prerequisites Checklist

**Database Setup:**
```bash
# 1. Apply database migration
psql -U postgres -d ai_traders_shadow -f database/migrations/001_add_expert_demonstrations.sql

# 2. Verify table creation
psql -U postgres -d ai_traders_shadow -c "\dt expert_demonstrations"

# 3. Create test user
psql -U postgres -d ai_traders_shadow -c "
INSERT INTO users (username, email, balance_paper)
VALUES ('test_user_qa', 'qa@test.com', 10000.00)
RETURNING id;
"
# Note the returned user_id for testing
```

**Backend Setup:**
```bash
# 1. Install dependencies
cd backend
pip install -r requirements.txt

# 2. Verify new dependencies
pip list | grep -E "(imitation|torch)"

# 3. Train PPO model (if not exists)
python -m app.ml.train_ppo

# 4. Start backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend Setup:**
```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Set environment variables
cat > .env.local <<EOF
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
EOF

# 3. Start frontend dev server
npm run dev
```

**Modal Setup (for Scenario 2):**
```bash
# 1. Install Modal CLI
pip install modal

# 2. Authenticate
modal token set --token-id <YOUR_TOKEN_ID> --token-secret <YOUR_TOKEN_SECRET>

# 3. Create secrets
cd backend
./modal_setup_secrets.sh

# 4. Test deployment
modal run app.modal_app
```

### Test Data Preparation

**Required Test Data:**
- 1 test user with initial balance: $10,000 (paper)
- BTC-USDT market data (via Binance API)
- PPO model trained on at least 10,000 timesteps
- Minimum 100 expert demonstrations for GAIL training

---

## 🎯 Test Scenarios

### Scenario Summary

| Scenario | Description | Priority | Estimated Time |
|----------|-------------|----------|----------------|
| **S1** | PPO Trading Flow (Frontend → DB) | P0 (Critical) | 20 mins |
| **S2** | GAIL Training Flow (DB → Model) | P0 (Critical) | 30 mins |
| **S3** | GAIL Inference Flow (Model → Frontend) | P0 (Critical) | 15 mins |
| **S4** | Strategy Switching (PPO ↔ GAIL) | P1 (High) | 15 mins |
| **S5** | Freemium Lock Validation | P1 (High) | 10 mins |
| **S6** | Expert Collector Quality Filter | P2 (Medium) | 20 mins |
| **S7** | Multi-User Data Isolation | P1 (High) | 15 mins |
| **S8** | WebSocket Real-time Updates | P2 (Medium) | 10 mins |

**Total Estimated Testing Time:** ~2.5 hours

---

## 📝 Detailed Test Cases

---

## 🧪 SCENARIO 1: PPO Trading Flow (Frontend → DB)

**Test ID:** TC-S1-001
**Priority:** P0 (Critical)
**Objective:** Validate that profitable PPO trades from frontend are recorded by ExpertCollector in database

### Test Case 1.1: Successful PPO Trade Recording

**Preconditions:**
- Backend server running
- Frontend server running
- Database migration applied
- PPO model loaded
- Test user exists (user_id = 1)

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open browser → http://localhost:3000 | Dashboard loads successfully |
| 2 | Verify connection status in header | Green indicator: "Connected" |
| 3 | Check Strategy Selector component | "L2: Standard AI (PPO)" is selected by default |
| 4 | Verify AI Recommendation header | Badge shows "🤖 Layer 2: PPO" |
| 5 | Wait for AI recommendation to load | Action displayed (HOLD/BUY/SELL) |
| 6 | If recommendation is BUY, proceed. If not, wait 60s for refresh | BUY signal appears |
| 7 | Navigate to Trade Panel | Header shows "Using: PPO" |
| 8 | Enter trade details:<br>- Symbol: BTC-USDT<br>- Quantity: 0.001<br>- Click "🟢 Buy" | Success message appears:<br>"✅ BUY order executed successfully!" |
| 9 | Wait 10 seconds, then execute SELL | Success message appears:<br>"✅ SELL order executed successfully! P&L: $XX.XX" |
| 10 | Note the P&L value from success message | P&L should be > $0 (profit) or < $0 (loss) |
| 11 | Open database client and run query:<br>`SELECT * FROM expert_demonstrations`<br>`WHERE user_id = 1`<br>`ORDER BY created_at DESC LIMIT 5;` | Query returns recent trades |

**Validation Criteria:**

```sql
-- Expected Database State
SELECT
  id,
  user_id,
  symbol,
  action, -- Should be 1 (BUY) or 2 (SELL)
  pnl,
  is_expert_trade,
  expert_score,
  strategy_used,
  observation_data IS NOT NULL as has_observation,
  created_at
FROM expert_demonstrations
WHERE user_id = 1
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Results:**
- ✅ At least 1 row exists for SELL trade (if P&L > 0.5%)
- ✅ `pnl` matches the frontend display
- ✅ `is_expert_trade = true` if P&L > 0.5%
- ✅ `expert_score` between 0-100
- ✅ `strategy_used = 'PPO'` or `'manual'`
- ✅ `observation_data` is NOT NULL
- ✅ `observation_data->>'features'` contains array of floats
- ✅ `observation_data->>'shape'` = `[50, 10]`

**Actual Results:** [To be filled during testing]

**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Pass | ⬜ Fail

**Notes/Issues:**

---

### Test Case 1.2: Non-Expert Trade Filtering

**Objective:** Verify that unprofitable trades (P&L < 0.5%) are NOT marked as expert demonstrations

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Execute a trade with very small P&L (e.g., quick buy-sell) | Trade executes but P&L < 0.5% |
| 2 | Query database for this trade | Row exists but `is_expert_trade = false` |
| 3 | Verify expert_score | Score should be low (< 50) or NULL |

**Validation Query:**
```sql
SELECT
  id,
  pnl,
  is_expert_trade,
  expert_score,
  observation_data IS NOT NULL as has_observation
FROM expert_demonstrations
WHERE user_id = 1
  AND pnl < (executed_price * 0.005) -- Less than 0.5%
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Results:**
- ✅ `is_expert_trade = false`
- ✅ `expert_score < 50` (or NULL)
- ✅ Observation data still recorded for future analysis

**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Pass | ⬜ Fail

---

### Test Case 1.3: Observation Data JSON Structure

**Objective:** Validate JSONB structure of observation_data

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Query observation_data structure | JSONB contains required fields |

**Validation Query:**
```sql
SELECT
  id,
  observation_data->>'features' as features_array,
  observation_data->>'shape' as shape,
  observation_data->>'dtype' as dtype,
  observation_data->>'normalization' as normalization,
  observation_data->>'version' as version,
  jsonb_array_length(observation_data->'features') as feature_count
FROM expert_demonstrations
WHERE user_id = 1
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Results:**
- ✅ `features_array` is a valid JSON array of numbers
- ✅ `shape` = `[50, 10]`
- ✅ `dtype` = `float32` or similar
- ✅ `normalization` = `minmax`
- ✅ `version` = `1.0`
- ✅ `feature_count` = 500 (50 * 10)

**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Pass | ⬜ Fail

---

## 🤖 SCENARIO 2: GAIL Training Flow (DB → Model)

**Test ID:** TC-S2-001
**Priority:** P0 (Critical)
**Objective:** Validate that expert demonstrations from database can successfully train a GAIL model

### Test Case 2.1: Local GAIL Training

**Preconditions:**
- Completed Scenario 1 (at least 100 expert demonstrations in DB)
- `imitation==1.0.0` and `torch==2.1.2` installed
- Database accessible from backend

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Verify expert demonstrations count:<br>`SELECT COUNT(*) FROM expert_demonstrations`<br>`WHERE is_expert_trade = true;` | Count >= 100 |
| 2 | Open terminal in `backend/` directory | - |
| 3 | Set environment variables:<br>`export DATABASE_URL="postgresql://..."`<br>`export SYMBOL="BTC-USDT"` | - |
| 4 | Run GAIL training script:<br>`python -m app.ml.train_gail` | Training starts |
| 5 | Monitor console output | Logs show:<br>- "Fetching expert demonstrations..."<br>- "Found X demonstrations"<br>- "Preparing dataset..."<br>- "Training GAIL..." |
| 6 | Wait for training to complete | Process completes without errors |
| 7 | Verify model saved:<br>`ls -lh models/` | File exists: `gail_crypto_model_BTC-USDT.zip` |
| 8 | Check model file size | Size > 1 MB (reasonable model size) |

**Expected Console Output:**
```
[GAIL Trainer] Fetching expert demonstrations for BTC-USDT...
[GAIL Trainer] Found 150 demonstrations with avg score 75.3
[GAIL Trainer] Preparing dataset...
[GAIL Trainer] Creating transitions (150 obs, 150 actions)
[GAIL Trainer] Training GAIL model (100000 timesteps)...
[GAIL] Iteration 100/1000 - Discriminator loss: 0.65
[GAIL] Iteration 200/1000 - Discriminator loss: 0.58
...
[GAIL Trainer] Training complete. Model saved to: models/gail_crypto_model_BTC-USDT.zip
[GAIL Trainer] Training summary:
  - Total timesteps: 100000
  - Expert demonstrations used: 150
  - Final discriminator loss: 0.42
  - Model size: 2.4 MB
```

**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Pass | ⬜ Fail

**Notes/Issues:**

---

### Test Case 2.2: Modal GAIL Training

**Objective:** Validate GAIL training on Modal.com serverless platform

**Preconditions:**
- Modal CLI authenticated
- Modal secrets configured
- Database accessible from Modal

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to `backend/` directory | - |
| 2 | Run Modal training function:<br>`modal run app.ml.train_gail::train_gail_with_modal \`<br>`--database-url $DATABASE_URL \`<br>`--symbol BTC-USDT \`<br>`--total-timesteps 50000` | Modal function starts |
| 3 | Monitor Modal logs in terminal | Logs stream in real-time |
| 4 | Wait for completion (5-10 minutes) | Function completes successfully |
| 5 | Check return value | JSON response with status: "success" |
| 6 | Verify model saved to Modal Volume or S3 | Model accessible via Modal storage |

**Expected Modal Output:**
```
✓ Created objects.
├── 🔨 Created mount /root/backend
├── 🔨 Created train_gail_with_modal.
└── 🔨 Created gail_trainer_image.

=> Running function train_gail_with_modal...
[Modal] Fetching expert demonstrations...
[Modal] Found 150 demonstrations
[Modal] Training GAIL model (50000 timesteps)...
[Modal] Training complete. Model saved to: /cache/models/gail_crypto_model.zip
=> Function completed.

{
  "status": "success",
  "model_path": "/cache/models/gail_crypto_model.zip",
  "demonstrations_used": 150,
  "training_timesteps": 50000,
  "final_loss": 0.42,
  "model_size_mb": 2.4
}
```

**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Pass | ⬜ Fail

---

### Test Case 2.3: GAIL Training with Insufficient Data

**Objective:** Verify error handling when expert demonstrations < minimum threshold

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Create new test user with < 100 demonstrations | User exists but insufficient data |
| 2 | Attempt GAIL training for this user | Training fails gracefully |
| 3 | Check error message | Clear error: "Insufficient expert demonstrations (found: X, required: 100)" |

**Expected Behavior:**
- ❌ Training does NOT proceed
- ✅ Clear error message returned
- ✅ No corrupted model files created
- ✅ Database remains unchanged

**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Pass | ⬜ Fail

---

## 🧠 SCENARIO 3: GAIL Inference Flow (Model → Frontend)

**Test ID:** TC-S3-001
**Priority:** P0 (Critical)
**Objective:** Validate that GAIL model can be loaded and serve predictions via API

### Test Case 3.1: GAIL Model Loading on Startup

**Preconditions:**
- GAIL model trained and saved (from Scenario 2)
- Backend server NOT running

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Ensure GAIL model exists:<br>`ls models/gail_crypto_model*.zip` | File exists |
| 2 | Start backend server:<br>`uvicorn app.main:app --reload` | Server starts |
| 3 | Monitor startup logs | Logs show:<br>"Loading PPO model..."<br>"Loading GAIL model..." |
| 4 | Check model health endpoint:<br>`curl http://localhost:8000/api/v1/prediction/model/health?strategy=GAIL` | Response:<br>`{"status": "healthy", "strategy": "GAIL", ...}` |

**Expected Response:**
```json
{
  "status": "healthy",
  "strategy": "GAIL",
  "model_loaded": true,
  "available_models": ["PPO", "GAIL"],
  "model_info": {
    "model_type": "GAIL",
    "model_version": "gail_v1",
    "last_updated": "2025-01-XX",
    "training_timesteps": 50000
  }
}
```

**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Pass | ⬜ Fail

---

### Test Case 3.2: GAIL Prediction via API (curl)

**Objective:** Test GAIL inference directly via API without frontend

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Make PPO prediction request:<br>`curl "http://localhost:8000/api/v1/prediction/predict/BTC-USDT?strategy=PPO"` | Returns prediction with strategy: "PPO" |
| 2 | Make GAIL prediction request:<br>`curl "http://localhost:8000/api/v1/prediction/predict/BTC-USDT?strategy=GAIL"` | Returns prediction with strategy: "GAIL" |
| 3 | Compare action_id from both responses | Values should be different (or logs show different models used) |
| 4 | Check backend logs | Logs show:<br>"[PredictionService] Using model: PPO"<br>"[PredictionService] Using model: GAIL" |

**Expected PPO Response:**
```json
{
  "action_id": 1,
  "action_name": "BUY",
  "symbol": "BTC-USDT",
  "current_price": 43250.50,
  "confidence": 0.82,
  "timestamp": "2025-01-XX...",
  "strategy": "PPO",
  "model_version": "ppo_v1"
}
```

**Expected GAIL Response:**
```json
{
  "action_id": 0,
  "action_name": "HOLD",
  "symbol": "BTC-USDT",
  "current_price": 43250.50,
  "confidence": 0.75,
  "timestamp": "2025-01-XX...",
  "strategy": "GAIL",
  "model_version": "gail_v1"
}
```

**Validation Criteria:**
- ✅ Both requests succeed (HTTP 200)
- ✅ Response includes `strategy` field
- ✅ `strategy` matches request parameter
- ✅ Backend logs confirm different models used
- ✅ Response times < 500ms

**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Pass | ⬜ Fail

---

### Test Case 3.3: Invalid Strategy Parameter

**Objective:** Verify error handling for invalid strategy values

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Request with invalid strategy:<br>`curl "http://localhost:8000/api/v1/prediction/predict/BTC-USDT?strategy=INVALID"` | HTTP 400 or 503 error |
| 2 | Check error message | Clear message: "INVALID model not loaded. Available: ['PPO', 'GAIL']" |

**Expected Error Response:**
```json
{
  "detail": "INVALID model not loaded. Available models: ['PPO', 'GAIL']",
  "status_code": 503
}
```

**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Pass | ⬜ Fail

---

## 🔄 SCENARIO 4: Strategy Switching (PPO ↔ GAIL)

**Test ID:** TC-S4-001
**Priority:** P1 (High)
**Objective:** Validate seamless switching between PPO and GAIL strategies in frontend

### Test Case 4.1: Frontend Strategy Switching

**Preconditions:**
- Both PPO and GAIL models loaded in backend
- Frontend running

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open browser → http://localhost:3000 | Dashboard loads with PPO selected |
| 2 | Note current AI Recommendation action | E.g., "BUY" with "🤖 Layer 2: PPO" |
| 3 | Open DevTools → Network tab | - |
| 4 | Click Strategy Selector dropdown | Shows PPO (selected) and GAIL (disabled) |
| 5 | Verify GAIL option is disabled | Cannot select GAIL (lock icon 🔒) |

**Note:** Since GAIL is locked in freemium UI, we cannot test frontend switching. This will be tested via API only.

**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Pass | ⬜ Fail | ⬜ N/A (Freemium Locked)

---

### Test Case 4.2: API Strategy Parameter Propagation

**Objective:** Verify strategy parameter flows through all API layers

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Call prediction API with PPO:<br>`curl "http://localhost:8000/api/v1/prediction/predict/BTC-USDT?strategy=PPO"` | Response: `"strategy": "PPO"` |
| 2 | Call prediction API with GAIL:<br>`curl "http://localhost:8000/api/v1/prediction/predict/BTC-USDT?strategy=GAIL"` | Response: `"strategy": "GAIL"` |
| 3 | Execute trade with PPO strategy:<br>`curl -X POST http://localhost:8000/api/v1/trading/execute \`<br>`-H "Content-Type: application/json" \`<br>`-d '{"symbol": "BTC-USDT", "side": "buy", "quantity": 0.001, "strategy": "PPO"}'` | Trade executes with strategy recorded |
| 4 | Query database:<br>`SELECT strategy_used FROM expert_demonstrations`<br>`ORDER BY created_at DESC LIMIT 1;` | Returns: `strategy_used = 'PPO'` |

**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Pass | ⬜ Fail

---

## 🔒 SCENARIO 5: Freemium Lock Validation

**Test ID:** TC-S5-001
**Priority:** P1 (High)
**Objective:** Verify GAIL option is properly locked in frontend UI

### Test Case 5.1: GAIL Option Disabled

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open Strategy Selector component | Component renders |
| 2 | Inspect dropdown `<select>` element | GAIL option has `disabled` attribute |
| 3 | Attempt to select GAIL via dropdown | Cannot select (greyed out) |
| 4 | Inspect GAIL card | Has lock icon 🔒 and "PREMIUM" badge |
| 5 | Click on GAIL card | Card does not select (cursor: not-allowed) |
| 6 | Verify premium notice | Shows: "💎 Upgrade to Premium to unlock Expert AI" |

**Visual Validation:**
- ✅ GAIL option greyed out in dropdown
- ✅ Lock icon 🔒 visible
- ✅ "PREMIUM" yellow badge displayed
- ✅ Opacity reduced (60%)
- ✅ Cursor shows not-allowed
- ✅ Premium upgrade message visible

**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Pass | ⬜ Fail

---

## 🎯 SCENARIO 6: Expert Collector Quality Filter

**Test ID:** TC-S6-001
**Priority:** P2 (Medium)
**Objective:** Validate ExpertCollector properly filters trades based on quality criteria

### Test Case 6.1: Profitability Threshold (0.5%)

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Execute trade with P&L = 0.3% (below threshold) | Trade recorded but not marked as expert |
| 2 | Execute trade with P&L = 0.6% (above threshold) | Trade marked as expert |
| 3 | Query database:<br>`SELECT pnl, is_expert_trade, expert_score`<br>`FROM expert_demonstrations`<br>`WHERE user_id = 1`<br>`ORDER BY created_at DESC LIMIT 2;` | First row: `is_expert_trade = true`<br>Second row: `is_expert_trade = false` |

**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Pass | ⬜ Fail

---

### Test Case 6.2: Win Rate Filtering

**Objective:** Verify trades from users with low win rate are not marked as expert

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Execute 10 trades with 3 wins, 7 losses (30% win rate) | Trades recorded |
| 2 | Execute profitable trade (P&L > 0.5%) | Trade recorded |
| 3 | Check if marked as expert | `is_expert_trade = false` (due to low overall win rate) |

**Expected Behavior:**
- Win rate < 50% → Not marked as expert, even if individual trade is profitable

**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Pass | ⬜ Fail

---

### Test Case 6.3: Expert Score Calculation

**Objective:** Validate expert_score formula (0-100)

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Execute perfect trade:<br>- P&L = 5% (max profitability)<br>- Win rate = 100%<br>- Consistency = 1.0 | `expert_score ≈ 100` |
| 2 | Execute mediocre trade:<br>- P&L = 1%<br>- Win rate = 55%<br>- Consistency = 0.7 | `expert_score ≈ 50-60` |
| 3 | Query and verify:<br>`SELECT expert_score, pnl, win_rate`<br>`FROM expert_demonstrations`<br>`WHERE user_id = 1`<br>`ORDER BY expert_score DESC;` | Scores match expected ranges |

**Expected Score Breakdown:**
```
expert_score = profitability_score + win_rate_score + consistency_score

Where:
- profitability_score = min(pnl_pct / 0.05, 1.0) * 40  (max 40 points)
- win_rate_score = win_rate * 30  (max 30 points)
- consistency_score = consistency * 30  (max 30 points)
```

**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Pass | ⬜ Fail

---

## 👥 SCENARIO 7: Multi-User Data Isolation

**Test ID:** TC-S7-001
**Priority:** P1 (High)
**Objective:** Ensure expert demonstrations are properly isolated per user

### Test Case 7.1: User Data Segregation

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Create two test users:<br>- User A (id = 1)<br>- User B (id = 2) | Users created |
| 2 | Execute 5 trades as User A | 5 demonstrations recorded for user_id = 1 |
| 3 | Execute 3 trades as User B | 3 demonstrations recorded for user_id = 2 |
| 4 | Query User A's data:<br>`SELECT COUNT(*) FROM expert_demonstrations`<br>`WHERE user_id = 1;` | Returns: 5 |
| 5 | Query User B's data:<br>`SELECT COUNT(*) FROM expert_demonstrations`<br>`WHERE user_id = 2;` | Returns: 3 |
| 6 | Train GAIL model for User A | Only User A's demonstrations used |
| 7 | Verify training logs | "Using 5 demonstrations from user_id = 1" |

**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Pass | ⬜ Fail

---

## 🔌 SCENARIO 8: WebSocket Real-time Updates

**Test ID:** TC-S8-001
**Priority:** P2 (Medium)
**Objective:** Validate WebSocket pushes prediction updates when strategy changes

### Test Case 8.1: Real-time Prediction Updates

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open frontend with WebSocket connected | Connection status: "Connected" (green) |
| 2 | Open DevTools → Console | No WebSocket errors |
| 3 | Wait for prediction update via WebSocket | Console logs: "[WebSocket] Prediction update received" |
| 4 | Verify AI Recommendation updates without page refresh | UI updates in real-time |

**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Pass | ⬜ Fail

---

## ⚠️ Edge Cases & Negative Testing

### Edge Case 1: Empty Database

**Scenario:** Attempt GAIL training with 0 expert demonstrations

**Expected Behavior:**
- ❌ Training fails gracefully
- ✅ Error message: "No expert demonstrations found. Execute profitable trades first."
- ✅ No model file created

---

### Edge Case 2: Corrupted Observation Data

**Scenario:** observation_data JSONB is malformed

**Expected Behavior:**
- ❌ GAIL training skips corrupted records
- ✅ Logs warning: "Skipping demonstration ID X due to invalid observation data"
- ✅ Training continues with valid records

---

### Edge Case 3: Model Loading Failure

**Scenario:** GAIL model file corrupted or missing

**Expected Behavior:**
- ⚠️ Backend starts with PPO only
- ✅ `/model/health?strategy=GAIL` returns: `{"status": "unavailable", "model_loaded": false}`
- ✅ GAIL prediction requests return 503 with clear error message

---

### Edge Case 4: Concurrent Strategy Requests

**Scenario:** Multiple users request different strategies simultaneously

**Expected Behavior:**
- ✅ PredictionService handles concurrent requests correctly
- ✅ Each request uses correct model (no race conditions)
- ✅ Response times remain < 1 second

---

### Edge Case 5: Database Connection Loss During Training

**Scenario:** Database disconnects mid-training

**Expected Behavior:**
- ❌ Training fails with timeout error
- ✅ No partial model saved
- ✅ Database transaction rolled back (no data corruption)

---

## ⚡ Performance Testing

### Performance Test 1: Prediction API Response Time

**Test Parameters:**
- Endpoint: `/api/v1/prediction/predict/BTC-USDT?strategy=PPO`
- Concurrent Users: 10, 50, 100
- Duration: 5 minutes

**Acceptance Criteria:**
| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| Avg Response Time | < 300ms | < 500ms |
| P95 Response Time | < 500ms | < 1000ms |
| Throughput | > 100 req/s | > 50 req/s |
| Error Rate | < 0.1% | < 1% |

**Load Test Script:**
```bash
# Using Apache Bench
ab -n 1000 -c 10 "http://localhost:8000/api/v1/prediction/predict/BTC-USDT?strategy=PPO"

# Using locust
locust -f tests/performance/locustfile.py --host http://localhost:8000
```

---

### Performance Test 2: GAIL Training Time

**Test Parameters:**
- Expert Demonstrations: 100, 500, 1000
- Training Timesteps: 50k, 100k, 200k

**Acceptance Criteria:**
| Demonstrations | Timesteps | Max Training Time |
|---------------|-----------|-------------------|
| 100 | 50k | 5 minutes |
| 500 | 100k | 15 minutes |
| 1000 | 200k | 30 minutes |

---

## 🤖 Automation Recommendations

### High Priority for Automation

**1. Database Validation Tests (Selenium + SQL)**
```python
# tests/e2e/test_expert_collector.py
def test_profitable_trade_recorded(db_connection, frontend_driver):
    # Execute trade via frontend
    frontend_driver.find_element(By.ID, "buy-button").click()

    # Wait for trade execution
    time.sleep(2)

    # Validate database
    cursor = db_connection.cursor()
    cursor.execute("SELECT * FROM expert_demonstrations ORDER BY created_at DESC LIMIT 1")
    latest_demo = cursor.fetchone()

    assert latest_demo['is_expert_trade'] == True
    assert latest_demo['pnl'] > 0
    assert latest_demo['observation_data'] is not None
```

**2. API Integration Tests (pytest + requests)**
```python
# tests/api/test_multi_model_prediction.py
def test_ppo_vs_gail_predictions():
    ppo_response = requests.get(f"{API_URL}/predict/BTC-USDT?strategy=PPO")
    gail_response = requests.get(f"{API_URL}/predict/BTC-USDT?strategy=GAIL")

    assert ppo_response.json()['strategy'] == 'PPO'
    assert gail_response.json()['strategy'] == 'GAIL'
    assert ppo_response.json()['action_id'] != gail_response.json()['action_id']  # Different models
```

**3. CI/CD Pipeline Tests (GitHub Actions)**
```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: timescale/timescaledb:latest-pg14
        env:
          POSTGRES_PASSWORD: test123
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3
      - name: Run database migrations
        run: psql -f database/migrations/001_add_expert_demonstrations.sql
      - name: Start backend
        run: uvicorn app.main:app &
      - name: Run E2E tests
        run: pytest tests/e2e/ -v
```

---

## 📊 Test Data Requirements

### Minimum Test Data Set

**Users:**
- 3 test users with different trading patterns:
  - User A: High win rate (70%), profitable trader
  - User B: Medium win rate (50%), average trader
  - User C: Low win rate (30%), losing trader

**Trades:**
- 200+ total trades across all users
- 100+ expert-quality trades (P&L > 0.5%, win rate > 50%)
- Mix of BUY and SELL actions
- Various P&L ranges: -5% to +10%

**Market Data:**
- BTC-USDT historical data (last 30 days)
- Sufficient data for 50 timesteps of observation window

---

## 🔄 Rollback & Recovery Procedures

### Rollback Scenario 1: Database Migration Issues

**If migration fails:**
```sql
-- Rollback migration
DROP TABLE IF EXISTS expert_demonstrations CASCADE;

-- Re-apply previous schema
psql -f database/schema.sql
```

### Rollback Scenario 2: GAIL Model Deployment Issues

**If GAIL model causes errors:**
1. Remove GAIL model file: `rm models/gail_crypto_model*.zip`
2. Restart backend (will load PPO only)
3. Frontend continues to work with PPO as default

### Recovery Procedure: Corrupted Expert Demonstrations

**If data corruption detected:**
```sql
-- Backup current data
CREATE TABLE expert_demonstrations_backup AS
SELECT * FROM expert_demonstrations;

-- Clean corrupted records
DELETE FROM expert_demonstrations
WHERE observation_data IS NULL
   OR observation_data->>'features' IS NULL;

-- Re-train GAIL with clean data
python -m app.ml.train_gail
```

---

## ✅ Sign-off Criteria

### Must Pass (Blockers)

- [ ] **S1:** PPO trades successfully recorded in database (100% pass rate)
- [ ] **S2:** GAIL training completes without errors (100% pass rate)
- [ ] **S3:** GAIL model serves predictions via API (100% pass rate)
- [ ] **S5:** GAIL option locked in frontend UI (100% pass rate)
- [ ] **S7:** User data properly isolated (100% pass rate)
- [ ] **All P0 test cases:** Pass rate >= 100%

### Should Pass (High Priority)

- [ ] **S4:** Strategy switching works seamlessly (>= 95% pass rate)
- [ ] **S6:** Expert collector filters correctly (>= 90% pass rate)
- [ ] **All P1 test cases:** Pass rate >= 95%

### Nice to Have (Medium Priority)

- [ ] **S8:** WebSocket updates work correctly (>= 80% pass rate)
- [ ] **Performance tests:** Meet target thresholds (>= 80%)
- [ ] **All P2 test cases:** Pass rate >= 85%

### Release Approval

**QA Sign-off:** ______________ Date: __________

**Product Owner Sign-off:** ______________ Date: __________

**Engineering Lead Sign-off:** ______________ Date: __________

---

## 📝 Test Execution Log Template

### Test Session Details

**Tester:** [Your Name]
**Date:** [YYYY-MM-DD]
**Environment:** Local / Modal / Staging
**Build Version:** [commit hash]

### Execution Summary

| Scenario | Test Cases | Passed | Failed | Blocked | Pass Rate |
|----------|-----------|--------|--------|---------|-----------|
| S1 | 3 | - | - | - | -% |
| S2 | 3 | - | - | - | -% |
| S3 | 3 | - | - | - | -% |
| S4 | 2 | - | - | - | -% |
| S5 | 1 | - | - | - | -% |
| S6 | 3 | - | - | - | -% |
| S7 | 1 | - | - | - | -% |
| S8 | 1 | - | - | - | -% |
| **Total** | **17** | **-** | **-** | **-** | **-%** |

### Defects Found

| Defect ID | Severity | Scenario | Description | Status |
|-----------|----------|----------|-------------|--------|
| BUG-001 | High | S1 | Expert score calculation incorrect | Open |
| BUG-002 | Medium | S3 | GAIL prediction slower than expected | Open |

### Notes

[Any additional observations, blockers, or recommendations]

---

## 🎯 Quick Start Testing Guide

**For rapid validation, execute these critical tests first:**

1. **Quick Smoke Test (10 minutes):**
   ```bash
   # 1. Start services
   docker-compose up -d

   # 2. Execute one profitable trade via frontend
   # (Manual: open browser, select PPO, execute BUY then SELL)

   # 3. Verify database
   psql -U postgres -d ai_traders_shadow -c "SELECT * FROM expert_demonstrations LIMIT 1;"

   # 4. Test API
   curl "http://localhost:8000/api/v1/prediction/predict/BTC-USDT?strategy=PPO"
   ```

2. **Full Regression Test (2.5 hours):**
   - Execute all test cases in order: S1 → S2 → S3 → S4 → S5 → S6 → S7 → S8
   - Document results in Test Execution Log

3. **Automated Test Suite (30 minutes):**
   ```bash
   # Run all automated tests
   pytest tests/e2e/ -v --html=report.html
   ```

---

**End of Test Plan**

*For questions or issues, contact: [Your Name] - [your.email@example.com]*
