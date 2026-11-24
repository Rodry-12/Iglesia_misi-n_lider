import { Permission } from '../auth/access-context';

export interface AdminNavItem {
  readonly title: string;
  readonly path: string;
  readonly permission: Permission;
  readonly permissionsAnyOf?: readonly Permission[];
  readonly globalPermission?: boolean;
  readonly children?: readonly AdminNavItem[];
}

export const ADMIN_NAVIGATION: readonly AdminNavItem[] = [
  { title: 'Miembros', path: '/gestion/miembros', permission: 'PERSON_VIEW' },
  {
    title: 'Formación',
    path: '/gestion/formacion',
    permission: 'PROCESS_VIEW',
    permissionsAnyOf: ['PROCESS_VIEW', 'CATEGORY_VIEW'],
    children: [
      {
        title: 'Categorías',
        path: '/gestion/formacion/categorias',
        permission: 'CATEGORY_VIEW',
      },
      {
        title: 'Procesos',
        path: '/gestion/formacion/procesos',
        permission: 'PROCESS_VIEW',
      },
      { title: 'Seguimiento', path: '/gestion/formacion/asignaciones', permission: 'PROCESS_VIEW' },
    ],
  },
  { title: 'Sedes', path: '/gestion/sedes', permission: 'BRANCH_VIEW' },
  { title: 'Usuarios', path: '/gestion/usuarios', permission: 'USER_VIEW' },
];
