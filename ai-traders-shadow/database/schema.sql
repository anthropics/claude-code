-- ========================================
-- AI Trader's Shadow - TimescaleDB Schema
-- ========================================

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- ========================================
-- 1. USERS TABLE (Relational)
-- ========================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    telegram_chat_id BIGINT UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    paper_trading_balance DECIMAL(18, 8) DEFAULT 100.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_telegram_chat_id ON users(telegram_chat_id);


-- ========================================
-- 2. MARKET_DATA_1M (Time-Series - 1 Minute Candles)
-- ========================================
CREATE TABLE IF NOT EXISTS market_data_1m (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    exchange VARCHAR(20) NOT NULL,
    open DECIMAL(18, 8) NOT NULL,
    high DECIMAL(18, 8) NOT NULL,
    low DECIMAL(18, 8) NOT NULL,
    close DECIMAL(18, 8) NOT NULL,
    volume DECIMAL(24, 8) NOT NULL,
    quote_volume DECIMAL(24, 8),
    trades_count INTEGER,
    PRIMARY KEY (time, symbol, exchange)
);

-- Convert to hypertable (TimescaleDB)
SELECT create_hypertable('market_data_1m', 'time', if_not_exists => TRUE);

CREATE INDEX idx_market_data_1m_symbol_time ON market_data_1m(symbol, time DESC);


-- ========================================
-- 3. ORDER_BOOK_SNAPSHOTS (Time-Series - L2 Data)
-- ========================================
CREATE TABLE IF NOT EXISTS order_book_snapshots (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    exchange VARCHAR(20) NOT NULL,
    bid_price DECIMAL(18, 8) NOT NULL,
    bid_quantity DECIMAL(24, 8) NOT NULL,
    ask_price DECIMAL(18, 8) NOT NULL,
    ask_quantity DECIMAL(24, 8) NOT NULL,
    spread_bps DECIMAL(10, 4),  -- Spread in basis points
    mid_price DECIMAL(18, 8),
    PRIMARY KEY (time, symbol, exchange)
);

SELECT create_hypertable('order_book_snapshots', 'time', if_not_exists => TRUE);

CREATE INDEX idx_order_book_symbol_time ON order_book_snapshots(symbol, time DESC);


-- ========================================
-- 4. TRADES_PAPER (Relational - Paper Trading Trades)
-- ========================================
CREATE TABLE IF NOT EXISTS trades_paper (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exchange VARCHAR(20) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
    order_type VARCHAR(20) DEFAULT 'market',
    price DECIMAL(18, 8) NOT NULL,
    quantity DECIMAL(24, 8) NOT NULL,
    quote_quantity DECIMAL(24, 8),
    fee DECIMAL(24, 8) DEFAULT 0,
    fee_currency VARCHAR(10),
    pnl DECIMAL(18, 8),  -- Realized P&L for this trade
    status VARCHAR(20) DEFAULT 'filled' CHECK (status IN ('pending', 'filled', 'canceled', 'rejected')),
    strategy_signal VARCHAR(50),  -- e.g., 'ppo_agent', 'manual'
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB  -- Additional trade context (e.g., mood at execution, market conditions)
);

CREATE INDEX idx_trades_paper_user_id ON trades_paper(user_id);
CREATE INDEX idx_trades_paper_executed_at ON trades_paper(executed_at DESC);
CREATE INDEX idx_trades_paper_symbol ON trades_paper(symbol);


-- ========================================
-- 5. AGENT_STATUS_LOG (Time-Series - Mood Meter & AI State)
-- ========================================
CREATE TABLE IF NOT EXISTS agent_status_log (
    time TIMESTAMPTZ NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mood VARCHAR(20) NOT NULL,  -- e.g., 'confident', 'cautious', 'fatigued'
    mood_score DECIMAL(5, 2),  -- Normalized score 0-100
    recent_pnl DECIMAL(18, 8),  -- P&L from last N trades
    win_rate DECIMAL(5, 4),  -- Recent win rate (0.0-1.0)
    trades_count_1h INTEGER,  -- Number of trades in last 1 hour
    market_volatility DECIMAL(10, 4),  -- ATR or similar metric
    liquidity_score DECIMAL(10, 4),  -- Market liquidity score
    reason TEXT,  -- Human-readable explanation for mood
    PRIMARY KEY (time, user_id)
);

SELECT create_hypertable('agent_status_log', 'time', if_not_exists => TRUE);

CREATE INDEX idx_agent_status_user_id_time ON agent_status_log(user_id, time DESC);


-- ========================================
-- 6. PRE_TRADE_CHECKS_LOG (Time-Series - Risk Management)
-- ========================================
CREATE TABLE IF NOT EXISTS pre_trade_checks_log (
    time TIMESTAMPTZ NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    check_type VARCHAR(50) NOT NULL,  -- e.g., 'spread_check', 'liquidity_check', 'news_check'
    passed BOOLEAN NOT NULL,
    details JSONB,  -- Detailed check results
    PRIMARY KEY (time, user_id, symbol, check_type)
);

SELECT create_hypertable('pre_trade_checks_log', 'time', if_not_exists => TRUE);

CREATE INDEX idx_pre_trade_checks_user_time ON pre_trade_checks_log(user_id, time DESC);


-- ========================================
-- 7. MONTE_CARLO_SIMULATIONS (Relational - Simulation Results)
-- ========================================
CREATE TABLE IF NOT EXISTS monte_carlo_simulations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strategy_name VARCHAR(100) NOT NULL,
    initial_balance DECIMAL(18, 8) NOT NULL,
    num_simulations INTEGER NOT NULL,
    simulation_days INTEGER NOT NULL,
    mean_final_balance DECIMAL(18, 8),
    median_final_balance DECIMAL(18, 8),
    std_dev DECIMAL(18, 8),
    max_drawdown_mean DECIMAL(18, 8),
    probability_profit DECIMAL(5, 4),  -- Probability of ending in profit
    percentile_5 DECIMAL(18, 8),
    percentile_95 DECIMAL(18, 8),
    results_data JSONB,  -- Full distribution data for visualization
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_monte_carlo_user_id ON monte_carlo_simulations(user_id);


-- ========================================
-- 8. TELEGRAM_NOTIFICATIONS_LOG (Time-Series - Notification History)
-- ========================================
CREATE TABLE IF NOT EXISTS telegram_notifications_log (
    time TIMESTAMPTZ NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,  -- e.g., 'mood_update', 'trade_alert', 'daily_summary'
    message TEXT NOT NULL,
    sent_successfully BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (time, user_id, notification_type)
);

SELECT create_hypertable('telegram_notifications_log', 'time', if_not_exists => TRUE);


-- ========================================
-- 9. RL_TRAINING_EPISODES (Relational - RL Training Metadata)
-- ========================================
CREATE TABLE IF NOT EXISTS rl_training_episodes (
    id SERIAL PRIMARY KEY,
    episode_number INTEGER NOT NULL,
    total_reward DECIMAL(18, 8),
    episode_length INTEGER,
    final_balance DECIMAL(18, 8),
    max_drawdown DECIMAL(18, 8),
    sharpe_ratio DECIMAL(10, 4),
    win_rate DECIMAL(5, 4),
    model_checkpoint_path VARCHAR(255),
    hyperparameters JSONB,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_rl_episodes_number ON rl_training_episodes(episode_number DESC);


-- ========================================
-- CONTINUOUS AGGREGATES (TimescaleDB - Pre-computed Views)
-- ========================================

-- Market Data 5m aggregates
CREATE MATERIALIZED VIEW IF NOT EXISTS market_data_5m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('5 minutes', time) AS time,
    symbol,
    exchange,
    first(open, time) AS open,
    max(high) AS high,
    min(low) AS low,
    last(close, time) AS close,
    sum(volume) AS volume,
    sum(quote_volume) AS quote_volume,
    sum(trades_count) AS trades_count
FROM market_data_1m
GROUP BY time_bucket('5 minutes', time), symbol, exchange;

-- Agent performance metrics (hourly)
CREATE MATERIALIZED VIEW IF NOT EXISTS agent_performance_1h
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS time,
    user_id,
    avg(mood_score) AS avg_mood_score,
    avg(recent_pnl) AS avg_pnl,
    avg(win_rate) AS avg_win_rate,
    avg(market_volatility) AS avg_volatility,
    count(*) AS status_updates_count
FROM agent_status_log
GROUP BY time_bucket('1 hour', time), user_id;


-- ========================================
-- DATA RETENTION POLICIES
-- ========================================

-- Keep raw 1m market data for 30 days
SELECT add_retention_policy('market_data_1m', INTERVAL '30 days', if_not_exists => TRUE);

-- Keep order book snapshots for 7 days (high volume data)
SELECT add_retention_policy('order_book_snapshots', INTERVAL '7 days', if_not_exists => TRUE);

-- Keep agent status logs for 90 days
SELECT add_retention_policy('agent_status_log', INTERVAL '90 days', if_not_exists => TRUE);

-- Keep pre-trade checks for 60 days
SELECT add_retention_policy('pre_trade_checks_log', INTERVAL '60 days', if_not_exists => TRUE);


-- ========================================
-- HELPER FUNCTIONS
-- ========================================

-- Function to calculate current paper trading balance
CREATE OR REPLACE FUNCTION get_paper_balance(p_user_id INTEGER)
RETURNS DECIMAL(18, 8) AS $$
DECLARE
    v_balance DECIMAL(18, 8);
BEGIN
    SELECT
        u.paper_trading_balance + COALESCE(SUM(t.pnl), 0)
    INTO v_balance
    FROM users u
    LEFT JOIN trades_paper t ON u.id = t.user_id
    WHERE u.id = p_user_id
    GROUP BY u.id, u.paper_trading_balance;

    RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql;


-- Function to get latest mood for user
CREATE OR REPLACE FUNCTION get_latest_mood(p_user_id INTEGER)
RETURNS TABLE (
    mood VARCHAR(20),
    mood_score DECIMAL(5, 2),
    reason TEXT,
    time TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.mood,
        a.mood_score,
        a.reason,
        a.time
    FROM agent_status_log a
    WHERE a.user_id = p_user_id
    ORDER BY a.time DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;


-- ========================================
-- SEED DATA (Development Only)
-- ========================================

-- Insert demo user
INSERT INTO users (username, email, hashed_password, telegram_chat_id, paper_trading_balance)
VALUES
    ('demo_trader', 'demo@aitradershadow.com', '$2b$12$demo_hash', 123456789, 100.0)
ON CONFLICT (username) DO NOTHING;


-- ========================================
-- GRANTS (Adjust for production)
-- ========================================

-- Grant permissions to application user (create this user separately)
-- CREATE USER app_user WITH PASSWORD 'secure_password';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
