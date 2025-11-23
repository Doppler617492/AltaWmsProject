FROM node:18-alpine

WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm install --production=false

# Copy source and build
COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 8090
CMD ["npm", "run", "start"]
