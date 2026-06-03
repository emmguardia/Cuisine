# Stage 1: Build avec Node
# Alpine ~5MB vs Debian ~1GB : surface d'attaque réduite
FROM node:26-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN apk update && apk upgrade --no-cache \
    && if [ -f package-lock.json ]; then npm ci --no-audit --no-fund --loglevel=error; else npm install --no-audit --no-fund --loglevel=error; fi

COPY . .

RUN npm run build

# Stage 2: Image finale nginx (aucun package Node)
# Stage nommé "runtime" → exclu du cache CI (no-cache-filters) pour toujours
# récupérer les derniers patchs de sécurité Alpine au build.
FROM nginx:alpine AS runtime

RUN apk update && apk upgrade -a --no-cache && rm -rf /var/cache/apk/*

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
