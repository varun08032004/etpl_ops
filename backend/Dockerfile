# Dockerfile for EtherTrack Internal Ops Backend
# Multi-stage build for production optimization

# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S -u 1001 -G nodejs etpl

# Copy built dependencies from builder
COPY --from=builder --chown=etpl:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=etpl:nodejs /app/package*.json ./

# Copy application code
COPY --chown=etpl:nodejs . .

# Switch to non-root user
USER etpl

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5001/health || exit 1

# Start application
CMD ["node", "server.js"]