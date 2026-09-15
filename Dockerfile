# AURA Assistant Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install production dependencies. The repository currently does not ship a
# package-lock.json, so npm install is used instead of npm ci.
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY server.js ./
COPY start-all.js ./
COPY public ./public
COPY core ./core

RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3000

# Use Node's built-in fetch so the image does not need curl.
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
