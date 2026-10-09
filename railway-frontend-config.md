# Railway Frontend Deployment Configuration
# Frontend is deployed on Railway at https://ops.ethertrack.in
# Backend is on Render at https://api.ethertrack.in

# Required Environment Variables on Railway:
# ---------------------------------------
# REACT_APP_API_BASE_URL=https://api.ethertrack.in/api
# (This tells the frontend where to send API requests)

# Build Settings:
# - Build Command: npm ci && npm run build
# - Output Directory: build
# - Start Command: npx serve -s build -l $PORT

# Railway Service Settings:
# - Root Directory: frontend
# - Port: 3000 (Railway assigns $PORT automatically)

# Domain Configuration:
# - Custom Domain: ops.ethertrack.in
# - HTTPS: Enabled (Railway provides automatic HTTPS)

# Notes:
# - The frontend makes direct API calls to https://api.ethertrack.in/api/*
# - Cookies are set by the backend (api.ethertrack.in) with SameSite=None; Secure
# - CORS is configured on the backend to allow https://ops.ethertrack.in
# - withCredentials: true is set on the axios client in frontend/src/api/client.js