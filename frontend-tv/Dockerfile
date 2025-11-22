FROM node:18-bullseye-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:18-bullseye-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:18-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.js ./next.config.js || true
EXPOSE 8090
CMD ["npm", "run", "start"]
