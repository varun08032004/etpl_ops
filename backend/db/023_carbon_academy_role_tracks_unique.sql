-- Add unique constraint to carbon_academy_role_tracks if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'carbon_academy_role_tracks'::regclass 
        AND contype = 'u' 
        AND conname = 'carbon_academy_role_tracks_role_name_department_key'
    ) THEN
        ALTER TABLE carbon_academy_role_tracks 
        ADD CONSTRAINT carbon_academy_role_tracks_role_name_department_key 
        UNIQUE (role_name, department);
    END IF;
END $$;