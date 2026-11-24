-- SQL Editor, project sneceodpvscrvjrlqwgw, role postgres. Metadata only.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
WITH checks AS (
  SELECT
    EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class t ON t.oid=c.conrelid
      JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
      WHERE n.nspname='iglesia' AND t.relname='persona_proceso'
        AND c.conname='ck_persona_proceso_fechas_v2' AND c.convalidated) AS new_check_validated,
    NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class t ON t.oid=c.conrelid
      JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
      WHERE n.nspname='iglesia' AND t.relname='persona_proceso' AND c.conname='ck_persona_proceso_fechas') AS old_check_replaced,
    EXISTS (SELECT 1 FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class idx ON idx.oid=i.indexrelid
      JOIN pg_catalog.pg_class t ON t.oid=i.indrelid JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
      WHERE n.nspname='iglesia' AND t.relname='persona_proceso' AND idx.relname='ux_persona_proceso_abierto_fecha'
        AND i.indisunique AND i.indisvalid AND i.indisready AND i.indpred IS NOT NULL) AS partial_unique_index_ready,
    EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='iglesia' AND p.proname='validar_estado_fechas_v2' AND p.pronargs=0
        AND pg_catalog.pg_get_userbyid(p.proowner)='mlp_ddl_owner' AND NOT p.prosecdef
        AND p.proconfig @> ARRAY['search_path=""']) AS function_security_preserved,
    EXISTS (SELECT 1 FROM pg_catalog.pg_trigger tr JOIN pg_catalog.pg_class t ON t.oid=tr.tgrelid
      JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace JOIN pg_catalog.pg_proc p ON p.oid=tr.tgfoid
      JOIN pg_catalog.pg_namespace pn ON pn.oid=p.pronamespace
      WHERE n.nspname='iglesia' AND t.relname='persona_proceso' AND tr.tgname='trg_validar_estado_fechas'
        AND NOT tr.tgisinternal AND tr.tgenabled='O' AND pn.nspname='iglesia'
        AND p.proname='validar_estado_fechas_v2' AND p.pronargs=0) AS trigger_points_to_v2,
    (SELECT count(*) FROM pg_catalog.pg_class t JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
      WHERE n.nspname='iglesia' AND t.relkind='r' AND t.relrowsecurity AND NOT t.relforcerowsecurity)=11 AS ministry_rls_preserved
)
SELECT *, new_check_validated AND old_check_replaced AND partial_unique_index_ready
  AND function_security_preserved AND trigger_points_to_v2 AND ministry_rls_preserved AS all_checks_passed
FROM checks;
ROLLBACK;
