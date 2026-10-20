# Plan — 006 primeng-design-system

## Diseño

Configurar `providePrimeNG`, español y `MisionLiderPreset` en `app.config.ts`. El preset importa Aura base y temas de los componentes usados para conservar el presupuesto; colores mediante variables de `styles/tokens.css`, también consumidas por Tailwind. Migrar controles Material a Button, InputText, Textarea y Table; retirar Material y su SCSS, mantener CDK como peer de PrimeNG.

El wrapper WelcomeSlider integra Galleria usando value/activeIndex/activeIndexChange, sin DOM interno. Mantiene efecto de rotación para coordinar pausa y limpieza, controles accesibles y movimiento reducido. Usar PassThrough público para nombrar botones de navegación. Preservar recursos institucionales. El header incorpora fondo oscuro para que sus enlaces blancos sigan legibles sobre los banners.

SDD: ADR 0003 sustituye ADR 0002; contrato `docs/design-system.md`, instrucciones AGENTS, skills y plantillas evitan repetir decisiones por módulo. `design:check` controla colores e imports en código de producto, sin inspeccionar pruebas diferidas.

## Verificación

Ejecutar build y checks de dependencias/diseño/skills/specs/formato. Revisar Chrome escritorio/móvil, navegación manual de Galleria, guía y tema sin mensajes reales. Registrar dimensiones, recursos y errores. No crear, modificar o ejecutar pruebas unitarias; conservar pendientes sus ajustes específicos de Material.

## Riesgos y decisiones

PrimeNG 21 comunitario contiene sección MIT; fijar versiones sin `latest` ni LTS comerciales. Aura completo excedió el presupuesto y se limita a componentes usados; nuevas incorporaciones registran su tema y dependencias. Preservar diseño público con alias de tokens y fuentes locales. No atribuir pruebas históricas Material a PrimeNG.
