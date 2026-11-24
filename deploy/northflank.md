# Backend .NET10 en Northflank: preparación Docker

Revisión del2026-11-24. Alcance: archivos locales y validación; sin crear recursos,
configurar secretos remotos, publicar imágenes ni modificar Supabase. Presupuesto
autorizado: **US$0/mes**. Angular se publica por separado; no cambia en este trabajo.

## Estado y condiciones antes de producción

El Dockerfile está preparado para que Northflank lo construya. No hay Docker local;
no se instaló y no se certifica imagen construida/ejecutada, tamaño ni RSS Linux.
La compilación .NET local no sustituye esa aceptación.

Hay cuatro condiciones pendientes del entorno real:

1. Volumen duradero para Data Protection y Gmail, confirmado **sin coste** en la
   cuenta Sandbox. Si no está incluido, **producción bloqueada con presupuesto0**.
2. PFX binario estable aprovisionado en runtime, legible solo por el usuario/grupo
   de la app, con su contraseña privada. Una variable con la ruta no crea el archivo.
3. Direcciones exactas del proxy confiable y verificación de X-Forwarded-For/Proto.
   No inventar IPs ni confiar en todas las redes privadas.
4. Frontend y API en HTTPS dentro del mismo sitio para cookies Strict. Los dominios
   predeterminados pages.dev y de Northflank son sitios diferentes; solo configurar
   CORS no habilita esas cookies. Usar dominios del mismo sitio bajo control del
   usuario; no cambiar SameSite ni CSRF para resolverlo.

## Servicio y contexto de build

| Opción                                | Configuración preparada                                   |
| ------------------------------------- | --------------------------------------------------------- |
| Fuente                                | Repositorio GitHub existente, rama elegida por el usuario |
| Tipo                                  | Servicio combinado de build/deploy Dockerfile             |
| Dockerfile relativo al repositorio    | `/backend/Dockerfile`                                     |
| Build context relativo al repositorio | `/backend`                                                |
| Etapa final                           | `final`                                                   |
| Build arguments/secretos de build     | Ninguno                                                   |
| Puerto del contenedor                 | HTTP8080; HTTPS público termina en ingress                |
| Comando/entrypoint del servicio       | Conservar el de la imagen; no bootstrap/migraciones       |
| Instancias                            | Una, sin escalado automático                              |
| Variables/secret files                | Solo runtime, desde Northflank                            |

Northflank documenta Dockerfile y contexto como opciones distintas; COPY es relativo
al contexto. Usar BuildKit para aprovechar la capa de restore. Véase
[build con Dockerfile](https://northflank.com/docs/v1/application/build/build-with-a-dockerfile).
No usar el contexto raíz: el ignore específico pertenece a backend/.dockerignore.

La solución real es backend/MisionLiderParis.slnx; TargetFramework net10.0 está en
Directory.Build.props. API referencia Infrastructure, esta Application y esta
Domain. El Dockerfile restaura solo esos cuatro proyectos con sus locks y el
NuGet.Config público existente. No copia pruebas ni SDK al runtime.

El publish es Release framework-dependent, sin apphost ni símbolos. No se usa
trimming/AOT para evitar incompatibilidades EF/reflection sin medición. El archivo
SQL histórico requerido como Content por el csproj se copia solo durante build y
se retira del publish antes de la etapa final; **no se ejecuta SQL**.

Las etiquetas oficiales10.0 reciben actualizaciones: registrar digest/imagen y
commit de cada release para rollback; el caché de locks no equivale a reproducir
una imagen base mutable. Antes de construir una release, comprobar actualizaciones
de seguridad de sus imágenes base.

## Variables: nombres que se configuran en Northflank

El doble guion bajo es el separador jerárquico .NET. La plantilla general sigue en
deploy/.env.example, **no se carga ni se copia dentro de la imagen**. Introducir
los valores privados directamente en el gestor del servicio; no en GitHub ni build
arguments. No es necesario enviar variables del backend al frontend.

| Bloque                      | Nombres                                                                                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entorno/puerto/hosts        | `ASPNETCORE_ENVIRONMENT`, `DOTNET_ENVIRONMENT`, `ASPNETCORE_HTTP_PORTS`, `AllowedHosts`                                                                    |
| Origen Angular              | `Security__AllowedOrigins__0`                                                                                                                              |
| Conexiones existentes       | `Database__ConnectionString`, `Database__IdentityConnectionString`, `Database__RequireVerifiedTls`                                                         |
| Pool Identity               | `Database__IdentityPoolingEnabled`, `Database__IdentityPoolMaximumSize`                                                                                    |
| Firma RLS vigente           | `DatabaseActor__KeyId`, `DatabaseActor__SigningKeyBase64`                                                                                                  |
| Data Protection persistente | `Security__KeyRingPath`, `Security__KeyCertificatePath`, `Security__KeyCertificatePassword`                                                                |
| Correo transaccional        | `Email__Provider`, `Email__From`, `Email__ReplyTo`, `Email__InvitationUrl`, `Email__RecoveryUrl`, `Email__ConfirmationUrl`                                 |
| Gmail OAuth                 | `GoogleGmail__ClientId`, `GoogleGmail__ClientSecret`, `GoogleGmail__RedirectUri`, `GoogleGmail__TokenStorePath`                                            |
| Proxy confirmado            | `ReverseProxy__Enabled`, `ReverseProxy__KnownProxies__0`, `ReverseProxy__ForwardLimit`                                                                     |
| Monitor opcional            | `MLP_HEALTH_TOKEN`                                                                                                                                         |
| Logs/diagnóstico            | `Logging__LogLevel__Default`, `Diagnostics__Performance__Enabled`, `Diagnostics__Performance__CommandDetails`, `Diagnostics__Performance__AllowProduction` |

Usar entorno Production, puerto8080 y TLS verificado a Supabase; conservar Session
pooler, separación ministerial/Identity y valores HMAC/KeyId vigentes. No copiar
localhost ni credenciales administrativas. AllowedHosts corresponde a la API;
AllowedOrigins al origen HTTPS exacto de Angular sin barra final ni comodines.
Las URLs de cuenta corresponden a Angular y el callback OAuth al backend.

Las opciones restantes de duración de cookie, bloqueo, contraseña y tokens ya tienen
defaults seguros en appsettings.json y no requieren duplicación. Si se ajustan,
usar los nombres de la plantilla existente. Con GmailApi no configurar Resend ni
SMTP. No configurar MigrationConnectionString, InspectorConnectionString,
MLP_BOOTSTRAP_* o ASPNETCORE_FORWARDEDHEADERS_ENABLED.

MLP_HEALTH_TOKEN es el único token de monitoreo; no concede permisos ministeriales.
Ahora se configura solo en Northflank. Al habilitar GitHub Actions posteriormente,
el cliente del monitor necesitará una copia en Actions Secrets, nunca en el código.

## Persistencia, PFX y usuario Linux

El runtime usa el usuario no privilegiado `app` mediante APP_UID de la imagen
oficial. Microsoft define actualmente UID/GID1654 y puerto8080; HOME se fija en
/home/app. Véase [Dockerfile oficial runtime-deps10.0](https://github.com/dotnet/dotnet-docker/blob/main/src/runtime-deps/10.0/noble/amd64/Dockerfile).
Confirmar esos datos en la imagen realmente construida, sin sobrescribir USER
con root desde Northflank.

| Recurso                   | Ruta preparada/configurable                                                 | Requisito                                                                            |
| ------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Volumen de datos privados | `/home/app/.local/share/MisionLiderParis`                                   | Duradero y escribible por app; no montar sobre /app ni todo /home/app                |
| Keyring                   | Subdirectorio `keys` del volumen                                            | Conservar claves anteriores; directorio privado                                      |
| Gmail                     | Subdirectorio `gmail`, archivo `credential.bin`                             | Escritura atómica, directorio0700 y archivo0600 aplicados por el adaptador existente |
| Certificado PFX           | Archivo secreto externo, por ejemplo `/run/secrets/mlp-data-protection.pfx` | Binario real, mismo material entre releases, montaje solo lectura                    |

Las rutas se asignan con las variables existentes; el Dockerfile no contiene PFX,
token OAuth ni material de producción. El archivo Gmail debe permanecer bajo HOME
y fuera del ContentRoot /app: es una validación actual que no se ha relajado.

La imagen crea directorios privados para app, pero **un volumen montado sustituye
sus permisos**. El aprovisionamiento de la plataforma debe permitir crear claves
y escribir Gmail con el UID efectivo, sin chmod777 ni scripts de arranque root.
Mantener padres privados, keyring sin acceso de otros usuarios, y backups cifrados
del conjunto keyring/PFX/Gmail con recuperación comprobada.

Northflank indica que sus secret files son root-owned. Debe comprobarse que el
PFX pueda montarse como binario legible por app (propietario app0400 o grupo
app0440) sin lectura pública ni conversión accidental a texto/Base64. Si el
panel/mecanismo disponible no puede garantizarlo, el aprovisionamiento queda
bloqueado; no se incluye una alternativa insegura. Ver
[secret files](https://northflank.com/docs/v1/application/secure/upload-secret-files).

Los secret files estables pueden reinyectar el PFX en cada release; no sustituyen
el volumen para archivos que la aplicación modifica. Perder keyring o certificado
impide descifrar tokens/cookies y credenciales Gmail existentes. No generar PFX
ni HMAC diferentes en cada arranque.

Northflank documenta volúmenes persistentes y sus permisos, pero la disponibilidad
con coste0 debe confirmarse en la cuenta concreta antes de aprovisionar. No basta
que el contenedor tenga disco efímero. Ver
[volúmenes](https://northflank.com/docs/v1/application/databases-and-persistence/add-a-volume).
No se declara VOLUME en Dockerfile para no crear almacenamiento anónimo que aparente
persistencia de plataforma.

## Proxy y HTTPS

Confiar solo en el ingress real identificado. La implementación acepta **IPs
concretas**, no CIDR ni hostnames, con ForwardLimit acotado y simetría de
X-Forwarded-For/Proto. Obtener del proveedor las direcciones estables y la cadena
real antes de activar ReverseProxy; no usar toda10/8,0.0.0.0,:: ni confiar en todos.
Si el proveedor solo ofrece una red cambiante, hace falta un diseño revisado antes
de desplegar; esta preparación no añade confianza genérica.

Northflank preserva entradas anteriores de X-Forwarded-For y añade la dirección
del cliente; la lista completa no es una prueba de confianza. Véase
[networking y headers](https://northflank.com/docs/v1/application/network/networking-on-northflank).
No se sustituye la identidad del proxy por un header que un cliente pueda elegir.

La configuración debe hacer que IsHttps sea verdadero tras el ingress para que
funcionen monitor, cookies y Gmail, sin bucles de redirección. No retirar
UseHttpsRedirection, Secure/HttpOnly/Strict ni antiforgery para que pase un probe.
No hay certificado HTTPS local que copiar a Kestrel: el PFX de Data Protection
tiene otro propósito. Mantener no-store y no registrar Authorization/cookies/tokens
ni query strings del callback en logs del ingress/APM.

## Salud y recursos

Configurar probes de plataforma **TCP8080** para startup/liveness; así no dependen
de cabeceras del ingress ni exponen la credencial del monitor. Como configuración
inicial propuesta: startup cada10s con hasta12 fallos antes de reiniciar, y liveness
cada30s con3 fallos; revisar tras medir arranque real. No son cuotas de Northflank.
El probe TCP no certifica PostgreSQL ni esquemas. Ver opciones en
[health checks](https://northflank.com/docs/v1/application/observe/configure-health-checks).

`/health/live` es liveness HTTP existente y `/health/ready` comprueba DB/esquemas;
no se modifican. `/api/v1/health/database` continúa protegido por Bearer, no debe
configurarse como HTTP probe público sin credencial. Su workflow está preparado
por separado y se habilita después del despliegue; no se ejecuta dentro de la imagen.
El startup validator existente puede impedir el arranque si Supabase no responde.

En el panel elegir únicamente una configuración Sandbox que muestre coste0,
una réplica y sin escalado ni addons adicionales. No fijar cuotas CPU/RAM gratuitas
inventadas: registrar los límites ofrecidos por esa cuenta. Si permite512MiB,
usarlo solo como candidato a medir, no como capacidad certificada. Observar RSS,
CPU, reinicios/OOM, colas de solicitudes, arranque y tiempos de DB antes de ajustar.
No se fuerza GC/heap, se añade caché o se cambian consultas/pools por Docker.

Contabilizar todos los pools/cadenas por proceso, incluidos Identity, ministerial
y la cadena derivada con timeout del monitor, además de posibles réplicas. El
límite10 de un pool no es un límite global de conexiones a Supabase. Medir p50/p95
HTTP y tiempo DB en la misma región/recorrido antes de prometer2s: Docker no elimina
latencia de red ni garantiza ese objetivo.

La página oficial presenta Sandbox gratuito y publica tarifas separadas de disco
persistente y egress. Eso no demuestra que la cuenta incluya gratis el volumen
necesario: revisar el resumen completo y mantener0USD; no activar Pay-as-you-go,
discos o recursos facturables sin autorización. No confundir Developer Sandbox
con el producto de sandboxes/microVM. Referencia revisada2026-11-24:
[precios](https://northflank.com/pricing).

## Despliegue y aceptación

1. Revisar el diff y resultados locales; resolver las cuatro condiciones iniciales.
   Comprobar respaldo/recuperación de secretos y cualquier cambio remoto antes de
   autorizarlo. Esta guía no ejecuta aprovisionamiento ni SQL.
2. Conectar GitHub con permisos mínimos para el repositorio elegido y crear el
   servicio Docker del contexto indicado. Mantener build sin secretos de producción.
3. Confirmar opción0USD, CPU/RAM, una instancia, almacenamiento, permisos y PFX.
   Configurar variables y secret files solo de runtime en Northflank.
4. Revisar build logs y registrar commit, digest y versión base. No ejecutar
   bootstrap/migrations ni sobrescribir ENTRYPOINT. Northflank construye la imagen.
5. Configurar puerto HTTP8080 y dominio HTTPS. Validar confianza del proxy antes
   de exponer inicio de sesión. Confirmar probes TCP y logs sin secretos.
6. En HTTPS comprobar login/CSRF/sesión, CORS exacto, rechazo de origen extraño,
   permisos por sede, listados, monitor401/200 y ausencia de redirección en bucle.
7. Autorizar Gmail con callback definitivo. Probar correo solo al destinatario
   autorizado y verificar recepción/enlace, no solo respuesta HTTP.
8. Reiniciar y desplegar una nueva revisión: comprobar persistencia de keyring,
   PFX y Gmail, cookies válidas y permisos de archivos. Solo después habilitar
   despliegues automáticos por la rama aprobada y el monitor GitHub independiente.

## Rollback

Conservar imagen/digest/commit anterior y snapshot/versiones seguras de variables,
keyring, PFX y credencial Gmail. Restaurar la imagen anterior desde la revisión
disponible en Northflank conservando almacenamiento/secretos compatibles; no
reconstruir una versión antigua asumiendo que su etiqueta10.0 no cambió. No hay
migraciones automáticas que revertir. Si se rotó un certificado, mantener capacidad
de descifrar las claves anteriores: no sobrescribir ni regenerar archivos al azar.
Volver a verificar salud HTTPS, cookie/CSRF, sedes y correo. Revocar secretos solo
si existe motivo y un procedimiento explícito de rotación.

## Validación local reproducible y límites

Sin Docker no se ejecuta docker build ni se instala el motor. El equivalente .NET:

```powershell
Set-Location backend
dotnet restore MisionLiderParis.slnx --locked-mode
dotnet build MisionLiderParis.slnx --no-restore -c Release
dotnet test MisionLiderParis.slnx --no-build --no-restore -c Release
```

En esta máquina la API local puede mantener archivos bloqueados: la evidencia usa
BaseOutputPath separado en artifacts/northflank-build/bin. El publish local aislado
se registra como evidencia .NET, no como validación del contenedor Linux. El fallo
previo de OpenAPI y las pruebas de PostgreSQL/browser omitidas se detallan en
backend/specs/004-northflank-backend-container/validation.md.

Queda por comprobar remotamente: imagen Linux real y arquitecturas disponibles,
escucha8080, UID/permisos de montajes, bibliotecas ICU/TLS de la base, tamaño,
memoria, límites efectivos, startup y latencias. No se afirma mejora de rendimiento,
build Docker correcto ni aplicación publicada a partir de un publish en Windows.
