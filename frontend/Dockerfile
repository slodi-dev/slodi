
# ── Stage: deps ───────────────────────────────────────────
FROM node:24.8.0-alpine3.21 AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci

# ── Stage: test ──────────────────────────────────────────
FROM deps AS test

COPY . .

CMD ["npm", "run", "test"]

# ── Stage: development ───────────────────────────────────
FROM deps AS development

COPY . .

CMD ["npm", "run", "dev"]

# ── Stage: prod-deps ─────────────────────────────────────
# Production-only dependencies (no devDependencies)
FROM deps AS prod-deps

RUN npm ci --omit=dev

# ── Stage: build ─────────────────────────────────────────
FROM deps AS build

# Only NEXT_PUBLIC_* vars that must be baked into the client bundle go here.
# No env files are copied — they are excluded via .dockerignore.
# NEXT_PUBLIC_DEFAULT_WORKSPACE_ID is intentionally absent: fetched at runtime via /api/config.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY . .
RUN npm run build

# ── Stage: production ────────────────────────────────────
FROM node:24.8.0-alpine3.21 AS production

WORKDIR /app

COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package*.json ./
COPY --from=prod-deps /app/node_modules ./node_modules

COPY --from=build /app/next.config.* ./

EXPOSE 3000

CMD ["npm", "start"]