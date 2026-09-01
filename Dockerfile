# AURA Assistant Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY server.js ./
COPY start-all.js ./
COPY public ./public
COPY core ./core

# Create directories for persistent data
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/status || exit 1

# Start AURA Assistant
CMD ["node", "server.js"]