import { inject } from '@angular/core';
import { CanActivateChildFn, CanMatchFn, Router } from '@angular/router';
import { AccessContext, Permission } from './access-context';
import { AuthStore } from './auth.store';

export const sessionGuard: CanMatchFn = async () => {
  const auth = inject(AuthStore);
  const access = inject(AccessContext);
  const router = inject(Router);
  await auth.validateEntrySession();
  return (
    access.authenticated() ||
    router.createUrlTree([auth.state() === 'forbidden' ? '/sin-acceso' : '/acceso'])
  );
};

export const moduleGuard: CanActivateChildFn = async (route) => {
  const access = inject(AccessContext);
  const router = inject(Router);
  await inject(AuthStore).ensureSession();
  if (!access.authenticated()) return router.createUrlTree(['/acceso']);
  if (route.data['sessionOnly'] === true) return true;
  const permission = route.data['permission'] as Permission | undefined;
  const any = route.data['permissionsAnyOf'] as readonly Permission[] | undefined;
  return (
    (permission !== undefined
      ? access.can(permission, route.data['globalPermission'] === true ? null : undefined)
      : Array.isArray(any) && any.some((value) => access.can(value))) ||
    router.createUrlTree(['/sin-acceso'])
  );
};
