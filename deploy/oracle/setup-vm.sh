#!/usr/bin/env bash
# Qué hace: prepara una VM Ubuntu de Oracle Cloud (instala Docker, abre 80/443 en el firewall interno y deja listo el repo).
# Por qué: desplegar la API de NexusPlay fuera de Railway a costo 0.
# Salida: /tmp/setup-vm.log (ejecutar con: bash setup-vm.sh 2>&1 | tee /tmp/setup-vm.log)
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/NexusFactoryLab/NexusPlay.git}"
BRANCH="${BRANCH:-deploy-oracle}" # tras mergear esta rama a main, cambiar el valor por defecto a main
DEST="${DEST:-$HOME/NexusPlay}"

echo "== 1/4 Docker =="
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker "$USER"
echo "docker: $(sudo docker --version)"

echo "== 2/4 Firewall interno (80 y 443) =="
# Las imágenes de Oracle traen reglas iptables que rechazan todo salvo SSH; en AWS la cadena está vacía.
# Insertar al inicio (posición 1) sirve en ambos casos y siempre queda antes de cualquier REJECT.
for port in 80 443; do
  if ! sudo iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null; then
    sudo iptables -I INPUT 1 -p tcp --dport "$port" -j ACCEPT
  fi
done
if ! sudo iptables -C INPUT -p udp --dport 443 -j ACCEPT 2>/dev/null; then
  sudo iptables -I INPUT 1 -p udp --dport 443 -j ACCEPT
fi
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent >/dev/null
sudo netfilter-persistent save
sudo iptables -L INPUT -n --line-numbers | head -12

echo "== 3/4 Repositorio ($BRANCH) =="
if [ -d "$DEST/.git" ]; then
  git -C "$DEST" fetch origin "$BRANCH"
  git -C "$DEST" checkout "$BRANCH"
  git -C "$DEST" pull --ff-only origin "$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$DEST"
fi

echo "== 4/4 Archivo .env =="
cd "$DEST/deploy/oracle"
if [ ! -f .env ]; then
  cp env.example .env
  chmod 600 .env
  echo "Se creó $DEST/deploy/oracle/.env: complétalo con 'nano .env' antes de levantar la API."
else
  echo ".env ya existe, no se toca."
fi

echo "OK. Cierra la sesión SSH y vuelve a entrar para que el grupo 'docker' tenga efecto."
