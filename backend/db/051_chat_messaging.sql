-- Chat/Messaging System for Workspaces
-- Supports: direct messages, workspace channels, file attachments, reactions, unsend

CREATE TABLE IF NOT EXISTS chat_conversations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id      UUID REFERENCES workspaces(id) ON DELETE CASCADE, -- NULL = direct message
  type              VARCHAR(20) NOT NULL DEFAULT 'direct', -- 'direct', 'channel', 'group'
  name              VARCHAR(200), -- for channels/groups
  description       TEXT,
  created_by        UUID NOT NULL REFERENCES staff_accounts(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_conversation_members (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id   UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role              VARCHAR(20) DEFAULT 'member', -- 'owner', 'admin', 'member'
  joined_at         TIMESTAMP DEFAULT NOW(),
  last_read_at      TIMESTAMP,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  UNIQUE(conversation_id, employee_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id   UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id         UUID NOT NULL REFERENCES staff_accounts(id),
  content           TEXT,
  message_type      VARCHAR(20) DEFAULT 'text', -- 'text', 'file', 'image', 'system'
  reply_to_id       UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  is_edited         BOOLEAN DEFAULT FALSE,
  is_deleted        BOOLEAN DEFAULT FALSE,
  deleted_at        TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_message_attachments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id        UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  file_name         VARCHAR(255) NOT NULL,
  file_size         BIGINT NOT NULL,
  mime_type         VARCHAR(100) NOT NULL,
  storage_path      VARCHAR(500) NOT NULL,
  thumbnail_path    VARCHAR(500), -- for images
  width             INTEGER, -- for images
  height            INTEGER, -- for images
  duration          INTEGER, -- for audio/video in seconds
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_message_reactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id        UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  emoji             VARCHAR(10) NOT NULL,
  created_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(message_id, employee_id, emoji)
);

CREATE TABLE IF NOT EXISTS chat_message_reads (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id        UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  read_at           TIMESTAMP DEFAULT NOW(),
  UNIQUE(message_id, employee_id)
);

CREATE TABLE IF NOT EXISTS chat_drafts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id   UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  content           TEXT,
  attachment_ids    UUID[],
  updated_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(conversation_id, employee_id)
);

-- Indexes
CREATE INDEX idx_chat_conversations_workspace ON chat_conversations(workspace_id);
CREATE INDEX idx_chat_conversation_members_conv ON chat_conversation_members(conversation_id);
CREATE INDEX idx_chat_conversation_members_emp ON chat_conversation_members(employee_id);
CREATE INDEX idx_chat_messages_conv ON chat_messages(conversation_id, created_at DESC);
CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX idx_chat_message_attachments_msg ON chat_message_attachments(message_id);
CREATE INDEX idx_chat_message_reactions_msg ON chat_message_reactions(message_id);
CREATE INDEX idx_chat_message_reads_msg ON chat_message_reads(message_id);
CREATE INDEX idx_chat_message_reads_emp ON chat_message_reads(employee_id);
CREATE INDEX idx_chat_drafts_conv_emp ON chat_drafts(conversation_id, employee_id);

-- Triggers
CREATE TRIGGER trg_chat_conversations_updated_at BEFORE UPDATE ON chat_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_chat_messages_updated_at BEFORE UPDATE ON chat_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_chat_drafts_updated_at BEFORE UPDATE ON chat_drafts FOR EACH ROW EXECUTE FUNCTION update_updated_at();