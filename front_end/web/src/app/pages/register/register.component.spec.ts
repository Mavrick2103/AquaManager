import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';

import { RegisterComponent } from './register.component';
import { AuthService } from '../../core/auth.service';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let authSpy: jasmine.SpyObj<AuthService>;
  let router: Router;

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj<AuthService>('AuthService', ['register']);

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        { provide: AuthService, useValue: authSpy },
        // 👇 fournit un vrai router minimal pour routerLink / ActivatedRoute
        provideRouter([]),
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.returnValue(Promise.resolve(true));

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('devrait être créé', () => {
    expect(component).toBeTruthy();
  });

  it('ne doit pas appeler auth.register si le formulaire est invalide', fakeAsync(() => {
    component.form.setValue({
      fullName: '',
      email: '',
      passwords: {
        password: '',
        confirmPassword: '',
      },
      acceptTos: true,
    });

    component.submit();
    tick();
    fixture.detectChanges();

    expect(authSpy.register).not.toHaveBeenCalled();
    expect(component.loading()).toBeFalse();
    expect(component.errorMsg()).toBe('Formulaire incomplet ou invalide');

    const errEl = fixture.debugElement.query(By.css('p.error'));
    expect(errEl.nativeElement.textContent).toContain('Formulaire incomplet ou invalide');
  }));

  it('ne doit pas appeler auth.register si les mots de passe ne correspondent pas', fakeAsync(() => {
    component.form.setValue({
      fullName: 'Romain',
      email: 'romain@test.com',
      passwords: {
        password: 'Password123',
        confirmPassword: 'AutrePassword123',
      },
      acceptTos: true,
    });

    component.form.updateValueAndValidity();
    component.passwords?.updateValueAndValidity();

    component.submit();
    tick();
    fixture.detectChanges();

    expect(component.passwords?.errors).toEqual({ passwordsMismatch: true });
    expect(authSpy.register).not.toHaveBeenCalled();
    expect(component.errorMsg()).toBe('Formulaire incomplet ou invalide');
  }));

  it('doit appeler auth.register avec le bon payload quand le formulaire est valide', fakeAsync(() => {
    authSpy.register.and.returnValue(Promise.resolve(true as any));

    component.form.setValue({
      fullName: 'Romain',
      email: 'romain@test.com',
      passwords: {
        password: 'Password123!',
        confirmPassword: 'Password123!',
      },
      acceptTos: true,
    });

    component.submit();
    tick();
    fixture.detectChanges();

    expect(authSpy.register).toHaveBeenCalledWith({
      fullName: 'Romain',
      email: 'romain@test.com',
      password: 'Password123!',
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/auth/connexion');
    expect(component.loading()).toBeFalse();
    expect(component.errorMsg()).toBeNull();
  }));

  it('doit afficher un message d’erreur si auth.register échoue', fakeAsync(() => {
    authSpy.register.and.returnValue(
      Promise.reject({ error: { message: 'Email déjà utilisé' } }) as any,
    );

    component.form.setValue({
      fullName: 'Romain',
      email: 'romain@test.com',
      passwords: {
        password: 'Password123!',
        confirmPassword: 'Password123!',
      },
      acceptTos: true,
    });

    component.submit();
    tick();
    fixture.detectChanges();

    expect(authSpy.register).toHaveBeenCalled();
    expect(component.loading()).toBeFalse();
    expect(component.errorMsg()).toBe('Email déjà utilisé');

    const errEl = fixture.debugElement.query(By.css('p.error'));
    expect(errEl.nativeElement.textContent).toContain('Email déjà utilisé');
  }));

  it('doit désactiver le bouton si les CGU ne sont pas acceptées', () => {
    component.acceptTos.setValue(false);
    fixture.detectChanges();

    const btn = fixture.debugElement.query(By.css('button[type="submit"]'))
      .nativeElement as HTMLButtonElement;

    expect(btn.disabled).toBeTrue();
  });
});
