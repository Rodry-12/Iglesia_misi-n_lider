import { InjectionToken, inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export function normalizeApiBaseUrl(value: string): string {
  const base = value.trim().replace(/\/+$/, '');
  if (base === '/api/v1') return base;
  const url = new URL(base);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/api/v1'
  ) {
    throw new Error('apiBaseUrl must be /api/v1 or an HTTPS URL ending in /api/v1.');
  }
  return url.origin + url.pathname;
}

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => normalizeApiBaseUrl(environment.apiBaseUrl),
});

// Keep this after auth/activity: those interceptors use the logical relative URL.
export const apiBaseUrlInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/v1/')) return next(request);
  const base = inject(API_BASE_URL);
  return next(request.clone({ url: base + request.url.slice('/api/v1'.length) }));
};
