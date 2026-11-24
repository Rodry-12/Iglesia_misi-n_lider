import { userAllowed, userProtected } from './user-access';
import { SessionDto } from '../../core/auth/auth.models';
import { UserAccount, UserOptions } from './users.models';
const options: UserOptions = {
  roles: [
    { id: 'op', code: 'OPERATOR' },
    { id: 'admin', code: 'BRANCH_ADMIN' },
    { id: 'root', code: 'SUPER_ADMIN' },
  ],
  branches: [],
  permissions: [],
};
const user: UserAccount = {
  id: 'target',
  displayName: 'Prueba',
  email: 'test@example.invalid',
  personId: null,
  isActive: true,
  emailConfirmed: true,
  hasPassword: true,
  lockoutEnd: null,
  grants: [{ roleId: 'op', branchId: 'a', permissionIds: [] }],
};
const session: SessionDto = {
  userId: 'actor',
  displayName: 'Administrador de sede',
  grants: [
    {
      roleId: 'admin',
      roleCode: 'BRANCH_ADMIN',
      branchId: 'a',
      permissions: ['USER_VIEW', 'USER_UPDATE', 'USER_ASSIGN_ROLE'],
    },
  ],
};
describe('política visual compartida de cuentas', () => {
  it('acceso personalizado aplica cada permiso únicamente a operadores de su sede', () => {
    const custom: SessionDto = {
      ...session,
      grants: [
        {
          ...session.grants[0],
          roleCode: 'OPERATOR',
          permissions: [
            'USER_VIEW',
            'USER_UPDATE',
            'USER_CREATE',
            'USER_ASSIGN_ROLE',
            'USER_CHANGE_STATUS',
          ],
        },
      ],
    };
    expect(userAllowed(custom, options, 'USER_VIEW')).toBe(true);
    expect(userAllowed(custom, options, 'USER_UPDATE', user)).toBe(true);
    expect(
      userAllowed(custom, options, 'USER_UPDATE', {
        ...user,
        grants: [{ roleId: 'op', branchId: 'b' }],
      }),
    ).toBe(false);
    expect(
      userAllowed(custom, options, 'USER_UPDATE', {
        ...user,
        grants: [{ roleId: 'admin', branchId: 'a' }],
      }),
    ).toBe(false);
    for (const permission of ['USER_CREATE', 'USER_ASSIGN_ROLE', 'USER_CHANGE_STATUS'])
      expect(userAllowed(custom, options, permission, user)).toBe(true);
    expect(userAllowed(custom, options, 'TYPO_PERMISSION', user)).toBe(false);
    const restricted: SessionDto = {
      ...custom,
      grants: [{ ...custom.grants[0], permissions: ['USER_VIEW'] }],
    };
    expect(userAllowed(restricted, options, 'USER_UPDATE', user)).toBe(false);
    expect(
      userAllowed(
        custom,
        { ...options, permissions: [{ id: 'more', code: 'PERSON_CREATE' }] },
        'USER_UPDATE',
        {
          ...user,
          grants: [{ roleId: 'op', branchId: 'a', permissionIds: ['more'] }],
        },
      ),
    ).toBe(false);
  });
  it('permite editar operador en la sede autorizada sin ampliar permisos', () => {
    expect(userAllowed(session, options, 'USER_UPDATE', user)).toBe(true);
    expect(userAllowed(session, options, 'USER_CHANGE_STATUS', user)).toBe(false);
  });
  it('deniega otra sede ycuentas administradoras aBRANCH_ADMIN', () => {
    expect(
      userAllowed(session, options, 'USER_UPDATE', {
        ...user,
        grants: [{ roleId: 'op', branchId: 'b' }],
      }),
    ).toBe(false);
    expect(
      userAllowed(session, options, 'USER_ASSIGN_ROLE', {
        ...user,
        grants: [{ roleId: 'admin', branchId: 'a' }],
      }),
    ).toBe(false);
  });
  it('protege la propia cuenta,acceso global yroles desconocidos', () => {
    expect(userProtected(session, options, { ...user, id: 'actor' })).toBe(true);
    expect(
      userProtected(session, options, { ...user, grants: [{ roleId: 'root', branchId: null }] }),
    ).toBe(true);
    expect(
      userProtected(session, options, { ...user, grants: [{ roleId: 'unknown', branchId: 'a' }] }),
    ).toBe(true);
  });
});
