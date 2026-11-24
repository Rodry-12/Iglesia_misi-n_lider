import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Subscription, timeout } from 'rxjs';
@Injectable()
export class AccountActionStore {
  private readonly http = inject(HttpClient);
  private command?: Subscription;
  private finish?: () => void;
  readonly busy = signal(false);
  readonly done = signal(false);
  readonly error = signal<string | null>(null);
  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.command?.unsubscribe();
      this.finish?.();
    });
  }
  submit(
    operation:
      | 'activate-invitation'
      | 'forgot-password'
      | 'reset-password'
      | 'confirm-email'
      | 'resend-confirmation',
    body: unknown,
  ): Promise<void> {
    if (this.busy() || this.done()) return Promise.resolve();
    this.busy.set(true);
    this.error.set(null);
    return new Promise((resolve) => {
      this.finish = resolve;
      this.command = this.http
        .post('/api/v1/auth/' + operation, body, { observe: 'response' })
        .pipe(timeout(20000))
        .subscribe({
          next: (response) => {
            this.busy.set(false);
            this.finish = undefined;
            if (
              response.status ===
              (operation === 'forgot-password' || operation === 'resend-confirmation' ? 202 : 204)
            )
              this.done.set(true);
            else this.error.set('El resultado no pudo confirmarse.');
            resolve();
          },
          error: (failure: unknown) => {
            this.busy.set(false);
            this.finish = undefined;
            const status = failure instanceof HttpErrorResponse ? failure.status : 0;
            this.error.set(
              status === 400
                ? 'El enlace no es válido, ya fue utilizado o la contraseña no cumple los requisitos.'
                : status === 429
                  ? 'Demasiadas solicitudes. Espera antes de volver a intentarlo.'
                  : 'No se pudo confirmar la operación. Inténtalo más tarde.',
            );
            resolve();
          },
        });
    });
  }
}
