# Validación — 004 public-site-architecture

Fecha: 2026-10-19, America/Bogota. Estado: implementación y compilación completas; validación de comportamiento pendiente.

| Criterio | Método                                                                            | Resultado y evidencia                        |
| -------- | --------------------------------------------------------------------------------- | -------------------------------------------- |
| AC-001   | RouterTestingHarness: landmarks únicos e identidad de header/footer entre páginas | Prueba añadida, no ejecutada                 |
| AC-002   | Navegación hacia /acceso, ausencia de enlaces internos y de formulario nuevo      | Prueba añadida, no ejecutada                 |
| AC-003   | Estado aria-expanded, navegación programática, Escape y retorno de foco           | Pruebas preparadas, no ejecutadas            |
| AC-004   | Contenido de secciones, canales de contacto y QR local                            | Pruebas conservadas/ampliadas, no ejecutadas |
| AC-005   | Compilación y comprobaciones estructurales                                        | Build correcto; suite no autorizada          |

`npm run build` terminó correctamente, incluido el hook de avisos de terceros. El bundle inicial fue de 286,05 kB (estimación de transferencia 79,37 kB, sin imágenes). El layout público y sus rutas se emitieron como chunks diferidos.

`npm run spec:check`, `npm run skills:check` y `npm run format:check` finalizaron correctamente. Se resolvieron los enlaces locales de documentación y skills sin referencias rotas. El CSS compilado contiene los estilos delimitados a `.public-site`; el QR del build coincide byte por byte con su original.

La solicitud de `npm test` fue rechazada por el usuario antes de iniciar el proceso. No se reintentó por otra vía. No se atribuyen resultados nuevos a las pruebas de este incremento ni se cierran los pendientes de la spec 003.

No se inició servidor ni navegador. No se afirma haber realizado revisión visual, de accesibilidad completa ni verificado identidad de componentes en ejecución. Esos comportamientos están cubiertos por pruebas preparadas para una ejecución posterior.

No se modificaron los archivos HTML originales, imágenes, datos bancarios ni la lógica de administración/autenticación. Se actualizaron las rutas de archivos en la trazabilidad previa para conservar referencias válidas después de los movimientos.
