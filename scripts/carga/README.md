# Prueba de carga de salas

Simula N jugadores por Socket.IO y mide CPU/RAM del servidor. Úsala solo contra un servidor de pruebas: registra usuarios `carga-*@carga.test` en la base a la que apunte.

## Entorno local aislado (puertos 3001 y 5174)

1. `.env` en la raíz con `POSTGRES_PORT=5433` y `MONGO_PORT=27018`, luego `docker compose -p nexusplay-carga up -d`.
2. El replica set de Mongo no se inicializa solo con un puerto distinto de 27017; hazlo a mano: `docker exec nexusplay-carga-mongo-1 mongosh -u admin -p admin --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27017'}]})"`.
3. `server/.env`: `DATABASE_URL` a `localhost:5433`, `MONGODB_URI` con `localhost:27018/...?directConnection=true&authSource=admin`, `PORT=3001`, `CORS_ORIGIN=http://localhost:5174`, `JWT_SECRET` cualquiera.
4. `client/.env.local`: `VITE_API_URL=http://localhost:3001`; cliente con `npx vite --port 5174`.
5. Migrar y sembrar: `prisma migrate deploy`, `npm run build`, y los seeds `seed-dual-quest-pixi-demo` y `seed-domino-niveles-demo` de `dist-seed/prisma`.

## Ejecutar

```
node scripts/carga/carga-salas.mjs --jugadores 30 --escenario duo --duracion 60 --pid <PID del servidor>
```

Escenarios: `duo`, `domino`, `mixto`. Los resultados quedan en `scripts/carga/resultados/` (ignorado por git).
Nota: en Windows los temporizadores tienen ~15 ms de resolución, así que los 30 Hz reales salen cerca de 21 Hz; en Linux serán exactos.
