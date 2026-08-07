import axios from 'axios';

// Vercel (frontend) and Render (backend) are different domains, so a
// relative '/api' path breaks completely in production — it would
// resolve to your-app.vercel.app/api/... instead of your Render backend,
// and every API call (including login) would 404. In local dev, frontend
// and backend are typically on the same origin (via CRA's proxy or
// same-host), so '/api' still works there as a fallback.
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

const client = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('etpl_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('etpl_token');
      if (window.location.pathname !== '/login') window.location.href = '/login';
      return Promise.reject(err);
    }

    // [FIX-AUTO-LOGOUT] 503 now means "the backend/DB had a transient hiccup,
    // your token was fine" (see middleware/auth.js) — NOT a reason to log
    // out. For a GET, retry once after a short delay before giving up; for
    // a write, don't auto-retry (could double-submit), just surface the
    // error and let the user retry the action themselves.
    const config = err.config;
    if (err.response?.status === 503 && config?.method === 'get' && !config._retried503) {
      config._retried503 = true;
      await new Promise((r) => setTimeout(r, 1200));
      return client(config);
    }

    return Promise.reject(err);
  }
);

export default client;