-- tasks tenia RLS habilitado sin ninguna politica de DELETE: el delete no borraba filas
-- (0 rows affected, sin error) y la tarea reaparecia al refrescar la pagina.
CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE USING (
    (EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = ANY (ARRAY['admin'::user_role, 'gerente_operaciones'::user_role])
    ))
    OR direct_responsible_id = auth.uid()
    OR (EXISTS (
      SELECT 1 FROM task_collaborators tc
      WHERE tc.task_id = tasks.id AND tc.user_id = auth.uid()
    ))
  );

-- Sin esta politica, el cleanup previo en deleteTaskAction tambien no-opeaba,
-- y el DELETE final en tasks fallaba por el FK RESTRICT de time_entries en tareas con horas cargadas.
CREATE POLICY "time_entries_delete" ON time_entries
  FOR DELETE USING (
    get_current_user_role() = ANY (ARRAY['admin'::user_role, 'gerente_operaciones'::user_role])
    OR user_id = auth.uid()
  );

-- Idem para hour_requests, referenciada por tasks con ON DELETE CASCADE pero
-- limpiada explicitamente por la app antes del borrado.
CREATE POLICY "hour_requests_delete" ON hour_requests
  FOR DELETE USING (
    get_current_user_role() = ANY (ARRAY['admin'::user_role, 'gerente_operaciones'::user_role])
  );
