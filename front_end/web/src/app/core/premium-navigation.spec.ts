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
    http.expectOne(r => r.url.endsWith('/users/me')).flush({userId:1,email:'buyer@example.test',role:'USER'});
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
    http.expectOne(r=>r.url.endsWith('/users/me')).flush({userId:1,email:'buyer@example.test',role:'USER'});
    await navigation;
    expect(TestBed.inject(Router).url).toBe('/profile?tab=subscription');
    expect(tour.offerForUser).not.toHaveBeenCalled();
  });
});
