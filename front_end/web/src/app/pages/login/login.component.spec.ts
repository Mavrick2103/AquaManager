import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { LoginComponent } from './login.component';
import { AuthService } from '../../core/auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authSpy: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj<AuthService>('AuthService', ['login']);

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: authSpy },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('devrait être créé', () => {
    expect(component).toBeTruthy();
  });

  it('ne doit pas appeler auth.login si le formulaire est invalide', fakeAsync(() => {
    component.form.setValue({
      email: '',
      password: '',
      remember: true,
    });

    component.submit();
    tick();

    expect(authSpy.login).not.toHaveBeenCalled();
    expect(component.loading()).toBeFalse();
  }));

  it('doit appeler auth.login avec email/password quand le formulaire est valide', fakeAsync(() => {
    authSpy.login.and.returnValue(Promise.resolve(true));

    component.form.setValue({
      email: 'test@mail.com',
      password: 'secret123',
      remember: true,
    });

    component.submit();
    tick();

    expect(authSpy.login).toHaveBeenCalledWith('test@mail.com', 'secret123');
    expect(component.loading()).toBeFalse();
    expect(component.errorMsg()).toBeNull();
  }));

  it('doit afficher une erreur si auth.login échoue', fakeAsync(() => {
    authSpy.login.and.returnValue(
      Promise.reject({ error: { message: 'Bad credentials' } }) as Promise<boolean>
    );

    component.form.setValue({
      email: 'test@mail.com',
      password: 'wrongpass',
      remember: true,
    });

    component.submit();
    tick();

    expect(component.errorMsg()).toBe('Bad credentials');
    expect(component.loading()).toBeFalse();
  }));

  it('conserve la destination abonnement après connexion', fakeAsync(() => {
    spyOnProperty(TestBed.inject(ActivatedRoute).snapshot, 'queryParamMap', 'get').and.returnValue(convertToParamMap({ returnUrl: '/profile?tab=subscription' }));
    authSpy.login.and.returnValue(Promise.resolve(true));
    component.form.setValue({ email: 'test@mail.com', password: 'secret123', remember: true });
    component.submit(); tick();
    expect(authSpy.login).toHaveBeenCalledWith('test@mail.com', 'secret123', '/profile?tab=subscription');
  }));

  it('ignore une destination externe', fakeAsync(() => {
    spyOnProperty(TestBed.inject(ActivatedRoute).snapshot, 'queryParamMap', 'get').and.returnValue(convertToParamMap({ returnUrl: 'https://example.com' }));
    authSpy.login.and.returnValue(Promise.resolve(true));
    component.form.setValue({ email: 'test@mail.com', password: 'secret123', remember: true });
    component.submit(); tick();
    expect(authSpy.login).toHaveBeenCalledWith('test@mail.com', 'secret123');
  }));

  it('emailErr devrait retourner "Email invalide" si mauvais format', () => {
    const localFixture = TestBed.createComponent(LoginComponent);
    const localComponent = localFixture.componentInstance;

    localComponent.form.controls.email.setValue('invalid');
    localComponent.form.controls.email.markAsTouched();

    expect(localComponent.emailErr()).toBe('Email invalide');
  });
});
