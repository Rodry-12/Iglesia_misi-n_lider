import { Routes } from '@angular/router';
import { moduleGuard } from '../../core/auth/access-guards';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    canActivateChild: [moduleGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        data: { sessionOnly: true },
        title: 'Gestión · Misión Líder París',
        loadComponent: () => import('./overview-page').then((m) => m.OverviewPage),
      },
      {
        path: 'finanzas',
        data: { permission: 'finanzas:leer' },
        title: 'Finanzas · Misión Líder París',
        loadComponent: () => import('../finance/finance-page').then((m) => m.FinancePage),
      },
      {
        path: 'miembros',
        data: { permission: 'miembros:leer' },
        title: 'Miembros · Misión Líder París',
        loadComponent: () => import('../members/members-page').then((m) => m.MembersPage),
      },
      {
        path: 'formacion',
        data: { permission: 'formacion:leer' },
        title: 'Formación · Misión Líder París',
        loadComponent: () => import('../training/training-page').then((m) => m.TrainingPage),
      },
      {
        path: 'sedes',
        data: { permission: 'sedes:leer' },
        title: 'Sedes · Misión Líder París',
        loadComponent: () => import('../sites/sites-page').then((m) => m.SitesPage),
      },
      {
        path: 'usuarios',
        data: { permission: 'usuarios:administrar' },
        title: 'Usuarios · Misión Líder París',
        loadComponent: () => import('../users/users-page').then((m) => m.UsersPage),
      },
    ],
  },
];
