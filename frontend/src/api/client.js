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
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('etpl_token');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default client;