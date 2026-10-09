'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateBody, schemas } = require('../middleware/validation');
const { z } = require('zod');
const storage = require('../services/storage');

router.use(authenticate);

const createConversationSchema = z.object({
  workspace_id: schemas.uuid.optional().nullable(),
  type: z.enum(['direct', 'channel', 'group']).default('direct'),
  name: z.string().max(200).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  member_ids: z.array(schemas.uuid).min(1),
});

const sendMessageSchema = z.object({
  conversation_id: schemas.uuid,
  content: z.string().max(10000).optional().nullable(),
  message_type: z.enum(['text', 'file', 'image']).default('text'),
  reply_to_id: schemas.uuid.optional().nullable(),
  attachment_ids: z.array(schemas.uuid).optional(),
});

const updateMessageSchema = z.object({
  content: z.string().max(10000),
});

const reactSchema = z.object({
  emoji: z.string().max(10),
});

// Get my conversations
router.get('/conversations', async (req, res) => {
  try {
    if (!req.staff.employee_id) {
      return res.json({ conversations: [] });
    }

    const { rows } = await safeQuery(
      `SELECT 
         cc.*, 
         ccm.role AS my_role,
         ccm.last_read_at,
         ccm.notifications_enabled,
         (
           SELECT json_build_object(
             'id', cm.id,
             'content', cm.content,
             'message_type', cm.message_type,
             'sender_id', cm.sender_id,
             'sender_name', e.full_name,
             'created_at', cm.created_at,
             'is_deleted', cm.is_deleted,
             'attachments', (
               SELECT json_agg(json_build_object(
                 'id', cma.id,
                 'file_name', cma.file_name,
                 'mime_type', cma.mime_type,
                 'file_size', cma.file_size,
                 'thumbnail_path', cma.thumbnail_path,
                 'width', cma.width,
                 'height', cma.height
               ))
               FROM chat_message_attachments cma WHERE cma.message_id = cm.id
             ),
             'reactions', (
               SELECT json_agg(json_build_object(
                 'emoji', cmr.emoji,
                 'count', cmr.cnt,
                 'me', cmr.me
               ))
               FROM (
                 SELECT emoji, COUNT(*) AS cnt,
                   BOOL_OR(employee_id = $1) AS me
                 FROM chat_message_reactions
                 WHERE message_id = cm.id
                 GROUP BY emoji
               ) cmr
             )
           )
           FROM chat_messages cm
           JOIN employees e ON e.id = (SELECT employee_id FROM staff_accounts WHERE id = cm.sender_id)
           WHERE cm.conversation_id = cc.id AND cm.is_deleted = FALSE
           ORDER BY cm.created_at DESC
           LIMIT 1
         ) AS last_message,
         (
           SELECT COUNT(*)
           FROM chat_messages cm2
           WHERE cm2.conversation_id = cc.id
             AND cm2.is_deleted = FALSE
             AND cm2.created_at > COALESCE(ccm.last_read_at, '1970-01-01')
             AND cm2.sender_id != (SELECT id FROM staff_accounts WHERE employee_id = $1)
         ) AS unread_count
       FROM chat_conversations cc
       JOIN chat_conversation_members ccm ON ccm.conversation_id = cc.id
       WHERE ccm.employee_id = $1
       ORDER BY 
         COALESCE((
           SELECT MAX(created_at) FROM chat_messages WHERE conversation_id = cc.id
         ), cc.created_at) DESC`,
      [req.staff.employee_id]
    );

    res.json({ conversations: rows });
  } catch (err) {
    console.error('[chat:conversations]', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get or create direct conversation
router.post('/conversations/direct', async (req, res) => {
  try {
    if (!req.staff.employee_id) {
      return res.status(400).json({ error: 'Employee record required' });
    }
    const { other_employee_id } = req.body;
    if (!other_employee_id) return res.status(400).json({ error: 'other_employee_id required' });
    if (other_employee_id === req.staff.employee_id) return res.status(400).json({ error: 'Cannot create conversation with yourself' });

    // Check if direct conversation already exists
    const { rows: [existing] } = await safeQuery(
      `SELECT cc.* FROM chat_conversations cc
       JOIN chat_conversation_members ccm1 ON ccm1.conversation_id = cc.id AND ccm1.employee_id = $1
       JOIN chat_conversation_members ccm2 ON ccm2.conversation_id = cc.id AND ccm2.employee_id = $2
       WHERE cc.type = 'direct'
       GROUP BY cc.id
       HAVING COUNT(*) = 2`,
      [req.staff.employee_id, other_employee_id]
    );

    if (existing) {
      return res.json({ conversation: existing, created: false });
    }

    const result = await withTransaction(async (client) => {
      const { rows: [conv] } = await client.query(
        `INSERT INTO chat_conversations (type, created_by) VALUES ('direct', $1) RETURNING *`,
        [req.staff.id]
      );
      await client.query(
        `INSERT INTO chat_conversation_members (conversation_id, employee_id, role) VALUES ($1,$2,'member'), ($1,$3,'member')`,
        [conv.id, req.staff.employee_id, other_employee_id]
      );
      return conv;
    });
    res.status(201).json({ conversation: result, created: true });
  } catch (err) {
    console.error('[chat:direct]', err);
    res.status(500).json({ error: 'Failed to create direct conversation' });
  }
});

// Create conversation (channel/group)
router.post('/conversations', async (req, res) => {
  try {
    if (!req.staff.employee_id) return res.status(400).json({ error: 'Employee record required' });

    const { workspace_id, type, name, description, member_ids } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    if (!member_ids?.length) return res.status(400).json({ error: 'At least one member required' });

    const result = await withTransaction(async (client) => {
      const { rows: [conv] } = await client.query(
        `INSERT INTO chat_conversations (workspace_id, type, name, description, created_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [workspace_id || null, type, name.trim(), description || null, req.staff.id]
      );
      const members = [...new Set([req.staff.employee_id, ...member_ids])];
      for (const empId of members) {
        await client.query(
          `INSERT INTO chat_conversation_members (conversation_id, employee_id, role)
           VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [conv.id, empId, empId === req.staff.employee_id ? 'owner' : 'member']
        );
      }
      return conv;
    });
    res.status(201).json({ conversation: result });
  } catch (err) {
    console.error('[chat:create]', err);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Get conversation with messages
router.get('/conversations/:id', async (req, res) => {
  try {
    if (!req.staff.employee_id) return res.status(403).json({ error: 'Employee record required' });

    const { rows: [conv] } = await safeQuery(
      `SELECT cc.*, ccm.role AS my_role, ccm.last_read_at
       FROM chat_conversations cc
       JOIN chat_conversation_members ccm ON ccm.conversation_id = cc.id
       WHERE cc.id = $1 AND ccm.employee_id = $2`,
      [req.params.id, req.staff.employee_id]
    );
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    const { limit = 50, before } = req.query;
    let where = `WHERE cm.conversation_id = $1 AND cm.is_deleted = FALSE`;
    const params = [req.params.id];
    if (before) {
      params.push(before);
      where += ` AND cm.created_at < $${params.length}`;
    }

    const { rows: messages } = await safeQuery(
      `SELECT cm.*, 
              e.full_name AS sender_name, e.employee_code AS sender_code,
              sa.email AS sender_email,
              (
                SELECT json_agg(json_build_object(
                  'id', cma.id,
                  'file_name', cma.file_name,
                  'mime_type', cma.mime_type,
                  'file_size', cma.file_size,
                  'thumbnail_path', cma.thumbnail_path,
                  'width', cma.width,
                  'height', cma.height,
                  'duration', cma.duration
                ))
                FROM chat_message_attachments cma WHERE cma.message_id = cm.id
              ) AS attachments,
              (
                SELECT json_agg(json_build_object(
                  'emoji', cmr.emoji,
                  'count', cmr.cnt,
                  'me', cmr.me
                ))
                FROM (
                  SELECT emoji, COUNT(*) AS cnt,
                    BOOL_OR(employee_id = $2) AS me
                  FROM chat_message_reactions
                  WHERE message_id = cm.id
                  GROUP BY emoji
                ) cmr
              ) AS reactions,
              (
                SELECT COUNT(*) FROM chat_message_reads cmr2
                WHERE cmr2.message_id = cm.id
              ) AS read_count
       FROM chat_messages cm
       JOIN staff_accounts sa ON sa.id = cm.sender_id
       JOIN employees e ON e.id = sa.employee_id
       WHERE ${where}
       ORDER BY cm.created_at DESC
       LIMIT $${params.length + 1}`,
      [...params, Number(limit)]
    );

    // Mark as read
    await safeQuery(
      `UPDATE chat_conversation_members SET last_read_at = NOW() 
       WHERE conversation_id = $1 AND employee_id = $2`,
      [req.params.id, req.staff.employee_id]
    );

    res.json({ conversation: conv, messages: messages.reverse() });
  } catch (err) {
    console.error('[chat:get]', err);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// Send message
router.post('/messages', async (req, res) => {
  try {
    if (!req.staff.employee_id) return res.status(403).json({ error: 'Employee record required' });

    const { conversation_id, content, message_type, reply_to_id, attachment_ids } = req.body;
    if (!conversation_id) return res.status(400).json({ error: 'conversation_id required' });

    // Verify membership
    const { rows: [member] } = await safeQuery(
      `SELECT 1 FROM chat_conversation_members WHERE conversation_id = $1 AND employee_id = $2`,
      [conversation_id, req.staff.employee_id]
    );
    if (!member) return res.status(403).json({ error: 'Not a member of this conversation' });

    const result = await withTransaction(async (client) => {
      const { rows: [message] } = await client.query(
        `INSERT INTO chat_messages (conversation_id, sender_id, content, message_type, reply_to_id)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [conversation_id, req.staff.id, content || null, message_type, reply_to_id || null]
      );

      if (attachment_ids?.length) {
        for (const aid of attachment_ids) {
          await client.query(
            `UPDATE chat_message_attachments SET message_id = $1 WHERE id = $2`,
            [message.id, aid]
          );
        }
      }

      // Clear draft
      await client.query(
        `DELETE FROM chat_drafts WHERE conversation_id = $1 AND employee_id = $2`,
        [conversation_id, req.staff.employee_id]
      );

      return message;
    });

    const { rows: [message] } = await safeQuery(
      `SELECT cm.*, e.full_name AS sender_name, e.employee_code AS sender_code
       FROM chat_messages cm
       JOIN staff_accounts sa ON sa.id = cm.sender_id
       JOIN employees e ON e.id = sa.employee_id
       WHERE cm.id = $1`, [result.id]
    );

    res.status(201).json({ message });
  } catch (err) {
    console.error('[chat:send]', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Edit message
router.put('/messages/:id', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });

    const { rows } = await safeQuery(
      `UPDATE chat_messages SET content = $1, is_edited = TRUE, updated_at = NOW()
       WHERE id = $1 AND sender_id = (SELECT id FROM staff_accounts WHERE employee_id = $2)
       RETURNING *`,
      [content.trim(), req.staff.employee_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Message not found or not yours' });
    res.json({ message: rows[0] });
  } catch (err) {
    console.error('[chat:edit]', err);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// Delete/Unsend message
router.delete('/messages/:id', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `UPDATE chat_messages SET is_deleted = TRUE, deleted_at = NOW(), content = '[Message unsent]'
       WHERE id = $1 AND sender_id = (SELECT id FROM staff_accounts WHERE employee_id = $2)
       RETURNING *`,
      [req.params.id, req.staff.employee_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Message not found or not yours' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[chat:delete]', err);
    res.status(500).json({ error: 'Failed to unsend message' });
  }
});

// React to message
router.post('/messages/:id/reactions', validateBody(reactSchema), async (req, res) => {
  try {
    const { emoji } = req.body;
    const { rows: [reaction] } = await safeQuery(
      `INSERT INTO chat_message_reactions (message_id, employee_id, emoji)
       VALUES ($1,$2,$3)
       ON CONFLICT (message_id, employee_id, emoji) DO NOTHING
       RETURNING *`,
      [req.params.id, req.staff.employee_id, emoji]
    );
    if (!reaction) return res.status(409).json({ error: 'Already reacted with this emoji' });
    res.status(201).json({ reaction });
  } catch (err) {
    console.error('[chat:react]', err);
    res.status(500).json({ error: 'Failed to react' });
  }
});

// Remove reaction
router.delete('/messages/:id/reactions/:emoji', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `DELETE FROM chat_message_reactions WHERE message_id = $1 AND employee_id = $2 AND emoji = $3 RETURNING *`,
      [req.params.id, req.staff.employee_id, req.params.emoji]
    );
    if (!rows.length) return res.status(404).json({ error: 'Reaction not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[chat:unreact]', err);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

// Upload attachment (returns attachment record, message created separately)
router.post('/attachments', async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const file = req.files.file;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ error: 'File type not allowed' });
    }

    const ext = file.name.split('.').pop();
    const storagePath = `chat/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;
    await storage.uploadFile(storagePath, file.data, file.mimetype);

    let thumbnailPath = null;
    let width = null, height = null;
    if (file.mimetype.startsWith('image/')) {
      // In production, generate thumbnail here
      thumbnailPath = storagePath;
    }

    const { rows: [attachment] } = await safeQuery(
      `INSERT INTO chat_message_attachments (message_id, file_name, file_size, mime_type, storage_path, thumbnail_path, width, height)
       VALUES (NULL, $1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [file.name, file.size, file.mimetype, storagePath, thumbnailPath, width, height]
    );
    res.status(201).json({ attachment });
  } catch (err) {
    console.error('[chat:upload]', err);
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
});

// Get attachment download URL
router.get('/attachments/:id/download', async (req, res) => {
  try {
    const { rows: [attachment] } = await safeQuery(
      `SELECT * FROM chat_message_attachments WHERE id = $1`, [req.params.id]
    );
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

    // Verify access via message -> conversation -> membership
    const { rows: [msg] } = await safeQuery(
      `SELECT cma.id FROM chat_message_attachments cma
       JOIN chat_messages cm ON cm.id = cma.message_id
       JOIN chat_conversation_members ccm ON ccm.conversation_id = cm.conversation_id
       WHERE cma.id = $1 AND ccm.employee_id = $2`,
      [req.params.id, req.staff.employee_id]
    );
    if (!msg) return res.status(403).json({ error: 'Access denied' });

    const fileBuffer = await storage.downloadFile(attachment.storage_path);
    res.setHeader('Content-Type', attachment.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${attachment.file_name}"`);
    res.send(fileBuffer);
  } catch (err) {
    console.error('[chat:download]', err);
    res.status(500).json({ error: 'Failed to download' });
  }
});

// Save draft
router.put('/conversations/:id/draft', async (req, res) => {
  try {
    const { content, attachment_ids } = req.body;
    const { rows: [draft] } = await safeQuery(
      `INSERT INTO chat_drafts (conversation_id, employee_id, content, attachment_ids)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (conversation_id, employee_id) DO UPDATE SET
         content = EXCLUDED.content,
         attachment_ids = EXCLUDED.attachment_ids,
         updated_at = NOW()
       RETURNING *`,
      [req.params.id, req.staff.employee_id, content || null, attachment_ids || null]
    );
    res.json({ draft });
  } catch (err) {
    console.error('[chat:draft]', err);
    res.status(500).json({ error: 'Failed to save draft' });
  }
});

// Get draft
router.get('/conversations/:id/draft', async (req, res) => {
  try {
    const { rows: [draft] } = await safeQuery(
      `SELECT * FROM chat_drafts WHERE conversation_id = $1 AND employee_id = $2`,
      [req.params.id, req.staff.employee_id]
    );
    res.json({ draft: draft || null });
  } catch (err) {
    console.error('[chat:draft:get]', err);
    res.status(500).json({ error: 'Failed to fetch draft' });
  }
});

// Add members to conversation
router.post('/conversations/:id/members', async (req, res) => {
  try {
    const { employee_ids, role } = req.body;
    if (!employee_ids?.length) return res.status(400).json({ error: 'employee_ids required' });

    const { rows: [myRole] } = await safeQuery(
      `SELECT role FROM chat_conversation_members WHERE conversation_id = $1 AND employee_id = $2`,
      [req.params.id, req.staff.employee_id]
    );
    if (!myRole || !['owner', 'admin'].includes(myRole.role)) {
      return res.status(403).json({ error: 'Only owners/admins can add members' });
    }

    const added = [];
    for (const empId of employee_ids) {
      const { rows } = await safeQuery(
        `INSERT INTO chat_conversation_members (conversation_id, employee_id, role)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING *`,
        [req.params.id, empId, role || 'member']
      );
      if (rows.length) added.push(rows[0]);
    }
    res.json({ added });
  } catch (err) {
    console.error('[chat:add-members]', err);
    res.status(500).json({ error: 'Failed to add members' });
  }
});

// Remove member
router.delete('/conversations/:id/members/:employeeId', async (req, res) => {
  try {
    const { rows: [myRole] } = await safeQuery(
      `SELECT role FROM chat_conversation_members WHERE conversation_id = $1 AND employee_id = $2`,
      [req.params.id, req.staff.employee_id]
    );
    if (!myRole || myRole.role !== 'owner') {
      return res.status(403).json({ error: 'Only owner can remove members' });
    }

    const { rows } = await safeQuery(
      `DELETE FROM chat_conversation_members WHERE conversation_id = $1 AND employee_id = $2 RETURNING *`,
      [req.params.id, req.params.employeeId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Member not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[chat:remove-member]', err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Leave conversation
router.post('/conversations/:id/leave', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `DELETE FROM chat_conversation_members WHERE conversation_id = $1 AND employee_id = $2 RETURNING *`,
      [req.params.id, req.staff.employee_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not a member' });
    res.json({ left: true });
  } catch (err) {
    console.error('[chat:leave]', err);
    res.status(500).json({ error: 'Failed to leave conversation' });
  }
});

module.exports = router;