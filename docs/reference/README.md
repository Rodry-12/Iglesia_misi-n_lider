# Referencia del sitio anterior

`legacy-site.zip` conserva 98 archivos del sitio HTML/Express y sus configuraciones anteriores. Se verificaron todas las entradas contra sus originales mediante SHA-256 antes de retirarlos de la raíz. `legacy-manifest.json` contiene sus rutas, tamaños, hashes y el hash del ZIP.

`assets-migration.json` registra los 33 recursos y licencias trasladados byte a byte a `frontend/public/assets/`, incluido el QR. Las copias sin referencias se retiraron del frontend, pero siguen recuperables en el ZIP. La licencia de Font Awesome se mantiene además en `assets/licenses/` con su atribución.

Esta referencia es documentación histórica, no una segunda aplicación activa. No se publica: Firebase sirve exclusivamente el build Angular. Para editar el sitio actual usar `frontend/src/app/` y sus recursos propios; no modificar ni regenerar el ZIP.

`scripts/preview-original.mjs` verifica el hash del ZIP y lo extrae a una carpeta bajo `frontend/artifacts/`, ignorada por Git. Sirve únicamente ese directorio en loopback para `npm run review:public`; no expone la raíz ni `.git`. El comparador desactiva el envío anterior de correo y bloquea red externa.

La referencia contiene datos públicos encontrados en el proyecto. No acredita vigencia institucional, disponibilidad de EmailJS ni destinatario bancario. La restauración de producción, si alguna vez se solicitara, requiere una decisión propia; no usar automáticamente las configuraciones históricas para publicar.
