#!/bin/bash
set -euo pipefail

echo "====================================="
echo " Déploiement AquaManager (Docker) "
echo "====================================="

cd "$(dirname "$0")"

echo ""
echo "1) Récupération du dernier code..."
git pull origin main

echo ""
echo "2) Build & mise à jour des conteneurs Docker..."
docker compose up -d --build

echo ""
echo "3) Nettoyage des ressources Docker inutiles..."
docker image prune -f >/dev/null 2>&1 || true

echo ""
echo "Déploiement terminé !"
echo "Frontend → http://localhost:4200"
echo "API → http://localhost:3000"
