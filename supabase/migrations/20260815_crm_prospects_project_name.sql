-- Nombre del proyecto/cotizacion cotizado, distinto del nombre del cliente/prospecto
-- (un mismo cliente puede tener varias cotizaciones en curso a la vez).

ALTER TABLE prospects ADD COLUMN project_name text NOT NULL DEFAULT '';
ALTER TABLE prospects ALTER COLUMN project_name DROP DEFAULT;
