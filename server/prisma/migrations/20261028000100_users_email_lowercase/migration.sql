-- Issue #121: segunda capa de persistencia para el correo. La aplicación ya
-- normaliza con Email.create (trim + lowercase); aquí la base lo garantiza.

-- 1. Abortar con mensaje claro si al pasar a minúsculas dos usuarios chocan.
DO $$
DECLARE
  duplicados text;
BEGIN
  SELECT string_agg(normalizado, ', ')
    INTO duplicados
    FROM (
      SELECT lower(trim(email)) AS normalizado
        FROM users
       GROUP BY lower(trim(email))
      HAVING count(*) > 1
    ) d;
  IF duplicados IS NOT NULL THEN
    RAISE EXCEPTION 'Correos duplicados al ignorar mayúsculas: %. Resuélvelos a mano antes de migrar.', duplicados;
  END IF;
END $$;

-- 2. Normalizar datos existentes.
UPDATE users SET email = lower(trim(email)) WHERE email <> lower(trim(email));

-- 3. Garantizar que nunca se guarde con mayúsculas (el @unique existente
--    pasa a ser insensible a mayúsculas de facto).
ALTER TABLE users
  ADD CONSTRAINT users_email_lowercase_chk CHECK (email = lower(email));
