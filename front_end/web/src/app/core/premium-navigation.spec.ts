import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { SiteTourService } from './site-tour.service';

@Component({ standalone: true, template: '' })
class TestPage {}

describe('Premium navigation and automatic tour', () => {
  let http: HttpTestingController;
  let tour: jasmine.SpyObj<SiteTourService>;
  beforeEach(() => {
    tour = jasmine.createSpyObj('SiteTourService', ['offerForUser']);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: SiteTourService, useValue: tour },
      provideRouter([
        { path: 'login', component: TestPage },
        { path: 'dashboard', component: TestPage },
        { path: 'profile', component: TestPage, canActivate: [AuthGuard] },
      ])] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  const token = () => 'header.' + btoa(JSON.stringify({ exp: Math.floor(Date.now()/1000)+3600 })) + '.signature';
  it('starts the tour with the id returned by the real user API contract', async () => {
    await RouterTestingHarness.create('/login');
    const promise = TestBed.inject(AuthService).login('new@example.test', 'password');
    http.expectOne(r => r.url.endsWith('/auth/login')).flush({ access_token: token() });
    await Promise.resolve();
    http.expectOne(r => r.url.endsWith('/users/me')).flush({ id: 42, email: 'new@example.test', role: 'USER' });
    await promise;
    expect(tour.offerForUser).toHaveBeenCalledOnceWith(42);
  });

  it('shares one refresh request when several API requests expire together', async () => {
    if (navigator.locks) {
      spyOn(navigator.locks, 'request').and.callFake(((...args: any[]) => Promise.resolve(args[args.length - 1]({}))) as any);
    }
    const auth = TestBed.inject(AuthService);
    const first = auth.refreshAccessToken();
    const second = auth.refreshAccessToken();
    expect(first).toBe(second);
    http.expectOne(r => r.url.endsWith('/auth/refresh')).flush({ access_token: 'renewed' });
    expect(await first).toBe('renewed');
    expect(await second).toBe('renewed');
  });

  it('does not restore an access token if refresh finishes after logout', async () => {
    if (navigator.locks) {
      spyOn(navigator.locks, 'request').and.callFake(((...args: any[]) => Promise.resolve(args[args.length - 1]({}))) as any);
    }
    const auth = TestBed.inject(AuthService);
    const refresh = auth.refreshAccessToken();
    const refreshRequest = http.expectOne(r => r.url.endsWith('/auth/refresh'));
    const logout = auth.logout();
    http.expectOne(r => r.url.endsWith('/auth/logout')).flush({ message: 'ok' });
    refreshRequest.flush({ access_token: 'too-late' });
    await logout;
    expect(await refresh).toBeNull();
    expect(auth.token).toBeNull();
  });
  it('keeps the subscription target when an unauthenticated visitor reaches the guard', async () => {
    spyOn(TestBed.inject(AuthService), 'refreshAccessToken').and.resolveTo(null);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/profile?tab=subscription');
    const router = TestBed.inject(Router);
    expect(router.url.split('?')[0]).toBe('/login');
    expect(router.parseUrl(router.url).queryParams['returnUrl']).toBe('/profile?tab=subscription');
  });
  it('opens the subscription profile after login without starting the tour', async () => {
    await RouterTestingHarness.create('/login');
    const promise = TestBed.inject(AuthService).login('buyer@example.test','password','/profile?tab=subscription');
    http.expectOne(r => r.url.endsWith('/auth/login')).flush({access_token:token()});
    await Promise.resolve();
    http.expectOne(r => r.url.endsWith('/users/me')).flush({id:1,email:'buyer@example.test',role:'USER'});
    await promise;
    expect(TestBed.inject(Router).url).toBe('/profile?tab=subscription');
    expect(tour.offerForUser).not.toHaveBeenCalled();
  });
  it('preserves the subscription target when restoring a session', async () => {
    const auth = TestBed.inject(AuthService);
    spyOn(auth,'isAuthenticated').and.returnValue(true);
    const harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl('/profile?tab=subscription');
    // Wait for the asynchronous router guards to request the current user.
    await new Promise(resolve => setTimeout(resolve, 0));
    http.expectOne(r=>r.url.endsWith('/users/me')).flush({id:1,email:'buyer@example.test',role:'USER'});
    await navigation;
    expect(TestBed.inject(Router).url).toBe('/profile?tab=subscription');
    expect(tour.offerForUser).not.toHaveBeenCalled();
  });
});
