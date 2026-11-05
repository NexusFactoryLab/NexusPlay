#!/usr/bin/env bash
# Qué hace: prepara una VM Ubuntu en AWS EC2 (instala Docker, clona el repo y crea el .env).
# Por qué: desplegar la API de NexusPlay fuera de Railway.
# Salida: /tmp/setup-vm.log (ejecutar con: bash setup-vm.sh 2>&1 | tee /tmp/setup-vm.log)
# Nota: los puertos 80/443 se abren en el Security Group de AWS, no aquí (Ubuntu en EC2 no trae firewall interno activo).
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/NexusFactoryLab/NexusPlay.git}"
BRANCH="${BRANCH:-main}"
DEST="${DEST:-$HOME/NexusPlay}"

echo "== 1/3 Docker =="
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker "$USER"
echo "docker: $(sudo docker --version)"

echo "== 2/3 Repositorio ($BRANCH) =="
if [ -d "$DEST/.git" ]; then
  git -C "$DEST" fetch origin "$BRANCH"
  git -C "$DEST" checkout "$BRANCH"
  git -C "$DEST" pull --ff-only origin "$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$DEST"
fi

echo "== 3/3 Archivo .env =="
cd "$DEST/deploy/aws"
if [ ! -f .env ]; then
  cp env.example .env
  chmod 600 .env
  echo "Se creó $DEST/deploy/aws/.env: complétalo con 'nano .env' antes de levantar la API."
else
  echo ".env ya existe, no se toca."
fi

echo "OK. Cierra la sesión SSH y vuelve a entrar para que el grupo 'docker' tenga efecto."
