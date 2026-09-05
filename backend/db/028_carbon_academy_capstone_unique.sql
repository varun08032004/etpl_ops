-- Add unique constraint to carbon_academy_capstone_requirements
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'carbon_academy_capstone_requirements'::regclass 
        AND contype = 'u' 
        AND conname = 'carbon_academy_capstone_requirements_programme_component_key'
    ) THEN
        ALTER TABLE carbon_academy_capstone_requirements 
        ADD CONSTRAINT carbon_academy_capstone_requirements_programme_component_key 
        UNIQUE (programme_id, component_name);
    END IF;
END $$;