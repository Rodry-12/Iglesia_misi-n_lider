# Validación 003 — Base de administración

Nota posterior: la evidencia de controles/tema Material describe esa implementación histórica. ADR 0003 y spec 006 la sustituyen por PrimeNG; no reutilizar los resultados unitarios de Material como validación de los componentes actuales. Las pruebas específicas pendientes se adaptarán cuando el usuario retome las pruebas unitarias.

Fecha: 2026-10-19, America/Bogota. Estado: implementación realizada, validación final pendiente.

## Resultados comprobados

- Instalación completada y lockfile actualizado. Se conservó la dependencia local al workspace que ya existía al comenzar este incremento.
- `npm run build`: compilación de producción correcta; bundle inicial 290,85 kB, estimación de transferencia 80,65 kB, sin contar imágenes. La guía visual, layout de gestión y módulos aparecen como chunks diferidos.
- `npm test`, primera pasada: **19 de 20 pruebas correctas**. Pasaron regresión pública, formulario, tema, guía visual, denegación anónima, denegación por permiso, navegación filtrada y aislamiento por sede. La apertura autorizada inicial de Finanzas superó el límite de 5 s (carga inicial observada de aproximadamente 8,5 s).
- Se aumentó a 15 s el límite de la prueba parametrizada que carga en frío el layout y Lucide. Se añadieron dos casos: metadatos ausentes y ámbito vacío/all-sites. **La suite final de 22 pruebas no se ejecutó: la repetición solicitada fue rechazada por el usuario.** No se afirma que ese ajuste haya resuelto el timeout.
- `npm run deps:check`: seis dependencias UI contrastadas contra manifiesto, instalación, lockfile y archivo de licencia; Material/CDK/Tailwind/PostCSS MIT y Lucide ISC.
- `npm run skills:check` y `npm run format:check`: correctos.
- Revisión del CSS compilado: utilidades Tailwind y responsive presentes; tokens claro/oscuro presentes; `--mat-sys-primary` referencia `--ml-color-primary`.
- `node scripts/prepare-ui-notices.mjs`: ejecutado correctamente sobre el build. `browser/third-party-notices.txt` incluye las seis dependencias y sus versiones, además de los avisos extraídos por Angular. Este script quedó como hook `postbuild`; no se volvió a compilar después de añadir el hook.
- Enlaces locales de documentación y skills comprobados, sin referencias rotas.

## Cobertura de aceptación

| Criterio | Estado                           | Evidencia                                                                                                    |
| -------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| AC-001   | Parcial                          | Build, dependencias y licencias correctos; suite final pendiente                                             |
| AC-002   | Verificado localmente            | Prueba de tema correcta y CSS compilado con puente Material/Tailwind                                         |
| AC-003   | Verificado localmente            | Tres pruebas de formulario y una de guía visual correctas                                                    |
| AC-004   | Parcial                          | Denegaciones y cuatro módulos autorizados correctos; Finanzas agotó el tiempo; metadatos nuevos sin ejecutar |
| AC-005   | Verificado para casos ejecutados | Navegación filtrada y sede-a/sede-b correctos; caso adicional de ámbito vacío pendiente                      |
| AC-006   | Verificado localmente            | Regresión pública, documentación, enlaces y skills correctos                                                 |

## Límites

No se inició servidor, navegador ni un nuevo despliegue. Las pruebas ejecutadas usan jsdom/TestBed; no constituyen una revisión visual o auditoría completa de accesibilidad.

No hay backend, autenticación real, asignación institucional de roles ni CRUD. Se consultó al usuario por esos datos; al no disponer de definición durante este incremento se conservó sesión nula y un contrato de capacidades. Los módulos muestran «Próximamente» y la guía no persiste datos.

La autorización por sede deberá aplicarse en la API; los guards del cliente solo controlan navegación. El build no demuestra seguridad de servidor ni validez de credenciales.
