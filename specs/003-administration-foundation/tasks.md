# Tareas — 003 administration-foundation

## Corrección de presentación — 2026-11-09

- [x] Retirar logo del sidebar y compactar navbar manteniendo sticky y controles táctiles.
- [x] Habilitar toggle del sidebar en escritorio/móvil con expansión del contenido.
- [x] Centrar etiqueta de logout en el menú de cuenta.
- [x] Reemplazar códigos por nombres de permisos en resumen y Usuarios, sin UUID de sesión.
- [x] Verificar labels/IDs,29 unitarias y17 recorridos interceptados; build y checks.
- [ ] Revisión visual final por el usuario con su sesión habitual.

## Nombre de sede y permisos — 2026-11-09

- [x] Corrección: quitar eyebrow institucional y mostrar solo la primera sede
  para cuentas limitadas; mantener excepción global de SUPER_ADMIN.

- [x] FR-012: cambiar marca lateral, título por sede y presentación de permisos.
- [x] Resolver nombres solo de concesiones validadas en la consulta existente.
- [x] Verificar 38 unitarias Angular,17 .NET y5 recorridos interceptados (1 duplicado omitido).
- [ ] Comprobar nombres con sesión real después de reiniciar la API actualizada.

## Actividad HTTP y overlay — 2026-11-21 (AC-010)

- [x] Centralizar contador/interceptor con finalize y excepcion HttpContextToken.
- [x] Componente compartido con modo flotante/regional,umbral150ms y tokens.
- [x] Verificar9 casos unitarios de concurrencia,CSRF,error,cancelacion y timers.
- [x] Completar navegador,checks y evidencia de integración inicial en Sedes.

## Ajuste navbar — 2026-11-09

- [x] Navbar sticky y título exacto, sin Sitio público ni logo superior. FR-010.
- [x] Menú de cuenta PrimeNG con nombre/rol/iniciales y logout existente; colores del sidebar con tokens.
- [x] Verificar scroll y overlay en cinco rutas, temas, teclado y regresiones de cierre de sesión. AC-008.
- [ ] Reducir advertencia de paquete inicial502,04kB frente al umbral500kB, sin subir el presupuesto.

## Incremento UX/UI administrativo — 2026-11-09

- [x] Inspeccionar layout, resumen, navegación, sesión, tema y tokens. FR-008/009.
- [x] Mejorar sidebar/header y menú móvil conservando visibilidad/rutas existentes. AC-007.
- [x] Resumir roles/ámbito/cuenta/permisos únicos y agrupar permisos técnicos en panel secundario. AC-007.
- [x] Mantener entradas solo CREATE, módulos autorizados y estados sin sesión. AC-007.
- [x] Verificar 21 unitarias,15 recorridos controlados, build y checks; documentar límites.
- [ ] Revisión estética manual con sesión habitual; no acredita aceptación operativa de módulos.

- [x] T001: Verificar e instalar dependencias y registrar decisión (AC-001).
- [x] T002: Conectar Tailwind, SCSS, tokens, temas y Lucide (AC-002).
- [x] T003: Crear guía visual y formulario tipado de ejemplo (AC-003).
- [x] T004: Implementar sesión inyectable, guards y rutas diferidas (AC-004).
- [x] T005: Filtrar navegación y comprobar alcance por sede (AC-005).
- [x] T006: Actualizar documentación, skills y pruebas de regresión (AC-006).
- [ ] T007: Ejecutar verificaciones y registrar evidencia (AC-001 a AC-006).

T007 permanece pendiente: la primera suite tuvo 19/20 pruebas correctas y un timeout; la repetición posterior al ajuste y los dos casos adicionales no fue autorizada.
