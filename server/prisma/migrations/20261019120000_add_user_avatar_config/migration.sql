-- Issue #77: avatar armado por piezas (tono de piel, peinado, ropa, calzado…).
-- Solo agrega una columna opcional; las cuentas existentes quedan sin avatar
-- (NULL) hasta que lo configuren.
ALTER TABLE "users" ADD COLUMN "avatar_config" JSONB;
