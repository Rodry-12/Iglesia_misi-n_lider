# 002 — Gmail API para Identity

Estado: implementación comprobada con simuladores; autorización y envío real pendientes.

## Alcance

Añadir Gmail como proveedor opcional de `IAccountEmailSender`, conservando Resend, SMTP y las plantillas y operaciones HU-012. No cambiar Angular, tablas, conexiones ni Supabase. No realizar envíos reales.

## Requisitos y aceptación

- FR-001 / AC-001: `Email:Provider=GmailApi` selecciona el adaptador nuevo para invitación, confirmación y recuperación, con From fijo `iglesiamisionliderparis@gmail.com` y sin fallback.
- FR-002 / AC-002: inicio HTTPS con POST y CSRF solo para administrador global; Authorization Code, PKCE S256, scope exclusivo gmail.send, offline, state aleatorio de un uso, vinculado al navegador, caducidad cinco minutos.
- FR-003 / AC-003: callback exacto `https://localhost:7243/api/v1/integrations/google/callback`; comprobar iniciador, correlación y permisos antes del intercambio y nuevamente antes de guardar, sin exponer tokens.
- FR-004 / AC-004: refresh token cifrado fuera del repositorio, ACL privada, access token en memoria, renovación serializada y revocación sin recuperar tokens obsoletos.
- FR-005 / AC-005: pruebas focalizadas sin Google real y regresiones Identity/HU-012; distinguir claramente evidencia simulada de aceptación externa.

## Límites

`gmail.send` no permite consultar perfiles: login_hint no prueba identidad. Se fuerza el buzón institucional en users.messages.send y el From, sin scopes extra. Estado pendiente y renovación coordinados por una instancia; un despliegue con réplicas requiere trabajo adicional previo.
