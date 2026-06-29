-- Habilitar la extensión de UUID si no está activa
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de Categorías
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    icon TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insertar categorías base para emergencias
INSERT INTO public.categories (slug, name, icon) VALUES
('agua', 'Agua potable', 'Droplet'),
('alimentos', 'Alimentos y comida', 'Apple'),
('medicinas', 'Medicinas y salud', 'HeartPulse'),
('refugio', 'Refugio y alojamiento', 'Home'),
('electricidad', 'Electricidad o Carga', 'Zap'),
('atencion_medica', 'Atención médica', 'Stethoscope'),
('transporte', 'Transporte o Evacuación', 'Truck'),
('internet', 'Internet o Comunicación', 'Wifi'),
('personas_desaparecidas', 'Búsqueda de personas', 'Users'),
('personas_encontradas', 'Personas encontradas', 'UserCheck')
ON CONFLICT (slug) DO NOTHING;

-- 2. Tabla de Reportes
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('recurso', 'necesidad')),
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    urgency TEXT NOT NULL CHECK (urgency IN ('baja', 'media', 'alta', 'critica')),
    reporter_alias VARCHAR(50) NOT NULL,
    contact_info TEXT,
    status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'resuelto', 'bloqueado')),
    external_id TEXT,
    source TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_source_external UNIQUE (source, external_id)
);

-- 3. Tabla de Validaciones comunitarias
CREATE TABLE IF NOT EXISTS public.validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE NOT NULL,
    validator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    vote TEXT NOT NULL CHECK (vote IN ('confirmado', 'desactualizado', 'duplicado', 'falso')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(report_id, validator_id) -- Un voto por usuario por reporte
);

-- Índices para optimizar búsquedas por coordenadas y filtros comunes
CREATE INDEX IF NOT EXISTS idx_reports_coords ON public.reports(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_reports_type_status ON public.reports(type, status);
CREATE INDEX IF NOT EXISTS idx_reports_category ON public.reports(category_id);

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validations ENABLE ROW LEVEL SECURITY;

-- Políticas para Categorías (Lectura pública, Escritura restringida)
CREATE POLICY "Permitir lectura pública de categorías" ON public.categories
    FOR SELECT USING (true);

-- Políticas para Reportes (Lectura pública, Escritura autenticados/anónimos)
CREATE POLICY "Permitir lectura pública de reportes activos" ON public.reports
    FOR SELECT USING (status = 'activo');

CREATE POLICY "Permitir inserción de reportes a cualquier usuario autenticado" ON public.reports
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

CREATE POLICY "Permitir actualizar propio reporte" ON public.reports
    FOR UPDATE USING (auth.uid() = reporter_id);

-- Políticas para Validaciones (Lectura pública, Escritura autenticados/anónimos)
CREATE POLICY "Permitir lectura pública de validaciones" ON public.validations
    FOR SELECT USING (true);

CREATE POLICY "Permitir inserción de validaciones a autenticados" ON public.validations
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Función RPC para calcular reportes cercanos usando Haversine directo en SQL
-- Esto nos evita requerir obligatoriamente la extensión PostGIS
CREATE OR REPLACE FUNCTION get_nearby_reports(
  user_lat DOUBLE PRECISION,
  user_lon DOUBLE PRECISION,
  max_dist_meters DOUBLE PRECISION
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  category_id UUID,
  title VARCHAR(100),
  description TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  urgency TEXT,
  reporter_alias VARCHAR(50),
  contact_info TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  distance_meters DOUBLE PRECISION
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.type,
    r.category_id,
    r.title,
    r.description,
    r.latitude,
    r.longitude,
    r.urgency,
    r.reporter_alias,
    r.contact_info,
    r.status,
    r.created_at,
    r.updated_at,
    (6371000 * acos(
      cos(radians(user_lat)) * cos(radians(r.latitude)) * 
      cos(radians(r.longitude) - radians(user_lon)) + 
      sin(radians(user_lat)) * sin(radians(r.latitude))
    )) AS distance_meters
  FROM public.reports r
  WHERE r.status = 'activo'
    AND (6371000 * acos(
      cos(radians(user_lat)) * cos(radians(r.latitude)) * 
      cos(radians(r.longitude) - radians(user_lon)) + 
      sin(radians(user_lat)) * sin(radians(r.latitude))
    )) <= max_dist_meters
  ORDER BY distance_meters ASC;
END;
$$;

-- Migración para añadir campos de origen externo a reportes
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS external_id TEXT,
ADD COLUMN IF NOT EXISTS source TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Añadir restricción única si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_source_external'
    ) THEN
        ALTER TABLE public.reports ADD CONSTRAINT unique_source_external UNIQUE (source, external_id);
    END IF;
END $$;
