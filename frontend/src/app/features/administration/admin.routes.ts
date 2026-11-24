import { Routes } from '@angular/router';
import { moduleGuard } from '../../core/auth/access-guards';
import { MembersStore } from '../members/members.store';
import { registrationDraftGuard } from '../members/registration-draft.guard';
import { CatalogStore } from '../training/catalog.store';
import { AssignmentStore } from '../training/assignment.store';
import { UsersStore } from '../users/users.store';

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
        // No financial permission exists in this API increment; fail closed.
        data: {},
        title: 'Finanzas · Misión Líder París',
        loadComponent: () => import('../finance/finance-page').then((m) => m.FinancePage),
      },
      {
        path: 'miembros',
        data: { permissionsAnyOf: ['PERSON_VIEW', 'PERSON_CREATE'] },
        providers: [MembersStore],
        title: 'Miembros · Misión Líder París',
        children: [
          {
            path: 'registrar',
            data: { permission: 'PERSON_CREATE', personRegistration: true },
            canDeactivate: [registrationDraftGuard],
            loadComponent: () => import('../members/members-page').then((m) => m.MembersPage),
          },
          {
            path: '',
            pathMatch: 'full',
            data: { permission: 'PERSON_VIEW' },
            canDeactivate: [registrationDraftGuard],
            loadComponent: () => import('../members/members-page').then((m) => m.MembersPage),
          },
          {
            path: ':id/editar',
            data: { permission: 'PERSON_UPDATE', personEdit: true },
            canDeactivate: [registrationDraftGuard],
            loadComponent: () => import('../members/members-page').then((m) => m.MembersPage),
          },
          {
            path: ':id',
            data: { permission: 'PERSON_VIEW' },
            loadComponent: () => import('../members/members-page').then((m) => m.MembersPage),
          },
        ],
      },
      {
        path: 'formacion',
        data: { permissionsAnyOf: ['CATEGORY_VIEW', 'PROCESS_VIEW', 'PROCESS_ASSIGN'] },
        providers: [CatalogStore, AssignmentStore],
        title: 'Formación · Misión Líder París',
        children: [
          {
            path: '',
            pathMatch: 'full',
            data: { permissionsAnyOf: ['CATEGORY_VIEW', 'PROCESS_VIEW', 'PROCESS_ASSIGN'] },
            loadComponent: () => import('../training/training-home').then((m) => m.TrainingHome),
          },
          {
            path: 'asignar',
            data: { permission: 'PROCESS_ASSIGN' },
            canDeactivate: [registrationDraftGuard],
            loadComponent: () =>
              import('../training/assignment-page').then((m) => m.AssignmentPage),
          },
          {
            path: 'asignaciones',
            data: { permission: 'PROCESS_VIEW' },
            loadComponent: () =>
              import('../training/assignment-list-page').then((m) => m.AssignmentListPage),
          },
          {
            path: 'asignaciones/:id',
            data: { permission: 'PROCESS_VIEW' },
            canDeactivate: [registrationDraftGuard],
            loadComponent: () =>
              import('../training/assignment-page').then((m) => m.AssignmentPage),
          },
          ...(['category', 'process'] as const).flatMap((kind) => {
            const segment = kind === 'category' ? 'categorias' : 'procesos';
            const prefix = kind === 'category' ? 'CATEGORY' : 'PROCESS';
            return [
              {
                path: segment,
                pathMatch: 'full' as const,
                data: { kind, permission: `${prefix}_VIEW` },
                loadComponent: () =>
                  import('../training/training-page').then((m) => m.TrainingPage),
              },
              {
                path: `${segment}/crear`,
                data: {
                  kind,
                  catalogMode: 'create',
                  permission: `${prefix}_CREATE`,
                  globalPermission: true,
                },
                canDeactivate: [registrationDraftGuard],
                loadComponent: () =>
                  import('../training/training-page').then((m) => m.TrainingPage),
              },
              {
                path: `${segment}/:id/editar`,
                data: {
                  kind,
                  catalogMode: 'edit',
                  permission: `${prefix}_UPDATE`,
                  globalPermission: true,
                },
                canDeactivate: [registrationDraftGuard],
                loadComponent: () =>
                  import('../training/training-page').then((m) => m.TrainingPage),
              },
              {
                path: `${segment}/:id`,
                data: { kind, catalogMode: 'detail', permission: `${prefix}_VIEW` },
                loadComponent: () =>
                  import('../training/training-page').then((m) => m.TrainingPage),
              },
            ];
          }),
        ],
      },
      {
        path: 'sedes',
        data: { permission: 'BRANCH_VIEW' },
        title: 'Sedes · Misión Líder París',
        children: [
          {
            path: 'crear',
            data: { permission: 'BRANCH_VIEW', globalPermission: true, branchMode: 'create' },
            canDeactivate: [registrationDraftGuard],
            loadComponent: () => import('../sites/sites-page').then((m) => m.SitesPage),
          },
          {
            path: ':id/editar',
            data: { permission: 'BRANCH_VIEW', globalPermission: true, branchMode: 'edit' },
            canDeactivate: [registrationDraftGuard],
            loadComponent: () => import('../sites/sites-page').then((m) => m.SitesPage),
          },
          {
            path: ':id',
            data: { permission: 'BRANCH_VIEW', branchMode: 'detail' },
            canDeactivate: [registrationDraftGuard],
            loadComponent: () => import('../sites/sites-page').then((m) => m.SitesPage),
          },
          {
            path: '',
            pathMatch: 'full',
            data: { permission: 'BRANCH_VIEW', branchMode: 'list' },
            canDeactivate: [registrationDraftGuard],
            loadComponent: () => import('../sites/sites-page').then((m) => m.SitesPage),
          },
        ],
      },
      {
        path: 'usuarios',
        data: { permissionsAnyOf: ['USER_VIEW', 'USER_CREATE'] },
        providers: [UsersStore],
        title: 'Usuarios · Misión Líder París',
        children: [
          {
            path: 'invitar',
            data: { permission: 'USER_CREATE', invite: true },
            canDeactivate: [registrationDraftGuard],
            loadComponent: () => import('../users/users-page').then((m) => m.UsersPage),
          },
          {
            path: '',
            pathMatch: 'full',
            data: { permission: 'USER_VIEW' },
            canDeactivate: [registrationDraftGuard],
            loadComponent: () => import('../users/users-page').then((m) => m.UsersPage),
          },
          {
            path: ':id/editar',
            data: { permission: 'USER_VIEW', userEdit: true },
            canDeactivate: [registrationDraftGuard],
            loadComponent: () => import('../users/users-page').then((m) => m.UsersPage),
          },
          {
            path: ':id',
            data: { permission: 'USER_VIEW' },
            canDeactivate: [registrationDraftGuard],
            loadComponent: () => import('../users/users-page').then((m) => m.UsersPage),
          },
        ],
      },
    ],
  },
];
