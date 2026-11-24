# 004 — northflank-backend-container

Estado: En curso; preparación local, sin despliegue ni gastos autorizados.

## Problema y resultado esperado

Preparar una imagen Linux .NET10 del backend existente para Northflank Sandbox, con configuración exclusivamente runtime y presupuesto0USD. Distinguir artefacto preparado de aceptación real de imagen/plataforma.

## Alcance y exclusiones

Dockerfile multietapa, .dockerignore de contexto backend y guía deploy/northflank.md. Sin Angular, cambios PostgreSQL/RLS/roles, reglas de negocio, modelo de cookies, nuevas credenciales ni servicios de pago. Sin instalar Docker o crear recursos remotos.

## Contrato transversal de UI

Para frontend, aplicar `docs/design-system.md` y ADR 0003: Angular + PrimeNG + Tailwind + SCSS + tokens + Lucide, Signals y Reactive Forms. Definir componentes, estados, accesibilidad y responsive en el plan. No duplicar colores: `frontend/src/styles/tokens.css`. Registrar cualquier excepción con su motivo.

## Requisitos

- FR-001: Compilar API net10.0 y sus cuatro proyectos reales con SDK10.0 oficial, restore locked con caché de capas y publish Release framework-dependent; ejecutar aspnet10.0 oficial sin SDK ni Angular, usuario app no root y HTTP8080.
- FR-002: Contexto backend con lista de archivos permitidos; excluir secretos, bin/obj, pruebas, metadata local, referencias históricas de ejecución y archivos privados. Ningún secreto en ARG/ENV/capas; configuración inyectada solo en runtime desde Northflank.
- FR-003: Documentar rutas persistentes para keyring/Gmail bajo HOME fuera de /app y PFX aprovisionado externamente con permisos restringidos. No crear secretos ni asumir volúmenes gratuitos o permisos de montaje efectivos.
- FR-004: Conservar HTTPS/cookies/CSRF y confianza explícita del proxy; documentar bloqueo sin IPs confiables, sitios compatibles con Strict, almacenamiento0USD y PFX legible por app. Reutilizar health/live, health/ready y monitor protegido sin duplicación.
- FR-005: Guía de build context, puerto, variables por nombre, recursos/precios verificados, logs, despliegue/rollback y rendimiento sin prometer2s ni alterar consultas.

## Aceptación

- AC-001: Dockerfile referencia archivos/proyectos reales, imágenes oficiales10.0, capas restore/publish separadas, ENTRYPOINT de API, puerto8080 y usuario no root; sin secretos ni arranque de migraciones.
- AC-002: Contexto permitido contiene todos los proyectos/dependencias y únicamente configuración pública necesaria; publicación local separada compila y no incluye secretos, SDK, Angular ni SQL histórico de referencia.
- AC-003: Guía identifica persistencia, UID/permisos, PFX binario, proxy confiable, CORS/Strict y condiciones0USD, sin valores productivos inventados ni activación remota.
- AC-004: Restore/build/test y revisión de compatibilidad documentados; si no hay Docker no se afirma construcción ni ejecución Linux real, memoria/tamaño/latencias quedan pendientes.

## Escenarios y dudas

La plataforma gratuita no queda certificada solo porque compile la aplicación. Deben confirmarse volúmenes sin coste, montaje binario PFX para UID app y direcciones de ingress confiables. Hostnames pages.dev y Northflank de sitios distintos son incompatibles con cookies Strict. Sin UI nueva; contrato visual no requiere cambios.
