-- Add id_photo_url column to employees table for ID card photos
ALTER TABLE employees ADD COLUMN IF NOT EXISTS id_photo_url VARCHAR(500);