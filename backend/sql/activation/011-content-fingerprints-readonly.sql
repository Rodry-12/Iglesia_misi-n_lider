-- Execute before/after each activation step with the authorized administrator.
-- Requires a window without external writers. Never returns personal records.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '60s';
SELECT jsonb_object_agg(name, jsonb_build_object('rows', row_count, 'fingerprint', fingerprint))::text
FROM (
  SELECT 'sede' name, count(*) row_count, md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text)), '')) fingerprint FROM iglesia.sede t
  UNION ALL SELECT 'persona', count(*), md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text)), '')) FROM iglesia.persona t
  UNION ALL SELECT 'persona_documento', count(*), md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text)), '')) FROM iglesia.persona_documento t
  UNION ALL SELECT 'persona_sede', count(*), md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text)), '')) FROM iglesia.persona_sede t
  UNION ALL SELECT 'categoria_proceso', count(*), md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text)), '')) FROM iglesia.categoria_proceso t
  UNION ALL SELECT 'proceso', count(*), md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text)), '')) FROM iglesia.proceso t
  UNION ALL SELECT 'estado_proceso', count(*), md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text)), '')) FROM iglesia.estado_proceso t
  UNION ALL SELECT 'persona_proceso', count(*), md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text)), '')) FROM iglesia.persona_proceso t
  UNION ALL SELECT 'rol', count(*), md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text)), '')) FROM iglesia.rol t
  UNION ALL SELECT 'permiso', count(*), md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text)), '')) FROM iglesia.permiso t
  UNION ALL SELECT 'rol_permiso', count(*), md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text)), '')) FROM iglesia.rol_permiso t
) content;
ROLLBACK;
