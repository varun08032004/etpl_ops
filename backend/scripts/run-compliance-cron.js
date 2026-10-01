#!/usr/bin/env node
// scripts/run-compliance-cron.js
//
// Daily cron job to run compliance reminders and threshold checks.
// Designed to be called by an external scheduler (Render Cron Job, GitHub Actions, etc.)
//
// Usage: node scripts/run-compliance-cron.js
//
// Environment variables required:
// - INTERNAL_OPS_DATABASE_URL (or INTERNAL_OPS_DATABASE_URL)
// - RESEND_API_KEY (for email alerts)
// - RESEND_FROM_EMAIL
// - INTERNAL_OPS_JWT_SECRET (for auth if needed)
// - INTERNAL_OPS_ALLOWED_ORIGIN

require('dotenv').config();
// Using native fetch (Node 18+)

const API_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3001';
const CRON_SECRET = process.env.COMPLIANCE_CRON_SECRET; // Optional shared secret for auth

async function callEndpoint(path, method = 'POST', body = {}) {
  const url = `${API_BASE_URL}/api/v1${path}`;
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (CRON_SECRET) {
    headers['X-Cron-Secret'] = CRON_SECRET;
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: method !== 'GET' ? JSON.stringify(body) : undefined,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
    }
    
    return data;
  } catch (error) {
    console.error(`[cron] ${path} failed:`, error.message);
    throw error;
  }
}

async function runComplianceCron() {
  console.log('[cron] Starting compliance daily job...');
  const startTime = Date.now();
  
  try {
    // 1. Run compliance reminders (sends due_soon and escalated events)
    console.log('[cron] Running compliance reminders...');
    const remindersResult = await callEndpoint('/compliance/run-reminders');
    console.log('[cron] Reminders result:', JSON.stringify(remindersResult));
    
    // 2. Check compliance thresholds (for one-time registrations like EPFO, ESIC, GST, PT)
    console.log('[cron] Checking compliance thresholds...');
    const thresholdsResult = await callEndpoint('/one-time-registrations/check-thresholds');
    console.log('[cron] Thresholds result:', JSON.stringify(thresholdsResult));
    
    // 3. Run data governance retention scan (optional, same schedule)
    console.log('[cron] Running data governance scan...');
    try {
      const scanResult = await callEndpoint('/data-governance/scan');
      console.log('[cron] Data governance scan result:', JSON.stringify(scanResult));
    } catch (e) {
      console.warn('[cron] Data governance scan failed (may not be configured):', e.message);
    }
    
    const duration = Date.now() - startTime;
    console.log(`[cron] Compliance daily job completed in ${duration}ms`);
    
    return {
      success: true,
      reminders: remindersResult,
      thresholds: thresholdsResult,
      durationMs: duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[cron] Compliance daily job failed after ${duration}ms:`, error.message);
    return {
      success: false,
      error: error.message,
      durationMs: duration,
    };
  }
}

// Run if called directly
if (require.main === module) {
  runComplianceCron()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('[cron] Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { runComplianceCron };