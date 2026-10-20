import { computed, inject, Injectable, InjectionToken, Signal, signal } from '@angular/core';

export type Permission =
  'finanzas:leer' | 'miembros:leer' | 'formacion:leer' | 'sedes:leer' | 'usuarios:administrar';
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

/** El futuro proveedor de autenticación entrega una sesión validada. No hay sesión de prueba por defecto. */
export const AUTH_PRINCIPAL = new InjectionToken<Signal<Principal | null>>('AUTH_PRINCIPAL', {
  providedIn: 'root',
  factory: () => signal<Principal | null>(null).asReadonly(),
});

@Injectable({ providedIn: 'root' })
export class AccessContext {
  readonly principal = inject(AUTH_PRINCIPAL);
  readonly authenticated = computed(() => this.principal() !== null);

  can(permission: Permission, siteId?: string): boolean {
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
