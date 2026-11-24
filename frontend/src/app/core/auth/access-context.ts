import { computed, inject, Injectable, InjectionToken, Signal, signal } from '@angular/core';

export const NAVIGATION_PERMISSIONS = [
  'PERSON_VIEW',
  'PERSON_CREATE',
  'PERSON_UPDATE',
  'PERSON_DEACTIVATE',
  'PROCESS_VIEW',
  'PROCESS_ASSIGN',
  'PROCESS_CHANGE_STATUS',
  'PROCESS_CHANGE_RESPONSIBLE',
  'PROCESS_CREATE',
  'PROCESS_UPDATE',
  'CATEGORY_VIEW',
  'CATEGORY_CREATE',
  'CATEGORY_UPDATE',
  'BRANCH_VIEW',
  'USER_VIEW',
  'USER_CREATE',
  'USER_UPDATE',
  'USER_CHANGE_STATUS',
  'USER_ASSIGN_ROLE',
] as const;
export type Permission = (typeof NAVIGATION_PERMISSIONS)[number];
export type SiteScope =
  { readonly kind: 'all-sites' } | { readonly kind: 'sites'; readonly ids: readonly string[] };
export interface AccessGrant {
  readonly permission: Permission;
  readonly scope: SiteScope;
}
export interface Principal {
  readonly id: string;
  readonly displayName: string;
  readonly roles: readonly string[];
  readonly grants: readonly AccessGrant[];
}

/** App configuration connects this to AuthStore; the fallback never fabricates a session. */
export const AUTH_PRINCIPAL = new InjectionToken<Signal<Principal | null>>('AUTH_PRINCIPAL', {
  providedIn: 'root',
  factory: () => signal<Principal | null>(null).asReadonly(),
});

@Injectable({ providedIn: 'root' })
export class AccessContext {
  readonly principal = inject(AUTH_PRINCIPAL);
  readonly authenticated = computed(() => this.principal() !== null);

  can(permission: Permission, siteId?: string | null): boolean {
    // A record without a current branch is visible/editable only with global scope.
    if (siteId === null)
      return (
        this.principal()?.grants.some(
          (grant) => grant.permission === permission && grant.scope.kind === 'all-sites',
        ) ?? false
      );
    if (siteId !== undefined && !siteId.trim()) return false;
    return (
      this.principal()?.grants.some(
        (grant) =>
          grant.permission === permission &&
          (grant.scope.kind === 'all-sites' ||
            (siteId === undefined
              ? grant.scope.ids.some((id) => !!id.trim())
              : grant.scope.ids.includes(siteId))),
      ) ?? false
    );
  }
}
