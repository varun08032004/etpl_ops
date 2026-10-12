-- Migration: Add unique constraint for journal entry idempotency
-- Run after schema.sql

-- Add unique constraint to prevent duplicate postings of the same business event
-- This ensures idempotency at the database level for source_type + source_id pairs
ALTER TABLE journal_entries
ADD CONSTRAINT uq_journal_entries_source_type_source_id
UNIQUE (source_type, source_id)
WHERE source_type IS NOT NULL AND source_id IS NOT NULL;