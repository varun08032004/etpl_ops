-- 012_churn_scores.sql
-- Churn prediction scores table

CREATE TABLE IF NOT EXISTS churn_scores (
    customer_id UUID PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    signals JSONB NOT NULL DEFAULT '{}',
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_churn_scores_risk_level ON churn_scores(risk_level);
CREATE INDEX IF NOT EXISTS idx_churn_scores_score ON churn_scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_churn_scores_computed_at ON churn_scores(computed_at DESC);

-- Add missing columns to customers table if needed for churn signals
DO $$
BEGIN
    -- last_login_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'last_login_at') THEN
        ALTER TABLE customers ADD COLUMN last_login_at TIMESTAMPTZ;
    END IF;
    -- login_count_30d
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'login_count_30d') THEN
        ALTER TABLE customers ADD COLUMN login_count_30d INTEGER DEFAULT 0;
    END IF;
    -- feature_adoption_pct
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'feature_adoption_pct') THEN
        ALTER TABLE customers ADD COLUMN feature_adoption_pct DECIMAL(5,4) DEFAULT 0;
    END IF;
    -- api_calls_30d
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'api_calls_30d') THEN
        ALTER TABLE customers ADD COLUMN api_calls_30d INTEGER DEFAULT 0;
    END IF;
    -- active_users
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'active_users') THEN
        ALTER TABLE customers ADD COLUMN active_users INTEGER DEFAULT 0;
    END IF;
END $$;