# Tareas — 001 Backend ministerial

## Continuación rendimiento — 2026-11-10

- [x] Agrupar lecturas ministeriales de administradores sin cambiar autorización.
- [x] Verificar2 transacciones frente a3 anteriores y conservar la del llamador.
- [x] Ejecutar16 integraciones focalizadas en base aislada preaprovisionada.
- [ ] Medir latencias HTTP autenticadas equivalentes antes/después en Supabase.

## Rendimiento — 2026-11-09 (AC-029)

- [x] Reproducir cuatro transacciones para una concesión global.
- [x] Agrupar lecturas firmadas, omitir lookups vacíos y conservar transacciones externas.
- [x] Verificar 37 integraciones y 36 unitarias focalizadas en entorno aislado.
- [x] Compilar Release, reiniciar API local y comprobar TLS, Identity, firma y RLS en solo lectura.
- [x] Documentar lanzadores y límites en docs/performance-and-local-development.md.
- [ ] Medir p50/p95 HTTP autenticado equivalente antes/después en Supabase; no sustituirlo con readiness ni pruebas aisladas.

## Verificación de aislamiento — 2026-11-06

- [x] Ejecutar primero las pruebas existentes sin base y registrar omisiones. AC-005/011.
- [x] Reutilizar base de pruebas preaprovisionada sin migraciones, DDL ni bootstrap; validar dos sedes con HTTP/RLS, asignaciones/reportes/CSV y contexto manipulado. AC-005/007/011.
- [x] Comprobar SuperAdmin HTTPS y límite de confianza del actor SQL en Supabase sin escrituras ministeriales; documentar alcance y pendientes en docs/branch-isolation-validation-2026-11-06.md. AC-005.
- [x] Detener el clúster aislado y conservar API runtime operativa. AC-011.

## Corrección de cuentas — 2026-11-06

- [x] Reproducir el alta incoherente mediante integración antes del fix: 201 recibido en lugar de 404. AC-021.
- [x] Centralizar validación destinataria y revocar sesiones al cambiar personId; registrar grants sustituidos como Added antes del guardado Identity. AC-022/023.
- [x] Añadir nueve unitarias y siete integraciones de ámbitos, edición, concesiones y revocación sin escalada. AC-021/022/023.
- [x] Ejecutar restore/build/tests en PostgreSQL aislado: 50 unitarias y 34 integraciones correctas; evidencia y trazabilidad actualizadas. AC-024.

- [x] Crear arquitectura .NET 10 y especificación propia dentro de backend. FR-001.
- [x] Conservar referencia original por hash sin ejecutarla. FR-002/009.
- [x] Conectar por Session pooler/TLS VerifyFull e inspeccionar las once tablas reales, RLS y tres funciones en READ ONLY. AC-002.
- [x] Comparar y revisar las 37 observaciones; verificar once mapeos con consultas vacías reales. AC-009.
- [x] Implementar Identity, cuentas, permisos por operación, concesiones y revocación. FR-003/004/005/010.
- [x] Ejecutar los siete escenarios Identity contra PostgreSQL local con usuario NOBYPASSRLS y adaptador ministerial real. AC-003 parcial: SMTP externo y operación productiva pendientes.
- [x] Implementar mapeos excluidos de migraciones, CRUD ministeriales, documentos, traslados y asignaciones. FR-006.
- [x] Implementar reportes con conteos distintos, paginación y CSV. FR-007.
- [x] Preparar scripts incrementales 001–005 y baseline real solo para integración local. FR-002.
- [x] Registrar suspensión intermedia de unitarias y posterior reanudación explícita del backend en la fase de activación; Angular sigue diferida.
- [x] Actualizar CI para restaurar baseline únicamente en PostgreSQL efímero y ejecutar la solución backend completa autorizada.
- [x] Completar evidencia de integración ministerial, RLS, transiciones, reportes y concurrencia: 24 pruebas de integración correctas, cero omitidas; cobertura no exhaustiva documentada en validation.md.
- [ ] Aplicar paquete revisado en Supabase, configurar LOGIN runtime, claves/SMTP y crear primer administrador. No ejecutado.
- [ ] Verificar correo real, navegador e integración Angular en su incremento correspondiente.
- [ ] Ejecutar workflow en GitHub. Preparado, no ejecutado durante esta entrega.

## Activación del 2026-10-24

- [x] Revisar UUID, contextos/mapeos, FK/cuenta-persona, roles por sede, cookies, SMTP y bootstrap. FR-011.
- [x] Separar conexión de bootstrap, sanitizar errores y validar política antes de crear cuentas; fortalecer runtime y readiness. FR-011/014.
- [x] Aplicar los cinco scripts reales en una nueva base local con filas ficticias; conservar contenido y OID de las once tablas y dos triggers no afectados. AC-012.
- [x] Restaurar respaldos anteriores/posteriores en otras bases nuevas; verificar hash Identity, concesión y ACL; preflight fallido sin reparación/pérdida. AC-013.
- [x] Ejecutar bootstrap CLI real y repetición rechazada; comprobar primer login Kestrel HTTPS con usuario runtime separado, CSRF/cookie/logout. AC-014.
- [x] Restore/build/test final: 41 unitarias y 27 integraciones correctas, cero fallidas/omitidas. Modelo Identity sin cambios pendientes. AC-011.
- [x] Corregir referencias documentales a helpers PowerShell inexistentes; conservar DPAPI únicamente como mecanismo local Windows y registrar el flujo Kestrel ejecutado por la prueba. AC-014/015.
- [x] Entregar inventario, riesgos, comandos exactos de aplicación, respaldo/recuperación y bootstrap sin cambios en Supabase. AC-015.
- [x] Ensayar de nuevo restore/build/tests backend en PostgreSQL efímero local; endurecer las comprobaciones de privilegios runtime y corregir trazabilidad. AC-011/012/018.
- [x] Ejecutar comparación actual READ ONLY: inspección 009.1 del 2026-11-06 completada, sin cambios comparables respecto a AC-016. Evidencia privada `.local/supabase-inspection-0091/`.
- [ ] Ejecutar preflight de datos productivos con la identidad autorizada para respaldo; inspector carece de SELECT. No confundirlo con la inspección estructural completada.
- [x] Ensayar 001–005 bajo LOGIN DDL restringido y revocar CREATE de base tras 001; preservar datos/OID y validar RLS/helpers en PostgreSQL local. AC-017 local; no demuestra permisos Supabase.
- [ ] Revalidar estado staged/index y exclusiones Git después de Paso 21 cuando `git.exe` esté disponible; AC-019 anterior corresponde a un snapshot previo.

No confundir implementación y verificación aislada con base productiva preparada. Consultar validation.md para resultados exactos y limitaciones.

## Preparación de activación remota — 2026-11-06

- [x] Preparar corrección limitada 040 por literal de función incompleto: mismos statements/cuerpos decodificados, representación E de una línea, parser offline y 041 READ ONLY. AC-020; ejecución remota pendiente del operador.

- [x] Registrar 010 OK comunicado por el operador; no repetir aprovisionamiento. 020 fallido con auth_app ausente, pendiente reejecución corregida.
- [x] Corregir solo ejecución 020: DDL original a nivel superior, sin cambio de modelo/historial/índices; guía de transformación RLS y verificación offline PostgreSQL 17. AC-020.
- [ ] El operador ejecuta 020 corregido con SQL original, verifica 021 y recién continúa 030–090.

- [x] Preparar variante SQL Editor `sql/supabase-editor/`, fuentes 001–005 intactas, una transacción por archivo, ownership/membresías compatibles con PostgreSQL 17/Supabase, verificación y passwords fuera del Editor. AC-020; ejecución remota pendiente.

- [x] Preparar respaldo interactivo sin guardar contraseñas, preflight agregado, fingerprints, manifest y validación completa del archivo sin conexión. AC-015/020; validación de sintaxis, no ejecución real.
- [x] Extraer comandos concretos de aprovisionamiento y runtime del diseño aprobado; mantener 001–005 sin cambios. AC-020.
- [x] Documentar configuración, bootstrap, riesgos, cierre DDL, aceptación y recuperación sin sobrescribir tablas. AC-020.
- [ ] Obtener y verificar respaldo real con credencial administrativa y escritores detenidos.
- [ ] Acordar destino vacío de recuperación y acreditar el ensayo; no crear otro proyecto/servidor por iniciativa propia.
- [ ] Presentar evidencia de respaldo/preflight y solicitar autorización expresa del paquete antes del primer cambio remoto.
- [ ] Aplicar pasos autorizados, validar checkpoints y cerrar acceso migrator.
- [ ] Comprobar runtime, login/logout, RLS y consulta real; registrar aparte pruebas por sede pendientes si faltan cuentas autorizadas.

## Remediación RLS firmada — 2026-11-07

- [x] Reproducir antes de corregir suplantación de UUID y persistencia tras rollback. AC-025.
- [x] Implementar contexto transaccional, lectores READ ONLY, transacciones de escritura y verificación criptográfica sin fallback. AC-025/026.
- [x] Separar conexión Identity, restringir privilegios y centralizar revocación de sesiones autorizada. AC-027.
- [x] Ampliar pruebas de manipulación, expiración, replay, pooling, cancelación y concurrencia entre sedes. AC-025/026.
- [x] Preparar SQL incremental 100, recuperación cerrada 101, verificación 102 y procedimiento; históricos sin cambios. AC-028.
- [x] Registrar resultado final de restore/build/tests y ensayos SQL aislados: 58 unitarias + 45 integraciones correctas; 100–102 parseados, 101 ensayado con rollback. AC-028.
- [ ] Aplicar y aceptar en Supabase solo después de respaldo verificado y autorización expresa; no forma parte de esta implementación.
# Rendimiento ejecutable 2026-11-23

- [x] FR-026: instrumentación técnica opt-in, pruebas de aislamiento/privacidad y documentación de captura.
- [x] AC-030: línea base real de servicios y comparación acotada, separando límites de HTTP/autenticación/escritura.
- [x] Aplicar pooling Identity limitado y reutilización de filtros respaldados por medición; compilar y verificar regresiones focalizadas.
- [x] Capturar HTTP autenticado real de login/sesión/sedes/personas/Seguimiento mediante sesión interactiva del usuario, sin acceder a cookies ni credenciales; documentar fases y reaperturas físicas.
- [ ] Capturar línea base HTTP equivalente, concurrencia y P95 con muestras suficientes; formularios/guardados solo con un caso autorizado.

- [x] FR-027/AC-031: capturar línea base con pool, agrupar protocolo firmado sin eliminar controles, comparar y verificar aislamiento/cancelación; registrar tres fallos de la batería amplia sin certificarlos.
- [x] FR-028/AC-032: compartir ámbito firmado solo dentro de GET ministerial; probar una transacción HTTP,89 regresiones focalizadas y comparación equivalente de servicios.
- [x] Repetir HTTP autenticado del usuario con el ámbito nuevo: sedes1008ms,personas1146ms,categorías1004ms,procesos1031ms,Seguimiento1132ms con opciones reutilizadas o1610–1808ms con opciones. Sin P95 acreditado.
- [x] Ampliar ámbito a Usuarios tras medir cuatro transacciones en opciones; diez regresiones de accesos/sedes correctas y20 lecturas pareadas de servicio.
- [ ] Repetir HTTP Usuarios final, frío/concurrencia y suficientes muestras paraP95; objetivo95% no acreditado.
