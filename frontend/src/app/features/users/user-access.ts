import { SessionDto } from '../../core/auth/auth.models';
import { UserAccount, UserOptions } from './users.models';

export function userRole(options: UserOptions | null, id: string) {
  return options?.roles.find((r) => r.id === id)?.code ?? 'Rol no disponible';
}
export function userAllowed(
  session: SessionDto | null,
  options: UserOptions | null,
  permission: string,
  user?: UserAccount,
) {
  if (
    !['USER_VIEW', 'USER_CREATE', 'USER_UPDATE', 'USER_ASSIGN_ROLE', 'USER_CHANGE_STATUS'].includes(
      permission,
    )
  )
    return false;
  const admins = (session?.grants ?? []).filter(
    (g) =>
      !!g.roleId &&
      ((g.roleCode === 'SUPER_ADMIN' && g.branchId === null) ||
        ((g.roleCode === 'BRANCH_ADMIN' || g.roleCode === 'OPERATOR') && !!g.branchId)),
  );
  if (!user) return admins.some((g) => g.permissions.includes(permission));
  return (
    user.grants.length > 0 &&
    user.grants.every((target) =>
      admins.some(
        (g) =>
          g.permissions.includes(permission) &&
          ((g.roleCode === 'SUPER_ADMIN' && g.branchId === null) ||
            (target.branchId !== null &&
              g.branchId === target.branchId &&
              userRole(options, target.roleId) === 'OPERATOR' &&
              (permission === 'USER_VIEW' ||
                (target.permissionIds ?? []).every((id) => {
                  const code = options?.permissions.find((item) => item.id === id)?.code;
                  return !!code && g.permissions.includes(code);
                })))),
      ),
    )
  );
}
export function userProtected(
  session: SessionDto | null,
  options: UserOptions | null,
  user: UserAccount,
) {
  return (
    !options ||
    user.id === session?.userId ||
    user.grants.some((g) =>
      ['SUPER_ADMIN', 'Rol no disponible'].includes(userRole(options, g.roleId)),
    )
  );
}
export function userStatus(user: UserAccount) {
  return !user.isActive
    ? 'Inactiva'
    : user.lockoutEnd && Date.parse(user.lockoutEnd) > Date.now()
      ? 'Bloqueada temporalmente'
      : !user.hasPassword
        ? 'Pendiente de activación'
        : !user.emailConfirmed
          ? 'Correo sin confirmar'
          : 'Activa';
}
