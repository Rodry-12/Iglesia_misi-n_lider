import { inject } from '@angular/core';
import { CanActivateChildFn, CanMatchFn, Router } from '@angular/router';
import { AccessContext, Permission } from './access-context';

export const sessionGuard: CanMatchFn = () => {
  return inject(AccessContext).authenticated() || inject(Router).createUrlTree(['/acceso']);
};

export const moduleGuard: CanActivateChildFn = (route) => {
  const access = inject(AccessContext);
  const router = inject(Router);
  if (!access.authenticated()) return router.createUrlTree(['/acceso']);
  if (route.data['sessionOnly'] === true) return true;
  const permission = route.data['permission'] as Permission | undefined;
  return (
    (permission !== undefined && access.can(permission)) || router.createUrlTree(['/sin-acceso'])
  );
};
