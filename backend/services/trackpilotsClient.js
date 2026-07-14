'use strict';
// services/trackpilotsClient.js
//
// Thin client for the real Trackpilots API (https://developer.trackpilots.com).
//
// NOTE ON API AVAILABILITY: as of writing, developer.trackpilots.com's own
// "Getting Started" page says "API Access – Coming Soon", but the OpenAPI
// spec backing developer.trackpilots.com/openapi.yaml is fully fleshed out
// with realistic example data — this suggests the API works for at least
// some accounts and that one docs page just hasn't caught up. If your API
// key gets rejected outright, that's the likely explanation — email
// team@trackpilots.com for early/customized access rather than assuming
// this code is wrong.
//
// Auth: Bearer token generated from the Trackpilots dashboard —
// Developer Tools -> API Keys (https://app.trackpilots.com/developer-tools/api-keys).
// The key is shown only once at creation time. Store it as TRACKPILOTS_API_KEY.

const BASE_URL = 'https://api.trackpilots.com';

function getApiKey() {
  const key = process.env.TRACKPILOTS_API_KEY;
  if (!key) {
    throw new Error(
      'TRACKPILOTS_API_KEY not configured — generate one at https://app.trackpilots.com/developer-tools/api-keys'
    );
  }
  return key;
}

async function trackpilotsRequest(path, { method = 'GET', body } = {}) {
  const key = getApiKey();
  let resp;
  try {
    resp = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error(`Could not reach Trackpilots API: ${err.message}`);
  }

  const json = await resp.json().catch(() => null);
  if (!resp.ok || !json?.success) {
    const code = json?.error?.code || resp.status;
    const message = json?.error?.message || resp.statusText;
    throw Object.assign(
      new Error(`Trackpilots API error (${code}): ${message}`),
      { status: resp.status, code }
    );
  }
  return json.data;
}

// GET /v1/employees — full Trackpilots roster: userId, userName, emailId,
// accountStatus, roleName, workMode, etc. Used to auto-map trackpilot_user_id
// onto our employees table by matching work_email, so nobody has to manually
// copy-paste UUIDs for every new hire.
async function fetchTrackpilotsEmployees() {
  return trackpilotsRequest('/v1/employees');
}

// POST /v1/report-analysis/attendance-summary
// Either userIds or teamIds is required (Trackpilots rejects both empty).
// Returns, per user: attendanceSummary (month totals) + dailySummary, where
// each day has { date, day, attendanceStatus, checkIn, checkOut }.
// attendanceStatus is one of: UPCOMING, PRESENT, ABSENT, WEEK_OFF, WORKED_ON_WEEK_OFF.
// checkIn/checkOut are formatted strings like "9:05 AM", not ISO timestamps —
// the caller is responsible for combining them with `date`.
async function fetchAttendanceSummary({ userIds, teamIds, year, month, timeZone = 'Asia/Kolkata' }) {
  if ((!userIds || !userIds.length) && (!teamIds || !teamIds.length)) {
    throw new Error('fetchAttendanceSummary requires userIds or teamIds');
  }
  return trackpilotsRequest('/v1/report-analysis/attendance-summary', {
    method: 'POST',
    body: {
      year,
      month,
      timeZone,
      ...(userIds?.length ? { userId: userIds } : {}),
      ...(teamIds?.length ? { teamId: teamIds } : {}),
    },
  });
}

module.exports = { fetchTrackpilotsEmployees, fetchAttendanceSummary };