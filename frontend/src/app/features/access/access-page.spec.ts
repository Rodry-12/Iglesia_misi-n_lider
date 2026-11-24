import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccessPage } from './access-page';
import { AuthStore } from '../../core/auth/auth.store';

describe('008: formulario de acceso', () => {
  const auth = {
    authenticated: signal(false),
    busy: signal(false),
    error: signal<string | null>(null),
    state: signal('anonymous'),
    login: vi.fn(),
    refreshSession: vi.fn(),
  };
  beforeEach(() => {
    auth.busy.set(false);
    auth.error.set(null);
    auth.login.mockReset().mockResolvedValue(false);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthStore, useValue: auth }],
    });
  });

  it('valida valores actuales y no envía datos vacíos', async () => {
    const fixture = TestBed.createComponent(AccessPage);
    fixture.detectChanges();
    await fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(auth.login).not.toHaveBeenCalled();
    expect(fixture.componentInstance.invalid('email')).toBe(true);
    expect(fixture.nativeElement.querySelector('#login-email').getAttribute('aria-invalid')).toBe(
      'true',
    );
  });

  it('recorta solo correo, conserva valores ante fallo y bloquea doble envío', async () => {
    const fixture = TestBed.createComponent(AccessPage);
    const component = fixture.componentInstance;
    component.form.setValue({ email: ' cuenta@example.invalid ', password: ' password ' });
    await component.submit();
    expect(auth.login).toHaveBeenCalledWith('cuenta@example.invalid', ' password ');
    expect(component.form.controls.password.value).toBe(' password ');
    expect(component.form.enabled).toBe(true);
    auth.busy.set(true);
    await component.submit();
    expect(auth.login).toHaveBeenCalledTimes(1);
  });

  it('borra contraseña después de éxito y permite controlar su visibilidad por botón', async () => {
    auth.login.mockResolvedValue(true);
    const fixture = TestBed.createComponent(AccessPage);
    fixture.detectChanges();
    fixture.componentInstance.form.setValue({
      email: 'cuenta@example.invalid',
      password: 'Password123!',
    });
    await fixture.componentInstance.submit();
    expect(fixture.componentInstance.form.controls.password.value).toBe('');
    const button = fixture.nativeElement.querySelector(
      '[aria-controls="login-password"]',
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#login-password').type).toBe('text');
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });
});
