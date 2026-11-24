-- REVIEW PROPOSAL, NOT APPLIED. This is NOT the supplied reconstruction.
-- First compare the LIVE schema, preserve its current definitions and review this policy.
-- The operator must explicitly set mlp.reviewed_reference_sha256 in the same session.
-- No history, tracking, finance, seeds, data repair or table reconstruction is introduced.
-- Never loaded by API startup or EF migrations; exercised only in explicitly isolated local integration databases.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preflight$
BEGIN
    IF current_setting('mlp.reviewed_reference_sha256', true) IS DISTINCT FROM
        '3E52847EAB332A19D206C08890550A99E46C4914AF3B80B29F7F3067E42BEAC2' THEN
        RAISE EXCEPTION 'Live schema comparison and operator review required; no changes applied';
    END IF;
    IF to_regclass('iglesia.persona_proceso') IS NULL OR to_regclass('iglesia.estado_proceso') IS NULL THEN
        RAISE EXCEPTION 'Required existing tables are not visible';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conrelid = 'iglesia.persona_proceso'::regclass AND conname = 'ck_persona_proceso_fechas') THEN
        RAISE EXCEPTION 'Original named date constraint differs; review live definitions first';
    END IF;
    IF to_regclass('iglesia.ux_persona_proceso_abierto_fecha') IS NOT NULL OR EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'iglesia.persona_proceso'::regclass
        AND conname = 'ck_persona_proceso_fechas_v2') THEN
        RAISE EXCEPTION 'Proposal appears already applied or partially present; review instead of rerunning';
    END IF;
END;
$preflight$;

LOCK TABLE iglesia.persona_proceso, iglesia.estado_proceso IN SHARE ROW EXCLUSIVE MODE;

DO $data_preflight$
BEGIN
    IF (SELECT count(*) FROM iglesia.estado_proceso WHERE
        (codigo IN ('PENDING', 'IN_PROGRESS', 'SUSPENDED') AND es_final = false) OR
        (codigo IN ('COMPLETED', 'WITHDRAWN') AND es_final = true)) <> 5 OR EXISTS (
        SELECT 1 FROM iglesia.estado_proceso WHERE codigo NOT IN
            ('PENDING', 'IN_PROGRESS', 'SUSPENDED', 'COMPLETED', 'WITHDRAWN')) THEN
        RAISE EXCEPTION 'State catalog differs; review its semantics before changing integrity';
    END IF;
    IF EXISTS (
        SELECT 1 FROM iglesia.persona_proceso pp JOIN iglesia.estado_proceso ep ON ep.id = pp.estado_id
        WHERE ep.es_final <> (pp.fecha_finalizacion IS NOT NULL)
           OR (pp.fecha_inicio IS NOT NULL AND pp.fecha_inicio < pp.fecha_asignacion)
           OR (pp.fecha_finalizacion IS NOT NULL AND pp.fecha_finalizacion < pp.fecha_asignacion)
           OR (pp.fecha_inicio IS NOT NULL AND pp.fecha_finalizacion < pp.fecha_inicio)
           OR (ep.codigo = 'PENDING' AND (pp.fecha_inicio IS NOT NULL OR pp.fecha_finalizacion IS NOT NULL))
           OR (ep.codigo IN ('IN_PROGRESS', 'SUSPENDED', 'COMPLETED') AND pp.fecha_inicio IS NULL)) THEN
        RAISE EXCEPTION 'Existing dates/state rows need manual review; this script will not repair data';
    END IF;
    IF EXISTS (SELECT 1 FROM iglesia.persona_proceso WHERE fecha_finalizacion IS NULL
        GROUP BY persona_id, proceso_id HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'Existing open duplicates require manual review; no rows were removed';
    END IF;
END;
$data_preflight$;

-- Validate the replacement before removing the conflicting original CHECK.
-- WITHDRAWN may have no start date; completion still requires a start in the trigger.
ALTER TABLE iglesia.persona_proceso ADD CONSTRAINT ck_persona_proceso_fechas_v2 CHECK (
    (fecha_inicio IS NULL OR fecha_inicio >= fecha_asignacion)
    AND (fecha_finalizacion IS NULL OR fecha_finalizacion >= fecha_asignacion)
    AND (fecha_finalizacion IS NULL OR fecha_inicio IS NULL OR fecha_finalizacion >= fecha_inicio)
) NOT VALID;
ALTER TABLE iglesia.persona_proceso VALIDATE CONSTRAINT ck_persona_proceso_fechas_v2;

CREATE OR REPLACE FUNCTION iglesia.validar_estado_fechas_v2()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $function$
DECLARE
    v_codigo text;
    v_anterior text;
BEGIN
    SELECT codigo INTO v_codigo FROM iglesia.estado_proceso WHERE id = NEW.estado_id;
    IF v_codigo IS NULL OR v_codigo NOT IN ('PENDING', 'IN_PROGRESS', 'SUSPENDED', 'COMPLETED', 'WITHDRAWN') THEN
        RAISE EXCEPTION 'Estado de proceso no permitido';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.estado_id IS DISTINCT FROM OLD.estado_id THEN
        SELECT codigo INTO v_anterior FROM iglesia.estado_proceso WHERE id = OLD.estado_id;
        IF NOT ((v_anterior = 'PENDING' AND v_codigo IN ('IN_PROGRESS', 'WITHDRAWN'))
            OR (v_anterior = 'IN_PROGRESS' AND v_codigo IN ('SUSPENDED', 'COMPLETED', 'WITHDRAWN'))
            OR (v_anterior = 'SUSPENDED' AND v_codigo IN ('IN_PROGRESS', 'WITHDRAWN'))) THEN
            RAISE EXCEPTION 'Transicion de estado no permitida';
        END IF;
    END IF;
    IF v_codigo = 'PENDING' THEN
        IF NEW.fecha_inicio IS NOT NULL OR NEW.fecha_finalizacion IS NOT NULL THEN
            RAISE EXCEPTION 'Un proceso pendiente no puede tener inicio o finalizacion';
        END IF;
    ELSIF v_codigo IN ('IN_PROGRESS', 'SUSPENDED') THEN
        NEW.fecha_inicio := COALESCE(NEW.fecha_inicio, NOW());
        IF NEW.fecha_finalizacion IS NOT NULL THEN
            RAISE EXCEPTION 'Una asignacion abierta no puede tener finalizacion';
        END IF;
    ELSIF v_codigo = 'COMPLETED' THEN
        NEW.fecha_inicio := COALESCE(NEW.fecha_inicio, NOW());
        NEW.fecha_finalizacion := COALESCE(NEW.fecha_finalizacion, NOW());
    ELSIF v_codigo = 'WITHDRAWN' THEN
        -- Do not invent a start date for an assignment that was never started.
        NEW.fecha_finalizacion := COALESCE(NEW.fecha_finalizacion, NOW());
    END IF;
    IF (NEW.fecha_inicio IS NOT NULL AND NEW.fecha_inicio < NEW.fecha_asignacion)
        OR (NEW.fecha_finalizacion IS NOT NULL AND NEW.fecha_finalizacion < NEW.fecha_asignacion)
        OR (NEW.fecha_inicio IS NOT NULL AND NEW.fecha_finalizacion < NEW.fecha_inicio) THEN
        RAISE EXCEPTION 'Fechas inconsistentes para la asignacion';
    END IF;
    NEW.fecha_actualizacion := NOW();
    RETURN NEW;
END;
$function$;

-- CREATE OR REPLACE preserves the trigger identity; original function remains for reviewed rollback.
CREATE OR REPLACE TRIGGER trg_validar_estado_fechas
BEFORE INSERT OR UPDATE OF estado_id, fecha_asignacion, fecha_inicio, fecha_finalizacion
ON iglesia.persona_proceso FOR EACH ROW EXECUTE FUNCTION iglesia.validar_estado_fechas_v2();

-- A physical unique index enforces open uniqueness under concurrent transactions.
-- The date/state preflight and trigger establish the predicate's meaning without a cross-table CHECK.
CREATE UNIQUE INDEX ux_persona_proceso_abierto_fecha
ON iglesia.persona_proceso(persona_id, proceso_id) WHERE fecha_finalizacion IS NULL;

ALTER TABLE iglesia.persona_proceso DROP CONSTRAINT ck_persona_proceso_fechas;
COMMIT;
