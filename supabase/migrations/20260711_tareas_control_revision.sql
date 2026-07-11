-- Workflow de revisión y control de versiones para tareas.
-- Ver spec: control de revisión, versiones, entrega al cliente.

ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'en_revision';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'listo_para_entregar';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'enviado_cliente';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'finalizado';

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS requires_review boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.tasks.requires_review IS 'Si la tarea usa el flujo de control de revisión (versiones, revisor, entrega a cliente).';

CREATE TABLE public.task_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  numero_version integer NOT NULL,
  link text NOT NULL,
  comentario_creador text,
  creado_por uuid NOT NULL REFERENCES public.users(id),
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  estado_revision text NOT NULL DEFAULT 'pendiente'
    CHECK (estado_revision = ANY (ARRAY['pendiente','correcciones_solicitadas','aprobada'])),
  revisado_por uuid REFERENCES public.users(id),
  fecha_revision timestamptz,
  comentario_revision text,
  UNIQUE (task_id, numero_version)
);

CREATE INDEX idx_task_versions_task_id ON public.task_versions(task_id);

CREATE OR REPLACE FUNCTION public.set_task_version_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT COALESCE(MAX(numero_version), 0) + 1 INTO NEW.numero_version
  FROM public.task_versions WHERE task_id = NEW.task_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_task_versions_number
  BEFORE INSERT ON public.task_versions
  FOR EACH ROW EXECUTE FUNCTION public.set_task_version_number();

ALTER TABLE public.task_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_versions_select ON public.task_versions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY task_versions_insert ON public.task_versions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND creado_por = auth.uid());

CREATE POLICY task_versions_review_update ON public.task_versions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ANY (ARRAY['admin'::user_role,'gerente_operaciones'::user_role]))
    OR EXISTS (
      SELECT 1 FROM public.users u JOIN public.role_permissions rp ON rp.role_id = u.custom_role_id
      WHERE u.id = auth.uid() AND rp.module = 'revisar_tareas' AND rp.can_read = true
    )
  );

-- started_at/completed_at/presented_at también para los nuevos estados del flujo de revisión.
CREATE OR REPLACE FUNCTION public.handle_task_status_dates()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.status = 'en_proceso' AND OLD.status != 'en_proceso' THEN
    NEW.started_at = NOW();
  END IF;

  IF NEW.status = 'terminado' AND OLD.status != 'terminado' THEN
    NEW.completed_at = NOW();
  END IF;

  IF NEW.status = 'presentado' AND OLD.status != 'presentado' THEN
    NEW.presented_at = NOW();
  END IF;

  IF NEW.status = 'listo_para_entregar' AND OLD.status != 'listo_para_entregar' THEN
    NEW.completed_at = NOW();
  END IF;

  IF NEW.status = 'enviado_cliente' AND OLD.status != 'enviado_cliente' THEN
    NEW.presented_at = NOW();
  END IF;

  RETURN NEW;
END;
$function$;

-- Los colaboradores también pueden avanzar el estado de una tarea (antes solo responsable/admin/gerente).
DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ANY (ARRAY['admin'::user_role,'gerente_operaciones'::user_role]))
    OR direct_responsible_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.task_collaborators tc WHERE tc.task_id = tasks.id AND tc.user_id = auth.uid())
  );

-- Permiso "Puede revisar tareas": inicialmente Natalia Celiz (Gerencia Operaciones) y Gastón Borda (Gestion).
INSERT INTO public.role_permissions (role_id, module, can_read, can_write)
VALUES
  ('19116f97-6bd0-4af6-b163-015ce4686214', 'revisar_tareas', true, true),
  ('16b65ed8-8a24-41b4-b6d5-4e3d0a3c3e10', 'revisar_tareas', true, true)
ON CONFLICT DO NOTHING;
