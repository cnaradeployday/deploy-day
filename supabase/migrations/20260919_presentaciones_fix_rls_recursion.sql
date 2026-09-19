-- presentaciones_select consultaba presentaciones_shares directo, y la policy
-- de presentaciones_shares consulta presentaciones de vuelta -> "infinite
-- recursion detected in policy for relation presentaciones" (42P17) al crear
-- una presentacion nueva. Se rompe el ciclo con una funcion SECURITY DEFINER
-- (mismo patron que has_module_access): al ejecutar con privilegios del dueno
-- de la tabla, no dispara RLS de nuevo sobre presentaciones_shares.

CREATE OR REPLACE FUNCTION public.presentacion_compartida_con_usuario(p_presentacion_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.presentaciones_shares s
    WHERE s.presentacion_id = p_presentacion_id AND s.user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS presentaciones_select ON public.presentaciones;

CREATE POLICY presentaciones_select ON public.presentaciones
  FOR SELECT USING (
    has_module_access('presentaciones','read')
    AND (
      visibilidad = 'publica'
      OR created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
      OR public.presentacion_compartida_con_usuario(presentaciones.id)
    )
  );
