-- 011_renewal_proposals.sql
-- Renewal proposals table for automated renewal workflow

CREATE TABLE IF NOT EXISTS renewal_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES corporate_deals(id) ON DELETE CASCADE,
    proposed_seats INTEGER,
    proposed_price_paise BIGINT NOT NULL DEFAULT 0,          -- proposed price per period in paise
    proposed_discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    proposed_term_months INTEGER,
    proposed_billing_frequency VARCHAR(20) CHECK (proposed_billing_frequency IN ('monthly', 'annual', 'one_time')),
    notes TEXT,
    created_by UUID REFERENCES staff_accounts(id),
    needs_approval BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'executed')),
    approved_by UUID REFERENCES staff_accounts(id),
    approved_at TIMESTAMPTZ,
    approval_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_renewal_proposals_deal_id ON renewal_proposals(deal_id);
CREATE INDEX IF NOT EXISTS idx_renewal_proposals_status ON renewal_proposals(status);
CREATE INDEX IF NOT EXISTS idx_renewal_proposals_needs_approval ON renewal_proposals(needs_approval) WHERE needs_approval = TRUE;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_renewal_proposal_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_renewal_proposals_updated_at ON renewal_proposals;
CREATE TRIGGER trg_renewal_proposals_updated_at
    BEFORE UPDATE ON renewal_proposals
    FOR EACH ROW EXECUTE FUNCTION update_renewal_proposal_timestamp();

-- Add renewal_date to corporate_deals if not exists (for platform-tracked renewals)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'corporate_deals' AND column_name = 'renewal_date'
    ) THEN
        ALTER TABLE corporate_deals ADD COLUMN renewal_date DATE;
        COMMENT ON COLUMN corporate_deals.renewal_date IS 'Next renewal date for this deal (auto-calculated from term/billing, or manually set for platform-tracked)';
    END IF;
END $$;

-- Add status to corporate_deals if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'corporate_deals' AND column_name = 'status'
    ) THEN
        ALTER TABLE corporate_deals ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'renewed', 'expired', 'cancelled'));
    END IF;
END $$;