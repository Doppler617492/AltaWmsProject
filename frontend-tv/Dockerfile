FROM node:18-alpine

WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm install --production=false

# Copy source and build
COPY . .

# Accept token as build argument for build-time injection
ARG NEXT_PUBLIC_TV_KIOSK_TOKEN=""
ARG NEXT_PUBLIC_BACKEND_URL=""
ENV NEXT_PUBLIC_TV_KIOSK_TOKEN=$NEXT_PUBLIC_TV_KIOSK_TOKEN
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL

RUN npm run build

ENV NODE_ENV=production
EXPOSE 8090
CMD ["npm", "run", "start"]
