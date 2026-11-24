/** Display labels only. API payloads, guards and grants continue using their codes. */
const labels: Readonly<Record<string, string>> = {
  BRANCH_CREATE: 'Registrar sedes',
  BRANCH_UPDATE: 'Editar y activar o desactivar sedes',
  BRANCH_VIEW: 'Consultar sedes',
  CATEGORY_CREATE: 'Crear categorías de procesos',
  CATEGORY_UPDATE: 'Editar y activar o desactivar categorías',
  CATEGORY_VIEW: 'Consultar categorías de procesos',
  PERSON_CREATE: 'Registrar personas',
  PERSON_DEACTIVATE: 'Activar o desactivar personas',
  PERSON_TRANSFER: 'Trasladar personas entre sedes',
  PERSON_UPDATE: 'Editar datos de personas',
  PERSON_VIEW: 'Consultar personas',
  PROCESS_ASSIGN: 'Asignar procesos a personas',
  PROCESS_CHANGE_RESPONSIBLE: 'Cambiar responsables de procesos',
  PROCESS_CHANGE_STATUS: 'Cambiar estados y finalizar procesos',
  PROCESS_CREATE: 'Crear procesos ministeriales',
  PROCESS_UPDATE: 'Editar y activar o desactivar procesos',
  PROCESS_VIEW: 'Consultar procesos y su seguimiento',
  REPORT_EXPORT: 'Exportar reportes',
  REPORT_VIEW: 'Consultar reportes',
  USER_ASSIGN_ROLE: 'Asignar roles y permisos a usuarios',
  USER_CHANGE_STATUS: 'Activar o desactivar usuarios y revocar sesiones',
  USER_CREATE: 'Invitar usuarios',
  USER_UPDATE: 'Editar datos de usuarios',
  USER_VIEW: 'Consultar usuarios',
};

export function permissionLabel(code: string): string {
  return labels[code] ?? 'Permiso adicional de la cuenta';
}
