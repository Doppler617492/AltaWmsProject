FROM node:18-bullseye-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
RUN npm install --frozen-lockfile

COPY . .
# Run build with curl available for debugging
RUN npm run build || (echo "Build failed, checking .next structure" && ls -la .next 2>/dev/null || echo "No .next dir")

FROM node:18-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --frozen-lockfile --omit=dev
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js
EXPOSE 8090
CMD ["node", ".next/standalone/server.js"]
