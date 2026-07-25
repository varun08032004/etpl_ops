'use strict';
// services/socialSync.js — pulls live follower/following/post counts from
// each platform's official API. Every function takes a plain handle (no @)
// and returns { followers_count, following_count, posts_count } or throws
// a descriptive Error the route layer turns into a clean 4xx/5xx.
//
// Credentials come from env vars (company-wide, since this ERP tracks one
// company's accounts, not a multi-tenant list of arbitrary clients):
//   INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID  — see setup notes
//   TWITTER_BEARER_TOKEN
//   YOUTUBE_API_KEY
//
// Nothing here scrapes a webpage — every call hits the platform's official,
// documented API. If a platform isn't configured or the API rejects the
// call (auth, rate limit, tier restriction), we throw a clear error rather
// than silently failing or falling back to scraping.

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    const err = new Error(`${name} is not configured on the server — see backend/services/socialSync.js setup notes.`);
    err.status = 501; // Not Implemented — this platform isn't wired up yet, not a request error
    throw err;
  }
  return value;
}

function cleanHandle(handle) {
  return String(handle || '').trim().replace(/^@/, '');
}

// ── Instagram — Graph API "Business Discovery" ─────────────────────────────
// Looks up ANY public Instagram Business/Creator account's stats using your
// own connected Instagram Business Account as the querying identity.
//
// Setup (one-time, ~15 min):
//   1. Your Instagram account must be a Business or Creator account, linked
//      to a Facebook Page.
//   2. Go to developers.facebook.com → create an app → add "Instagram Graph API".
//   3. Generate a long-lived User or Page access token with the
//      instagram_basic permission (Graph API Explorer works for this).
//   4. Set INSTAGRAM_ACCESS_TOKEN to that token, and
//      INSTAGRAM_BUSINESS_ACCOUNT_ID to your own linked IG Business Account ID
//      (found via GET /me/accounts then GET /{page-id}?fields=instagram_business_account).
async function fetchInstagramStats(handle) {
  const token = requireEnv('INSTAGRAM_ACCESS_TOKEN');
  const myAccountId = requireEnv('INSTAGRAM_BUSINESS_ACCOUNT_ID');
  const username = cleanHandle(handle);
  if (!username) throw Object.assign(new Error('No Instagram handle set on this account'), { status: 400 });

  const url = `https://graph.facebook.com/v19.0/${myAccountId}` +
    `?fields=business_discovery.username(${encodeURIComponent(username)}){followers_count,follows_count,media_count}` +
    `&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok || data.error) {
    const msg = data.error?.message || `Instagram API returned ${res.status}`;
    throw Object.assign(new Error(`Instagram: ${msg}`), { status: res.status >= 400 && res.status < 500 ? 400 : 502 });
  }

  const bd = data.business_discovery;
  if (!bd) throw Object.assign(new Error(`Instagram: "${username}" wasn't found, or isn't a public Business/Creator account`), { status: 404 });

  return {
    followers_count: bd.followers_count ?? 0,
    following_count: bd.follows_count ?? 0,
    posts_count: bd.media_count ?? 0,
  };
}

// ── Twitter / X — API v2 user lookup ────────────────────────────────────────
// Setup: developer.x.com → create a project/app → generate a Bearer Token
// (App-only auth is enough for public metrics). NOTE: X restructured
// pricing in 2023 — reading another account's public_metrics generally
// requires at least the paid Basic tier; the Free tier is largely
// write/OAuth-only. If you're on Free, this will likely fail with a 403 —
// that's X's restriction, not a bug here.
async function fetchTwitterStats(handle) {
  const token = requireEnv('TWITTER_BEARER_TOKEN');
  const username = cleanHandle(handle);
  if (!username) throw Object.assign(new Error('No Twitter/X handle set on this account'), { status: 400 });

  const url = `https://api.twitter.com/2/users/by/username/${encodeURIComponent(username)}?user.fields=public_metrics`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();

  if (!res.ok || data.errors) {
    const msg = data.errors?.[0]?.detail || data.detail || `X API returned ${res.status}`;
    const hint = res.status === 403 ? ' (likely a Free-tier restriction — public metrics usually need the paid Basic tier or above)' : '';
    throw Object.assign(new Error(`Twitter/X: ${msg}${hint}`), { status: res.status >= 400 && res.status < 500 ? 400 : 502 });
  }

  const metrics = data.data?.public_metrics;
  if (!metrics) throw Object.assign(new Error(`Twitter/X: "${username}" not found`), { status: 404 });

  return {
    followers_count: metrics.followers_count ?? 0,
    following_count: metrics.following_count ?? 0,
    posts_count: metrics.tweet_count ?? 0,
  };
}

// ── YouTube — Data API v3, public + free, no OAuth needed ──────────────────
// Setup: console.cloud.google.com → new project → enable "YouTube Data API
// v3" → create an API key. handle can be a @handle (e.g. "@ethertrack") or
// a raw channel ID (UC...).
async function fetchYoutubeStats(handle) {
  const apiKey = requireEnv('YOUTUBE_API_KEY');
  const raw = cleanHandle(handle);
  if (!raw) throw Object.assign(new Error('No YouTube handle/channel ID set on this account'), { status: 400 });

  const isChannelId = /^UC[\w-]{22}$/.test(raw);
  const url = isChannelId
    ? `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${encodeURIComponent(raw)}&key=${apiKey}`
    : `https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${encodeURIComponent(raw.replace(/^@/, ''))}&key=${apiKey}`;

  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok || data.error) {
    const msg = data.error?.message || `YouTube API returned ${res.status}`;
    throw Object.assign(new Error(`YouTube: ${msg}`), { status: res.status >= 400 && res.status < 500 ? 400 : 502 });
  }

  const stats = data.items?.[0]?.statistics;
  if (!stats) throw Object.assign(new Error(`YouTube: channel "${raw}" not found`), { status: 404 });

  return {
    followers_count: Number(stats.subscriberCount ?? 0),
    following_count: 0, // channels don't have a "following" concept
    posts_count: Number(stats.videoCount ?? 0),
  };
}

const SYNCERS = {
  instagram: fetchInstagramStats,
  twitter: fetchTwitterStats,
  youtube: fetchYoutubeStats,
};

function isSyncable(platform) {
  return Object.prototype.hasOwnProperty.call(SYNCERS, platform);
}

async function syncStatsForPlatform(platform, handle) {
  const fn = SYNCERS[platform];
  if (!fn) {
    const err = new Error(`Live sync isn't available for "${platform}" yet — only instagram, twitter, and youtube are wired up.`);
    err.status = 400;
    throw err;
  }
  return fn(handle);
}

module.exports = { syncStatsForPlatform, isSyncable };