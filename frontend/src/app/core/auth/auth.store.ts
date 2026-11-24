import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, timeout, TimeoutError } from 'rxjs';
import { CsrfService } from './csrf.service';
import { readSession, SessionDto, toPrincipal } from './auth.models';

export type AuthState =
  'unknown' | 'loading' | 'authenticated' | 'anonymous' | 'forbidden' | 'error';

// Remote Identity and signed permission resolution involve several database round trips.
const AUTH_REQUEST_TIMEOUT_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly http = inject(HttpClient);
  private readonly csrf = inject(CsrfService);
  private readonly router = inject(Router);
  private readonly sessionValue = signal<SessionDto | null>(null);
  private readonly stateValue = signal<AuthState>('unknown');
  private readonly operation = signal<'idle' | 'login' | 'logout'>('idle');
  private readonly errorValue = signal<string | null>(null);
  private pending?: Promise<void>;
  private version = 0;
  readonly session = this.sessionValue.asReadonly();
  readonly state = this.stateValue.asReadonly();
  readonly error = this.errorValue.asReadonly();
  readonly busy = computed(() => this.state() === 'loading' || this.operation() !== 'idle');
  readonly authenticated = computed(() => this.session() !== null);
  readonly principal = computed(() => (this.session() ? toPrincipal(this.session()!) : null));
  readonly user = computed(() =>
    this.session()
      ? { id: this.session()!.userId, displayName: this.session()!.displayName }
      : null,
  );
  readonly branches = computed(() => [
    ...new Set(this.session()?.grants.flatMap((g) => (g.branchId ? [g.branchId] : [])) ?? []),
  ]);
  readonly permissions = computed(() => [
    ...new Set(this.session()?.grants.flatMap((g) => g.permissions) ?? []),
  ]);

  ensureSession(): Promise<void> {
    return this.pending ?? (this.state() === 'unknown' ? this.refreshSession() : Promise.resolve());
  }

  validateEntrySession(): Promise<void> {
    // Guards control navigation only. Each resource request still validates the
    // cookie and current permissions on the server; 401 clears this UI session.
    // Load once per application start, or retry an earlier connection failure.
    return this.state() === 'error' ? this.refreshSession() : this.ensureSession();
  }

  refreshSession(): Promise<void> {
    if (this.pending) return this.pending;
    const version = this.version;
    this.stateValue.set('loading');
    const pending = (async () => {
      try {
        const session = readSession(
          await firstValueFrom(
            this.http.get<unknown>('/api/v1/auth/session').pipe(timeout(AUTH_REQUEST_TIMEOUT_MS)),
          ),
        );
        if (version !== this.version) return;
        this.sessionValue.set(session);
        this.stateValue.set('authenticated');
        this.errorValue.set(null);
      } catch (error) {
        if (version !== this.version) return;
        this.sessionValue.set(null);
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        this.stateValue.set(status === 401 ? 'anonymous' : status === 403 ? 'forbidden' : 'error');
        this.errorValue.set(status === 401 ? null : this.message(error));
      }
    })().finally(() => {
      if (this.pending === pending) this.pending = undefined;
    });
    this.pending = pending;
    return pending;
  }

  async login(email: string, password: string): Promise<boolean> {
    if (this.operation() !== 'idle') return false;
    const version = ++this.version;
    this.pending = undefined;
    this.sessionValue.set(null);
    this.stateValue.set('anonymous');
    this.operation.set('login');
    this.errorValue.set(null);
    this.csrf.reset();
    try {
      await firstValueFrom(
        this.http
          .post('/api/v1/auth/login', { email: email.trim(), password })
          .pipe(timeout(AUTH_REQUEST_TIMEOUT_MS)),
      );
      this.csrf.reset();
      // Independent GETs after the authentication cookie is received. Still require
      // both CSRF renewal and canonical session before exposing an authenticated UI.
      const [, canonical] = await Promise.all([
        firstValueFrom(this.csrf.get()),
        firstValueFrom(
          this.http.get<unknown>('/api/v1/auth/session').pipe(timeout(AUTH_REQUEST_TIMEOUT_MS)),
        ),
      ]);
      const session = readSession(canonical);
      if (version !== this.version) return false;
      this.sessionValue.set(session);
      this.stateValue.set('authenticated');
      return true;
    } catch (error) {
      if (version === this.version) {
        this.sessionValue.set(null);
        this.stateValue.set('anonymous');
        this.errorValue.set(this.message(error));
        this.csrf.reset();
      } else if (error instanceof HttpErrorResponse && error.status === 401 && !this.error()) {
        // The interceptor may already have cleared a session revoked immediately after login.
        this.errorValue.set('La sesión no pudo verificarse. Inicia sesión de nuevo.');
      }
      return false;
    } finally {
      this.operation.set('idle');
    }
  }

  async logout(): Promise<boolean> {
    if (this.operation() !== 'idle') return false;
    ++this.version;
    this.pending = undefined;
    this.operation.set('logout');
    this.errorValue.set(null);
    this.stateValue.set(this.session() ? 'authenticated' : 'anonymous');
    try {
      await firstValueFrom(this.http.post('/api/v1/auth/logout', {}).pipe(timeout(10000)));
    } catch (error) {
      if (!(error instanceof HttpErrorResponse && error.status === 401)) {
        this.errorValue.set('No fue posible cerrar la sesión. Inténtalo de nuevo.');
        this.operation.set('idle');
        return false;
      }
    }
    this.sessionValue.set(null);
    this.stateValue.set('anonymous');
    this.csrf.reset();
    // A failed refresh cannot undo logout. The next write will obtain a new token.
    try {
      await firstValueFrom(this.csrf.get());
    } catch {
      this.csrf.reset();
    }
    this.operation.set('idle');
    await this.router.navigateByUrl('/acceso');
    return true;
  }

  expireSession(): void {
    const hadSession = this.authenticated();
    ++this.version;
    this.pending = undefined;
    this.sessionValue.set(null);
    this.stateValue.set('anonymous');
    this.csrf.reset();
    this.errorValue.set(hadSession ? 'Tu sesión ha finalizado. Inicia sesión de nuevo.' : null);
    if (this.router.url.startsWith('/gestion')) void this.router.navigateByUrl('/acceso');
  }

  private message(error: unknown): string {
    if (error instanceof TimeoutError)
      return 'La verificación de la sesión está tardando demasiado. Inténtalo de nuevo.';
    if (error instanceof HttpErrorResponse) {
      if (error.status === 503)
        return 'El servicio de autenticación no está disponible temporalmente. Inténtalo de nuevo.';
      if (error.status === 401)
        return 'No fue posible iniciar sesión. Revisa tus credenciales y el estado de tu cuenta.';
      if (error.status === 403) return 'No tienes permiso para acceder.';
      if (error.status === 429)
        return 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.';
      if (error.status === 400 && error.error?.code === 'invalid_csrf')
        return 'La verificación de seguridad venció. Inténtalo de nuevo.';
    }
    return 'No pudimos comprobar la sesión. Revisa tu conexión e inténtalo de nuevo.';
  }
}
