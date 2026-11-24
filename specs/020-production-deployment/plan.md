# Plan — 020 production-deployment

## Diseño

Revisar firebase.json/.firebaserc, API Program/configuración, cookies/interceptor, correo y rutas públicas. Registrar configuración exacta en deploy/.env.example y docs/production-deployment.md; Gmail confirmado, alojamiento/dominio a cargo del usuario. Compilar Angular y publicar API en backend/artifacts/release/api sin trasladar secretos ni activar recursos remotos.

Para UI: seleccionar componentes PrimeNG según `docs/design-system.md`; identificar tokens existentes/nuevos, estados de interacción, foco/teclado y adaptación móvil/escritorio. El preset de PrimeNG y Tailwind comparten `tokens.css`.

## Verificación

AC-001: fuentes y documentación primaria. AC-002: build/publish y comprobación de artefactos, sin bases/correos reales. AC-003: pruebas de ForwardedHeadersMiddleware con proxy conocido/desconocido, configuración inválida y modo desactivado; regresiones HTTP/CSRF. AC-004: aceptación remota pendiente, no ejecutada en este incremento.

La autorización vigente del usuario retoma pruebas. En esta preparación no hay comportamiento funcional nuevo ni tests nuevos. Registrar build/checks por separado; no afirmar aceptación remota. Revisar tres fallos ministeriales y OpenAPI/certificado existentes antes de certificar candidato.

## Riesgos y decisiones

FR-007/AC-006: wrapper Node de build lee exclusivamente MLP_API_BASE_URL del entorno o frontend/.env (parseEnv nativo); valida HTTPS y sufijo /api/v1 y pasa --define al CLI de Angular mediante spawn sin shell. No genera ni modifica TypeScript. El archivo .env permanece ignorado, se versiona solo la plantilla pública. Desarrollo conserva proxy local. Verificar precedencia/rechazo con node:test e inspeccionar el resultado de un build con destino de prueba; reconstruir al valor original después.

FR-006/AC-005: environments de compilación y reemplazo production en angular.json. Un interceptor final resuelve /api/v1 contra apiBaseUrl, después de autenticación/actividad, para preservar comprobaciones de sesión y evitar adjuntar credenciales a externos. Pruebas con HttpTestingController, sin API ni correo reales. No hay UI ni tokens visuales nuevos. HTTPS y cookies Strict se conservan: origen distinto exige CORS autorizado y pertenecer al mismo sitio; dominios de sitios diferentes necesitan otro diseño de sesión. Configuración pública requiere recompilar y no carga .env.

TrustedReverseProxy configura únicamente X-Forwarded-For/Proto cuando ReverseProxy:Enabled=true con IPs válidas explícitas, límite1–3 y headers simétricos; rechaza0.0.0.0/::. Middleware antes de HTTPS/autenticación. No aceptar X-Forwarded-Host ni activar confianza global. Persistencia de claves/Gmail y variables privadas se provisionan separadamente. EmailJS público independiente. Sin cambios de UI/tokens/componentes ni activación remota.
