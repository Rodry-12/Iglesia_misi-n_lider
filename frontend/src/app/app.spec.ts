import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { Router } from '@angular/router';
import { CHURCH_CONTENT } from './core/content/church-content';
import { PUBLIC_REFERENCE } from './core/content/public-reference-content';
import { CONTACT_GATEWAY } from './features/public/contact/data-access/contact-gateway';

describe('AC-002: rutas publicas', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: CONTACT_GATEWAY, useValue: { send: async () => {} } },
      ],
    }),
  );

  it.each([
    ['/', 'Nuestra comunidad'],
    ['/donar', 'Diezmos y Ofrendas'],
    ['/contacto', 'Habla con nosotros'],
    ['/pagina-inexistente', 'No encontramos esta página'],
  ])('resuelve %s y presenta su contenido', async (url, heading) => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(heading);
  });

  it('AC-003: muestra el QR local y el envio manual de comprobantes', async () => {
    const harness = await RouterTestingHarness.create('/donar');
    const page = harness.routeNativeElement!;
    expect(page.querySelector<HTMLImageElement>('.donation-qr')?.getAttribute('src')).toBe(
      '/assets/images/qr.png',
    );
    expect(page.querySelector<HTMLAnchorElement>('a[href^="mailto:"]')?.getAttribute('href')).toBe(
      'mailto:iglesiamisionliderparis@gmail.com',
    );
    expect(page.textContent).toContain('comprobante');
    expect(page.querySelector('form')).toBeNull();
  });

  it('004 AC-001: conserva un único layout y sus instancias entre páginas públicas', async () => {
    const harness = await RouterTestingHarness.create('/');
    const header = harness.routeNativeElement!.querySelector('header');
    const footer = harness.routeNativeElement!.querySelector('footer');
    for (const url of ['/donar', '/contacto', '/pagina-inexistente', '/']) {
      const toggle = header!.querySelector<HTMLButtonElement>('.menu-toggle')!;
      toggle.click();
      harness.fixture.detectChanges();
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      await harness.navigateByUrl(url);
      const page = harness.routeNativeElement!;
      expect(page.querySelectorAll('header')).toHaveLength(1);
      expect(page.querySelectorAll('footer')).toHaveLength(1);
      expect(page.querySelectorAll('main')).toHaveLength(1);
      expect(page.querySelector('header')).toBe(header);
      expect(page.querySelector('footer')).toBe(footer);
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('004 AC-002: muestra acceso futuro sin enlaces internos en el menú del visitante', async () => {
    const harness = await RouterTestingHarness.create('/');
    const nav = harness.routeNativeElement!.querySelector('header nav')!;
    expect(nav.querySelector('a[href="/gestion"]')).toBeNull();
    expect(nav.querySelector('a[href="/diseno"]')).toBeNull();
    const access = nav.querySelector<HTMLAnchorElement>('a[href="/acceso"]')!;
    expect(access.textContent).toContain('Iniciar sesión');
    access.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/acceso');
    expect(harness.routeNativeElement!.querySelector('input[type="password"]')).toBeNull();
  });

  it('004 AC-004: conserva el contenido de las secciones y los canales de contacto', async () => {
    const harness = await RouterTestingHarness.create('/');
    const main = harness.routeNativeElement!.querySelector('main')!;
    for (const content of [
      PUBLIC_REFERENCE.communityDescription,
      CHURCH_CONTENT.mission,
      CHURCH_CONTENT.vision,
    ]) {
      expect(main.textContent).toContain(content);
    }
    for (const service of PUBLIC_REFERENCE.services)
      expect(main.textContent).toContain(service.schedule);
    await harness.navigateByUrl('/contacto');
    expect(
      harness.routeNativeElement!.querySelector('main a[href^="mailto:"]')?.getAttribute('href'),
    ).toBe('mailto:' + CHURCH_CONTENT.email);
  });
});
