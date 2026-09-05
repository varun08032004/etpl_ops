-- Migration to add Carbon Academy course metadata columns
ALTER TABLE training_courses ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'foundation';
ALTER TABLE training_courses ADD COLUMN IF NOT EXISTS total_instructional_hours NUMERIC(6,2);
ALTER TABLE training_courses ADD COLUMN IF NOT EXISTS total_practical_hours NUMERIC(6,2);
ALTER TABLE training_courses ADD COLUMN IF NOT EXISTS total_assessment_hours NUMERIC(6,2);
ALTER TABLE training_courses ADD COLUMN IF NOT EXISTS total_hours NUMERIC(6,2);

-- Also add tier to training_programmes if not exists
ALTER TABLE training_programmes ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'foundation';