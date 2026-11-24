import { TestBed } from '@angular/core/testing';
import { DesignSystemPage } from './design-system-page';
import { SiteForm } from '../../shared/forms/site-form';
import { By } from '@angular/platform-browser';

describe('003 AC-003: guía visual', () => {
  it('presenta datos validados en la tabla y los retira al limpiar', async () => {
    const fixture = TestBed.createComponent(DesignSystemPage);
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(SiteForm)).componentInstance as SiteForm;
    form.form.setValue({ name: 'Sede de ejemplo', city: 'Municipio de ejemplo' });
    form.validate();
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('table')?.textContent).toContain('Sede de ejemplo');
    expect(page.querySelector('[role="status"]')?.textContent).toContain('No se ha guardado');
    form.reset();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(page.querySelector('table')?.textContent).not.toContain('Sede de ejemplo');
  });
});
