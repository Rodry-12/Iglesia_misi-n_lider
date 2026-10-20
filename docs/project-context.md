# Contexto del proyecto

Inventario basado en la revisión local del 19 de octubre de 2026. El contenido del código es una fuente de migración, no una confirmación de vigencia institucional.

Estado vigente tras spec 007 y ADR 0004: el inventario original de las siguientes secciones está dentro de `docs/reference/legacy-site.zip`, no en la raíz activa. Angular posee sus recursos en `frontend/public/assets/`; backend está reservado sin implementación. Consultar README y docs/development.md para los comandos actuales.

## Producto y fuentes

La Iglesia Misión Líder París presenta su comunidad, doctrina, ministerios, reuniones y canales de contacto. El sitio permite consultar instrucciones para donar por transferencia bancaria.

| Fuente original                             | Información                                                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `index.html`                                | Comunidad, misión, visión, creencias, seis valores, pastores, cinco ministerios, horarios, evento y formulario |
| `donar/index.html`                          | Diezmos y ofrendas, QR de Bancolombia y envío manual de comprobantes                                           |
| `src/css/`                                  | Paleta verde, blanco, gris y negro; estilos móviles y adaptación a 930 px                                      |
| `src/images/`, `src/backgrounds/`, `fonts/` | Fotografías, logotipos, banners, QR y fuentes                                                                  |
| `src/js/index.js`                           | Menú y carruseles Glider, con avance automático de bienvenida                                                  |
| `src/js/form.js`                            | Validaciones y envío mediante EmailJS                                                                          |
| `firebase.json`, `.firebaserc`              | Hosting estático; proyecto configurado `iglesia-mision`                                                        |
| `app.js`                                    | Intento Express/Handlebars sin dependencias, vistas ni carpeta pública completas                               |

El sitio nombra a Nain Salas y Nelly Taborda. Registra reuniones los miércoles a las 19:00, jóvenes los sábados a las 19:00 y servicio dominical a las 09:00. Contacto: `+57 3204139770`, `iglesiamisionliderparis@gmail.com`. Dominio de referencia: `https://iglesiamisionliderparis.org/`.

Estas referencias son contenido público del repositorio. No cambiar el QR, cuentas, contactos, doctrina o nombres inventando información. No se ha validado el destinatario del QR.

## Integraciones y límites

- EmailJS envía mensajes desde el navegador. El servicio, plantilla y clave pública aparecen en los archivos originales; su disponibilidad y restricciones externas no se verificaron.
- Donar consiste en escanear el QR desde la app bancaria y enviar el comprobante por correo. No hay API de pagos ni conciliación automática.
- WhatsApp, mapas, redes sociales y correo son enlaces externos.
- No hay backend operativo, base de datos, autenticación, CMS, administración de eventos ni gestión de miembros.

## Hallazgos que orientan la migración

1. El formulario muestra éxito y borra el mensaje antes de resolver EmailJS. En fallo no informa al usuario.
2. El reinicio visual no reinicia el estado de validación. Una nueva entrega puede utilizar indicadores anteriores.
3. Los recursos de portada apuntan al dominio público y dificultan comprobar cambios locales.
4. El menú usa un icono clicable y varias tarjetas dependen de hover.
5. Hay un cierre de contenedor faltante en el primer carrusel y una fuente enlazada como CSS en donaciones.
6. Firebase publica la raíz del repositorio. La preparación Angular usa otra configuración, limitada al resultado compilado.
7. Hay un evento del 24 de junio sin año, copyright 2022 y recursos visuales sin referencia directa. No deducir de ello la fecha del último mantenimiento.

## Alcance inicial

Prioridad posterior confirmada por el usuario: la página pública sigue siendo el sitio institucional; el header añade «Iniciar sesión», pero el acceso y los módulos nuevos se posponen. La spec 004 organiza lo ya migrado con layout persistente, componentes públicos y límites de estilos. Ver `docs/public-site-architecture.md`.

Actualización del 19 de octubre de 2026: el usuario autorizó orientar la aplicación Angular a administración de varias sedes con Finanzas, Miembros, Formación, Sedes y Usuarios. Se añadió la spec 003 y se eligió Material como alternativa autorizada a PrimeNG por continuidad de licencia. La estructura y los contratos existen; aún no hay backend, autenticación real ni CRUD. Ver `docs/administration.md`.

Decisión posterior vigente: el usuario confirma PrimeNG y el stack complementario. ADR 0003 y spec 006 sustituyen Material por PrimeNG 21.1.10 con temas 2.0.3, centralizan identidad en tokens y establecen `docs/design-system.md` como contrato compartido. Las pruebas unitarias se retomarán después; no desarrollarlas ni ejecutarlas en el incremento actual.

Preparar una base ejecutable, documentación y flujo SDD, preservando la referencia original. Migrar después por funcionalidades. SEO renderizado, actualización de contenido, EmailJS real y validación bancaria permanecen como decisiones o verificaciones pendientes.
