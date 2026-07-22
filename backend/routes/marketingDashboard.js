'use strict';
// routes/marketingDashboard.js — read-only aggregate over every marketing
// table, for the Dashboard overview page. No writes here.

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/summary', async (req, res) => {
  try {
    const [
      social, campaigns, content, leads, events, press, newsletter, seo,
    ] = await Promise.all([
      safeQuery(`SELECT COUNT(*)::int AS accounts, COALESCE(SUM(followers_count),0)::int AS followers FROM marketing_social_accounts WHERE status = 'active'`),
      safeQuery(`SELECT COUNT(*) FILTER (WHERE status = 'active')::int AS active_count,
                        COALESCE(SUM(budget) FILTER (WHERE status IN ('active','planned')),0)::float AS active_budget,
                        COALESCE(SUM(amount_spent),0)::float AS total_spent,
                        COALESCE(SUM(leads_generated),0)::int AS total_leads
                 FROM marketing_campaigns`),
      safeQuery(`SELECT COUNT(*) FILTER (WHERE status IN ('draft','scheduled') AND scheduled_date >= CURRENT_DATE)::int AS upcoming,
                        COUNT(*) FILTER (WHERE status = 'idea')::int AS ideas
                 FROM marketing_content_calendar`),
      safeQuery(`SELECT COUNT(*) FILTER (WHERE status = 'new')::int AS new_leads,
                        COUNT(*) FILTER (WHERE status = 'converted')::int AS converted,
                        COUNT(*)::int AS total
                 FROM marketing_leads`),
      safeQuery(`SELECT COUNT(*) FILTER (WHERE start_date >= CURRENT_DATE AND status IN ('planned','confirmed'))::int AS upcoming
                 FROM marketing_events`),
      safeQuery(`SELECT COUNT(*)::int AS total FROM marketing_press_mentions WHERE published_date >= CURRENT_DATE - INTERVAL '90 days'`),
      safeQuery(`SELECT subscriber_count, snapshot_date FROM marketing_newsletter_snapshots ORDER BY snapshot_date DESC LIMIT 1`),
      safeQuery(`SELECT organic_traffic, snapshot_date FROM marketing_seo_snapshots ORDER BY snapshot_date DESC LIMIT 1`),
    ]);

    const { rows: upcomingContent } = await safeQuery(
      `SELECT id, title, platform, scheduled_date, status FROM marketing_content_calendar
       WHERE scheduled_date >= CURRENT_DATE AND status IN ('draft','scheduled')
       ORDER BY scheduled_date ASC LIMIT 5`
    );
    const { rows: recentLeads } = await safeQuery(
      `SELECT id, full_name, company_name, source, status, received_at FROM marketing_leads
       ORDER BY received_at DESC NULLS LAST, created_at DESC LIMIT 5`
    );
    const { rows: upcomingEvents } = await safeQuery(
      `SELECT id, name, event_type, start_date, role FROM marketing_events
       WHERE start_date >= CURRENT_DATE ORDER BY start_date ASC LIMIT 5`
    );

    res.json({
      social: social.rows[0],
      campaigns: campaigns.rows[0],
      content: content.rows[0],
      leads: leads.rows[0],
      events: events.rows[0],
      press: press.rows[0],
      newsletter: newsletter.rows[0] || null,
      seo: seo.rows[0] || null,
      upcomingContent,
      recentLeads,
      upcomingEvents,
    });
  } catch (err) {
    console.error('[marketing-dashboard:summary]', err);
    res.status(500).json({ error: 'Failed to build marketing dashboard' });
  }
});

module.exports = router;