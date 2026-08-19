-- AI Tool Execution Log
CREATE TABLE IF NOT EXISTS ai_tool_execution_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id          UUID NOT NULL REFERENCES staff_accounts(id),
  tool_name         VARCHAR(100) NOT NULL,
  parameters        JSONB NOT NULL,
  result_summary    JSONB,
  success           BOOLEAN NOT NULL,
  error_message     TEXT,
  confirmation_required BOOLEAN DEFAULT FALSE,
  confirmed_by      UUID REFERENCES staff_accounts(id),
  confirmed_at      TIMESTAMP,
  latency_ms        INTEGER,
  executed_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_log_staff ON ai_tool_execution_log(staff_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tool_log_tool ON ai_tool_execution_log(tool_name, executed_at DESC);

-- Extend ai_chat_log with new columns
ALTER TABLE ai_chat_log ADD COLUMN IF NOT EXISTS intent VARCHAR(50);
ALTER TABLE ai_chat_log ADD COLUMN IF NOT EXISTS tools_executed JSONB;