'use strict';

const { safeQuery } = require('../db/pool');

async function getRules() {
  const { rows } = await safeQuery(`SELECT match_type, pattern, category FROM productivity_rules`);
  return rows;
}

// domain rules match by substring (so a rule for 'youtube.com' catches
// 'www.youtube.com' and 'music.youtube.com'); app rules match exactly
// (app_name is a stable executable name, not free text).
function categorize(rules, { appName, domain }) {
  if (domain) {
    const d = domain.toLowerCase();
    const rule = rules.find((r) => r.match_type === 'domain' && d.includes(r.pattern.toLowerCase()));
    if (rule) return rule.category;
  }
  if (appName) {
    const a = appName.toLowerCase();
    const rule = rules.find((r) => r.match_type === 'app' && r.pattern.toLowerCase() === a);
    if (rule) return rule.category;
  }
  return 'neutral';
}

// Reduces a list of { app_name/domain, duration_seconds } rows into
// { productive, unproductive, neutral, blocked } second totals plus a %
// figure, used by both the live dashboard and the day-drilldown endpoints.
function summarizeProductivity(rules, appRows, siteRows) {
  const totals = { productive: 0, unproductive: 0, neutral: 0, blocked: 0 };
  for (const row of appRows) {
    const cat = categorize(rules, { appName: row.app_name });
    totals[cat] += Number(row.duration_seconds) || 0;
  }
  for (const row of siteRows) {
    const cat = categorize(rules, { domain: row.domain });
    totals[cat] += Number(row.duration_seconds) || 0;
  }
  const trackedSeconds = totals.productive + totals.unproductive + totals.neutral + totals.blocked;
  const productivePct = trackedSeconds > 0 ? Math.round((totals.productive / trackedSeconds) * 100) : 0;
  return { totals, productivePct };
}

// ── productivity score (0–100) ──────────────────────────────────────────
// Three components, weighted, each independently visible so this never
// reads as a black-box number:
//
//  Focus (55%)      — of everything CATEGORIZED (productive/unproductive/
//                      neutral/blocked), how much was productive. Blocked
//                      time counts double against you — visiting something
//                      explicitly blocked is worse than merely neutral or
//                      unproductive, and the score should reflect that.
//  Engagement (25%) — active_seconds vs. active+idle. Were they actually
//                      at the keyboard during the time they were logged in.
//  Attendance (20%) — active_seconds against a full expected workday
//                      (default 8h, set in monitoring_settings). Caps at
//                      100% — working a 14-hour day doesn't buy extra
//                      score, it just means attendance is fully satisfied.
//
// Deliberately NOT folding idle time as a flat penalty on its own — idle
// includes legitimate off-laptop work (meetings, calls) which engagement
// alone can't distinguish from actual slacking, so it's weighted
// moderately (25%) rather than dominating the score.
function computeProductivityScore({ totals, activeSeconds, idleSeconds, expectedDailyHours = 8 }) {
  const categorizedSeconds = totals.productive + totals.unproductive + totals.neutral + totals.blocked;
  const focusScore = categorizedSeconds > 0
    ? Math.max(0, (totals.productive - totals.blocked) / categorizedSeconds) * 100
    : 0;

  const engagementDenominator = activeSeconds + idleSeconds;
  const engagementScore = engagementDenominator > 0 ? (activeSeconds / engagementDenominator) * 100 : 0;

  const expectedSeconds = expectedDailyHours * 3600;
  const attendanceScore = expectedSeconds > 0 ? Math.min(activeSeconds / expectedSeconds, 1) * 100 : 0;

  const overall = Math.round(0.55 * focusScore + 0.25 * engagementScore + 0.20 * attendanceScore);

  let label;
  if (overall >= 85) label = 'Excellent';
  else if (overall >= 70) label = 'Good';
  else if (overall >= 50) label = 'Needs attention';
  else label = 'Poor';

  return {
    score: Math.max(0, Math.min(100, overall)),
    label,
    breakdown: {
      focus: Math.round(focusScore),
      engagement: Math.round(engagementScore),
      attendance: Math.round(attendanceScore),
    },
  };
}

module.exports = { getRules, categorize, summarizeProductivity, computeProductivityScore };