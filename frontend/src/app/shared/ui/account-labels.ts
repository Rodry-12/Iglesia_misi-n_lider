/** Presentation only: never use these labels to authorize an operation. */
export function accountRoleLabel(code: string): string {
  return (
    (
      {
        SUPER_ADMIN: 'SuperAdministrador',
        BRANCH_ADMIN: 'Administrador de sede',
        OPERATOR: 'Operador',
      } as Record<string, string>
    )[code] ?? code
  );
}
