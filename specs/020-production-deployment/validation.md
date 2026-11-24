# Validación — 020 production-deployment

Revisión de variables backend: plantilla contrastada con Program.cs y BackendOptions.cs. Se distinguen DOMINIO_APP (Angular/CORS/enlaces de cuenta) y DOMINIO_API (AllowedHosts/callback Gmail), que pueden coincidir. Solo documentación/plantilla, sin cambiar credenciales ni ejecutar conexiones o despliegues.

2026-11-23: inspección local completada. Firebase publica solo frontend/dist con fallback a index.html; Angular llama /api/v1 y adjunta credenciales/CSRF solo a ese prefijo. API AllowedHosts=localhost por defecto. Se añadió proxy confiable opt-in antes de HTTPS/auth, desactivado por defecto. Cookies Secure/Strict/HttpOnly; Gmail requiere token bajo perfil, key ring/PFX persistentes y estado OAuth en memoria. Contacto público usa EmailJS independiente. No se inspeccionaron ni imprimieron secretos privados. El usuario aclara que maneja alojamiento/dominio/DNS y confirma Gmail; no se solicita presupuesto.

| Criterio | Método                                       | Resultado y evidencia |
| -------- | -------------------------------------------- | --------------------- |
| AC-001   | Fuentes locales y documentación primaria | Informe docs/production-deployment.md |
| AC-002   | Build Angular / publish API | Correctos; artefactos separados |
| AC-003   | Plantilla/guía y seguridad de proxy |22 pruebas HTTP correctas; sin credenciales reales |
| AC-004   | Aceptación remota | No ejecutada |

No se crearon recursos, no se modificó DNS/Supabase ni se enviaron correos. No se considera vigente un respaldo histórico sin comprobarlo para el corte. Los fallos previos están documentados en backend/specs/001-ministry-backend/validation.md y no se da la suite por aceptada completa.

Comandos: npm run build correcto; advertencia existente de presupuesto583,76kB frente a500kB. dotnet publish Release --no-restore correcto a backend/artifacts/release/api; compilación final con BaseOutputPath absoluto en backend/artifacts/production-build/bin para no sobrescribir la API local en ejecución. Assembly e index.html presentes; no se encontraron .env, secrets.json, PFX/P12 ni credential.bin entre los nombres de archivos publicados.

dotnet test IntegrationTests --filter '(TrustedReverseProxyTests|HttpSecurityTests|PerformanceMiddlewareTests) excepto DevelopmentOpenApi...' correcto22/22. Siete casos nuevos verifican proxy conocido/desconocido, confianza vacía/inválida/any y forwarding desactivado. Primer intento de compilación de tests requirió agregar using Microsoft.AspNetCore.Builder; repetición correcta. No conexión a base ni mensajes de correo en estas pruebas.

Plantilla deliberadamente contiene REEMPLAZAR; no se presenta como configuración real validada del host. Rutas Linux bajo /home/app son ejemplos, necesitan usuario/volumen efectivos. Persistencia, proxy público y OAuth/entrega reales pendientes de completar en servidor. No se usa el build como prueba de aceptación remota.

2026-11-23, FR-006/AC-005: se añade apiBaseUrl en environments de desarrollo/producción y fileReplacements de Angular. Valor versionado /api/v1 conserva el mismo origen; no se inventa URL remota. Un interceptor final resuelve todas las llamadas API después de autenticación/actividad. Documentados recompilación, origen exacto CORS y límite SameSite=Strict (otro origen debe pertenecer al mismo sitio). No se cambia el backend ni se debilitan cookies/CSRF.

`npm test -- --include=src/app/core/config/api-base-url.interceptor.spec.ts --include=src/app/core/auth/auth.store.spec.ts`:35/35 correctas (13 de configuración HTTP,22 de autenticación). Se verifica sesión/listado/parámetros, CSRF antes de escritura, cookies,401, exclusión de EmailJS, mismo origen y rechazo de bases inválidas. Primer intento bloqueado por spawn EPERM del sandbox; repetición autorizada fuera del sandbox correcta. No peticiones reales a API ni envío de correo.

`npm run build`: correcto con reemplazo de producción configurado; advertencia de presupuesto inicial584,30kB frente a500kB (el presupuesto ya se excedía antes del cambio). Prettier de archivos TypeScript/JSON modificados correcto. Primer spec:check detectó falta de trazabilidad AC-005 durante el trabajo y se completó después. Aceptación en navegador con URL pública real y CORS remoto pendiente; no se afirma despliegue.

2026-11-23, FR-007/AC-006: a petición del usuario se sustituye la edición manual de TypeScript por MLP_API_BASE_URL del entorno del build o frontend/.env. scripts/build-frontend.mjs usa parseEnv nativo y solo pasa esa clave a Angular --define; el entorno prevalece sobre .env, sin fuente se conserva /api/v1. Se versiona frontend/.env.example; .env continúa ignorado. No se crearon archivos con URL real ni se cambió el backend.

`node --test scripts/build-frontend.test.mjs`:8/8 correctas (precedencia, valor de .env entre comillas, fallback y rechazo de URL vacía/insegura/credenciales/query/fragmento/ruta incorrecta). Primer intento con EPERM del sandbox; repetición autorizada correcta. Prettier dirigido a archivos modificados correcto.

Build con MLP_API_BASE_URL=https://api.build-verification.invalid/api/v1 correcto; inspección de JavaScript confirmó ese literal en un archivo. Segundo npm run build sin variable ni frontend/.env correcto, para retirar el destino de prueba del artefacto final. Advertencia previa de presupuesto inicial se mantiene (584,30kB frente a500kB). La URL es pública y se fija al compilar; no se afirma configuración dinámica después de publicar. No se hicieron peticiones remotas ni se repitieron las35 regresiones HTTP sin cambios en esos interceptores.
