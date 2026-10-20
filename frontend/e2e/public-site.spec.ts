import { expect, test } from '@playwright/test';

test('005: secciones, imágenes, footer responsive y ausencia de desbordamiento', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  for (const title of [
    'Nuestra comunidad',
    'Creemos',
    'Nuestros valores',
    'Nain Salas',
    'Ministerios',
    'Visita nuestra iglesia',
    'Próximos eventos',
    'Habla con',
  ])
    await expect(
      page
        .locator('main')
        .getByRole('heading', { name: new RegExp(title) })
        .first(),
    ).toBeAttached();
  await page.evaluate(async () => {
    for (const image of document.images) image.loading = 'eager';
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    await page
      .locator('img')
      .evaluateAll((images) =>
        images
          .filter((img) => !(img as HTMLImageElement).naturalWidth)
          .map((img) => (img as HTMLImageElement).src),
      ),
  ).toEqual([]);
  const columns = await page.locator('footer .footer-start > div').evaluateAll((nodes) =>
    nodes.map((node) => ({
      x: node.getBoundingClientRect().x,
      y: node.getBoundingClientRect().y,
    })),
  );
  if (testInfo.project.name === 'desktop')
    expect(new Set(columns.map((c) => Math.round(c.x))).size).toBe(3);
  else expect(columns[0].y).toBeLessThan(columns[1].y);
  expect(errors).toEqual([]);
});

test('005: slider original con selección y navegación', async ({ page }) => {
  await page.goto('/');
  const carousel = page.getByRole('region', { name: 'Bienvenida a Misión Líder París' });
  await expect(carousel.locator('img')).toHaveCount(3);
  await carousel.getByRole('button', { name: 'Imagen siguiente', exact: true }).click();
  await expect(carousel.getByRole('button', { name: 'Mostrar imagen 2' })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await carousel.getByRole('button', { name: 'Imagen anterior', exact: true }).click();
  await expect(carousel.getByRole('button', { name: 'Mostrar imagen 1' })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await carousel.getByRole('button', { name: 'Mostrar imagen 3' }).click();
  await expect(carousel.getByRole('button', { name: 'Mostrar imagen 3' })).toHaveAttribute(
    'aria-current',
    'true',
  );
});

test('005: ministerios y horarios accesibles por interacción', async ({ page }) => {
  await page.goto('/');
  const ministries = page.locator('.ministerios--section');
  await ministries.scrollIntoViewIfNeeded();
  await ministries.locator('summary').first().click();
  await expect(ministries.locator('details').first()).toHaveAttribute('open', '');
  await ministries.getByRole('button', { name: 'Siguientes ministerios' }).click();
  await expect
    .poll(() => ministries.locator('.ministerios-container-list').evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0);
  const details = page.getByRole('button', { name: /Ver detalles: Servicio de Miércoles/ });
  await details.click();
  await expect(details).toHaveAttribute('aria-expanded', 'true');
});

test('005: formulario pendiente, fallo, reintento y reinicio sin envío externo', async ({
  page,
}) => {
  let calls = 0;
  let release!: () => void;
  await page.route('https://api.emailjs.com/**', async (route) => {
    calls++;
    if (calls === 1) {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      await route.fulfill({ status: 500, contentType: 'text/plain', body: 'Fallo simulado' });
    } else await route.fulfill({ status: 200, contentType: 'text/plain', body: 'OK' });
  });
  await page.goto('/contacto');
  await page.getByLabel('Nombre', { exact: true }).fill('Persona de prueba');
  await page.getByLabel('Correo', { exact: true }).fill('prueba@example.org');
  await page.getByLabel('Asunto', { exact: true }).fill('Petición de prueba 2026');
  await page
    .getByLabel('Contenido', { exact: true })
    .fill('Mensaje simulado, no se envía a terceros.');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enviando…', exact: true })).toBeDisabled();
  await expect.poll(() => calls).toBe(1);
  release();
  await expect(page.getByRole('status')).toContainText('No pudimos enviar');
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Persona de prueba');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Correo enviado exitosamente');
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  expect(calls).toBe(2);
});

test('005: donación manual y entrada futura de sesión', async ({ page }, testInfo) => {
  await page.goto('/donar');
  await expect(
    page.locator('main').getByRole('heading', { name: 'Diezmos y Ofrendas' }),
  ).toBeVisible();
  await expect(page.locator('main img[src$="qr.png"]')).toBeAttached();
  await expect(page.locator('main form')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (testInfo.project.name === 'mobile') await page.locator('#menu-btn').click();
  await page.getByRole('link', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/acceso$/);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});
