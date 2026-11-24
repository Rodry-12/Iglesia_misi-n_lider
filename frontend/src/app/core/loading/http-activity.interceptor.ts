import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { defer, finalize } from 'rxjs';
import { HttpActivity } from './http-activity';

export const SKIP_HTTP_ACTIVITY = new HttpContextToken(() => false);

export const httpActivityInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/v1/') || request.context.get(SKIP_HTTP_ACTIVITY))
    return next(request);
  const activity = inject(HttpActivity);
  return defer(() => {
    const finish = activity.beginRequest();
    return defer(() => next(request)).pipe(finalize(finish));
  });
};
