-- Add unique constraint to carbon_academy_certification_levels
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'carbon_academy_certification_levels'::regclass 
        AND contype = 'u' 
        AND conname = 'carbon_academy_certification_levels_level_name_key'
    ) THEN
        ALTER TABLE carbon_academy_certification_levels 
        ADD CONSTRAINT carbon_academy_certification_levels_level_name_key 
        UNIQUE (level_name);
    END IF;
END $$;