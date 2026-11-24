# Tareas — 003 protected-database-health

- [x] Inspeccionar pipeline, Identity/CSRF/CORS, rate limiting, excepciones, health checks, Npgsql y pruebas.
- [x] FR-001/FR-002: implementar contrato/sonda/credencial/endpoint sin credenciales nuevas ni SQL remoto.
- [x] AC-001/AC-002/AC-003: pruebas HTTP, sonda TCP y regresiones sin base real; timeout corregido tras detectar negociación Npgsql no cancelable inmediatamente.
- [x] AC-004: workflow, plantilla y guía; restore/build y evidencia local.
- [x] Repetición final164 pruebas correctas;105 omitidas y fallo previo OpenAPI excluido explícitamente; YAML validado y trazabilidad revisada.
- [ ] Ejecutar SELECT1 de integración en una base loopback _tests existente cuando esté disponible; no arrancar aplicaciones con PostgreSQL local ni modificar esquemas para esta prueba.
- [ ] Aceptación operativa HTTPS/GitHub con URL y secreto reales, después del despliegue del usuario.
