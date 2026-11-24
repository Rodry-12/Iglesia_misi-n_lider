# Plan — 018 user-invitations

Avisos transversales: componente declarativo ToastFeedback con entradas message/severity y efecto Signals hacia Notifications; plantilla vacía y OnPush. Sustituir 42 bloques Message preexistentes sin perder sus textos/condiciones y pasar las alertas de acceso, consulta de personas y contacto al mismo canal. Conservar botones de reintento y confirmaciones. Deduplicar también entre stores/pantallas y severidades; quitar aviso global adicional de 403 en interceptor. Proteger la regla en design:check, verificar unitarias transversales y recorridos interceptados sin imágenes/envíos.

Pie de edición (2026-11-21): colocar Cerrar y Guardar cambios juntos en el footer público de Dialog. Botón submit externo asociado al formulario mediante form/id, conservando ngSubmit y confirmaciones; ocultar el submit interior solo para edición. Seguridad y consulta no muestran Guardar; invitación conserva su envío existente.

Ajuste transversal de limpieza y navegación (2026-11-21): usar showClear condicionado al valor del control en los cinco puntos existentes (Usuarios, Personas, Seguimiento y fechas de registro/edición). Sidebar abierto con flex column y nota final con margen automático; conservar ocultación y navegación móvil. Verificar selección/limpieza y posición del pie sin imágenes ni llamadas reales.

AC-007: ampliar UserAdministrationPolicy y AccessScope.CanManageGrant al perfil OPERATOR, con permiso explícito por operación, validez de concesión, sede y subconjunto de permisos. Reutilizar validaciones de persona/sede, stamps y cuenta propia. Corregir filtro de listado y política visual compartida para que Angular refleje el backend. No modificar SQL, RLS, esquemas ni cuentas reales. Añadir pruebas de permisos aislados, delegación, listado/edición y ausencia de acciones no concedidas; integración HTTP exclusivamente en base aislada preaprovisionada.

Refinamiento AC-006: sustituir MultiSelect de permisos por Checkbox de PrimeNG agrupados en fieldset/legend por módulo, etiquetas asociadas y layout adaptable con tokens. Mantener los mismos IDs, formulario reactivo y validaciones; perfil personalizado es etiqueta de OPERATOR. Retirar solo la presentación inline del aviso de éxito, conservando Notifications y los errores de formulario.

Ajuste AC-006 (2026-11-21): conservar Dialog/Button/InputText/Message de PrimeNG; separar Seguridad de los formularios, indicar selección con `aria-pressed` y tokens, y desplegar opcionalmente la asociación con Miembros. Búsqueda explícita por documento, cancelación al cambiarlo, vacío solo tras respuesta y paginación condicional. Mantener borradores, permisos y confirmaciones; verificar escritorio/móvil con HTTP controlado sin operaciones reales.

## Diseño

- Reutilizar UserAdministration, sus permisos reales y AccountAccessValidator. Opciones mínimas por operación y búsqueda exacta de documento; evitar un join que conceda acceso Identity al rol ministerial. Consultas separadas y acotadas por UUID/documento.
- Conservar GET/PUT de usuarios y revocación. POST /users también crea una cuenta sin contraseña; nueva entrada /users/invitations devuelve estado de envío explícito. El contrato antiguo de contraseña deja de aplicarla. Ajustar regresiones para que el destinatario active por Identity.
- IAccountEmailSender añade invitación, comparte composición entre SMTP y Resend. HttpClient sin redirecciones, logs ni reintentos; API HTTPS fija, clave privada, idempotencia por mensaje. Secretos y dominio quedan externos. Sin paquetes nuevos.
- InvitationTokenProvider con propósito y expiración independientes. Bloqueo de fila Identity serializa activación/reenvío. user_tokens existente guarda únicamente el instante del último intento (60 segundos), nunca el token de invitación. Reenvío y cambios de seguridad rotan stamp. No outbox/historial.
- Activación pública verifica Identity y establece contraseña/confirmación en una transacción. No consulta ministerio con un actor administrativo fabricado. Login y RLS verifican después persona, sede y concesiones vigentes; las revocaciones existentes invalidan el stamp.
- UsersStore y AccountActionStore contienen HTTP, cancelación, carga/error/éxito y limpieza. PrimeNG Table, Select, MultiSelect, InputText, Button, Message, ConfirmDialog; labels/teclado, tabla contenida y controles fluid en móvil. Diseño heredado de catalog.scss, sin nuevos colores.

Para UI: seleccionar componentes PrimeNG según `docs/design-system.md`; identificar tokens existentes/nuevos, estados de interacción, foco/teclado y adaptación móvil/escritorio. El preset de PrimeNG y Tailwind comparten `tokens.css`.

## Verificación

Unidades del adaptador con HttpMessageHandler sintético y de Angular con HttpTestingController; integración Identity/ministerio/actor firmado en loopback _tests; E2E controlados y fixture Kestrel HTTPS con buzón en memoria. Dos fases de navegador permiten pasar el token solo por memoria/entorno del proceso, sin endpoint de captura ni token en archivos. Sin correo real ni cambios remotos.

HU-012 autoriza expresamente pruebas unitarias y de integración focalizadas.

## Riesgos y decisiones

Sin historial/outbox no se acredita entrega: se informa accepted/unconfirmed y el administrador puede reenviar. Las transacciones de Identity no abarcan la base ministerial desde otra conexión; las comprobaciones actuales se conservan y el login/RLS sigue fallando cerrado ante cambios posteriores. Las invitaciones no permiten saltarse bloqueos ni recuperar una cuenta passwordless por otros propósitos. No se habilita envío real hasta renovar la clave expuesta y verificar remitente/dominio.

## Ajuste de listado de Usuarios — 2026-11-21 (AC-004)

Invitar usuario con icono ytexto de contraste explícito,alineado a la derecha dentro delpanel de filtros. Estado de cuenta:Todos/Activa/Inactiva (valores API vacio/true/false sin cambios);se conservan estados de bloqueo,correo pendiente yactivación pendiente en filas. Roles del listado usan accountRoleLabel únicamente parapresentación. Persona cambia Sin vínculo porSin persona asociada,con explicación en title;persona vinculada novisible se distingue,no seexponen UUID. Paginador visual equivalente aSedes:contador de registros,flechas44px ypaginaactual verde,con límites yparámetros existentes. Tabla/estados/filtros encards por tokens,scroll horizontal local,móvil/oscuro. Sin cambios de permisos ni flujos de invitación.

Archivos:frontend/src/app/features/users/users-page.ts,users-page.html,users-list.scss;frontend/e2e/users-list.spec.ts,users.spec.ts;specs/018-user-invitations/{spec.md,plan.md,tasks.md,validation.md,traceability.json}.

Verificación:13 unitarias existentes de Usuarios aprobadas;12 recorridos distintos desktop/mobile aprobados (6 del listado nuevo y6 regresiones invitación/denegación/activación). HTTP interceptado,sin cuentas/envíos reales. Se corrigió un selector ambiguo de regresión que encontraba tanto mensaje persistente comoToast;ahora comprueba el mensaje específico. Build,design/spec checks yformato registrados. Advertencia inicial583,72kB/500kB persiste,no se eleva presupuesto. Sin backend/Supabase/despliegue/imagenes. Revisión estética del usuario pendiente.

## Modales de Usuarios — incremento autorizado 2026-11-21

AC-006: listado con iconos Ver/Editar según permisos efectivos. UserViewDialog de solo lectura,UserEditDialog para perfil/accesos/estado/reenvío/revocación yUserInviteDialog independientes. Modales esperan datos/opciones;listado permanece detrás,sus filtros/búsqueda3s/paginación se conservan. Lógica de formulario existente extraída aUserAccountEditor yUserAccountForm,política visual user-access compartida;Stores por modal. Rutas directas conservadas yadaptador /:id/editar para abrir administración. Guardde borrador existente protege salida,también desde listado. Foco,cierre/descartar yerrores permanecen controlados. Backend/contratos/roles/Supabase intactos.

Revocar ejecuta POST /api/v1/users/{id}/revoke-sessions existente:UpdateSecurityStamp invalida cookies einvitaciones previas;no elimina cuenta nicambia contraseña. Explicación yconfirmación explícitas enmodal de administración. Solo USER_UPDATE permiteperfil;USER_ASSIGN_ROLE permiteaccesos con restricciones existentes;USER_CHANGE_STATUS permiteestado/revocación;USER_CREATE permitereenvío/invitación. No se habilitan propiasconcesiones nicambios deacceso global.

Ajuste AC-006 (2026-11-21): reutilizar user-dialog-actions en el footer de invitación, con Cancelar y submit externo Crear e invitar asociado al formulario existente. Mantener confirmación, validaciones, permisos y bloqueo de doble envío; comprobar alineación y visibilidad en escritorio/móvil sin envíos reales.
