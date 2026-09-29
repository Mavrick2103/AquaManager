import { HttpErrorResponse, HttpHandler, HttpRequest } from '@angular/common/http';
import { firstValueFrom, throwError } from 'rxjs';
import { AuthInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('AuthInterceptor refresh recovery', () => {
  for (const status of [400, 403, 404, 500, 401]) {
    it(`preserves replay status ${status} and only logs out for 401`, async () => {
      const auth = { token: 'old', refreshAccessToken: jasmine.createSpy().and.resolveTo('new'), logout: jasmine.createSpy() };
      let calls = 0;
      const handler = { handle: () => throwError(() => new HttpErrorResponse({ status: ++calls === 1 ? 401 : status })) } as HttpHandler;
      try {
        await firstValueFrom(new AuthInterceptor(auth as unknown as AuthService).intercept(new HttpRequest('GET', '/api/aquariums'), handler));
        fail('Expected HTTP error');
      } catch (error) {
        expect((error as HttpErrorResponse).status).toBe(status);
      }
      expect(calls).toBe(2);
      expect(auth.logout).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
    });
  }
  for (const rejects of [false, true]) {
    it(`logs out once when refresh ${rejects ? 'rejects' : 'returns null'}`, async () => {
      const auth = { token: 'old', refreshAccessToken: () => rejects ? Promise.reject(new Error()) : Promise.resolve(null), logout: jasmine.createSpy() };
      const handler = { handle: () => throwError(() => new HttpErrorResponse({ status: 401 })) } as HttpHandler;
      await firstValueFrom(new AuthInterceptor(auth as unknown as AuthService).intercept(new HttpRequest('GET', '/api/aquariums'), handler)).catch(() => {});
      expect(auth.logout).toHaveBeenCalledTimes(1);
    });
  }
});
