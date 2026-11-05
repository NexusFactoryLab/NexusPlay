#!/usr/bin/env bash
# Qué hace: trae el código nuevo de la rama y reconstruye/reinicia la API y Caddy.
# Por qué: publicar cambios en la VM de Oracle (reemplaza el deploy automático de Railway).
# Salida: /tmp/actualizar.log (ejecutar con: bash actualizar.sh 2>&1 | tee /tmp/actualizar.log)
set -euo pipefail

BRANCH="${BRANCH:-deploy-oracle}" # tras mergear esta rama a main, cambiar el valor por defecto a main
cd "$(dirname "$0")/../.."
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

cd deploy/oracle
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f >/dev/null
docker compose -f docker-compose.prod.yml ps
echo "Últimas líneas del log de la API:"
docker compose -f docker-compose.prod.yml logs --tail 15 api
