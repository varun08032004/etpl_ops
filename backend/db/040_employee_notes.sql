-- Employee Notes - Personal notes for each employee
CREATE TABLE IF NOT EXISTS employee_notes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title             VARCHAR(255) NOT NULL,
  content           TEXT,
  is_pinned         BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_employee_notes_employee ON employee_notes(employee_id);
CREATE INDEX idx_employee_notes_pinned ON employee_notes(employee_id, is_pinned) WHERE is_pinned = TRUE;

-- Trigger for updated_at
CREATE TRIGGER trg_employee_notes_updated_at
  BEFORE UPDATE ON employee_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();