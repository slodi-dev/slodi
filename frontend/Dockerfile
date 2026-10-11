
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
# No default: a missing value used to bake http://localhost:8000 into the
# production bundle without a word. Fail the build instead.
ARG NEXT_PUBLIC_API_URL
RUN test -n "$NEXT_PUBLIC_API_URL" || \
  (echo "NEXT_PUBLIC_API_URL build arg is required (set it in the root .env)" >&2; exit 1)
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