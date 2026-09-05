-- ═══════════════════════════════════════════════════════════════════════════
-- ANALYTICS SNAPSHOTS — Pre-computed metrics for fast dashboard loads
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS analytics_mrr_snapshots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date   DATE NOT NULL UNIQUE,
  mrr             NUMERIC(14,2) NOT NULL DEFAULT 0,
  arr             NUMERIC(14,2) NOT NULL DEFAULT 0,
  active_subscriptions INTEGER NOT NULL DEFAULT 0,
  corporate_seats INTEGER NOT NULL DEFAULT 0,
  by_plan         JSONB NOT NULL DEFAULT '{}',        -- { starter: 1000, growth: 5000, corporate: 25000 }
  by_cycle        JSONB NOT NULL DEFAULT '{}',        -- { monthly: 10000, yearly: 20000 }
  avg_revenue_per_user NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analytics_mrr_snapshots_date ON analytics_mrr_snapshots(snapshot_date DESC);

-- ──────────────────────────────────────────────────────────────────────────
-- CHURN COHORTS — Monthly cohort retention snapshots
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_churn_cohorts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cohort_month    VARCHAR(7) NOT NULL,                -- 'YYYY-MM' format
  snapshot_date   DATE NOT NULL,                       -- when this snapshot was taken
  started         INTEGER NOT NULL DEFAULT 0,
  active          INTEGER NOT NULL DEFAULT 0,
  churned         INTEGER NOT NULL DEFAULT 0,
  expanded        INTEGER NOT NULL DEFAULT 0,
  contracted      INTEGER NOT NULL DEFAULT 0,
  mrr_started     NUMERIC(14,2) NOT NULL DEFAULT 0,
  mrr_current     NUMERIC(14,2) NOT NULL DEFAULT 0,
  retention_rate  NUMERIC(5,2) NOT NULL DEFAULT 0,     -- percentage
  net_revenue_retention NUMERIC(5,2) NOT NULL DEFAULT 0, -- percentage
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(cohort_month, snapshot_date)
);

CREATE INDEX idx_analytics_churn_cohorts_date ON analytics_churn_cohorts(snapshot_date DESC, cohort_month DESC);

-- ──────────────────────────────────────────────────────────────────────────
-- EXPANSION METRICS — New/Expansion/Contraction/Churn/Reactivation MRR
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_expansion_snapshots (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date         DATE NOT NULL UNIQUE,
  period_start          DATE NOT NULL,                 -- 30 days before snapshot_date
  period_end            DATE NOT NULL,                 -- snapshot_date
  new_mrr               NUMERIC(14,2) NOT NULL DEFAULT 0,
  expansion_mrr         NUMERIC(14,2) NOT NULL DEFAULT 0,
  contraction_mrr       NUMERIC(14,2) NOT NULL DEFAULT 0,
  churned_mrr           NUMERIC(14,2) NOT NULL DEFAULT 0,
  reactivation_mrr      NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_new_mrr           NUMERIC(14,2) NOT NULL DEFAULT 0,
  gross_mrr_churn_rate  NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analytics_expansion_snapshots_date ON analytics_expansion_snapshots(snapshot_date DESC);

-- ──────────────────────────────────────────────────────────────────────────
-- UNIT ECONOMICS — LTV, CAC, Payback snapshots
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_unit_economics_snapshots (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date         DATE NOT NULL UNIQUE,
  ltv                   NUMERIC(14,2) NOT NULL DEFAULT 0,
  cac                   NUMERIC(14,2) NOT NULL DEFAULT 0,
  payback_months        NUMERIC(5,2) NOT NULL DEFAULT 0,
  avg_monthly_churn     NUMERIC(5,2) NOT NULL DEFAULT 0,
  ltv_to_cac_ratio      NUMERIC(5,2),
  marketing_spend       NUMERIC(14,2) NOT NULL DEFAULT 0,  -- for CAC calculation
  new_customers_count   INTEGER NOT NULL DEFAULT 0,        -- for CAC calculation
  created_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analytics_unit_economics_date ON analytics_unit_economics_snapshots(snapshot_date DESC);

-- ──────────────────────────────────────────────────────────────────────────
-- MARKETING SPEND — For true CAC calculation (manual entry or imported)
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_marketing_spend (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  spend_date      DATE NOT NULL,
  channel         VARCHAR(100) NOT NULL,                 -- 'google', 'meta', 'linkedin', 'email', 'referral', 'organic', 'other'
  campaign        VARCHAR(200),
  amount_inr      NUMERIC(14,2) NOT NULL DEFAULT 0,
  new_customers   INTEGER NOT NULL DEFAULT 0,            -- attributed new customers
  notes           TEXT,
  created_by      UUID REFERENCES staff_accounts(id),
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(spend_date, channel, campaign)
);

CREATE INDEX idx_analytics_marketing_spend_date ON analytics_marketing_spend(spend_date DESC);

-- ──────────────────────────────────────────────────────────────────────────
-- DAILY MRR TIME SERIES — For trend charts (one row per day)
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_daily_mrr (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_date     DATE NOT NULL UNIQUE,
  mrr             NUMERIC(14,2) NOT NULL DEFAULT 0,
  arr             NUMERIC(14,2) NOT NULL DEFAULT 0,
  active_subscriptions INTEGER NOT NULL DEFAULT 0,
  new_subscriptions INTEGER NOT NULL DEFAULT 0,
  churned_subscriptions INTEGER NOT NULL DEFAULT 0,
  net_new_subscriptions INTEGER NOT NULL DEFAULT 0,
  by_plan         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analytics_daily_mrr_date ON analytics_daily_mrr(record_date DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGERS — auto update updated_at (none needed, these are append-only snapshots)
-- ═══════════════════════════════════════════════════════════════════════════