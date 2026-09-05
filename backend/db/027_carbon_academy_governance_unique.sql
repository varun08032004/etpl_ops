-- Add unique constraint to carbon_academy_governance_rules
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'carbon_academy_governance_rules'::regclass 
        AND contype = 'u' 
        AND conname = 'carbon_academy_governance_rules_content_area_key'
    ) THEN
        ALTER TABLE carbon_academy_governance_rules 
        ADD CONSTRAINT carbon_academy_governance_rules_content_area_key 
        UNIQUE (content_area);
    END IF;
END $$;