-- Add unique constraint for training_progress upsert
ALTER TABLE training_progress 
ADD CONSTRAINT uk_training_progress_assignment_programme 
UNIQUE (assignment_id, programme_id);