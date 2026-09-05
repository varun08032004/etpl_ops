-- Add unique constraint to carbon_academy_certification_requirements
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'carbon_academy_certification_requirements'::regclass 
        AND contype = 'u' 
        AND conname = 'carbon_academy_certification_requirements_cert_course_key'
    ) THEN
        ALTER TABLE carbon_academy_certification_requirements 
        ADD CONSTRAINT carbon_academy_certification_requirements_cert_course_key 
        UNIQUE (certification_level_id, course_id);
    END IF;
END $$;