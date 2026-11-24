import { NAVIGATION_PERMISSIONS, Principal, Permission } from './access-context';

export interface SessionGrant {
  readonly roleId: string;
  readonly roleCode: 'SUPER_ADMIN' | 'BRANCH_ADMIN' | 'OPERATOR';
  readonly branchId: string | null;
  readonly branchName?: string | null;
  readonly permissions: readonly string[];
}
export interface SessionDto {
  readonly userId: string;
  readonly displayName: string;
  readonly grants: readonly SessionGrant[];
}

export function readSession(value: unknown): SessionDto {
  const session = value as SessionDto | null;
  if (
    !session ||
    typeof session.userId !== 'string' ||
    !session.userId ||
    typeof session.displayName !== 'string' ||
    !Array.isArray(session.grants) ||
    !session.grants.length ||
    !session.grants.every(
      (g) =>
        g &&
        typeof g.roleId === 'string' &&
        !!g.roleId &&
        ['SUPER_ADMIN', 'BRANCH_ADMIN', 'OPERATOR'].includes(g.roleCode) &&
        (g.roleCode === 'SUPER_ADMIN'
          ? g.branchId === null
          : typeof g.branchId === 'string' && !!g.branchId) &&
        (g.branchName == null || typeof g.branchName === 'string') &&
        Array.isArray(g.permissions) &&
        g.permissions.every((p: unknown) => typeof p === 'string' && !!p),
    )
  )
    throw new Error('invalid_session_response');
  return session;
}

export function toPrincipal(session: SessionDto): Principal {
  return {
    id: session.userId,
    displayName: session.displayName,
    roles: [...new Set(session.grants.map((g) => g.roleCode))],
    grants: session.grants.flatMap((grant) =>
      grant.permissions
        .filter((permission) => (NAVIGATION_PERMISSIONS as readonly string[]).includes(permission))
        .map((permission) => ({
          permission: permission as Permission,
          scope:
            grant.roleCode === 'SUPER_ADMIN' && grant.branchId === null
              ? { kind: 'all-sites' as const }
              : { kind: 'sites' as const, ids: [grant.branchId!] },
        })),
    ),
  };
}
