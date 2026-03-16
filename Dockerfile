FROM node:22-slim AS base
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# node-cron is dynamically imported in instrumentation.ts — not traced by standalone bundler
COPY --from=builder /app/node_modules/node-cron ./node_modules/node-cron

EXPOSE ${PORT:-3000}
ENV PORT=${PORT:-3000}
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
