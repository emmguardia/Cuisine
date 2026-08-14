# Stage 1: Build avec Node
# Alpine ~5MB vs Debian ~1GB : surface d'attaque réduite
FROM node:26-alpine AS builder

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

WORKDIR /app

RUN apk update && apk upgrade --no-cache

# pnpm épinglé. Pas de corepack : il a été retiré du bundle Node à partir de
# Node 25/26.
RUN npm install -g pnpm@10.33.4 --no-audit --no-fund

# Manifestes d'abord : la couche d'install reste en cache tant qu'ils ne
# changent pas. .npmrc porte minimum-release-age=1440 et ignore-scripts=true.
COPY package.json pnpm-lock.yaml .npmrc ./

# --frozen-lockfile : échoue si le lockfile ne correspond pas au package.json,
# au lieu de le régénérer en silence. La version précédente retombait sur
# `npm install` quand le lockfile manquait, ce qui rendait les builds
# non reproductibles.
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

# Stage 2: Image finale nginx NON privilégiée (tourne en uid 101, écrit dans /tmp)
# Stage nommé "runtime" → exclu du cache CI (no-cache-filters) pour toujours
# récupérer les derniers patchs de sécurité Alpine au build.
FROM nginxinc/nginx-unprivileged:alpine AS runtime

# apk a besoin de root ; on rebascule en 101 (nginx) pour l'exécution.
USER root
RUN apk update && apk upgrade -a --no-cache && rm -rf /var/cache/apk/*

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

USER 101
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
