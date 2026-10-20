# Contrato del sistema de diseño

Este documento rige las nuevas pantallas y cambios de UI de Misión Líder París. La decisión técnica vigente está en [ADR 0003](adr/0003-primeng-design-system.md). Cambiar biblioteca, identidad o comportamiento compartido requiere actualizar la decisión y la especificación correspondiente; no basta con escribirlo en una conversación o duplicar valores en un componente.

## Fuentes únicas

| Responsabilidad | Fuente que se modifica |
| --- | --- |
| Paleta, tipografías, espacios, radios, sombras, foco y movimiento | `frontend/src/styles/tokens.css` |
| Aplicación de tokens a PrimeNG, base Aura | `frontend/src/app/core/theme/primeng-preset.ts` |
| Registro del tema, selector oscuro y traducciones | `frontend/src/app/app.config.ts` |
| Utilidades responsive y puente de tokens | `frontend/src/styles/tailwind.css` |
| Adaptación editorial del HTML público | `frontend/src/styles/_public-site.scss` |
| Catálogo navegable de controles | `/diseno` |
| Conducta de una funcionalidad y evidencia | `specs/NNN-nombre/` |

Los valores de color viven en tokens, no en este documento. `--ml-brand-*` y `--ml-neutral-*` son escalas; `--ml-color-*` expresa intención (acción, superficie, texto, error, foco); `--ml-public-*` conserva la identidad editorial original. Los nombres históricos `--dark-green`, etc., son alias de compatibilidad hacia esos tokens, no otra paleta. Un color editorial decorativo no sustituye automáticamente al color de texto o botón: la acción principal usa su variante de contraste.

Al cambiar una intención, modificar su token; no copiar el hexadecimal en SCSS, TypeScript o clases Tailwind arbitrarias. El preset usa referencias CSS, de modo que PrimeNG y Tailwind comparten el cambio. La preferencia oscura es explícita en `html[data-theme='dark']`, no depende automáticamente del sistema operativo. Las fotografías y banners son contenido, no tokens; mantienen los recursos originales.

El meta `theme-color` de `src/index.html` conserva un literal para el navegador antes de cargar CSS: si cambia el color principal claro debe sincronizarse. Las fuentes `@font-face` se declaran en `_public-fonts.scss`; la elección de familia está en tokens. La geometría heredada del HTML se conserva durante la paridad: no convertir cada medida histórica en un token sin reutilización real.

La vista 404 conserva excepcionalmente la composición y acentos de la referencia Firebase, mediante tokens `--ml-not-found-*`, con texto público en español y regreso al inicio (ADR 0004). El offset de anclas usa `--ml-header-offset`; no añadir márgenes diferentes por página para compensar el mismo header.

## Selección de componentes

| Necesidad | Elección |
| --- | --- |
| Banners e imágenes de portada | PrimeNG Galleria con wrapper de accesibilidad |
| Lista deslizante de tarjetas | Evaluar PrimeNG Carousel; el rail nativo heredado sigue funcionando hasta migración justificada |
| Seleccionar número/rango | PrimeNG Slider |
| Acciones | Button / directiva pButton; enlaces reales conservan navegación |
| Campos y formularios | InputText, Textarea, Select, DatePicker según necesidad; Reactive Forms tipados |
| Datos tabulares y filtros | Table; paginación/ordenación de servidor cuando el volumen lo requiera |
| Diálogos y notificaciones | Dialog, ConfirmDialog, Toast o Message según contexto |
| Iconos nuevos | Importaciones individuales de Lucide |

No añadir Material, Bootstrap, otro kit o widgets personalizados que dupliquen una necesidad cubierta sin justificarlo en la spec. Importar componentes por funcionalidad; no crear un módulo global que cargue todo PrimeNG ni wrappers vacíos de cada control. SCSS se usa para composición propia; los estilos de PrimeNG se ajustan con preset, tokens o sus APIs públicas, sin `::ng-deep` ni selectores privados.

El preset importa Aura base y los temas de Button, InputText, Textarea, Galleria y DataTable, evitando cargar el catálogo completo en el arranque. Al incorporar otro componente, registrar también su tema Aura y los de controles auxiliares que use, y comprobar el presupuesto de build. No aumentar el límite para ocultar una importación innecesaria.

## Criterios UI y UX

- Mantener header/footer persistentes y jerarquía de encabezados. Las páginas públicas preservan el contenido institucional; autenticación y CRUD esperan sus requisitos.
- Definir estados vacío, cargando, éxito, error, deshabilitado y validación solo cuando apliquen. Conservar datos ante fallo y mostrar éxito únicamente tras confirmación.
- Etiquetas asociadas, errores comprensibles, foco visible, teclado y controles táctiles de al menos el token de 44 px en controles propios. Revisar contraste AA en cada combinación nueva; la existencia de tokens no certifica accesibilidad del sitio heredado.
- Carruseles con navegación manual y pausa; detener rotación por foco/puntero y respetar movimiento reducido. La información no depende solo de hover o del color.
- Diseñar móvil primero; comprobar al menos móvil y escritorio, sin scroll horizontal del documento. Las tablas pueden tener su propia región de desplazamiento.
- Reutilizar escalas de espacio y tipografía para UI nueva. No rediseñar doctrina, datos, QR o fotografías inventando contenido.

## Aplicación en Spec-Driven Development

Antes de implementar, la spec declara objetivo, usuario, flujos, criterios observables y referencia a este contrato. El plan identifica componentes PrimeNG, tokens existentes o nuevos, rutas, estados, accesibilidad y efecto responsive. Una excepción se documenta con motivo y alcance; un cambio transversal se decide en ADR y se propaga a instrucciones y catálogo.

Las tareas enlazan requisitos con archivos; `validation.md` separa build, checks estructurales y revisión visual. `traceability.json` no marca un criterio verificado por existir código. Por instrucción vigente, **las pruebas unitarias están diferidas**: no crearlas, modificarlas ni ejecutarlas hasta que el usuario retome ese trabajo. Su ausencia se registra, no se oculta ni se convierte en un impedimento para implementar la UI autorizada.

`npm run design:check` comprueba que la biblioteca declarada sea PrimeNG, que no se importe Material en el código de aplicación, que no aparezcan colores literales fuera de tokens y que los tokens referenciados existan. Excluye las pruebas diferidas. Es un control estático del contrato, no una prueba de interacción, contraste o accesibilidad completa.
