# 002 — Formulario de contacto fiable

Estado: Borrador; no implementado en la base.

## Problema

El formulario original confirma el envío antes de resolver EmailJS, elimina datos ante fallos y conserva indicadores de validación después de reiniciarse. Las personas necesitan saber si su petición realmente fue aceptada por el servicio de correo.

## Alcance y exclusiones

Formulario Angular reactivo de nombre, correo, asunto y contenido; validación y estados de envío; adaptador de entrega sustituible en pruebas. No incluye almacenamiento de peticiones, cuentas de usuarios, campañas o panel administrativo.

## Requisitos

- FR-001: Nombre de 1 a 40 caracteres, correo con formato válido, asunto de 7 a 40 y mensaje de 1 a 300. Rechazar texto vacío tras recortar espacios; aceptar puntuación y números en asunto y mensaje.
- FR-002: Validar los valores actuales al enviar, incluyendo datos pegados o completados automáticamente. Asociar errores a los campos y mover el foco al primer error cuando corresponda.
- FR-003: Durante el envío, bloquear duplicados e informar el progreso. Solo mostrar éxito después de la confirmación del adaptador.
- FR-004: Ante rechazo o error del servicio, mostrar un error accesible, conservar datos y permitir reintentar.
- FR-005: Tras éxito, limpiar formulario y estado de validación; un nuevo formulario vacío no debe enviarse.
- FR-006: Aislar EmailJS detrás de un adaptador inyectable y usar un adaptador falso en tests. No registrar el contenido de peticiones en consola.

## Aceptación

- AC-001: Un formulario inválido o con texto compuesto solo por espacios no llama al adaptador y muestra errores asociados.
- AC-002: Con datos válidos y una promesa pendiente, se informa envío en curso y un segundo envío no produce una segunda llamada.
- AC-003: Si el adaptador rechaza el envío, se conservan todos los campos, aparece un error accesible y se puede reintentar.
- AC-004: Si el adaptador confirma, se muestra éxito y se limpia el formulario; intentar enviar inmediatamente el formulario vacío no llama al adaptador otra vez.
- AC-005: Datos válidos insertados sin eventos de teclado se validan al enviar; el asunto acepta números y puntuación.
- AC-006: Las pruebas cubren estados pendiente, fallo, reintento y éxito sin llamadas a EmailJS real.

## Dudas antes de integrar producción

Confirmar destinatario, vigencia de servicio/plantilla EmailJS, límites y restricciones de origen configurados, política de tratamiento aplicable y texto institucional de confirmación. Estas dudas no impiden implementar y probar el comportamiento con un adaptador falso.
