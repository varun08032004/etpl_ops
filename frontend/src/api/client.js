import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Add request interceptor to include auth token if needed
client.interceptors.request.use((config) => {
  // Add any auth headers if needed
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Add response interceptor for error handling
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If the error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't intercept refresh endpoint itself
      if (originalRequest.url === '/auth/refresh') {
        return Promise.reject(error);
      }

      // Don't retry if request already has Authorization header (caller handles auth)
      if (originalRequest.headers?.Authorization) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return client(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Try to refresh the token
        await client.post('/auth/refresh');
        isRefreshing = false;
        processQueue(null);
        return client(originalRequest);
      } catch (err) {
        isRefreshing = false;
        processQueue(err, null);
        
        // Only redirect to login if not already on login page
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(err);
      }
    }

    // For other errors, just reject
    return Promise.reject(error);
  }
);

export default client;