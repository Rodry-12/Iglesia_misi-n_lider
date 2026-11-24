# Plan

Reutilizar ProcessCatalogService y controladores. Ampliación aditiva CategoryDto/ProcessDto con fechas reales; categoría contextual en procesos mediante proyección EF. Sin CRUD nuevo ni SQL.

Angular: reemplazar preparación Formación por catálogo con tarjetas de categorías, tabla compacta de procesos, filtros/paginadores independientes y selección. Rutas hijas de detalle y formulario compartidos por entidad; guards de lectura y permiso global para mutaciones. Store por ruta: HTTP, Signals, cancelación/versiones de lecturas, borrado por identidad, opciones paginadas y comandos sin reintentos. No descargar/filtrar registros por sede.

PrimeNG Button, InputText, Textarea, Select, Table, Paginator, Message y ConfirmDialog existentes. Fichas con UUID/fechas; formularios con nombre, descripción, orden y categoría activa si proceso. Estilos SCSS/tokens de docs/design-system.md, responsive, labels/foco/teclado, vacío/cargando/error/guardado/conflicto. Confirmación antes de baja y de descartar borrador.

Verificar backend HTTP + PostgreSQL aislado, DTO y relaciones, nombres únicos y competencia de creación/estado/asignaciones. Unitarias de store/formulario/permisos; E2E controlados y fixture HTTPS real reutilizada. No tocar Supabase ni ejecutar migraciones/bootstrap.

Navegacion 2026-11-22: extender ADMIN_NAVIGATION con children y globalPermission sin cambiar guards ni API. Layout reutiliza RouterLinkActive, Button PrimeNG y LucideChevronDown; tokens de sidebar para jerarquia y foco. Enlace Formacion conserva acceso al catalogo; boton contiguo despliega/oculta cuatro rutas existentes. NavigationEnd abre el grupo al entrar o recargar una ruta hija. Se mantiene cierre de sidebar al navegar en movil.

Correccion vigente 2026-11-22: sustituye el enfoque anterior de simples enlaces de creacion. TrainingHome es portada de accesos sin consultas ministeriales; TrainingPage se reutiliza en dos rutas con data.kind para mostrar/consultar un solo catalogo. CatalogStore conserva listKind para que reintentos y refrescos tras comandos no carguen el otro modulo, y cancela lecturas al cambiar. Formularios/fichas mantienen UUID, validaciones y permisos originales; enlaces absolutos y cancelacion regresan a su segmento. Ver procesos navega a Procesos con categoryId. No duplicar CRUD ni tocar API/PostgreSQL.

FR-008: reutilizar TrainingPage como listado de fondo tambien en rutas crear/editar/detalle mediante data.catalogMode. Componentes de formulario/ficha con CatalogStore privado para no contaminar el listado; guard padre delega canLeave del formulario. Guardado confirmado notifica Toast y regresa al listado con filtros/pagina en URL. PrimeNG Dialog/Table/Select/Button y Lucide, tokens existentes, footer externo por form/id, permisos sin cambios. Tabla categorias reemplaza tarjetas, sin duplicar titulo. Conservar confirmacion de estado y reglas de guardado existentes.

Busqueda 2026-11-22: ProcessCatalogService aplica translate + upper en PostgreSQL a nombre y termino antes de Count/Skip/Take. SearchNormalization comparte el mapeo existente de Sedes; sin extensiones, DDL, cambios de datos o permisos. Verificacion mediante servicios reales en transaccion de solo lectura con rollback.

FR-010: extender predicado de procesos con OR sobre p.Category.Name, con el mismo translate/upper. Mantener JOIN/proyeccion y filtros existentes. Angular modifica solo placeholder; comprobar transporte de termino tras debounce en escritorio/movil con HTTP controlado y verificar resultados reales mediante servicio en solo lectura.

FR-011: CatalogStore distingue optionsLoaded de optionsLoading/optionsError; resetear en clear/inicio y marcar solo despues de cargar todas las paginas. Aviso vacio requiere carga completada y no pendiente. No depender de visible de Dialog: su contenido puede instanciar Toast aunque este oculto.
