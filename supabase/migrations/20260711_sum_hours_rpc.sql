-- Fix: consultas de "horas de todo el equipo" traían cada time_entry crudo y sumaban
-- en el servidor de la app, lo que quedaba cortado por el límite de 1000 filas por
-- consulta que aplica PostgREST por defecto (time_entries ya supera esa cantidad).
-- Estas funciones agregan del lado de Postgres y devuelven una fila por tarea/usuario,
-- muy por debajo de cualquier límite razonable, sin importar cuántos time_entries existan.

CREATE OR REPLACE FUNCTION public.sum_hours_by_task(p_task_ids uuid[], p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS TABLE(task_id uuid, total_hours numeric)
LANGUAGE sql STABLE AS $$
  SELECT te.task_id, SUM(te.hours_logged) AS total_hours
  FROM public.time_entries te
  WHERE te.task_id = ANY(p_task_ids)
    AND (p_from IS NULL OR te.entry_date >= p_from)
    AND (p_to IS NULL OR te.entry_date <= p_to)
  GROUP BY te.task_id;
$$;

CREATE OR REPLACE FUNCTION public.sum_hours_by_user(p_user_ids uuid[], p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS TABLE(user_id uuid, total_hours numeric)
LANGUAGE sql STABLE AS $$
  SELECT te.user_id, SUM(te.hours_logged) AS total_hours
  FROM public.time_entries te
  WHERE te.user_id = ANY(p_user_ids)
    AND (p_from IS NULL OR te.entry_date >= p_from)
    AND (p_to IS NULL OR te.entry_date <= p_to)
  GROUP BY te.user_id;
$$;

CREATE OR REPLACE FUNCTION public.sum_hours_by_user_task(p_user_ids uuid[], p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS TABLE(user_id uuid, task_id uuid, total_hours numeric)
LANGUAGE sql STABLE AS $$
  SELECT te.user_id, te.task_id, SUM(te.hours_logged) AS total_hours
  FROM public.time_entries te
  WHERE te.user_id = ANY(p_user_ids)
    AND (p_from IS NULL OR te.entry_date >= p_from)
    AND (p_to IS NULL OR te.entry_date <= p_to)
  GROUP BY te.user_id, te.task_id;
$$;
