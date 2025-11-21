-- ========================================
-- Migration: Add Expert Demonstrations Table for GAIL Training
-- Version: 2024-01-13-add-expert-demonstrations
-- ========================================

-- Add expert_demonstrations table for Imitation Learning (GAIL)
CREATE TABLE IF NOT EXISTS expert_demonstrations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trade_id INTEGER REFERENCES trades_paper(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Trade Context
    symbol VARCHAR(20) NOT NULL,
    action INTEGER NOT NULL CHECK (action IN (0, 1, 2)),  -- 0: HOLD, 1: BUY, 2: SELL
    executed_price DECIMAL(18, 8) NOT NULL,

    -- Outcome
    reward FLOAT NOT NULL,
    pnl DECIMAL(18, 8),
    win_rate FLOAT,

    -- Expert Label
    is_expert_trade BOOLEAN DEFAULT false,
    expert_score FLOAT,

    -- ML Training Data
    observation_data JSONB NOT NULL,

    -- Metadata
    strategy_used VARCHAR(50),
    market_conditions JSONB,
    notes TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_expert_demonstrations_user_id ON expert_demonstrations(user_id);
CREATE INDEX IF NOT EXISTS idx_expert_demonstrations_created_at ON expert_demonstrations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expert_demonstrations_is_expert ON expert_demonstrations(is_expert_trade) WHERE is_expert_trade = true;
CREATE INDEX IF NOT EXISTS idx_expert_demonstrations_symbol ON expert_demonstrations(symbol);
CREATE INDEX IF NOT EXISTS idx_expert_demonstrations_expert_score ON expert_demonstrations(expert_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_expert_demonstrations_observation ON expert_demonstrations USING GIN (observation_data);

-- Add comments
COMMENT ON TABLE expert_demonstrations IS 'Stores expert demonstrations from profitable paper trades for GAIL (Imitation Learning) training';
COMMENT ON COLUMN expert_demonstrations.observation_data IS 'JSONB containing normalized market state (50x10 array) captured before action execution';
COMMENT ON COLUMN expert_demonstrations.is_expert_trade IS 'True if trade meets profitability threshold (e.g., pnl > 0.5%)';
COMMENT ON COLUMN expert_demonstrations.expert_score IS 'Quality metric: higher score = better demonstration for training';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: expert_demonstrations table created successfully';
END $$;
