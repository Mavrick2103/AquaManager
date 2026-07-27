# ---------- Build Angular ----------
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Évite que Cypress télécharge son binaire dans l'image Docker
ENV CYPRESS_INSTALL_BINARY=0

# Installer les dépendances frontend
COPY package*.json ./
RUN npm ci

# Copier le code et builder Angular
COPY . .
RUN npm run build

# ---------- Nginx to serve ----------
FROM nginx:alpine

# Copier le build Angular généré par `ng build`
# (dossier dist/web/browser comme dans tes logs)
COPY --from=builder /app/dist/web/browser/ /usr/share/nginx/html

# Angular SSR names the client shell index.csr.html; Nginx expects index.html.
COPY --from=builder /app/dist/web/browser/index.csr.html /usr/share/nginx/html/index.html

# Config Nginx custom (reverse proxy vers l’API Nest)
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

