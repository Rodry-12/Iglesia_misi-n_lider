# 006 — primeng-design-system

Estado: Verificada en el alcance autorizado. La revisión ampliada se corrigió y volvió a comprobar en spec 007; evidencia histórica y cierre en validation.md. Pruebas unitarias diferidas por el usuario.

## Problema y resultado esperado

Eliminar la contradicción entre la preferencia explícita de PrimeNG y las instrucciones que elegían Material. Establecer decisiones de UI compartidas y ejecutables para que los módulos futuros usen el mismo stack, identidad y criterios de interacción. Aplicar PrimeNG al carrusel y controles existentes sin perder el sitio institucional.

## Alcance y exclusiones

Fijar PrimeNG 21 comunitario y tema MIT compatibles con Angular 21, sustituir los controles Material existentes, centralizar tokens, registrar tema/español, usar Galleria en portada y actualizar ADR, contrato de diseño, instrucciones, skills y plantillas SDD. No desarrollar autenticación/CRUD, cambiar contenido institucional ni crear, modificar o ejecutar pruebas unitarias. No enviar correos reales ni desplegar.

## Contrato transversal de UI

Aplicar `docs/design-system.md` y ADR 0003. `tokens.css` define los valores; `primeng-preset.ts` adapta Aura a ellos y Tailwind los consume por `@theme inline`. Las specs de funcionalidades referencian este contrato y explican cualquier excepción.

## Requisitos

- FR-001: Adoptar Angular 21 + PrimeNG 21.1.10 + temas 2.0.3, Tailwind 4, SCSS, tokens, Lucide, Signals y Reactive Forms. Retirar Material y conservar CDK requerido por PrimeNG; registrar licencias y versiones.
- FR-002: Centralizar colores, tipografías y escalas reutilizables en tokens.css; conectar PrimeNG/Tailwind y mantener alias editoriales de compatibilidad sin otra paleta.
- FR-003: Usar Galleria para bienvenida, conservando tres imágenes, selección manual, teclado, pausa por interacción y movimiento reducido. Slider se reserva para números; Carousel se evalúa para tarjetas.
- FR-004: Migrar botones, formulario/tabla del catálogo y controles del contacto a PrimeNG; conservar comportamiento de datos y rutas. Tema oscuro explícito y controles básicos en español.
- FR-005: Actualizar instrucciones y skills, publicar contrato de diseño y plantillas SDD que lo hereden; añadir un control estático del contrato.
- FR-006: Verificar build, dependencias, trazabilidad, skills, formato y revisión visual, sin pruebas unitarias. Documentar límites de evidencia y carga inicial.

## Aceptación

- AC-001: Manifest/lockfile fijan PrimeNG y temas revisados; no hay dependencia o importación runtime de Material. El control de dependencias verifica la sección comunitaria MIT y el build genera avisos.
- AC-002: Los colores de aplicación están en tokens.css, referencias válidas y preset/Tailwind compartidos; design:check pasa. El catálogo muestra los tokens y cambio de tema.
- AC-003: La portada muestra Galleria con las imágenes originales; se puede avanzar, retroceder y seleccionar, pausa por interacción/movimiento reducido; sin desbordamiento en móvil y escritorio.
- AC-004: Botones, formulario y tabla PrimeNG renderizan, conservan navegación y no introducen envío real en la revisión. La guía puede alternar tema; el contacto conserva su contrato de estados.
- AC-005: ADR vigente, contrato, AGENTS, skills y plantillas SDD apuntan a PrimeNG/tokens y difieren pruebas unitarias. Checks y build correctos y evidencia visual registrada con sus límites.

## Escenarios y dudas

Comparar inicio, donaciones, acceso y catálogo en Chrome. La migración no acredita accesibilidad completa del HTML heredado ni vigencia de sus datos. El estado pendiente/fallido del correo mantiene su implementación, pero las pruebas unitarias específicas se retomarán después. La adopción de PrimeNG 21 MIT no autoriza una actualización automática a líneas comerciales ni promete soporte indefinido.
