-- PROPUESTA: requiere respaldo vigente y autorizacion expresa antes de ejecutar.
-- Solo lectura del catalogo existente; no crea tablas ni modifica sus registros.
BEGIN;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid='iglesia.tipo_documento'::regclass AND relrowsecurity)
       OR EXISTS (SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='iglesia.tipo_documento'::regclass)
       OR has_table_privilege('mlp_runtime', 'iglesia.tipo_documento', 'SELECT') THEN
        RAISE EXCEPTION 'Document catalog preconditions changed; review required';
    END IF;
END $$;
GRANT SELECT ON TABLE iglesia.tipo_documento TO mlp_runtime;
CREATE POLICY mlp_runtime_document_types_read ON iglesia.tipo_documento
    FOR SELECT TO mlp_runtime
    USING (auth_app.verified_actor_id() IS NOT NULL);
COMMIT;

-- Recuperacion, SOLO con autorizacion separada y tras verificar que no hubo cambios posteriores:
-- BEGIN;
-- DROP POLICY mlp_runtime_document_types_read ON iglesia.tipo_documento;
-- REVOKE SELECT ON TABLE iglesia.tipo_documento FROM mlp_runtime;
-- COMMIT;
