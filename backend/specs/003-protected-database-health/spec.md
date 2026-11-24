# 003 — protected-database-health

Estado: En curso.

## Problema y resultado esperado

Monitorizar conectividad PostgreSQL mediante GET HTTPS /api/v1/health/database cada12 horas desde GitHub Actions, con credencial independiente y sin datos internos.

## Alcance y exclusiones

Endpoint, sonda Npgsql SELECT1 sobre Database:ConnectionString existente, seguridad, pruebas y workflow de ejemplo. Sin modificaciones de PostgreSQL, tablas, roles, RLS, permisos, credenciales vigentes o despliegue remoto. No garantiza evitar suspensión de Supabase Free.

## Contrato transversal de UI

Para frontend, aplicar `docs/design-system.md` y ADR 0003: Angular + PrimeNG + Tailwind + SCSS + tokens + Lucide, Signals y Reactive Forms. Definir componentes, estados, accesibilidad y responsive en el plan. No duplicar colores: `frontend/src/styles/tokens.css`. Registrar cualquier excepción con su motivo.

## Requisitos

- FR-001: Usar MLP_HEALTH_TOKEN exclusivamente del entorno,32 bytes aleatorios codificados en64 caracteres hexadecimales; Authorization Bearer, comparación de tiempo constante tras validar estructura/longitud. Ausente/inválido/no configurado =>401 sin consultar PostgreSQL.
- FR-002: Reutilizar conexión ministerial runtime validada al arrancar y pooler/TLS/pool existente; SELECT1 con CommandTimeout2s y cancelación total5s. Responder200 {status:healthy} o503 {status:unavailable}, sin SQL, datos ni excepciones.
- FR-003: SoloGET, HTTPS, no-store, CORS deshabilitado y rate limit6/min global al monitor, sin modificar autenticación/CSRF/permisos de otras rutas. Token no crea principal ni sesión.
- FR-004: Workflow cada12h y manual, secreto externo, HTTPS verificado, timeout y fallo seguro sin logs de credenciales ni redirección de Bearer a otro destino.

## Aceptación

- AC-001: Pruebas cubren token correcto/incorrecto/ausente/malformado/no configurado, formato del entorno y exclusión de credencial de monitor de rutas ministeriales.
- AC-002: Pruebas verifican SELECT1 real cuando hay base aislada disponible, indisponibilidad, timeout, contrato200/503 y ausencia de información sensible.
- AC-003: Pruebas HTTP demuestran no-store, CORS denegado incluso al origen Angular autorizado, rate limiting y regresiones de login/usuarios/sedes/personas/formación.
- AC-004: Workflow/documentación describen programación, variables, prueba local, límites y no activación remota; build/test y limitaciones registrados.

## Escenarios y dudas

La identidad runtime se comprueba con RuntimeDatabaseValidator existente. Ningún usuario administrativo nuevo. Un fallo de conexión al arranque puede impedir que la API levante; un monitor HTTP fallido también detecta ese caso, sin prometer un503 de un proceso que no arrancó. La autenticación del monitor no valida Identity ni tablas ni RLS: únicamente conectividad. No hay cambios visuales.
