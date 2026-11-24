import { TestBed } from '@angular/core/testing';
import { SiteDraft, SiteForm } from './site-form';

describe('003 AC-003: formulario tipado de vista previa', () => {
  it('rechaza vacíos y espacios sin emitir datos', () => {
    const fixture = TestBed.createComponent(SiteForm);
    const component = fixture.componentInstance;
    const values: SiteDraft[] = [];
    component.validated.subscribe((value) => values.push(value));
    component.validate();
    expect(component.form.touched).toBe(true);
    component.form.setValue({ name: '   ', city: '  ' });
    component.validate();
    expect(values).toEqual([]);
  });

  it('valida los valores actuales sin keyup, recorta y reinicia sin conservar validación', () => {
    const fixture = TestBed.createComponent(SiteForm);
    const component = fixture.componentInstance;
    const values: SiteDraft[] = [];
    component.validated.subscribe((value) => values.push(value));
    component.form.setValue({ name: ' Sede de ejemplo ', city: ' Bello ' });
    component.validate();
    expect(values).toEqual([{ name: 'Sede de ejemplo', city: 'Bello' }]);
    component.reset();
    expect(component.form.getRawValue()).toEqual({ name: '', city: '' });
    expect(component.form.untouched).toBe(true);
    component.validate();
    expect(values).toHaveLength(1);
  });

  it('limita el tamaño y asocia errores a controles PrimeNG al enviar', async () => {
    const fixture = TestBed.createComponent(SiteForm);
    fixture.detectChanges();
    fixture.componentInstance.form.setValue({ name: 'x'.repeat(81), city: 'Bello' });
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.name.hasError('maxlength')).toBe(true);
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input')!;
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });
});
