# Validación — 004 northflank-backend-container

2026-11-24. Preparación local verificada; ejecución Docker/Linux y aceptación de Northflank pendientes. No despliegue ni gastos.

| Criterio | Método                               | Resultado y evidencia                                                                                                                                       |
| -------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-001   | Inspección Dockerfile y rutas        | Dos etapas oficiales10.0; restore locked antes de fuentes; USER APP_UID, HOME /home/app, EXPOSE8080, ENTRYPOINT de API, sin secretos ni SQL de arranque.    |
| AC-002   | Contexto/COPY/restore/publish limpio | Doce entradas COPY JSON y cuatro proyectos verificados;19 archivos de publicación,14,77MiB (no tamaño de imagen), sin archivos privados ni apphost Windows. |
| AC-003   | Código + documentación primaria      | Tabla de nombres, persistencia/PFX y permisos, proxy limitado y bloqueo Strict entre sitios; plan0USD condicionado a recursos reales del panel.             |
| AC-004   | Build/tests y límites Linux          | Build0 errores/0 advertencias;164 pruebas correctas,105 omitidas, OpenAPI previo excluido. Sin Docker: imagen y runtime Linux no certificados.              |

Fuentes inspeccionadas: MisionLiderParis.slnx, Directory.Build.props, cuatro csproj
y locks, Directory.Packages.props, global.json, NuGet.Config, Program.cs,
TrustedReverseProxy, RuntimeDatabaseValidator, ProtectedGmailCredentialStore,
health checks existentes, deploy/.env.example e ignores. No hubo cambios de .NET,
frontend, consultas, seguridad de sesión, base de datos ni configuración privada.

`dotnet restore MisionLiderParis.slnx --locked-mode`: correcto. El intento
restringido terminó sin diagnóstico; repetición autorizada fuera del sandbox correcta.
`dotnet build ... --no-restore -c Release --property:BaseOutputPath=.../artifacts/northflank-build/bin/`:
correcto0 errores/0 advertencias. Se separó salida para no sobrescribir API en uso.

`dotnet test ... --no-build --no-restore -c Release --filter
FullyQualifiedName!~DevelopmentOpenApiDescribesImplementedRoutesAndRequestContracts`:
114 unitarias y50 integración correctas (164);105 omitidas por falta de PostgreSQL
aislado/browser. TRX en backend/artifacts/northflank-test-results. OpenAPI conserva
el fallo previo documentado en spec003; no se afirma suite completa sin exclusiones.
No se crearon tests que solo comparen texto del Dockerfile consigo mismo.

Se validaron doce rutas fuente de instrucciones COPY JSON y los cuatro proyectos
referenciados. Se verificaron nombres/capitalización de rutas para Linux y la
inclusión de la referencia Content del csproj sin ejecutar su SQL. El usuario app
y UID1654/puerto8080 se contrastaron con Dockerfile oficial .NET10 runtime-deps.

La primera publicación desde el árbol de trabajo con BaseOutputPath alterno
incorporó JSON de bin antiguos por el comportamiento de globbing del SDK. No es el
contexto Docker: .dockerignore excluye bin/obj y Development. Para validar sin esa
contaminación se preparó backend/artifacts/northflank-context con88 archivos de
fuentes/proyectos/locks/settings públicos y cinco entradas de configuración/referencia,
sin secretos, bin/obj ni metadata local. Se restauró solo API locked y se publicó
Release desde ese conjunto limpio, con --self-contained false, UseAppHost=false,
DebugType=None y DebugSymbols=false. No es otra aplicación ni fuente versionada:
es un artefacto temporal de verificación, no se inicia contra ninguna base.

Publish limpio en backend/artifacts/northflank-clean-release/api: correcto. Se retiró
schema-reference.txt como hace la etapa publish del Dockerfile. Revisión de nombres:
sin .env, secrets.json, PFX/P12/KEY/PEM, credential.bin, PDB, pruebas, metadata local,
Development ni apphost Windows. Claves privadas conocidas de appsettings.json
comprobadas vacías sin imprimirlas. Runtimeconfig net10.0;19 archivos/14,77MiB.
Esto no es un escaneo del binario completo ni prueba de imagen libre de vulnerabilidades.

Docker no está instalado (Get-Command docker sin resultado); no se instaló ni
ejecutó docker build/run. Compatibilidad Linux se revisó estáticamente: rutas y
mayúsculas, IL framework-dependent, sin apphost Windows; APIs de permisos Unix
existentes con ramas OperatingSystem y base oficial. No se afirma ejecución Linux,
UID efectivo de un volumen montado, size de imagen, memoria, arranque ni mejora2s.

Fuentes primarias enlazadas en deploy/northflank.md: build context/BuildKit,
secret files root-owned, volúmenes, headers de networking y precios oficiales,
revisadas2026-11-24. No se inventaron cuotas CPU/RAM ni direcciones de ingress.
La existencia de Sandbox gratuito no acredita volumen/PFX seguro sin coste en la
cuenta concreta. No se creó ningún recurso de pago ni gratuito remoto.

Pendiente: build real Northflank, HTTPS con proxy confiable, volumen0USD/permisos,
PFX binario legible por app, dominios del mismo sitio, OAuth/runtime secrets,
aceptación de sesiones al reiniciar y rollback. Las variables se configuran luego
solo en Northflank; el monitor de Actions se habilita después, no desde la imagen.
