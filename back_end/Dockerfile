# ---------- Build stage ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Installer les dépendances (avec package.json + package-lock.json)
COPY package*.json ./
RUN npm ci

# Copier le code source et builder NestJS
COPY . .
RUN npm run build

# ---------- Runtime stage ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Installer uniquement les deps de prod
COPY package*.json ./
RUN npm ci --omit=dev

# Récupérer le build NestJS
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/src/main.js"]
