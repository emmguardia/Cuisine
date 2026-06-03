# ── Stage 1 : dépendances ────────────────────────────────────────────
FROM node:26-alpine AS deps
WORKDIR /app

RUN apk update && apk upgrade --no-cache

COPY package*.json ./
RUN npm ci --no-audit --no-fund --loglevel=error --omit=dev

# ── Stage 2 : image finale ────────────────────────────────────────────
# Stage nommé "runtime" → exclu du cache CI (no-cache-filters) pour toujours
# récupérer les derniers patchs de sécurité Alpine au build.
FROM node:26-alpine AS runtime
WORKDIR /app

RUN apk update && apk upgrade --no-cache \
 && addgroup -g 1001 -S nodejs \
 && adduser  -u 1001 -S nodejs -G nodejs \
 && rm -rf /var/cache/apk/*

COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

USER nodejs
EXPOSE 3000

CMD ["node", "server.js"]
