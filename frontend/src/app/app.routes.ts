import { Routes } from '@angular/router';
import { sessionGuard } from './core/auth/access-guards';

export const routes: Routes = [
  {
    path: 'gestion',
    canMatch: [sessionGuard],
    loadComponent: () => import('./layout/admin-layout/admin-layout').then((m) => m.AdminLayout),
    loadChildren: () =>
      import('./features/administration/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: '',
    loadComponent: () => import('./layout/public/public-layout').then((m) => m.PublicLayout),
    children: [
      {
        path: 'diseno',
        title: 'Sistema de diseño · Misión Líder París',
        loadComponent: () =>
          import('./features/design-system/design-system-page').then((m) => m.DesignSystemPage),
      },
      {
        path: 'acceso',
        title: 'Acceso · Misión Líder París',
        loadComponent: () => import('./features/access/access-page').then((m) => m.AccessPage),
      },
      {
        path: 'sin-acceso',
        title: 'Sin acceso · Misión Líder París',
        loadComponent: () =>
          import('./features/access/forbidden-page').then((m) => m.ForbiddenPage),
      },
      {
        path: '',
        loadChildren: () => import('./features/public/public.routes').then((m) => m.PUBLIC_ROUTES),
      },
    ],
  },
];
