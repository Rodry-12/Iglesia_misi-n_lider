import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { DOCUMENT, ViewportScroller } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { providePrimeNG } from 'primeng/config';
import { MisionLiderPreset } from './core/theme/primeng-preset';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideAppInitializer(() => {
      const document = inject(DOCUMENT);
      inject(ViewportScroller).setOffset(() => {
        const offset = Number.parseFloat(
          document.defaultView
            ?.getComputedStyle(document.documentElement)
            .getPropertyValue('--ml-header-offset') ?? '',
        );
        return [
          0,
          Number.isFinite(offset)
            ? offset
            : (document.querySelector('.nav-main')?.getBoundingClientRect().height ?? 0),
        ];
      });
    }),
    providePrimeNG({
      theme: {
        preset: MisionLiderPreset,
        options: {
          // PrimeUI normaliza el selector de atributo sobre :root y :host.
          darkModeSelector: "[data-theme='dark']",
          cssLayer: { name: 'primeng', order: 'theme, base, primeng, components, utilities' },
        },
      },
      translation: {
        startsWith: 'Comienza con',
        contains: 'Contiene',
        notContains: 'No contiene',
        endsWith: 'Termina con',
        equals: 'Igual a',
        notEquals: 'Distinto de',
        noFilter: 'Sin filtro',
        apply: 'Aplicar',
        clear: 'Limpiar',
        accept: 'Aceptar',
        reject: 'Cancelar',
        emptyMessage: 'No hay resultados',
        emptyFilterMessage: 'No hay coincidencias',
        firstDayOfWeek: 1,
        dayNames: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
        dayNamesShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
        dayNamesMin: ['do', 'lu', 'ma', 'mi', 'ju', 'vi', 'sá'],
        monthNames: [
          'enero',
          'febrero',
          'marzo',
          'abril',
          'mayo',
          'junio',
          'julio',
          'agosto',
          'septiembre',
          'octubre',
          'noviembre',
          'diciembre',
        ],
        monthNamesShort: [
          'ene',
          'feb',
          'mar',
          'abr',
          'may',
          'jun',
          'jul',
          'ago',
          'sep',
          'oct',
          'nov',
          'dic',
        ],
        today: 'Hoy',
        dateFormat: 'dd/mm/yy',
        aria: {
          previous: 'Anterior',
          next: 'Siguiente',
          firstPageLabel: 'Primera página',
          lastPageLabel: 'Última página',
          nextPageLabel: 'Página siguiente',
          prevPageLabel: 'Página anterior',
          pageLabel: 'Página {page}',
          slide: 'Diapositiva',
          slideNumber: '{slideNumber}',
        },
      },
    }),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
  ],
};
