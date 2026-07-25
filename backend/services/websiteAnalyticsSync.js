'use strict';
// services/websiteAnalyticsSync.js — pulls real clicks/impressions (Search
// Console) and pageviews (GA4) for a given page path on ethertrack.in.
// Both use the shared service-account auth in services/googleAuth.js.

const { getGoogleAccessToken } = require('./googleAuth');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    const err = new Error(`${name} is not configured on the server.`);
    err.status = 501;
    throw err;
  }
  return value;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ── Search Console — clicks, impressions, CTR, average position ────────────
// GOOGLE_SEARCH_CONSOLE_SITE_URL is the property exactly as it appears in
// Search Console — either "https://ethertrack.in/" (URL-prefix property) or
// "sc-domain:ethertrack.in" (domain property, if verified that way).
async function fetchSearchConsoleStats(pagePath, days = 28) {
  const siteUrl = requireEnv('GOOGLE_SEARCH_CONSOLE_SITE_URL');
  const token = await getGoogleAccessToken('https://www.googleapis.com/auth/webmasters.readonly');

  const fullUrl = pagePath.startsWith('http') ? pagePath : `https://ethertrack.in${pagePath.startsWith('/') ? '' : '/'}${pagePath}`;

  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: daysAgo(days),
        endDate: daysAgo(0),
        dimensions: ['page'],
        dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'equals', expression: fullUrl }] }],
        rowLimit: 1,
      }),
    }
  );
  const data = await res.json();

  if (!res.ok || data.error) {
    const msg = data.error?.message || `Search Console API returned ${res.status}`;
    throw Object.assign(new Error(`Search Console: ${msg}`), { status: res.status >= 400 && res.status < 500 ? 400 : 502 });
  }

  const row = data.rows?.[0];
  return {
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    ctr: row ? Math.round(row.ctr * 10000) / 100 : 0, // as a percentage, 2dp
    avg_position: row ? Math.round(row.position * 10) / 10 : null,
  };
}

// ── GA4 — pageviews ──────────────────────────────────────────────────────
// GOOGLE_GA4_PROPERTY_ID is the numeric GA4 property ID (Admin → Property
// Settings → Property ID, looks like "123456789" — NOT the "G-XXXX" measurement ID).
async function fetchGa4Pageviews(pagePath, days = 28) {
  const propertyId = requireEnv('GOOGLE_GA4_PROPERTY_ID');
  const token = await getGoogleAccessToken('https://www.googleapis.com/auth/analytics.readonly');

  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        dimensionFilter: {
          filter: { fieldName: 'pagePath', stringFilter: { matchType: 'EXACT', value: pagePath } },
        },
        limit: 1,
      }),
    }
  );
  const data = await res.json();

  if (!res.ok || data.error) {
    const msg = data.error?.message || `GA4 API returned ${res.status}`;
    throw Object.assign(new Error(`GA4: ${msg}`), { status: res.status >= 400 && res.status < 500 ? 400 : 502 });
  }

  const value = data.rows?.[0]?.metricValues?.[0]?.value;
  return { pageviews: value ? Number(value) : 0 };
}

// Combines both — used by the sync endpoint. Each half fails independently
// (e.g. if only Search Console is configured, GA4 numbers just come back null
// with a note, rather than the whole sync failing).
async function syncPageAnalytics(pagePath, days = 28) {
  const result = { clicks: null, impressions: null, ctr: null, avg_position: null, pageviews: null, warnings: [] };

  try {
    const gsc = await fetchSearchConsoleStats(pagePath, days);
    Object.assign(result, gsc);
  } catch (err) {
    result.warnings.push(err.message);
  }

  try {
    const ga4 = await fetchGa4Pageviews(pagePath, days);
    result.pageviews = ga4.pageviews;
  } catch (err) {
    result.warnings.push(err.message);
  }

  return result;
}

module.exports = { fetchSearchConsoleStats, fetchGa4Pageviews, syncPageAnalytics };