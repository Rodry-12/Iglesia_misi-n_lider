# Ruta de trabajo

## Sitio público

Las specs 004 y 005 organizaron el layout y recuperaron el contenido de referencia. La spec 006 adoptó PrimeNG, tokens compartidos e instrucciones SDD. La spec 007 restaura el header con scroll, adapta el 404, corrige la revisión y retira la aplicación anterior de la estructura activa.

La referencia HTML ya no es una aplicación paralela: está comprimida y verificada en `docs/reference/`. Angular posee sus recursos en `frontend/public/assets/`. Consultar ADR 0004 y la evidencia de 007.

## Antes del lanzamiento

Confirmar institucionalmente horarios, eventos con año, contactos y QR; verificar configuración y entrega real del correo; revisar SEO, metadatos, peso de recursos, accesibilidad y rutas directas en un hosting de ensayo. Build y revisión local no sustituyen estas verificaciones. No publicar sin solicitud explícita.

Las pruebas unitarias se retomarán cuando el usuario lo indique; conservar su backlog y adaptar los casos históricos afectados por las migraciones.

## Administración futura

La spec 003 conserva preparación de rutas y autorización para Finanzas, Miembros, Formación, Sedes y Usuarios. No hay autenticación, API ni CRUD operativo. `backend/` permanece vacío salvo el marcador Git; no se ha elegido framework o base de datos.

El próximo incremento administrativo debe especificar identidad, contratos, capacidades y ámbito de sede, validación en servidor y auditoría antes de implementar operaciones. La página pública y la entrada Iniciar sesión no autorizan por sí solas una sesión ficticia, pagos automáticos ni persistencia.
