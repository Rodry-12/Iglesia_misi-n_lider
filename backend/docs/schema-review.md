# Esquema real inspeccionado

La conexión Session pooler IPv4 con TLS VerifyFull y CA pública resolvió el impedimento inicial del host directo IPv6. Se consultó Supabase PostgreSQL 17.6 en transacción READ ONLY antes de implementar EF ministerial. No se ejecutó DDL, reconstrucción ni lectura de filas personales.

## Resultado

Las once tablas coinciden con la referencia en columnas, tipos, nullabilidad, defaults y relaciones. La comparación produjo 37 observaciones para revisión: RLS en once tablas, representación de CHECK/predicados y cuerpos de las tres funciones. Se revisaron las diferencias textuales de TRIM/paréntesis y mensajes/comentarios de funciones; no se ocultaron por normalización automática. Las inconsistencias de integridad descritas en [reference-analysis.md](reference-analysis.md) siguen requiriendo corrección incremental.

Se confirmó RLS habilitado en todas las tablas, sin políticas y sin FORCE. El rol de inspección tiene BYPASSRLS, por lo que su lectura exitosa no acredita al usuario runtime. No existía auth_app en la base inspeccionada.

Catálogos activos: SUPER_ADMIN global, BRANCH_ADMIN y OPERATOR por sede; 24 permisos; 40 asociaciones (24 globales, 16 de administrador de sede, ninguna de operador). Estados PENDING/IN_PROGRESS/SUSPENDED abiertos y COMPLETED/WITHDRAWN finales. Los operadores necesitan concesiones explícitas.

## Mapeos

MinistryDbContext mapea sede, persona, persona_documento, persona_sede, categoria_proceso, proceso, estado_proceso, persona_proceso, rol, permiso y rol_permiso con nombres españoles exactos, relaciones y restricciones existentes. Todas están excluidas de migraciones. El comando READ ONLY --verify-mappings se ejecutó correctamente contra las once tablas con filtros vacíos, sin leer registros personales.

AuthDbContext contiene únicamente auth_app. El script 004 agrega referencias cuenta/persona/rol/sede/permiso verificadas y triggers de concesiones. El 005 mantiene RLS y agrega políticas solo al grupo runtime; no cambia políticas de clientes Supabase.

La fase de activación verificó los scripts reales localmente con contenido/OID conservados, respaldos restaurados y primer login HTTPS. El modelo ministerial describe ahora el CHECK v2 y el índice parcial requeridos después del 003; sigue excluido de migraciones y no aplica ese cambio a Supabase. Ver activation-review.md.

## Evidencia conservada

- Referencia recibida y hashes: [reference/README.md](reference/README.md).
- Captura real exclusivamente de metadatos: [live-ministry-schema.json](reference/live-ministry-schema.json).
- Dump real exclusivamente de estructura: [live-ministry-baseline.sql.txt](reference/live-ministry-baseline.sql.txt), restaurado solamente en una nueva base local de integración.
- Códigos de catálogo sin UUID reales ni datos personales: [verified-catalog.json](reference/verified-catalog.json).
- Informes completos generados por CLI: schema-inspection.json/schema-comparison.json locales e ignorados.

La inspección no verifica datos existentes ni elimina la necesidad del preflight de migración. Ningún script incremental fue aplicado en Supabase durante este trabajo.
