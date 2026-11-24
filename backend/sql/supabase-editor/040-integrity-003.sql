-- GENERATED from sql/proposals/003-assignment-integrity.sql; copy/run this ENTIRE FILE alone in SQL Editor.
-- Project sneceodpvscrvjrlqwgw. Role postgres. Verified backup and approval required.
-- Single-use deployment wrapper. Stop on any error. Do not run all files together.
-- REVIEW PROPOSAL, NOT APPLIED. This is NOT the supplied reconstruction.
-- First compare the LIVE schema, preserve its current definitions and review this policy.
-- The operator must explicitly set mlp.reviewed_reference_sha256 in the same session.
-- No history, tracking, finance, seeds, data repair or table reconstruction is introduced.
-- Never loaded by API startup or EF migrations; exercised only in explicitly isolated local integration databases.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO E' BEGIN\n  IF NOT (current_database()=''postgres'' AND current_user=''postgres''\n  AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=''mlp_ddl_owner'' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls)) THEN RAISE EXCEPTION ''Select the approved project and SQL Editor role postgres; provisioning 010 is required''; END IF;\nEND; ';
GRANT mlp_ddl_owner TO postgres WITH SET TRUE, INHERIT FALSE GRANTED BY postgres;
SET LOCAL ROLE mlp_ddl_owner;
DO E' BEGIN\n  IF NOT (EXISTS (SELECT 1 FROM auth_app.__ef_migrations_history WHERE "MigrationId"=''20261024044431_ExplicitOperatorPermissions'')) THEN RAISE EXCEPTION ''040: migration 002 required''; END IF;\nEND; ';
SET LOCAL mlp.reviewed_reference_sha256 = '3E52847EAB332A19D206C08890550A99E46C4914AF3B80B29F7F3067E42BEAC2';
-- BEGIN ORIGINAL SOURCE - ROUTINE LITERAL QUOTING ONLY

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO E'\nBEGIN\n    IF current_setting(''mlp.reviewed_reference_sha256'', true) IS DISTINCT FROM\n        ''3E52847EAB332A19D206C08890550A99E46C4914AF3B80B29F7F3067E42BEAC2'' THEN\n        RAISE EXCEPTION ''Live schema comparison and operator review required; no changes applied'';\n    END IF;\n    IF to_regclass(''iglesia.persona_proceso'') IS NULL OR to_regclass(''iglesia.estado_proceso'') IS NULL THEN\n        RAISE EXCEPTION ''Required existing tables are not visible'';\n    END IF;\n    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint\n        WHERE conrelid = ''iglesia.persona_proceso''::regclass AND conname = ''ck_persona_proceso_fechas'') THEN\n        RAISE EXCEPTION ''Original named date constraint differs; review live definitions first'';\n    END IF;\n    IF to_regclass(''iglesia.ux_persona_proceso_abierto_fecha'') IS NOT NULL OR EXISTS (\n        SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = ''iglesia.persona_proceso''::regclass\n        AND conname = ''ck_persona_proceso_fechas_v2'') THEN\n        RAISE EXCEPTION ''Proposal appears already applied or partially present; review instead of rerunning'';\n    END IF;\nEND;\n';

LOCK TABLE iglesia.persona_proceso, iglesia.estado_proceso IN SHARE ROW EXCLUSIVE MODE;

DO E'\nBEGIN\n    IF (SELECT count(*) FROM iglesia.estado_proceso WHERE\n        (codigo IN (''PENDING'', ''IN_PROGRESS'', ''SUSPENDED'') AND es_final = false) OR\n        (codigo IN (''COMPLETED'', ''WITHDRAWN'') AND es_final = true)) <> 5 OR EXISTS (\n        SELECT 1 FROM iglesia.estado_proceso WHERE codigo NOT IN\n            (''PENDING'', ''IN_PROGRESS'', ''SUSPENDED'', ''COMPLETED'', ''WITHDRAWN'')) THEN\n        RAISE EXCEPTION ''State catalog differs; review its semantics before changing integrity'';\n    END IF;\n    IF EXISTS (\n        SELECT 1 FROM iglesia.persona_proceso pp JOIN iglesia.estado_proceso ep ON ep.id = pp.estado_id\n        WHERE ep.es_final <> (pp.fecha_finalizacion IS NOT NULL)\n           OR (pp.fecha_inicio IS NOT NULL AND pp.fecha_inicio < pp.fecha_asignacion)\n           OR (pp.fecha_finalizacion IS NOT NULL AND pp.fecha_finalizacion < pp.fecha_asignacion)\n           OR (pp.fecha_inicio IS NOT NULL AND pp.fecha_finalizacion < pp.fecha_inicio)\n           OR (ep.codigo = ''PENDING'' AND (pp.fecha_inicio IS NOT NULL OR pp.fecha_finalizacion IS NOT NULL))\n           OR (ep.codigo IN (''IN_PROGRESS'', ''SUSPENDED'', ''COMPLETED'') AND pp.fecha_inicio IS NULL)) THEN\n        RAISE EXCEPTION ''Existing dates/state rows need manual review; this script will not repair data'';\n    END IF;\n    IF EXISTS (SELECT 1 FROM iglesia.persona_proceso WHERE fecha_finalizacion IS NULL\n        GROUP BY persona_id, proceso_id HAVING count(*) > 1) THEN\n        RAISE EXCEPTION ''Existing open duplicates require manual review; no rows were removed'';\n    END IF;\nEND;\n';

-- Validate the replacement before removing the conflicting original CHECK.
-- WITHDRAWN may have no start date; completion still requires a start in the trigger.
ALTER TABLE iglesia.persona_proceso ADD CONSTRAINT ck_persona_proceso_fechas_v2 CHECK (
    (fecha_inicio IS NULL OR fecha_inicio >= fecha_asignacion)
    AND (fecha_finalizacion IS NULL OR fecha_finalizacion >= fecha_asignacion)
    AND (fecha_finalizacion IS NULL OR fecha_inicio IS NULL OR fecha_finalizacion >= fecha_inicio)
) NOT VALID;
ALTER TABLE iglesia.persona_proceso VALIDATE CONSTRAINT ck_persona_proceso_fechas_v2;

CREATE OR REPLACE FUNCTION iglesia.validar_estado_fechas_v2()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS E'\nDECLARE\n    v_codigo text;\n    v_anterior text;\nBEGIN\n    SELECT codigo INTO v_codigo FROM iglesia.estado_proceso WHERE id = NEW.estado_id;\n    IF v_codigo IS NULL OR v_codigo NOT IN (''PENDING'', ''IN_PROGRESS'', ''SUSPENDED'', ''COMPLETED'', ''WITHDRAWN'') THEN\n        RAISE EXCEPTION ''Estado de proceso no permitido'';\n    END IF;\n    IF TG_OP = ''UPDATE'' AND NEW.estado_id IS DISTINCT FROM OLD.estado_id THEN\n        SELECT codigo INTO v_anterior FROM iglesia.estado_proceso WHERE id = OLD.estado_id;\n        IF NOT ((v_anterior = ''PENDING'' AND v_codigo IN (''IN_PROGRESS'', ''WITHDRAWN''))\n            OR (v_anterior = ''IN_PROGRESS'' AND v_codigo IN (''SUSPENDED'', ''COMPLETED'', ''WITHDRAWN''))\n            OR (v_anterior = ''SUSPENDED'' AND v_codigo IN (''IN_PROGRESS'', ''WITHDRAWN''))) THEN\n            RAISE EXCEPTION ''Transicion de estado no permitida'';\n        END IF;\n    END IF;\n    IF v_codigo = ''PENDING'' THEN\n        IF NEW.fecha_inicio IS NOT NULL OR NEW.fecha_finalizacion IS NOT NULL THEN\n            RAISE EXCEPTION ''Un proceso pendiente no puede tener inicio o finalizacion'';\n        END IF;\n    ELSIF v_codigo IN (''IN_PROGRESS'', ''SUSPENDED'') THEN\n        NEW.fecha_inicio := COALESCE(NEW.fecha_inicio, NOW());\n        IF NEW.fecha_finalizacion IS NOT NULL THEN\n            RAISE EXCEPTION ''Una asignacion abierta no puede tener finalizacion'';\n        END IF;\n    ELSIF v_codigo = ''COMPLETED'' THEN\n        NEW.fecha_inicio := COALESCE(NEW.fecha_inicio, NOW());\n        NEW.fecha_finalizacion := COALESCE(NEW.fecha_finalizacion, NOW());\n    ELSIF v_codigo = ''WITHDRAWN'' THEN\n        -- Do not invent a start date for an assignment that was never started.\n        NEW.fecha_finalizacion := COALESCE(NEW.fecha_finalizacion, NOW());\n    END IF;\n    IF (NEW.fecha_inicio IS NOT NULL AND NEW.fecha_inicio < NEW.fecha_asignacion)\n        OR (NEW.fecha_finalizacion IS NOT NULL AND NEW.fecha_finalizacion < NEW.fecha_asignacion)\n        OR (NEW.fecha_inicio IS NOT NULL AND NEW.fecha_finalizacion < NEW.fecha_inicio) THEN\n        RAISE EXCEPTION ''Fechas inconsistentes para la asignacion'';\n    END IF;\n    NEW.fecha_actualizacion := NOW();\n    RETURN NEW;\nEND;\n';

-- CREATE OR REPLACE preserves the trigger identity; original function remains for reviewed rollback.
CREATE OR REPLACE TRIGGER trg_validar_estado_fechas
BEFORE INSERT OR UPDATE OF estado_id, fecha_asignacion, fecha_inicio, fecha_finalizacion
ON iglesia.persona_proceso FOR EACH ROW EXECUTE FUNCTION iglesia.validar_estado_fechas_v2();

-- A physical unique index enforces open uniqueness under concurrent transactions.
-- The date/state preflight and trigger establish the predicate's meaning without a cross-table CHECK.
CREATE UNIQUE INDEX ux_persona_proceso_abierto_fecha
ON iglesia.persona_proceso(persona_id, proceso_id) WHERE fecha_finalizacion IS NULL;

ALTER TABLE iglesia.persona_proceso DROP CONSTRAINT ck_persona_proceso_fechas;
-- END ORIGINAL SOURCE - ROUTINE LITERAL QUOTING ONLY
DO E' BEGIN\n  IF NOT (EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid=''iglesia.persona_proceso''::regclass\n      AND conname=''ck_persona_proceso_fechas_v2'' AND convalidated)\n      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid=''iglesia.persona_proceso''::regclass AND conname=''ck_persona_proceso_fechas'')\n      AND EXISTS (SELECT 1 FROM pg_catalog.pg_index WHERE indexrelid=to_regclass(''iglesia.ux_persona_proceso_abierto_fecha'') AND indisvalid AND indisready AND indisunique)\n      AND EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid=''iglesia.persona_proceso''::regclass\n        AND tgname=''trg_validar_estado_fechas'' AND tgfoid=to_regprocedure(''iglesia.validar_estado_fechas_v2()'') AND NOT tgisinternal)) THEN RAISE EXCEPTION ''040: integrity checkpoint failed''; END IF;\nEND; ';
SET LOCAL ROLE postgres;

REVOKE mlp_ddl_owner FROM postgres GRANTED BY postgres;
DO E' BEGIN\n  IF NOT (NOT pg_catalog.pg_has_role(''postgres'',''mlp_ddl_owner'',''SET'') AND NOT pg_catalog.pg_has_role(''postgres'',''mlp_ddl_owner'',''USAGE'')) THEN RAISE EXCEPTION ''Temporary DDL access was not removed; transaction must abort''; END IF;\nEND; ';
SELECT '040-integrity-003.sql' AS step, 'OK - check COMMIT and continue only after review' AS result;
COMMIT;
-- FIN 040: archivo completo; ejecutar desde BEGIN hasta COMMIT, sin seleccion parcial.
