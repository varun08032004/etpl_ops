// ─────────────────────────────────────────────────────────────────────────
// services/automationEngine.js
//
// Deliberately simple: fireEvent(eventName, payload) looks up active rules
// matching that trigger and executes their configured action. This is NOT
// a workflow builder — no branching, no multi-step chains, no UI for
// building new trigger/action combos beyond what's coded here. Real
// "Automation Engine" (Section 11 of the SRS) is Phase 2+ scope.
// ─────────────────────────────────────────────────────────────────────────
'use strict';

const { safeQuery } = require('../db/pool');
const emailService = require('./emailService');

function renderTemplate(template, payload) {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => (payload[key] !== undefined ? payload[key] : `{{${key}}}`));
}

async function runAction(rule, payload) {
  switch (rule.action_type) {
    case 'create_notification': {
      const { target_role, target_staff_id, title, body_template } = rule.config;
      await safeQuery(
        `INSERT INTO notifications (target_role, target_staff_id, title, body, link, source_event)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [target_role || null, target_staff_id || null, title || rule.name,
         renderTemplate(body_template, payload), payload.link || null, rule.trigger_event]
      );
      break;
    }
    case 'create_onboarding_checklist': {
      const items = rule.config.items || [];
      if (!payload.employeeId) break;
      for (const item of items) {
        await safeQuery(
          `INSERT INTO onboarding_checklist_items (employee_id, title) VALUES ($1,$2)`,
          [payload.employeeId, item]
        );
      }
      break;
    }
    case 'send_email': {
      const { target_roles, to_template, subject, body_template } = rule.config;

      let recipients = [];
      if (target_roles?.length) {
        const { rows } = await safeQuery(
          `SELECT email FROM staff_accounts WHERE role = ANY($1) AND is_active = true`,
          [target_roles]
        );
        recipients = rows.map((r) => r.email);
      } else if (to_template) {
        const resolved = renderTemplate(to_template, payload);
        if (resolved && !resolved.includes('{{')) recipients = [resolved];
      }

      if (!recipients.length) {
        console.warn(`[automation:send_email] rule "${rule.name}" resolved to zero recipients — check target_roles/to_template in its config`);
        break;
      }

      try {
        await emailService.sendMail({
          to: recipients.join(','),
          subject: renderTemplate(subject, payload),
          text: renderTemplate(body_template, payload),
        });
      } catch (err) {
        // emailService itself falls back to a console-logged stub when unconfigured,
        // so an error here means something actually went wrong sending, not just "no SMTP set up".
        console.error(`[automation:send_email] rule "${rule.name}" failed to send:`, err.message);
      }
      break;
    }
    default:
      console.warn('[automation] unknown action_type', rule.action_type);
  }
}

/**
 * Fires all active rules matching an event. Never throws — automation
 * failures should never break the primary action that triggered them
 * (e.g. a broken notification rule must not prevent an employee from
 * actually being created).
 */
async function fireEvent(eventName, payload = {}) {
  try {
    const { rows: rules } = await safeQuery(
      `SELECT * FROM automation_rules WHERE trigger_event = $1 AND is_active = true`,
      [eventName]
    );
    for (const rule of rules) {
      try {
        await runAction(rule, payload);
      } catch (err) {
        console.error(`[automation] rule "${rule.name}" failed for event ${eventName}:`, err.message);
      }
    }
  } catch (err) {
    console.error(`[automation] fireEvent(${eventName}) failed:`, err.message);
  }
}

module.exports = { fireEvent };