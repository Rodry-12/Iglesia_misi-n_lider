# Plan HU-003

Ajuste visual 2026-11-21: no mostrar País emisor en el contexto documental readonly del editor; conservar el valor persistido y el contrato. Reutilizar las proporciones y estilos de identificación/sede/estado de la ficha, con footer y protecciones de edición existentes.

2026-11-21: reutilizar PersonEditPage como editor modal con Dialog PrimeNG y store aislado por instancia; entrada personId y salidas closed/savedChange, sin mover HTTP al componente. MembersPage coordina apertura/cierre y refresco del listado; la URL directa de edición abre el mismo modal y delega canLeave mediante el guard existente. Pie externo al scroll y submit nativo asociado mediante form/id. Estilos compartidos person-dialog.scss con ficha readonly, DatePicker appendTo body y composición responsive. Se retiran datos técnicos de la consulta, conservando expectedUpdatedAt interno. Mantener confirmación de descarte, bloqueo durante guardado y errores operativos en Toast.

Reutilizar PeopleService, PersonRequest y MembersStore. Agregar ExpectedUpdatedAt y token EF de fecha_actualizacion sin DDL, manteniendo transacción y bloqueos. El servidor controla la nueva fecha y aumenta al menos un microsegundo respecto de la versión anterior. PostgreSQL timestamptz almacena microsegundos; los lectores devuelven la versión exacta, usada en comparación y WHERE de EF. Verificar round-trip y peticiones paralelas.

UI según docs/design-system.md: PrimeNG InputText, DatePicker, Button, Message y ConfirmDialog; SCSS/tokens HU-002, dos columnas escritorio y una móvil. Estados carga/error/no autorizado/edición/guardando/conflicto/éxito; labels, teclado y mensajes accesibles. Documento/contexto ministerial como texto. Guard de borrador compartido y validadores comunes, sin otro store ni HTTP en componentes.

Pruebas HTTP/SQL local controlado de integridad, permisos, inválidos y concurrencia; unitarias Angular de formulario/store; E2E real con fixture HTTPS existente. Sin credenciales reales, Supabase, migraciones ni bootstrap.
