import { CanDeactivateFn } from '@angular/router';
export const registrationDraftGuard: CanDeactivateFn<{ canLeave(): boolean | Promise<boolean> }> = (
  page,
  _route,
  _state,
  next,
) => next?.url.startsWith('/acceso') || next?.url.startsWith('/sin-acceso') || page.canLeave();
