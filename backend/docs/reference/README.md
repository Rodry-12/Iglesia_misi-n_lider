# Referencia SQL recibida

`ministerial-reconstruction.sql.reference.txt` conserva íntegramente el adjunto recibido el 2026-10-23. SHA-256:

`3E52847EAB332A19D206C08890550A99E46C4914AF3B80B29F7F3067E42BEAC2`

Es una reconstrucción de referencia, **no un dump verificado**. No ejecutarla en Supabase, inicio, migraciones o tests. Se conserva con extensión de texto. La API copia el texto como contenido para el lector del contrato; no lo pasa a Npgsql ni lo sirve al navegador. El lector está limitado a este hash y rechaza modificaciones no revisadas.

Incluye 11 tablas, 11 índices explícitos, 3 funciones/triggers, 5 estados y 24 códigos de permiso. La estructura desplegada se consultó posteriormente en la base autorizada, antes de implementar mapeos EF.

Para comparar: `dotnet run --project src/MisionLiderParis.Api -- --compare-schema` desde backend, con conexión configurada fuera de Git. El comando consulta exclusivamente catálogos en transacción READ ONLY; genera archivos locales ignorados `schema-inspection.json` y `schema-comparison.json`. Falta de conexión o diferencias/revisiones pendientes producen código de salida 2. Los resultados de pruebas sintéticas no acreditan Supabase.

Ni el comparador ni un resultado sin diferencias habilitan mapeos o aplican scripts automáticamente. Las diferencias de representación de CHECK/defaults/predicados requieren revisión humana, sin asumir equivalencia semántica por apariencia.

## Fuentes reales posteriores

- `live-ministry-schema.json`: captura real exclusivamente de metadatos, anterior a los mapeos. SHA-256 `A5453DF18AB3FD4F021F66DCD640A0A9A9ACFA89A5BFD5160755CD8170B43C7F`.
- `live-ministry-baseline.sql.txt`: pg_dump real `--schema-only --no-owner --no-acl` de iglesia, obtenido de solo lectura. SHA-256 `A6723E5F406CF80B0CDD34A2A4C2724706ADCA58E03709A2665DF2410F9F31C9`. Se restaura únicamente en una nueva base local/CI aislada, nunca en Supabase existente. No contiene datos de producción ni es la reconstrucción adjunta.
- `verified-catalog.json`: códigos activos y correspondencia BRANCH_ADMIN extraídos del catálogo real; sin UUID reales ni datos personales. Los tests generan identificadores propios.

La comparación real registró 37 observaciones de revisión sobre RLS/representación CHECK/predicados/funciones. Los once conjuntos EF se verificaron contra Supabase con filtros vacíos y transacción READ ONLY. No se ejecutó DDL remoto. Ver `../schema-review.md`.
