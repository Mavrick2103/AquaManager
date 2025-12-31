import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

function isAuthEndpoint(url: string): boolean {
  try {
    const u = new URL(url, window.location.origin);
    return /^\/?api\/auth\/(refresh|login|logout)(\/|$)/.test(u.pathname);
  } catch {
    return url.includes('/auth/refresh') || url.includes('/auth/login') || url.includes('/auth/logout');
  }
}

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const isAuth = isAuthEndpoint(req.url);

    const alreadyHasAuth = !!req.headers.get('Authorization');

    const token = !isAuth && !alreadyHasAuth ? this.auth.token : null;

    const authReq = token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

    return next.handle(authReq).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status !== 401 || isAuth) {
          return throwError(() => err);
        }

        return from(this.auth.refreshAccessToken()).pipe(
          switchMap((newToken) => {
            if (!newToken) {
              this.auth.logout();
              return throwError(() => err);
            }
            const replay = req.clone({
              setHeaders: { Authorization: `Bearer ${newToken}` },
            });
            return next.handle(replay);
          }),
          catchError(() => {
            this.auth.logout();
            return throwError(() => err);
          })
        );
      })
    );
  }
}
