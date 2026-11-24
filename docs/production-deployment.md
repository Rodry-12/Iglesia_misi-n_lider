# Configuración de producción por bloques

Preparación del2026-11-23, spec020. El usuario administra alojamiento, dominio y DNS;
el alcance aquí es configuración, variables, cadenas y Gmail. El correo confirmado
es iglesiamisionliderparis@gmail.com. No se han publicado recursos ni cambiado DNS,
Supabase, credenciales o consentimientos remotos.

La plantilla está en [deploy/.env.example](../deploy/.env.example). Los valores
REEMPLAZAR son marcadores deliberadamente inválidos. No pegar contraseñas aquí ni
versionar una copia completada. En .NET, doble guion bajo representa dos puntos:
Database__ConnectionString equivale a Database:ConnectionString. El servidor debe
inyectar estas variables: .NET no carga .env automáticamente.

## 1. Backend: entorno, hosts y HTTPS

Configurar ASPNETCORE_ENVIRONMENT=Production y DOTNET_ENVIRONMENT=Production.
AllowedHosts recibe nombres concretos, sin https:// ni rutas; varios hosts se
separan con punto y coma. Security__AllowedOrigins__0 recibe el origen HTTPS del
navegador, con puerto si corresponde, sin barra final ni ruta. Agregar índices1,2
solo si hay más orígenes realmente autorizados. No colocar comodines.

El servidor proporciona puerto, certificado HTTPS y terminación de TLS. La API
puede recibir HTTPS directamente con ASPNETCORE_URLS y
Kestrel__Certificates__Default__Path/Password, o HTTP interno mediante
ASPNETCORE_HTTP_PORTS detrás del proxy confiable. Son alternativas: no activar las
dos recetas sin conocer el encaminamiento. El certificado TLS es distinto al de
protección de Data Protection. Restringir el puerto HTTP interno al proxy.

La API
usa IsHttps/UseHttpsRedirection. Se añadió ReverseProxy__Enabled, apagado por defecto.
Si el proxy termina TLS y conecta a Kestrel por HTTP, activar esa opción y configurar
ReverseProxy__KnownProxies__0 con su IP real (índices1,2 para otros proxies aprobados).
ForwardLimit=1 inicialmente, rango1–3. Exige X-Forwarded-For/Proto simétricos y solo
acepta los de esas IP; sin IP válida el arranque falla. No usar0.0.0.0,:: ni nombres
de dominio; no confiar en cualquier X-Forwarded-Proto/For del cliente.
No activar ASPNETCORE_FORWARDEDHEADERS_ENABLED como sustituto de esa lista explícita.
Esto afecta redirecciones, Gmail y límites por IP. No se altera el arranque local.
[Guía Microsoft](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/proxy-load-balancer?view=aspnetcore-10.0).

## 2. Base de datos: dos cadenas privadas

Conservar Supabase sneceodpvscrvjrlqwgw y sus tablas. El destino operativo comprobado
es el Session pooler aws-1-us-east-2.pooler.supabase.com:5432, base postgres.
No sustituir por el puerto de Transaction pooler ni recrear el proyecto para desplegar.

| Variable | Contenido |
| --- | --- |
| Database__ConnectionString | Cadena del login ministerial runtime, sin DDL/superuser/BYPASSRLS |
| Database__IdentityConnectionString | Cadena de otro login, exclusivo del runtime Identity |
| Database__RequireVerifiedTls | true |
| Database__IdentityPoolingEnabled | true |
| Database__IdentityPoolMaximumSize | 10, punto medido; revisar presupuesto total por pool/cadena/proceso |

La plantilla muestra la sintaxis. En conexiones al pooler el usuario incluye el
sufijo del proyecto; no duplicarlo si ya forma parte de la cadena privada existente.
Reutilizar las cadenas vigentes verificadas del almacenamiento privado; no usar
postgres, anon/service_role keys ni la contraseña de acceso a la web. Contraseña,
CA y host TLS no se adivinan ni se sustituyen manualmente por valores de ejemplo.
Si se requiere Root Certificate, montar la CA pública y ajustar su ruta al servidor.
No desactivar VerifyFull ni activar NoResetOnClose/multiplexing.

Introducir las cadenas como valores literales en el gestor del servidor; la sintaxis
de escape de contraseñas con comillas, punto y coma o dólar depende del cargador.
No construir comandos concatenando contraseñas. Las comillas externas del .env
son del formato de archivo y no forman parte de la cadena al introducirla en una UI.

No inyectar Database__MigrationConnectionString, InspectorConnectionString ni
MLP_BOOTSTRAP_EMAIL/PASSWORD. El arranque normal no migra ni crea administradores.

## 3. Firma de RLS y claves persistentes

DatabaseActor__KeyId y DatabaseActor__SigningKeyBase64 son los valores vigentes del
contexto firmado. No generar otro HMAC al desplegar: debe coincidir con el registro
de Supabase. La clave es de32–64bytes en Base64 y el identificador de1–64caracteres
alfanuméricos, guion o guion bajo. No imprimirla ni enviarla a Angular.

Security__KeyRingPath apunta a un directorio persistente privado. KeyCertificatePath
apunta al PFX de protección de datos y KeyCertificatePassword se inyecta aparte.
No es el certificado HTTPS de localhost. Conservar claves anteriores y certificado
para descifrar tokens de cuenta/Gmail tras reinicios y despliegues. No ubicar secretos
en wwwroot, frontend/dist, imagen pública ni repositorio.

Las rutas Linux de la plantilla son ejemplos para un proceso cuyo HOME sea/home/app;
adaptarlas al usuario real, montar almacenamiento duradero y darle permisos mínimos.
En Windows usar rutas absolutas accesibles a la identidad del servicio. No trasladar
los helpers DPAPI Windows como mecanismo de carga de secretos de un servidor Linux.

## 4. Gmail institucional

Email__Provider=GmailApi activa el proveedor ya implementado. No hacen falta SMTP,
Resend__ApiKey ni contraseña de Gmail para este flujo. El remitente Gmail está fijado
en el código a iglesiamisionliderparis@gmail.com; Email__From se mantiene coherente
en la plantilla y ReplyTo usa ese buzón.

Completar GoogleGmail__ClientId y ClientSecret con el cliente OAuth web existente.
Registrar en Google el mismo RedirectUri definitivo que se inyecta a la API:
https://ORIGEN_PUBLICO_API/api/v1/integrations/google/callback. Coincidencia exacta,
HTTPS, sin query/fragmento. No usar la URL localhost en producción.

GoogleGmail__TokenStorePath es persistente, privado y está bajo el perfil/HOME del
proceso, fuera del content root/repositorio; el código comprueba esos límites.
La carpeta de Gmail y el key ring/PFX deben sobrevivir juntos a reinicios.
Puede autorizarse de nuevo en producción desde la consola protegida, sin copiar
tokens a mano: abrir /api/v1/integrations/google como SuperAdministrador y usar su
botón, que envía POST con CSRF; Google retorna al callback y guarda el refresh token
cifrado. No generar ni compartir ese token en el chat o variables públicas.

Revisar el estado de publicación/consentimiento del cliente OAuth y la verificación
que corresponda al uso real. Los refresh tokens externos de Testing con scopes
como gmail.send pueden caducar a los7días; no tratarlos como credenciales permanentes.
[Reglas Google](https://developers.google.com/identity/protocols/oauth2#expiration).
Una instancia API inicialmente: estado OAuth y renovación se coordinan en memoria;
el código no implementa coordinación entre réplicas.

## 5. Enlaces de cuenta

Todos apuntan a Angular, no a rutas API ni al equipo del desarrollador:

| Variable | URL |
| --- | --- |
| Email__InvitationUrl | https://DOMINIO_APP/activar-cuenta |
| Email__RecoveryUrl | https://DOMINIO_APP/restablecer-contrasena |
| Email__ConfirmationUrl | https://DOMINIO_APP/confirmar-correo |

Sin barra extra al final de la ruta, query ni fragmento. AccountEmailComposer añade
el fragmento con email/token y Angular lo consume. No configurar RecoveryUrl como
/recuperar-acceso: esa ruta solicita el correo, no recibe el token de restablecimiento.
InvitationMinutes=1440 y ResetTokenMinutes=30 conservan los valores actuales.

## 6. Frontend y formulario público

Angular no necesita conexiones PostgreSQL, HMAC, PFX, ClientSecret ni RefreshToken.
La URL pública se configura mediante la variable de entorno **MLP_API_BASE_URL**
del proceso que ejecuta `npm run build`. No se edita TypeScript.

En PowerShell, desde la raíz del repositorio:

```powershell
$env:MLP_API_BASE_URL = 'https://api.tudominio.com/api/v1'
npm run build
```

También se puede copiar `frontend/.env.example` a `frontend/.env` y configurar:

```dotenv
MLP_API_BASE_URL=https://api.tudominio.com/api/v1
```

El entorno del proceso tiene prioridad sobre frontend/.env; no se lee el .env de
la raíz ni deploy/.env (backend). Si no existe variable, se usa `/api/v1`.
En CI/hosting, definir MLP_API_BASE_URL en las variables del paso de build y usar
`npm run build`. El wrapper valida la URL antes de invocar Angular e incorpora
únicamente esta variable mediante --define; no genera archivos fuente. Invocar
`ng build` directamente omite el wrapper y usa el valor por defecto.

`api.tudominio.com` es un ejemplo: reemplazar por el origen HTTPS real del backend.
Incluir `/api/v1`, sin credenciales, query ni fragmento. Publicar
`frontend/dist/iglesia-web/browser`. La configuración se incorpora al compilar:
cambiar variables del servidor o frontend/.env después del build requiere volver
a compilar y publicar. Es configuración pública, visible en el navegador; no poner
secretos. `.env` está ignorado por Git.

El valor versionado `/api/v1` conserva el mismo origen y evita apuntar a un dominio
inventado: en ese caso el servidor debe enrutar `/api` al backend antes del fallback
a index.html. Para otro origen HTTPS, el interceptor final aplica apiBaseUrl a
listados, login, sesión y CSRF; conserva cookies y token solo para las llamadas de
API y no modifica EmailJS. El backend debe autorizar el origen exacto del frontend
en `Security__AllowedOrigins__0` (CORS con credenciales).

Las cookies siguen Secure/Strict: frontend y API en orígenes distintos deben
pertenecer al mismo sitio, por ejemplo `app.example.org` y `api.example.org`, ambos
HTTPS. Dos dominios de sitios distintos no quedan resueltos solo por URL/CORS;
requieren revisar el diseño de sesión. No se debilita SameSite para este cambio.

Desarrollo usa `frontend/src/environments/environment.ts` con `/api/v1` y conserva
el proxy local. angular.json reemplaza ese archivo solo en producción. El proxy de
ng serve no existe en un build publicado.

firebase.json solo tiene fallback SPA. No reenviar esta sesión sin más a Cloud Run
mediante Firebase Hosting: ese proxy solo transmite __session y filtraría las cookies
actuales __Host de sesión, antiforgery y correlación Gmail.
[Restricción Firebase](https://firebase.google.com/docs/hosting/manage-cache#using_cookies).
Esto es una condición técnica de configuración para quien administre el hosting.

El contacto público usa EmailJS, independiente de las invitaciones Gmail del backend.
Sus IDs públicos están en frontend/src/app/features/public/contact/data-access/contact-gateway.ts.
Revisar servicio, plantilla, destinatario y dominios permitidos en EmailJS. La clave
pública no es un secreto de servidor; configurar GmailApi no configura este formulario.
No se hicieron envíos reales durante esta preparación.

## 7. Logs y comprobación final

La plantilla deja diagnóstico detallado apagado y logs sin SQL/headers/cuerpos.
En proxy/APM no registrar query strings de callback, tokens, cookies ni respuestas
personales. No dejar Performance__AllowProduction activo permanentemente.

Antes de activar el servidor: comprobar rutas/montajes y variables privadas sin
imprimir valores; HTTPS/health, login/CSRF y cookie, reiniciar y verificar sesión/token;
aceptar acceso personalizado y dos sedes. Comprobar aparte invitación, recuperación,
confirmación y contacto con un envío controlado autorizado al destinatario elegido.
Un200 o deliveryStatus no demuestra por sí mismo recepción en el buzón.

Hay tres fallos ministeriales amplios y un fallo OpenAPI/certificado pendientes de
revisar según backend/specs/001-ministry-backend/validation.md. No certificar la suite
completa ni la producción por haber compilado. No tocar Supabase, DNS, recursos ni
enviar correos por efecto de copiar esta plantilla.

## Artefactos preparados

API: backend/artifacts/release/api, generado con dotnet publish del proyecto API
en Release --no-restore. Angular: frontend/dist/iglesia-web/browser, con npm run build.
Son artefactos locales y no se han publicado. El directorio API contiene assemblies
y configuración pública; secretos, PFX, key ring y token Gmail se provisionan aparte.
