-- Add code and tier columns to training_lessons
ALTER TABLE training_lessons ADD COLUMN IF NOT EXISTS code VARCHAR(50);
ALTER TABLE training_lessons ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'foundation';
ALTER TABLE training_lessons ADD COLUMN IF NOT EXISTS total_instructional_hours NUMERIC(6,2);
ALTER TABLE training_lessons ADD COLUMN IF NOT EXISTS total_practical_hours NUMERIC(6,2);
ALTER TABLE training_lessons ADD COLUMN IF NOT EXISTS total_assessment_hours NUMERIC(6,2);
ALTER TABLE training_lessons ADD COLUMN IF NOT EXISTS total_hours NUMERIC(6,2);