-- Fix missing updated_at trigger for training_assessment_attempts
DROP TRIGGER IF EXISTS trg_training_assessment_attempts_updated_at ON training_assessment_attempts;
CREATE TRIGGER trg_training_assessment_attempts_updated_at 
BEFORE UPDATE ON training_assessment_attempts 
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Fix missing employee_id index on training_assignments
CREATE INDEX IF NOT EXISTS idx_training_assignments_employee 
ON training_assignments(employee_id);

-- Also add missing indexes for other tables that might be needed
CREATE INDEX IF NOT EXISTS idx_training_assignments_programme_id ON training_assignments(programme_id);
CREATE INDEX IF NOT EXISTS idx_training_assignments_course_id ON training_assignments(course_id);