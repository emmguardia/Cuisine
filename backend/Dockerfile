# ── Stage 1 : dépendances ────────────────────────────────────────────
FROM node:26-alpine AS deps

ENV NODE_ENV=production \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

WORKDIR /app

RUN apk update && apk upgrade --no-cache

# pnpm épinglé. Pas de corepack : il a été retiré du bundle Node à partir de
# Node 25/26.
RUN npm install -g pnpm@10.33.4 --no-audit --no-fund

# .npmrc porte ignore-scripts=true. Aucune dépendance de ce backend n'est
# native, donc pnpm.onlyBuiltDependencies est volontairement absent.
COPY package.json pnpm-lock.yaml .npmrc ./

RUN pnpm install --prod --frozen-lockfile \
    && pnpm store prune 2>/dev/null || true

# ── Stage 2 : image finale ────────────────────────────────────────────
# Stage nommé "runtime" → exclu du cache CI (no-cache-filters) pour toujours
# récupérer les derniers patchs de sécurité Alpine au build.
FROM node:26-alpine AS runtime
WORKDIR /app

RUN apk update && apk upgrade --no-cache \
 && addgroup -g 1001 -S nodejs \
 && adduser  -u 1001 -S nodejs -G nodejs \
 && rm -rf /var/cache/apk/*

# HARDENING SUPPLY-CHAIN : le runtime n'exécute que `node server.js`.
# Retirer npm, npx, corepack et yarn élimine d'un coup toutes les CVE de leurs
# dépendances bundlées (picomatch, tar, cross-spawn, glob, minimatch, undici,
# sigstore…).
#
# C'est aussi ce qui permet de supprimer le `--skip-dirs
# "/usr/local/lib/node_modules/npm"` que le scan Trivy portait jusqu'ici : ce
# filtre masquait les CVE de npm au lieu de les traiter, et masquait donc aussi
# toute nouvelle vulnérabilité qui serait apparue à cet endroit. Le répertoire
# n'existe plus, le scan couvre désormais l'intégralité de l'image.
RUN rm -rf \
      /usr/local/lib/node_modules/npm \
      /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm \
      /usr/local/bin/npx \
      /usr/local/bin/corepack \
      /opt/yarn-* \
      /usr/local/bin/yarn \
      /usr/local/bin/yarnpkg \
    && rm -rf /root/.npm /root/.cache 2>/dev/null || true

COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

USER nodejs
EXPOSE 3000

CMD ["node", "server.js"]
