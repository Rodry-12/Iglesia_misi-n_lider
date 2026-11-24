import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, Observable, of, switchMap, throwError } from 'rxjs';
import { AuthStore } from './auth.store';
import { CsrfService } from './csrf.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  // Never attach credentials or CSRF to EmailJS or any external URL.
  if (!request.url.startsWith('/api/v1/')) return next(request);
  const auth = inject(AuthStore);
  const csrf = inject(CsrfService);
  const write = !['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(request.method);
  const token: Observable<{ token: string; headerName: string } | null> = write
    ? csrf.get()
    : of(null);
  return token.pipe(
    switchMap((value) =>
      next(
        request.clone({
          withCredentials: true,
          ...(value ? { setHeaders: { 'X-XSRF-TOKEN': value.token } } : {}),
        }),
      ),
    ),
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 400 && error.error?.code === 'invalid_csrf') csrf.reset();
        if (
          error.status === 401 &&
          !['/api/v1/auth/login', '/api/v1/auth/csrf'].includes(request.url)
        )
          auth.expireSession();
        // Resource denials belong to the caller's operation feedback. A global
        // auth error here would duplicate its Toast and pollute unrelated views.
      }
      return throwError(() => error);
    }),
  );
};
