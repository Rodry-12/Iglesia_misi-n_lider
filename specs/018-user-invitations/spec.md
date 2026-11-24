# 018 — user-invitations

Refinamiento transversal de avisos (2026-11-21): todos los mensajes de resultado/advertencia/error de operación usan el Toast raíz, sin banners en páginas o modales. Reutilizar textos, condiciones, confirmaciones y reintentos; incluir Personas, Formación, Sedes, Usuarios, Acceso/Activación y Contacto público. Regla visual común en docs/design-system.md. No cambiar autorización ni contratos HTTP.

AC-007 — Acceso personalizado efectivo: las cinco capacidades USER_* deben funcionar para OPERATOR cuando están concedidas explícitamente en la sede de la operación. Consulta limitada a cuentas OPERATOR con todas sus sedes visibles; cambios, invitación y sustitución de accesos limitados a permisos delegables del actor en esa misma sede, sin administrar perfiles superiores, ampliar la propia cuenta ni heredar permisos de otra sede. Mantener 403 para operaciones/sedes no autorizadas y 404 para recursos fuera del ámbito visible. Las restricciones globales preexistentes se conservan y se explican en la selección de permisos.

Refinamiento AC-006: «Accesos y permisos» presenta OPERATOR como «Acceso personalizado», con acciones por módulo seleccionables mediante casillas. Los códigos y contratos internos permanecen intactos. Explicar accesos protegidos y suma de concesiones; comunicar éxitos únicamente mediante el Toast global, sin banner duplicado.

Claridad AC-006 (2026-11-21): asociar una cuenta a Miembros es opcional y usa documento completo para evitar asociaciones incorrectas. El modal debe explicar esta finalidad, ocultar inicialmente la búsqueda y distinguir cerrar sesiones/anular invitaciones de desactivar la cuenta. Seguridad tiene sección propia, autorizaciones existentes y confirmación antes de operar; no muestra paginación sin páginas adicionales ni resultados de otro documento.

Estado vigente (2026-11-09): **PARCIALMENTE VALIDADA**. Identity, contexto HMAC/RLS y Gmail API están configurados y cuentan con evidencia real contra Supabase. Falta aceptar el recorrido de invitación, activación y login desde el frontend publicado; el despliegue público inspeccionado todavía no incluye la activación. Véase validation.md.

La sustitución inicial de Gmail por Resend del 2026-11-08 es histórica. Por petición posterior se incorporó Gmail API en backend/specs/002-gmail-api, conservando Resend y SMTP como adaptadores seleccionables, sin fallback automático. Los requisitos y pruebas originales de Resend siguientes acreditan ese adaptador; no describen el proveedor operativo actual, GmailApi.

## Problema y resultado esperado

Administrar cuentas y accesos por sede e invitar destinatarios para que establezcan sus contraseñas, sin que el administrador las defina.

## Alcance y exclusiones

Listado/búsqueda/filtros/paginación, detalle, alta con invitación, perfil/persona vinculada, sustitución de concesiones, desactivación/reactivación y revocación. Activación pública y pantallas de confirmación/recuperación existentes. Resend configurable, SMTP conservado y EmailJS solo público. Sin tablas, migraciones, Supabase, bootstrap, imágenes, historial ni envíos reales.

## Contrato transversal de UI

Para frontend, aplicar `docs/design-system.md` y ADR 0003: Angular + PrimeNG + Tailwind + SCSS + tokens + Lucide, Signals y Reactive Forms. Definir componentes, estados, accesibilidad y responsive en el plan. No duplicar colores: `frontend/src/styles/tokens.css`. Registrar cualquier excepción con su motivo.

## Requisitos

- FR-001: reutilizar las políticas de delegación y coherencia persona/sede, documentos vigentes y cuentas/personas opcionalmente vinculadas; proteger cuentas globales y evitar autoescalación.
- FR-002: invitación Identity con propósito propio, expiración configurable, cuenta sin contraseña, confirmación del correo solo al activar, uso único concurrente e invalidación por security stamp; reenvío autorizado limitado por cuenta y HTTP.
- FR-003: entrega posterior al commit con estado recuperable y sin reintentos automáticos ni fallback; proveedor Resend o SMTP mediante IAccountEmailSender, sin secretos en frontend/logs.
- FR-004: Angular standalone Signals/OnPush, formularios reactivos PrimeNG, tokens existentes, guards específicos, URL de filtros, confirmaciones y borradores; enlaces por fragmento retirado de URL y contraseñas borradas tras éxito.

## Aceptación

- AC-001: administrar cuentas/roles/sedes respeta la API, la delegación, RLS y los vínculos; altas no aplican contraseñas del administrador.
- AC-002: invitación válida activa una sola vez, expira y se revoca; ausencia de permisos/cuenta activa/bloqueo impiden abuso; envío fallido conserva cuenta recuperable.
- AC-003: adaptador Resend genera HTML/texto seguros, utiliza autenticación privada e idempotencia, controla errores sin fallback ni envío externo en pruebas.
- AC-004: listado, creación, detalle y activación funcionan con permisos y sesión, también en móvil; compilaciones/regresiones y recorrido HTTPS aislado quedan documentados.

## Escenarios y dudas

La aceptación externa exige clave nueva no expuesta, dominio/remitente verificado, callbacks HTTPS y despliegue coordinado del contexto firmado. Resend no sustituye Identity ni Supabase Auth. Ninguna respuesta de envío acredita entrega final.

## Ajuste de listado de Usuarios — 2026-11-21 (AC-004)

AC-005: botón Invitar legible/derecha,filtros Activa/Inactiva,persona asociada explícita ypaginación equivalente aSedes;validar permisos,temas ymóvil sin escrituras reales.

Invitar usuario con icono ytexto de contraste explícito,alineado a la derecha dentro delpanel de filtros. Estado de cuenta:Todos/Activa/Inactiva (valores API vacio/true/false sin cambios);se conservan estados de bloqueo,correo pendiente yactivación pendiente en filas. Roles del listado usan accountRoleLabel únicamente parapresentación. Persona cambia Sin vínculo porSin persona asociada,con explicación en title;persona vinculada novisible se distingue,no seexponen UUID. Paginador visual equivalente aSedes:contador de registros,flechas44px ypaginaactual verde,con límites yparámetros existentes. Tabla/estados/filtros encards por tokens,scroll horizontal local,móvil/oscuro. Sin cambios de permisos ni flujos de invitación.

Archivos:frontend/src/app/features/users/users-page.ts,users-page.html,users-list.scss;frontend/e2e/users-list.spec.ts,users.spec.ts;specs/018-user-invitations/{spec.md,plan.md,tasks.md,validation.md,traceability.json}.

Verificación:13 unitarias existentes de Usuarios aprobadas;12 recorridos distintos desktop/mobile aprobados (6 del listado nuevo y6 regresiones invitación/denegación/activación). HTTP interceptado,sin cuentas/envíos reales. Se corrigió un selector ambiguo de regresión que encontraba tanto mensaje persistente comoToast;ahora comprueba el mensaje específico. Build,design/spec checks yformato registrados. Advertencia inicial583,72kB/500kB persiste,no se eleva presupuesto. Sin backend/Supabase/despliegue/imagenes. Revisión estética del usuario pendiente.

### Espera de búsqueda solicitada — 2026-11-21

Texto en buscadores Sedes yUsuarios:3000ms sin nuevos caracteres antes de consultar;cada pulsación reinicia el plazo. Sedes conserva estado inmediato yUsuarios conserva selección de sede/estado350ms. Navegación cancela texto pendiente ydestrucción limpia suscripción. Sin modificar HTTP,permisos oSupabase. Build correcto;advertencia inicial583,72kB previa. Verificación focalizada de filtros mediante navegador interceptado.

## Modales de Usuarios — incremento autorizado 2026-11-21

AC-006: listado con iconos Ver/Editar según permisos efectivos. UserViewDialog de solo lectura,UserEditDialog para perfil/accesos/estado/reenvío/revocación yUserInviteDialog independientes. Modales esperan datos/opciones;listado permanece detrás,sus filtros/búsqueda3s/paginación se conservan. Lógica de formulario existente extraída aUserAccountEditor yUserAccountForm,política visual user-access compartida;Stores por modal. Rutas directas conservadas yadaptador /:id/editar para abrir administración. Guardde borrador existente protege salida,también desde listado. Foco,cierre/descartar yerrores permanecen controlados. Backend/contratos/roles/Supabase intactos.

Revocar ejecuta POST /api/v1/users/{id}/revoke-sessions existente:UpdateSecurityStamp invalida cookies einvitaciones previas;no elimina cuenta nicambia contraseña. Explicación yconfirmación explícitas enmodal de administración. Solo USER_UPDATE permiteperfil;USER_ASSIGN_ROLE permiteaccesos con restricciones existentes;USER_CHANGE_STATUS permiteestado/revocación;USER_CREATE permitereenvío/invitación. No se habilitan propiasconcesiones nicambios deacceso global.
