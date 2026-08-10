-- Fecha de cierre del resumen bancario al que pertenece cada consumo de
-- tarjeta de credito. Se completa al importar con IA (se extrae del PDF
-- del resumen) o a mano; nullable porque los movimientos ya cargados no
-- la tienen.

ALTER TABLE tarjeta_credito ADD COLUMN fecha_cierre date;
