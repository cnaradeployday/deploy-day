-- Reconstruido a partir del esquema real de Supabase (no habia archivo en el repo).
-- Un usuario con rol personalizado y permiso de lectura sobre el modulo "tareas"
-- tambien puede actualizar tareas (antes solo admin/gerente/responsable/colaborador).

DROP POLICY IF EXISTS tasks_update ON public.tasks;

CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ANY (ARRAY['admin'::user_role,'gerente_operaciones'::user_role]))
    OR direct_responsible_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.task_collaborators tc WHERE tc.task_id = tasks.id AND tc.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.users u JOIN public.role_permissions rp ON rp.role_id = u.custom_role_id
      WHERE u.id = auth.uid() AND rp.module = 'tareas' AND rp.can_read = true
    )
  );
