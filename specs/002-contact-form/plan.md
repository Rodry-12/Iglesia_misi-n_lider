# Plan 002

Propuesta: agregar formulario reactivo tipado a `features/public/contact/`, un contrato `ContactGateway` con token de inyección y un adaptador EmailJS configurado explícitamente cuando se conozcan los datos vigentes.

El componente mantiene `idle | sending | success | error`. El método de envío valida siempre valores actuales y descarta llamadas mientras `sending`. Un fallo conserva datos; éxito reinicia controles y estado. Usar `aria-describedby`, `aria-invalid` y una región de estado accesible.

Las pruebas usan un adaptador con promesa controlada para resolver, rechazar y contar llamadas. Cubrir validación sin keyup, duplicados, reintento y segundo envío vacío. Actualizar trazabilidad y evidencia cuando se implemente. No hacer envíos reales para demostrar las pruebas.
