FROM node:18-bullseye-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    npm_config_fetch_retries=10 \
    npm_config_fetch_retry_mintimeout=30000 \
    npm_config_fetch_retry_maxtimeout=180000 \
    NEXT_SKIP_BUILD_OPTIMIZATION=true
COPY package*.json ./
RUN npm ci && npm cache clean --force
COPY . .
RUN npm run build

FROM node:18-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js
EXPOSE 8090
CMD ["node", ".next/standalone/server.js"]
