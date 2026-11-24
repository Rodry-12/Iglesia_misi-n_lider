# 008 — angular-authentication

Precisión FR-005/FR-007 (2026-11-21): un 403 de un recurso no provoca una redirección global de la página ni retira la sesión. Se deniega y comunica esa operación; los guards mantienen la restricción de rutas y 401 conserva su invalidación de sesión. Una respuesta autorizada 200 no se descarta por el 403 de otra petición.

Estado: Verificada localmente. Etapa 2.1 autorizada el 2026-11-06, incluidas unitarias Angular. Activación productiva fuera de alcance.

## Problema y resultado esperado

Conectar /acceso y /gestion con Identity real de la API, conservar sesión por cookie y mostrar concesiones efectivas sin sesiones simuladas.

## Alcance y exclusiones

Login, sesión, logout, CSRF, HTTPS/proxy local, guards, resumen de usuario/sedes/permisos, unitarias y E2E. Sin CRUD, recuperación de contraseña en UI, cambios de backend/esquema ni Supabase productivo. El contrato devuelve UUID de sede, no nombres. Finanzas no tiene permiso API confirmado y permanece diferida.

## Contrato transversal de UI

Para frontend, aplicar `docs/design-system.md` y ADR 0003: Angular + PrimeNG + Tailwind + SCSS + tokens + Lucide, Signals y Reactive Forms. Definir componentes, estados, accesibilidad y responsive en el plan. No duplicar colores: `frontend/src/styles/tokens.css`. Registrar cualquier excepción con su motivo.

## Requisitos

- FR-001: Consumir csrf/login/session/logout reales bajo /api/v1/auth, cookies y X-XSRF-TOKEN en memoria; renovar CSRF al cambiar identidad.
- FR-002: Store Signals restaura sesión, controla carga/errores y rechaza respuestas tardías; nunca persiste contraseñas ni tokens en almacenamiento web.
- FR-003: /acceso usa OnPush, Reactive Forms y PrimeNG, con validación, foco, carga y errores distintos de credenciales, permisos, servicio y límite de intentos.
- FR-004: Guards esperan sesión y usan PERSON_VIEW, PROCESS_VIEW, BRANCH_VIEW y USER_VIEW por sede. La API sigue autorizando las operaciones.
- FR-005: /gestion muestra usuario, UUID de sedes, roles y permisos devueltos, actualización y cierre real. 401 retira acceso; 403 significa denegación.
- FR-006: Desarrollo HTTPS del mismo origen con proxy /api y validación TLS hacia la API; certificados y secretos fuera de Git.
- FR-007: Tras login, renovar CSRF y consultar la sesión canónica en paralelo; exigir ambas respuestas antes de autenticar la UI. Los guards reutilizan la sesión en memoria sin consultar session en cada navegación o cambio de filtros. Recuperar sesión al iniciar/recargar, permitir actualización explícita y reintentar un fallo de conexión al entrar. No usar el DTO del POST como prueba de cookie ni almacenar tokens en el navegador. Cada endpoint conserva autorización real; 401 retira la sesión y403 indica denegación. La UI puede conservar permisos anteriores hasta refrescar; nunca autorizan datos en servidor.
- FR-008: Mejorar exclusivamente la composición de /acceso con tarjeta adaptable, jerarquía, recuperación junto a contraseña, acción principal destacada y ayuda separada. Reutilizar PrimeNG/tokens, logo del encabezado y footer íntegro; conservar lógica, enlaces, accesibilidad y estados. Sin cambios de autenticación ni otras pantallas.

## Aceptación

- AC-001: Unitarias verifican restauración, login, renovación CSRF, logout, concurrencia y fallos; credenciales/tokens solo acompañan la API propia.
- AC-002: Formulario, resumen y guards cubren validación, permisos por sede y denegación.
- AC-003: E2E con API interceptada cubren login/logout, recarga, expiración, falta de permiso y errores; se distinguen de prueba real.
- AC-004: Si el entorno permite, navegador HTTPS verifica login/session/logout con API y PostgreSQL reales; de lo contrario se registra el bloqueo sin afirmar éxito.
- AC-005: Build, unitarias, checks SDD/diseño y revisión responsive pasan; comandos y límites documentados.

## Escenarios y dudas

401 inicial significa ausencia de sesión; 401 durante gestión exige acceso de nuevo; 403 indica permiso insuficiente. Un fallo de logout conserva sesión para reintentar, sin afirmar revocación. No inventar nombres de sedes ni permisos financieros.
