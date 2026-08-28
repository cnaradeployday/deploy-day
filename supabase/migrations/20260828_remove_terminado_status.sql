-- Se elimina "Terminado" del flujo de tareas. El flujo simple pasa a ser:
-- creado -> estimado -> en_proceso -> presentado -> finalizado
-- (antes: creado -> estimado -> en_proceso -> terminado -> presentado)
-- "Finalizado" queda como el unico estado de cierre, compartido con el flujo
-- de revision de cliente (que ya usaba finalizado como cierre).

CREATE OR REPLACE FUNCTION public.handle_task_status_dates()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.status = 'en_proceso' AND OLD.status != 'en_proceso' THEN
    NEW.started_at = NOW();
  END IF;

  -- "presentado" ahora ocupa el lugar que tenia "terminado" (trabajo terminado, listo para presentar).
  IF NEW.status = 'presentado' AND OLD.status != 'presentado' THEN
    NEW.completed_at = NOW();
  END IF;

  IF NEW.status = 'listo_para_entregar' AND OLD.status != 'listo_para_entregar' THEN
    NEW.completed_at = NOW();
  END IF;

  -- "finalizado" ahora ocupa el lugar que tenia "presentado" en el flujo simple (cierre final).
  -- Para el flujo de revision, presented_at ya se marca al llegar a "enviado_cliente".
  IF NEW.status = 'finalizado' AND OLD.status != 'finalizado' AND NOT NEW.requires_review THEN
    NEW.presented_at = NOW();
  END IF;

  IF NEW.status = 'enviado_cliente' AND OLD.status != 'enviado_cliente' THEN
    NEW.presented_at = NOW();
  END IF;

  RETURN NEW;
END;
$function$;

-- Reindexar datos existentes: terminado -> presentado, presentado (viejo) -> finalizado.
-- El CASE lee el status ORIGINAL de cada fila, por lo que no hay doble corrimiento.
-- (One-off: al momento de aplicarse, "presentado" todavia tenia el significado viejo.)
UPDATE public.tasks
SET status = CASE
  WHEN status = 'terminado' THEN 'presentado'
  WHEN status = 'presentado' THEN 'finalizado'
  ELSE status
END
WHERE status IN ('terminado', 'presentado');
