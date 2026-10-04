-- ═══════════════════════════════════════════════════════════════════════════
-- ORG HIERARCHY TIERS — Editable organizational hierarchy levels
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE org_hierarchy_tiers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL UNIQUE,        -- e.g. 'Managing Director', 'Director', 'CEO', 'Department Head'
  display_order INTEGER NOT NULL DEFAULT 0,          -- Lower = higher in hierarchy (0 = top)
  description   TEXT,
  color         VARCHAR(20) DEFAULT '#6366f1',       -- Hex color for UI
  icon          VARCHAR(50),                         -- Optional icon name
  is_system     BOOLEAN DEFAULT FALSE,               -- System tiers (cannot be deleted)
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- Default tiers matching requested hierarchy
INSERT INTO org_hierarchy_tiers (name, display_order, description, color, is_system) VALUES
('Managing Director / Executive Director', 0, 'Top leadership — Founder, MD, ED', '#7c3aed', true),
('Director(s)', 10, 'Board-level directors', '#6d28d9', true),
('CEO', 20, 'Chief Executive Officer', '#5b21b6', true),
('Department Head (HOD)', 30, 'Head of Department', '#3730a3', true),
('Senior Management', 40, 'VP, GM, Senior Leaders', '#1e40af', false),
('Management', 50, 'Managers, Team Leads', '#0f766e', false),
('Employee', 60, 'Individual contributors', '#166534', false)
ON CONFLICT (name) DO NOTHING;

-- Add tier_id to designations table
ALTER TABLE designations ADD COLUMN IF NOT EXISTS tier_id UUID REFERENCES org_hierarchy_tiers(id);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_designations_tier ON designations(tier_id);

-- Trigger for updated_at
CREATE TRIGGER trg_org_hierarchy_tiers_updated_at
  BEFORE UPDATE ON org_hierarchy_tiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();