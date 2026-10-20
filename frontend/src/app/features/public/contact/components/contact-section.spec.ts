import { TestBed } from '@angular/core/testing';
import { CONTACT_GATEWAY, ContactMessage } from '../data-access/contact-gateway';
import { ContactSection } from './contact-section';

describe('005 AC-004: contacto fiable', () => {
  const message: ContactMessage = {
    user: 'Persona de prueba',
    email: 'prueba@example.org',
    subject: 'Petición de prueba 2026',
    content: 'Mensaje de prueba local.',
  };
  const send = vi.fn<(value: ContactMessage) => Promise<void>>();
  beforeEach(() => {
    send.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: CONTACT_GATEWAY, useValue: { send } }],
    });
  });

  it('valida valores pegados y rechaza espacios sin enviar', async () => {
    const form = TestBed.createComponent(ContactSection).componentInstance;
    form.form.setValue({ ...message, user: '   ', subject: '        ' });
    await form.submit();
    expect(send).not.toHaveBeenCalled();
    expect(form.status()).toBe('invalid');
  });

  it('espera confirmación, impide duplicados y conserva datos en fallo', async () => {
    let reject!: (reason: Error) => void;
    send.mockImplementation(
      () =>
        new Promise((_, failure) => {
          reject = failure;
        }),
    );
    const component = TestBed.createComponent(ContactSection).componentInstance;
    component.form.setValue(message);
    const pending = component.submit();
    expect(component.status()).toBe('sending');
    expect(component.form.disabled).toBe(true);
    await component.submit();
    expect(send).toHaveBeenCalledTimes(1);
    reject(new Error('Fallo simulado'));
    await pending;
    expect(component.status()).toBe('error');
    expect(component.form.getRawValue()).toEqual(message);
    expect(component.form.enabled).toBe(true);
  });

  it('permite reintento y reinicia toda la validación solo tras éxito', async () => {
    send.mockRejectedValueOnce(new Error('Fallo simulado')).mockResolvedValueOnce(undefined);
    const component = TestBed.createComponent(ContactSection).componentInstance;
    component.form.setValue(message);
    await component.submit();
    expect(component.status()).toBe('error');
    await component.submit();
    expect(component.status()).toBe('success');
    expect(component.form.untouched).toBe(true);
    expect(component.form.getRawValue()).toEqual({ user: '', email: '', subject: '', content: '' });
    await component.submit();
    expect(send).toHaveBeenCalledTimes(2);
    expect(component.status()).toBe('invalid');
  });
});
