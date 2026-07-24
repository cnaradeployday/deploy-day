-- El boton "Editar tarea" se muestra a admin/gerente_operaciones o a cualquier
-- rol personalizado con permiso en el modulo 'tareas' (ver tareas/[id]/page.tsx,
-- canEditTask), pero la politica de UPDATE en tasks solo contemplaba
-- admin/gerente_operaciones, el responsable directo y los colaboradores.
-- Un usuario con ese permiso de rol pero sin ser responsable/colaborador de la
-- tarea llegaba al formulario y el UPDATE se descartaba en silencio (0 filas,
-- sin error), asi que "no guardaba los cambios".
DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE USING (
    (EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = ANY (ARRAY['admin'::user_role, 'gerente_operaciones'::user_role])
    ))
    OR direct_responsible_id = auth.uid()
    OR (EXISTS (
      SELECT 1 FROM task_collaborators tc
      WHERE tc.task_id = tasks.id AND tc.user_id = auth.uid()
    ))
    OR (EXISTS (
      SELECT 1 FROM users u
      JOIN role_permissions rp ON rp.role_id = u.custom_role_id
      WHERE u.id = auth.uid() AND rp.module = 'tareas' AND rp.can_read = true
    ))
  );
