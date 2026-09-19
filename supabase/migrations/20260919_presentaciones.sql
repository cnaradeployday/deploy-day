-- Modulo Presentaciones: biblioteca de presentaciones HTML por cliente, con
-- publicacion via URL permanente, versionado, favoritos, tags, compartir
-- interno, proteccion por contrasena/vencimiento y analytics de vistas.

CREATE TABLE public.presentaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  slug text NOT NULL UNIQUE,
  descripcion text,
  visibilidad text NOT NULL DEFAULT 'publica' CHECK (visibilidad = ANY (ARRAY['publica','privada'])),
  estado text NOT NULL DEFAULT 'borrador' CHECK (estado = ANY (ARRAY['borrador','procesando','publicada','error','despublicada'])),
  error_mensaje text,
  version_actual integer NOT NULL DEFAULT 0,
  portada_path text,
  password_hash text,
  link_expira_at timestamptz,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_presentaciones_client_id ON public.presentaciones(client_id);
CREATE INDEX idx_presentaciones_updated_at ON public.presentaciones(updated_at DESC);

COMMENT ON COLUMN public.presentaciones.version_actual IS 'numero_version de presentaciones_versiones que esta publicado; 0 = ninguna version publicada aun.';

-- Historial de versiones: cada carga/reemplazo de archivos crea una fila.
-- storage_prefix apunta a la carpeta del bucket 'presentaciones' con esos archivos.
CREATE TABLE public.presentaciones_versiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentacion_id uuid NOT NULL REFERENCES public.presentaciones(id) ON DELETE CASCADE,
  numero_version integer NOT NULL,
  storage_prefix text NOT NULL,
  archivo_principal text NOT NULL DEFAULT 'index.html',
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (presentacion_id, numero_version)
);

CREATE INDEX idx_presentaciones_versiones_presentacion_id ON public.presentaciones_versiones(presentacion_id);

CREATE TABLE public.presentaciones_favoritos (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  presentacion_id uuid NOT NULL REFERENCES public.presentaciones(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, presentacion_id)
);

CREATE TABLE public.presentaciones_clientes_favoritos (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, client_id)
);

CREATE TABLE public.presentaciones_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.presentaciones_tags_rel (
  presentacion_id uuid NOT NULL REFERENCES public.presentaciones(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.presentaciones_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (presentacion_id, tag_id)
);

-- Compartir una presentacion privada con companeros puntuales (ademas del dueno y admin).
CREATE TABLE public.presentaciones_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentacion_id uuid NOT NULL REFERENCES public.presentaciones(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (presentacion_id, user_id)
);

-- Analytics: una fila por visita al link publico. Sin user_id porque quien mira es externo.
CREATE TABLE public.presentaciones_vistas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentacion_id uuid NOT NULL REFERENCES public.presentaciones(id) ON DELETE CASCADE,
  visto_at timestamptz NOT NULL DEFAULT now(),
  referrer text,
  user_agent text
);

CREATE INDEX idx_presentaciones_vistas_presentacion_id ON public.presentaciones_vistas(presentacion_id, visto_at DESC);

CREATE OR REPLACE FUNCTION public.set_presentaciones_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_presentaciones_updated_at
  BEFORE UPDATE ON public.presentaciones
  FOR EACH ROW EXECUTE FUNCTION public.set_presentaciones_updated_at();

-- RLS -------------------------------------------------------------------

ALTER TABLE public.presentaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentaciones_versiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentaciones_favoritos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentaciones_clientes_favoritos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentaciones_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentaciones_tags_rel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentaciones_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentaciones_vistas ENABLE ROW LEVEL SECURITY;

-- Una privada solo la ve quien la creo, un admin, o alguien con quien se comparte.
CREATE POLICY presentaciones_select ON public.presentaciones
  FOR SELECT USING (
    has_module_access('presentaciones','read')
    AND (
      visibilidad = 'publica'
      OR created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
      OR EXISTS (SELECT 1 FROM public.presentaciones_shares s WHERE s.presentacion_id = presentaciones.id AND s.user_id = auth.uid())
    )
  );

CREATE POLICY presentaciones_insert ON public.presentaciones
  FOR INSERT WITH CHECK (has_module_access('presentaciones','write') AND created_by = auth.uid());

CREATE POLICY presentaciones_update ON public.presentaciones
  FOR UPDATE USING (
    has_module_access('presentaciones','write')
    AND (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  );

CREATE POLICY presentaciones_delete ON public.presentaciones
  FOR DELETE USING (
    has_module_access('presentaciones','write')
    AND (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  );

CREATE POLICY presentaciones_versiones_select ON public.presentaciones_versiones
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.presentaciones p WHERE p.id = presentacion_id));

CREATE POLICY presentaciones_versiones_insert ON public.presentaciones_versiones
  FOR INSERT WITH CHECK (has_module_access('presentaciones','write'));

CREATE POLICY presentaciones_favoritos_all ON public.presentaciones_favoritos
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY presentaciones_clientes_favoritos_all ON public.presentaciones_clientes_favoritos
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY presentaciones_tags_select ON public.presentaciones_tags
  FOR SELECT USING (has_module_access('presentaciones','read'));

CREATE POLICY presentaciones_tags_insert ON public.presentaciones_tags
  FOR INSERT WITH CHECK (has_module_access('presentaciones','write'));

CREATE POLICY presentaciones_tags_rel_select ON public.presentaciones_tags_rel
  FOR SELECT USING (has_module_access('presentaciones','read'));

CREATE POLICY presentaciones_tags_rel_insert ON public.presentaciones_tags_rel
  FOR INSERT WITH CHECK (has_module_access('presentaciones','write'));

CREATE POLICY presentaciones_tags_rel_delete ON public.presentaciones_tags_rel
  FOR DELETE USING (has_module_access('presentaciones','write'));

CREATE POLICY presentaciones_shares_select ON public.presentaciones_shares
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.presentaciones p WHERE p.id = presentacion_id AND p.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY presentaciones_shares_insert ON public.presentaciones_shares
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.presentaciones p WHERE p.id = presentacion_id AND p.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY presentaciones_shares_delete ON public.presentaciones_shares
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.presentaciones p WHERE p.id = presentacion_id AND p.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- Vistas: las inserta el route handler publico con el service role (bypassea RLS).
-- Solo lectura para quien puede administrar la presentacion.
CREATE POLICY presentaciones_vistas_select ON public.presentaciones_vistas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.presentaciones p
      WHERE p.id = presentacion_id
        AND (p.created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
    )
  );

-- Storage ----------------------------------------------------------------
-- Bucket privado: los archivos se sirven siempre a traves de /p/[slug], nunca
-- con la URL directa de Storage, para poder aplicar contrasena/vencimiento
-- y la regla de visibilidad publica/privada de forma centralizada.

INSERT INTO storage.buckets (id, name, public)
VALUES ('presentaciones', 'presentaciones', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY presentaciones_files_select ON storage.objects
  FOR SELECT USING (bucket_id = 'presentaciones' AND has_module_access('presentaciones','read'));

CREATE POLICY presentaciones_files_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'presentaciones' AND has_module_access('presentaciones','write'));

CREATE POLICY presentaciones_files_update ON storage.objects
  FOR UPDATE USING (bucket_id = 'presentaciones' AND has_module_access('presentaciones','write'))
  WITH CHECK (bucket_id = 'presentaciones' AND has_module_access('presentaciones','write'));

CREATE POLICY presentaciones_files_delete ON storage.objects
  FOR DELETE USING (bucket_id = 'presentaciones' AND has_module_access('presentaciones','write'));
