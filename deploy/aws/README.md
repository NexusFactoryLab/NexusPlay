# Despliegue del backend en una VM (AWS EC2)

Levanta solo dos contenedores: la API (NestJS) y Caddy (HTTPS automático). Las bases de datos
(Postgres, Mongo), las imágenes y la IA son servicios externos que se configuran en el `.env`.
El frontend se despliega aparte (Vercel).

## Primera vez
1. Crear la instancia (Ubuntu 24.04), un Security Group con 22 (solo tu IP), 80 y 443, y una IP elástica.
2. Registro DNS `A` de `api.nexusplaygames.com` apuntando a esa IP (sin proxy de Cloudflare al principio).
3. En la VM: `curl -fsSL https://raw.githubusercontent.com/NexusFactoryLab/NexusPlay/main/deploy/aws/setup-vm.sh -o /tmp/setup-vm.sh && bash /tmp/setup-vm.sh`
4. Cerrar y volver a abrir la sesión SSH, completar `deploy/aws/.env` (plantilla: `env.example`) y permitir la IP de la VM en Atlas.
5. `cd ~/NexusPlay/deploy/aws && docker compose -f docker-compose.prod.yml up -d --build`
6. En Vercel, `VITE_API_URL=https://api.nexusplaygames.com` y redesplegar.

## Actualizar
Después de mergear a `main`, en la VM:

```
bash ~/NexusPlay/deploy/aws/actualizar.sh 2>&1 | tee /tmp/actualizar.log
```

Trae `main`, reconstruye la imagen y reinicia los contenedores (las salas activas se pierden: viven en memoria).
No aplica migraciones de base de datos: si el cambio las trae, ejecutarlas aparte. Si el cambio usa una variable
de entorno nueva, agregarla antes al `.env` de la VM.

El archivo `.env` real (claves y contraseñas) vive solo en la VM, con permisos 600, y nunca se sube al repositorio.
