-- Seed automation rules for compliance alerts
-- Run this after the base schema and automation_rules table exist

DO $$
DECLARE
  owner_id UUID;
BEGIN
  SELECT id INTO owner_id FROM staff_accounts WHERE role = 'owner' LIMIT 1;
  
  IF owner_id IS NULL THEN
    RAISE NOTICE 'No owner account found, skipping automation rules seed';
    RETURN;
  END IF;

  -- Compliance Due Soon - Email Alert
  IF NOT EXISTS (
    SELECT 1 FROM automation_rules 
    WHERE name = 'Compliance Due Soon - Email Alert' 
    AND trigger_event = 'compliance_item.due_soon'
  ) THEN
    INSERT INTO automation_rules (name, trigger_event, condition, actions, is_active, created_by)
    VALUES (
      'Compliance Due Soon - Email Alert',
      'compliance_item.due_soon',
      NULL,
      '{
        "action_type": "send_email",
        "config": {
          "to_template": "admin@ethertrack.in",
          "subject": "⚠ Compliance Due Soon: {{title}} ({{days_until_due}} days)",
          "body_template": "Compliance filing \"{{title}}\" ({{category}}) is due on {{due_date}}.\n\nDays until due: {{days_until_due}}\nOwner: {{owner_name}}\n\nPlease take action: {{link}}"
        }
      }'::jsonb,
      TRUE,
      owner_id
    );
    RAISE NOTICE 'Inserted Compliance Due Soon automation rule';
  ELSE
    RAISE NOTICE 'Compliance Due Soon automation rule already exists';
  END IF;

  -- Compliance Escalated - Email Alert
  IF NOT EXISTS (
    SELECT 1 FROM automation_rules 
    WHERE name = 'Compliance Escalated - Email Alert' 
    AND trigger_event = 'compliance_item.escalated'
  ) THEN
    INSERT INTO automation_rules (name, trigger_event, condition, actions, is_active, created_by)
    VALUES (
      'Compliance Escalated - Email Alert',
      'compliance_item.escalated',
      NULL,
      '{
        "action_type": "send_email",
        "config": {
          "to_template": "admin@ethertrack.in",
          "subject": "🚨 COMPLIANCE ESCALATED: {{title}}",
          "body_template": "URGENT: Compliance filing \"{{title}}\" ({{category}}) was due on {{due_date}} and has not been filed.\n\nOwner: {{owner_name}}\nStatus: No action taken after final reminder.\n\nImmediate attention required: {{link}}"
        }
      }'::jsonb,
      TRUE,
      owner_id
    );
    RAISE NOTICE 'Inserted Compliance Escalated automation rule';
  ELSE
    RAISE NOTICE 'Compliance Escalated automation rule already exists';
  END IF;
END $$;