# Plan — 004 northflank-backend-container

## Diseño

Dockerfile en backend/ y contexto backend/: copiar primero props/configs y csproj/locks de Domain/Application/Infrastructure/API, restore de API, después src y archivo de referencia exigido por csproj, publish sin apphost/símbolos y retirar schema-reference del resultado de imagen. Runtime aspnet10.0, /app de solo código root-owned, USER app mediante APP_UID oficial, HOME /home/app; directorios privados bajo HOME para montajes externos. No VOLUME implícito ni scripts root de arranque.

Para UI: seleccionar componentes PrimeNG según `docs/design-system.md`; identificar tokens existentes/nuevos, estados de interacción, foco/teclado y adaptación móvil/escritorio. El preset de PrimeNG y Tailwind comparten `tokens.css`.

## Verificación

Restore locked, build Release a artefactos aislados y tests existentes; reconocer fallo previo OpenAPI y pruebas PostgreSQL omitidas. Publish API local framework-dependent y revisión de nombres/archivo sensible. Revisar entradas COPY y referencias con mayúsculas exactas para Linux. Sin Docker instalado: no construir imagen, no medir RSS/arranque/tamaño ni afirmar aceptación de Northflank. Consultar documentación primaria de Northflank y Microsoft, registrar fecha y bloqueos.

Instrucción vigente: pruebas unitarias diferidas por el usuario. No crearlas, modificarlas ni ejecutarlas hasta que se retomen explícitamente. Registrar build, checks y revisión visual por separado; no afirmar cobertura unitaria.

## Riesgos y decisiones

Registrar los riesgos reales y las decisiones que necesitan contexto adicional.
