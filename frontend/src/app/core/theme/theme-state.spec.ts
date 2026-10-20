import { TestBed } from '@angular/core/testing';
import { ThemeToggle } from '../../shared/ui/theme-toggle';

describe('003 AC-002: tema compartido', () => {
  afterEach(() => document.documentElement.removeAttribute('data-theme'));

  it('cambia el atributo global y expone el estado accesible', async () => {
    const fixture = TestBed.createComponent(ThemeToggle);
    fixture.detectChanges();
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button',
    )!;
    expect(document.documentElement.dataset['theme']).toBe('light');
    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.textContent).toContain('Tema claro');
    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.documentElement.dataset['theme']).toBe('light');
  });
});
