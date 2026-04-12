FROM docker.io/node:20.11-alpine3.18 AS base

# stage 1. Install dependencies only when needed
FROM base AS deps

RUN apk add --no-cache libc6-compat

ARG APP_HOME=/app
WORKDIR ${APP_HOME}

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./

RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Stage 2 Rebuild the source code when needed

FROM base AS builder
ARG APP_HOME=/app
WORKDIR ${APP_HOME}


COPY --from=deps /app/node_modules ./node_modules

COPY . ${APP_HOME}

COPY .env.production .env.production

RUN npm run build

# Stage 3: Create a production image. copy all the files and run next as a non root user
FROM base AS runner

ARG APP_HOME=/app
WORKDIR ${APP_HOME}

ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && \
  adduser -S nextjs -u 1001 -G nodejs

COPY --from=builder /app/public ./public

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN chown -R nextjs:nodejs ${APP_HOME}

USER nextjs

ENV PORT 3000

CMD HOSTNAME=client node server.js


