import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { DOCUMENT, ViewportScroller } from '@angular/common';
import { provideHttpClient, withInterceptors, withNoXsrfProtection } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { providePrimeNG } from 'primeng/config';
import { MisionLiderPreset } from './core/theme/primeng-preset';
import { AuthStore } from './core/auth/auth.store';
import { AUTH_PRINCIPAL } from './core/auth/access-context';
import { authInterceptor } from './core/auth/auth.interceptor';
import { httpActivityInterceptor } from './core/loading/http-activity.interceptor';
import { MessageService } from 'primeng/api';
import { Notifications } from './core/notifications/notifications';
import { apiBaseUrlInterceptor } from './core/config/api-base-url.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: MessageService, useExisting: Notifications },
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(
      withInterceptors([httpActivityInterceptor, authInterceptor, apiBaseUrlInterceptor]),
      withNoXsrfProtection(),
    ),
    { provide: AUTH_PRINCIPAL, useFactory: () => inject(AuthStore).principal },
    provideAppInitializer(() => {
      void inject(AuthStore).ensureSession();
    }),
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
        chooseDate: 'Elegir fecha',
        chooseMonth: 'Elegir mes',
        chooseYear: 'Elegir año',
        prevMonth: 'Mes anterior',
        nextMonth: 'Mes siguiente',
        prevYear: 'Año anterior',
        nextYear: 'Año siguiente',
        prevDecade: 'Década anterior',
        nextDecade: 'Década siguiente',
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
