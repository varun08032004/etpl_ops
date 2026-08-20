-- 013_health_scores.sql
-- Customer Health Scores table

CREATE TABLE IF NOT EXISTS health_scores (
    customer_id UUID PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
    overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
    tier VARCHAR(20) NOT NULL CHECK (tier IN ('healthy', 'at_risk', 'critical')),
    category_scores JSONB NOT NULL DEFAULT '{}',  -- {usage, support, billing, sentiment}
    signals JSONB NOT NULL DEFAULT '{}',
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_scores_tier ON health_scores(tier);
CREATE INDEX IF NOT EXISTS idx_health_scores_overall_score ON health_scores(overall_score ASC);
CREATE INDEX IF NOT EXISTS idx_health_scores_computed_at ON health_scores(computed_at DESC);