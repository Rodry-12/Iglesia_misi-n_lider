# 007 — public-finalization-cleanup

Estado: Verificada en el alcance autorizado: implementación, build, checks y revisión local. Pruebas unitarias diferidas.

Nota histórica del 2026-10-23: la reserva de backend vacío de FR-005/AC-004 fue sustituida por el incremento autorizado en ADR 0005 y `backend/specs/001-ministry-backend/`. Esta spec conserva la evidencia del cierre público del 19 de octubre; no limita la nueva petición de backend.

## Problema y resultado esperado

Restaurar el cambio de apariencia del header original al hacer scroll, recuperar la composición del 404 y retirar la aplicación HTML/Express activa tras independizar Angular. Dejar un repositorio claro con frontend, backend reservado, documentación y herramientas necesarias.

## Alcance y exclusiones

Header transparente en portada de escritorio hasta superar 80 px, negro y logo reducido después; móvil e interiores legibles. 404 con tarjeta y adaptación móvil de la referencia Firebase, mensajes en español y regreso al inicio. Cerrar hallazgos de la revisión anterior. Trasladar recursos usados a frontend/public/assets con verificación SHA-256, archivar la referencia original, retirar fuentes/herramientas obsoletas y unificar Firebase para Angular. Crear backend vacío con marcador Git. No implementar backend, autenticación o CRUD, enviar correo real, desplegar ni crear/modificar/ejecutar pruebas unitarias.

## Contrato de UI

Se mantiene ADR 0003 y docs/design-system.md: PrimeNG, Tailwind, SCSS y tokens comunes. El 404 conserva excepcionalmente los colores de la referencia Firebase, definidos en tokens, en lugar de introducir valores aislados. La referencia se conserva comprimida; no es una segunda aplicación activa.

## Contrato transversal de UI

Para frontend, aplicar `docs/design-system.md` y ADR 0003: Angular + PrimeNG + Tailwind + SCSS + tokens + Lucide, Signals y Reactive Forms. Definir componentes, estados, accesibilidad y responsive en el plan. No duplicar colores: `frontend/src/styles/tokens.css`. Registrar cualquier excepción con su motivo.

## Requisitos

- FR-001: Reproducir umbral de scroll >80 px y reversión al volver arriba; interiores negros, móvil usable y estado correcto al cargar rutas directamente.
- FR-002: Implementar 404 Angular con composición visual original, código, título claro, acción de regreso, header/footer compartidos y responsive.
- FR-003: Corregir conflicto hover/estado, anclas bajo header, overflow de 320 px, contactos duplicados, jerarquía/foco del formulario y espera máxima del correo.
- FR-004: Usar únicamente recursos propios versionados en frontend/public/assets; no copiar desde raíces heredadas al arrancar o compilar. Conservar QR, imágenes y fuentes byte a byte y sus licencias.
- FR-005: Archivar y verificar originales antes de retirar index.html, 404.html, donar, src, fonts y Express de la raíz. Consolidar configuración Firebase y depuración Angular. Backend sin implementación.
- FR-006: Mantener comandos, skills, documentación y trazabilidad SDD consistentes con la estructura final y registrar build/revisión visual sin pruebas unitarias.

## Aceptación

- AC-001: En portada de escritorio, header transparente a 0/80 px y negro por encima de 80; logo se reduce y revierte al volver arriba. Interiores y móvil conservan navegación usable.
- AC-002: URL desconocida muestra 404 con tarjeta responsive y enlace que vuelve al inicio, sin errores y dentro del layout público. Comparación con el 404 archivado registrada, incluidas diferencias deliberadas de idioma/layout.
- AC-003: Horarios abren/cierran correctamente con puntero encima; anclas visibles bajo header; no overflow en 320 px. Footer usa contenido central. El formulario enfoca el primer inválido y falla con recuperación al superar 15 s sin respuesta, sin envío externo ni reintento automático.
- AC-004: Assets requeridos existentes y propios; hashes del traslado coinciden con originales. ZIP original con todas sus entradas verificado. Build/start funcionan después de retirar fuentes antiguas; carpeta backend vacía salvo .gitkeep.
- AC-005: Raíz limpia, configuración Firebase sirve solo build Angular; sin Express residual ni perfil 8080. Checks, build, docs/skills/specs y revisión de navegador registrados sin pruebas unitarias.

## Escenarios y dudas

El 404 antiguo era una plantilla de Firebase, no una página institucional. Se conserva su composición pero se elimina la explicación técnica de Firebase para el visitante y se añade retorno a la aplicación. La ruta desconocida SPA no implica respuesta HTTP 404 del hosting estático. La publicación y el backend quedan pendientes. Se conserva archivo ZIP trazable porque los cambios originales no tienen garantía de estar todos recuperables desde Git. Los datos institucionales y la entrega real de EmailJS no se certifican.
