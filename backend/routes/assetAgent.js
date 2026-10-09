'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAction } = require('../services/auditLog');

router.use(authenticate);

// Get all assets with agent status for admin monitoring
router.get('/admin/asset-agent-status', requireRole('hr', 'admin', 'owner'), async (req, res) => {
  try {
    const { employee_id, status, asset_type, page = 1, limit = 50 } = req.query;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (employee_id) {
      conditions.push(`e.id = $${paramIndex++}`);
      params.push(employee_id);
    }
    if (status) {
      conditions.push(`agent_current_status = $${paramIndex++}`);
      params.push(status);
    }
    if (asset_type) {
      conditions.push(`a.asset_type = $${paramIndex++}`);
      params.push(asset_type);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const { rows } = await safeQuery(
      `SELECT * FROM employee_asset_agent_status ${whereClause} ORDER BY full_name, asset_tag LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    // Get total count
    const { rows: [{ total }] } = await safeQuery(
      `SELECT COUNT(*)::int as total FROM employee_asset_agent_status ${whereClause}`,
      params.slice(0, -2)
    );

    res.json({ 
      assets: rows, 
      pagination: { page: Number(page), limit: Number(limit), total } 
    });
  } catch (err) {
    console.error('[assetAgent:admin:asset-agent-status]', err);
    res.status(500).json({ error: 'Failed to load asset agent status' });
  }
});

// Get current user's asset agent status (for profile page - "me")
router.get('/employee/me/asset-agent-status', async (req, res) => {
  try {
    if (!req.staff.employee_id) {
      return res.status(400).json({ error: 'Current user not linked to employee record' });
    }
    const { rows } = await safeQuery(
      `SELECT * FROM employee_asset_agent_status WHERE employee_id = $1 ORDER BY assigned_at DESC`,
      [req.staff.employee_id]
    );
    res.json({ assets: rows });
  } catch (err) {
    console.error('[assetAgent:employee:asset-agent-status:me]', err);
    res.status(500).json({ error: 'Failed to load employee asset agent status' });
  }
});

// Get single employee's asset agent status (for profile page)
router.get('/employee/:employeeId/asset-agent-status', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const isSelf = req.staff.employee_id === employeeId;
    const canViewAll = ['owner', 'admin', 'hr', 'manager'].includes(req.staff.role);
    
    if (!isSelf && !canViewAll) {
      return res.status(403).json({ error: 'Not authorized to view this employee\'s assets' });
    }

    const { rows } = await safeQuery(
      `SELECT * FROM employee_asset_agent_status WHERE employee_id = $1 ORDER BY assigned_at DESC`,
      [employeeId]
    );

    res.json({ assets: rows });
  } catch (err) {
    console.error('[assetAgent:employee:asset-agent-status]', err);
    res.status(500).json({ error: 'Failed to load employee asset agent status' });
  }
});

// Link agent device to asset (admin only)
router.post('/admin/assets/:assetId/link-agent', requireRole('hr', 'admin', 'owner'), async (req, res) => {
  try {
    const { assetId } = req.params;
    const { agent_device_id } = req.body;
    
    if (!agent_device_id) {
      return res.status(400).json({ error: 'agent_device_id required' });
    }

    // Verify agent device exists and is active
    const { rows: [device] } = await safeQuery(
      `SELECT * FROM agent_devices WHERE id = $1 AND status = 'active'`,
      [agent_device_id]
    );
    if (!device) {
      return res.status(404).json({ error: 'Agent device not found or not active' });
    }

    // Verify asset exists
    const { rows: [asset] } = await safeQuery(
      `SELECT * FROM assets WHERE id = $1`,
      [assetId]
    );
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Check if agent device already linked to another asset
    const { rows: [existing] } = await safeQuery(
      `SELECT id, asset_tag FROM assets WHERE agent_device_id = $1 AND id != $2`,
      [agent_device_id, assetId]
    );
    if (existing) {
      return res.status(400).json({ error: `Agent device already linked to asset ${existing.asset_tag}` });
    }

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE assets SET agent_device_id = $1, updated_at = NOW() WHERE id = $2`,
        [agent_device_id, assetId]
      );
      
      // Also update agent_devices with asset reference
      await client.query(
        `UPDATE agent_devices SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{asset_id}', $1) WHERE id = $2`,
        [JSON.stringify(assetId), agent_device_id]
      );

      await logAction({ 
        staffId: req.staff.id, 
        action: 'asset.agent.link', 
        entity: 'assets', 
        entityId: assetId, 
        newValue: { agent_device_id },
        ipAddress: req.ip 
      });
    });

    res.json({ ok: true, message: 'Agent device linked to asset' });
  } catch (err) {
    console.error('[assetAgent:admin:link-agent]', err);
    res.status(500).json({ error: 'Failed to link agent device' });
  }
});

// Unlink agent device from asset (admin only)
router.post('/admin/assets/:assetId/unlink-agent', requireRole('hr', 'admin', 'owner'), async (req, res) => {
  try {
    const { assetId } = req.params;

    await withTransaction(async (client) => {
      const { rows: [asset] } = await client.query(
        `SELECT agent_device_id FROM assets WHERE id = $1`,
        [assetId]
      );
      
      if (!asset?.agent_device_id) {
        return res.status(400).json({ error: 'Asset has no linked agent device' });
      }

      await client.query(
        `UPDATE assets SET agent_device_id = NULL, updated_at = NOW() WHERE id = $1`,
        [assetId]
      );

      await logAction({ 
        staffId: req.staff.id, 
        action: 'asset.agent.unlink', 
        entity: 'assets', 
        entityId: assetId, 
        ipAddress: req.ip 
      });
    });

    res.json({ ok: true, message: 'Agent device unlinked from asset' });
  } catch (err) {
    console.error('[assetAgent:admin:unlink-agent]', err);
    res.status(500).json({ error: 'Failed to unlink agent device' });
  }
});

// Get agent device status history
router.get('/admin/agent-status-history', requireRole('hr', 'admin', 'owner'), async (req, res) => {
  try {
    const { agent_device_id, employee_id, asset_id, from, to, limit = 100 } = req.query;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (agent_device_id) {
      conditions.push(`ash.agent_device_id = $${paramIndex++}`);
      params.push(agent_device_id);
    }
    if (employee_id) {
      conditions.push(`ash.employee_id = $${paramIndex++}`);
      params.push(employee_id);
    }
    if (asset_id) {
      conditions.push(`ash.asset_id = $${paramIndex++}`);
      params.push(asset_id);
    }
    if (from) {
      conditions.push(`ash.changed_at >= $${paramIndex++}`);
      params.push(from);
    }
    if (to) {
      conditions.push(`ash.changed_at <= $${paramIndex++}`);
      params.push(to);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);

    const { rows } = await safeQuery(
      `SELECT ash.*, sa.email as changed_by_email, e.full_name as employee_name, a.asset_tag
       FROM agent_status_history ash
       LEFT JOIN staff_accounts sa ON sa.id = ash.changed_by
       LEFT JOIN employees e ON e.id = ash.employee_id
       LEFT JOIN assets a ON a.id = ash.asset_id
       ${whereClause}
       ORDER BY ash.changed_at DESC
       LIMIT $${paramIndex}`,
      params
    );

    res.json({ history: rows });
  } catch (err) {
    console.error('[assetAgent:admin:status-history]', err);
    res.status(500).json({ error: 'Failed to load agent status history' });
  }
});

// Get agent download info (for employee profile)
router.get('/agent-download-info', async (req, res) => {
  try {
    // Return agent download URL and setup info
    const baseUrl = process.env.AGENT_DOWNLOAD_URL || 'https://your-domain.com/agent/download';
    
    res.json({
      download_url: baseUrl,
      company_code: process.env.AGENT_COMPANY_CODE || 'ETPL',
      api_base_url: process.env.ETHERTRACK_API_BASE_URL || 'https://api.yourdomain.com',
      version: '1.0.0', // Could be dynamic from package.json
      instructions: 'Download the installer, run as Administrator. Enter your company email/password and the company code above.'
    });
  } catch (err) {
    console.error('[assetAgent:agent-download-info]', err);
    res.status(500).json({ error: 'Failed to get agent download info' });
  }
});

// Proxy endpoint to download agent installer (bypasses CORS)
router.get('/agent-download', async (req, res) => {
  try {
    const downloadUrl = process.env.AGENT_DOWNLOAD_URL || 'https://your-domain.com/agent/download';
    
    if (!downloadUrl || downloadUrl === 'https://your-domain.com/agent/download') {
      return res.status(400).json({ error: 'Agent download URL not configured' });
    }

    const response = await fetch(downloadUrl);
    
    if (!response.ok) {
      return res.status(404).json({ error: 'Failed to fetch installer from source' });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="EtherTrack-Agent-Setup.exe"');
    
    // Stream the response
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (err) {
    console.error('[assetAgent:agent-download]', err);
    res.status(500).json({ error: 'Failed to download installer' });
  }
});

module.exports = router;