import { Permission } from '../auth/access-context';

export interface AdminNavItem {
  readonly title: string;
  readonly path: string;
  readonly permission: Permission;
}

export const ADMIN_NAVIGATION: readonly AdminNavItem[] = [
  { title: 'Finanzas', path: '/gestion/finanzas', permission: 'finanzas:leer' },
  { title: 'Miembros', path: '/gestion/miembros', permission: 'miembros:leer' },
  { title: 'Formación', path: '/gestion/formacion', permission: 'formacion:leer' },
  { title: 'Sedes', path: '/gestion/sedes', permission: 'sedes:leer' },
  { title: 'Usuarios', path: '/gestion/usuarios', permission: 'usuarios:administrar' },
];
