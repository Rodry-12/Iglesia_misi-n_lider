import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { finalize, Observable, of, shareReplay, tap, timeout } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CsrfService {
  private readonly http = inject(HttpClient);
  private token: string | null = null;
  private pending?: Observable<{ token: string; headerName: string }>;
  private version = 0;

  reset(): void {
    this.version++;
    this.token = null;
    this.pending = undefined;
  }

  get(): Observable<{ token: string; headerName: string }> {
    if (this.token) return of({ token: this.token, headerName: 'X-XSRF-TOKEN' });
    if (this.pending) return this.pending;
    const version = this.version;
    this.pending = this.http
      .get<{ token: string; headerName: string }>('/api/v1/auth/csrf', { withCredentials: true })
      .pipe(
        timeout(10000),
        tap((value) => {
          if (
            value.headerName !== 'X-XSRF-TOKEN' ||
            typeof value.token !== 'string' ||
            !value.token
          )
            throw new Error('invalid_csrf_response');
          if (version === this.version) this.token = value.token;
        }),
        finalize(() => {
          if (version === this.version) this.pending = undefined;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.pending;
  }
}
