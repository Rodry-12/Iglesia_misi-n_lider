# Tareas — 008 angular-authentication

## Navegación sin consultas redundantes — 2026-11-09

- [x] Identificar canMatch/sessionGuard como causa de GET session previo a navegación.
- [x] Reutilizar sesión en memoria y retirar handoff; conservar verificación backend.
- [x] Comprobar unitarias y navegador interceptado con conteos de session.
- [ ] Medir p50/p95 autenticado real de endpoints; no inferir mejoras HTTP de mocks.

## UX/UI de acceso — 2026-11-09

- [x] Inspeccionar layout, header/footer, marca, tokens y formulario; limitar cambios visuales a AccessPage. FR-008.
- [x] Reorganizar recuperación, contraseña, botón principal, ayudas, foco y anchos adaptables. AC-002.
- [x] Verificar tres unitarias, cuatro recorridos controlados escritorio/móvil y build. AC-002/005.
- [ ] Revisión estética manual y tablet del diseño de /acceso.

## Latencia de entrada — 2026-11-09

- [x] Confirmar que los 6,10 segundos informados corresponden al recorrido total, no al POST aislado.
- [x] Paralelizar GET posteriores al login y consumir una vez la verificación canónica en el guard inmediato. FR-007, AC-001/002.
- [x] Verificar 30 unitarias focalizadas y 12 recorridos de navegador controlados; build correcto.
- [ ] Comparar manualmente el tiempo real de entrada a gestión con los 6,10 segundos informados; no hay credenciales usadas por el agente.

- [x] Inspeccionar contrato, cookies, endpoints y catálogos reales; especificar alcance y UI. AC-001/002.
- [x] Implementar AuthStore, CSRF en memoria, interceptor propio y restauración sin bloquear el sitio público. AC-001.
- [x] Implementar acceso PrimeNG/Reactive Forms y resumen de sesión con guards y permisos por sede. AC-002.
- [x] Configurar HTTPS/proxy con validación TLS y documentar arranque exacto. AC-004/005.
- [x] Retomar unitarias Angular: 50 correctas; corregir dos expectativas históricas y aria-invalid de formulario de ejemplo. AC-001/002/005.
- [x] E2E ordinarios: 22 correctos (12 autenticación interceptada y 10 públicos), dos opt-in omitidos explícitamente. AC-003/005.
- [x] E2E reales separados: dos correctos, escritorio/móvil, contra API y cuenta PostgreSQL existentes, sin interceptación. AC-004.
- [x] Verificar build, diseño, formato, dependencias, skills y SDD; registrar evidencia y límites. AC-005.
