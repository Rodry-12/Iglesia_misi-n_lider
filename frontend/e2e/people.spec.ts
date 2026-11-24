import { expect, Page, test } from '@playwright/test';

const id = '11111111-1111-4111-8111-111111111111';
const unknown = '22222222-2222-4222-8222-222222222222';
const person = {
  id,
  firstNames: 'Ana',
  lastNames: 'Consulta',
  phone: '3001234567',
  email: 'person@example.invalid',
  birthDate: '1990-01-01',
  isActive: true,
  branchId: 'a',
  branchName: 'Sede A',
  hasDocuments: true,
  documents: [
    {
      id: 'd',
      documentType: 'CC',
      documentNumber: '123456',
      issuingCountry: 'CO',
      isCurrent: true,
      endedAt: null,
    },
  ],
  createdAt: '2026-11-07T14:00:00Z',
  updatedAt: '2026-11-07T15:00:00Z',
};

async function controlledApi(page: Page, permission = true) {
  const state = {
    expired: false,
    unavailable: false,
    oldDocuments: false,
    missingDocuments: false,
  };
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/api/v1/auth/session')
      return route.fulfill({
        status: 200,
        json: {
          userId: 'controlled-user',
          displayName: 'Consulta controlada',
          grants: [
            {
              roleId: 'operator',
              roleCode: 'OPERATOR',
              branchId: 'a',
              permissions: permission ? ['PERSON_VIEW'] : ['PROCESS_VIEW'],
            },
          ],
        },
      });
    if (path === '/api/v1/people' || path.startsWith('/api/v1/people/')) {
      if (state.expired) return route.fulfill({ status: 401, json: {} });
      if (state.unavailable) return route.fulfill({ status: 503, json: {} });
      if (url.searchParams.get('branchId') === 'foreign')
        return route.fulfill({ status: 403, json: {} });
      if (path.endsWith(unknown)) return route.fulfill({ status: 404, json: {} });
      const item = {
        ...person,
        hasDocuments: !state.missingDocuments,
        documents: state.missingDocuments
          ? []
          : state.oldDocuments
            ? [{ ...person.documents[0], isCurrent: false }]
            : person.documents,
      };
      if (path !== '/api/v1/people') return route.fulfill({ status: 200, json: item });
      const search = url.searchParams.get('search') ?? '';
      const pageNumber = Number(url.searchParams.get('page') ?? 1);
      return route.fulfill({
        status: 200,
        json: {
          items: search === 'nadie' || pageNumber > 1 ? [] : [item],
          pageNumber,
          pageSize: Number(url.searchParams.get('pageSize') ?? 25),
          totalCount: search === 'nadie' ? 0 : 30,
          branches: [{ id: 'a', name: 'Sede A' }],
        },
      });
    }
    return route.fulfill({ status: 404, json: {} }); // Never contact the configured proxy/API.
  });
  return state;
}

test('HU-001 listado compacto, búsqueda, filtros, paginación y ficha', async ({
  page,
}, testInfo) => {
  await controlledApi(page);
  await page.goto('/gestion/miembros');
  await expect(page.getByRole('heading', { name: 'Gestión de Personas' })).toBeVisible();
  await expect(page.locator('thead th')).toHaveText([
    'Documento',
    'Persona',
    'Sede',
    'Estado',
    'Acciones',
  ]);
  await expect(page.getByText('Ana Consulta', { exact: true })).toBeVisible();
  await expect(page.getByText('person@example.invalid')).toHaveCount(0);
  if (process.env['MLP_SKIP_VISUAL_ARTIFACTS'] !== '1')
    await page.screenshot({
      path: `artifacts/009-list-${testInfo.project.name}.png`,
      fullPage: true,
    });
  await page.getByLabel('Buscar persona').fill('nadie');
  await expect(page).toHaveURL(/search=nadie/);
  await expect(page.getByText('No se encontraron personas con estos filtros.')).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar búsqueda', exact: true }).click();
  await expect(page).not.toHaveURL(/search=/);
  await page.getByRole('combobox', { name: 'Estado', exact: true }).click();
  await page.getByRole('option', { name: 'Inactivo', exact: true }).click();
  await expect(page).toHaveURL(/isActive=false/);
  await expect(page).toHaveURL(/page=1/);
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('app-table-pagination [aria-current=page]')).toHaveText('Página 2');
  await page.getByLabel('Buscar persona').fill('Ana');
  await expect(page).toHaveURL(/page=1/);
  const link = page.getByRole('link', { name: 'Ver detalle de Ana Consulta' });
  await link.scrollIntoViewIfNeeded();
  await link.click();
  await expect(page.getByRole('dialog', { name: 'Ficha de persona', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/miembros\?/);
  await page.goto('/gestion/miembros/' + id + '?search=Ana&page=1');
  await page.reload();
  await expect(page.getByText('person@example.invalid')).toBeVisible();
  await expect(page.getByRole('dialog').locator('dt').first()).toHaveText('Tipo de documento');
  await expect(page.getByRole('dialog').locator('dt').nth(1)).toHaveText('Número de documento');
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Identificación', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText('01/01/1990')).toBeVisible();
  await expect(page.getByText(id, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog').getByText('País emisor', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Información del sistema' })).toHaveCount(0);
  await expect(page.getByRole('dialog').locator('input')).toHaveCount(0);
  if (process.env['MLP_SKIP_VISUAL_ARTIFACTS'] !== '1')
    await page.screenshot({
      path: `artifacts/009-detail-${testInfo.project.name}.png`,
      fullPage: true,
    });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(page).toHaveURL(/miembros\?/);
  await expect(page).toHaveURL(/search=Ana/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('HU-001 documentos antiguos, errores recuperables y sesión expirada', async ({ page }) => {
  const state = await controlledApi(page);
  state.missingDocuments = true;
  await page.goto('/gestion/miembros');
  await expect(page.getByText('Documento pendiente de regularización')).toBeVisible();
  state.missingDocuments = false;
  state.oldDocuments = true;
  await page.reload();
  await expect(page.getByText('Sin documento vigente')).toBeVisible();
  state.unavailable = true;
  await page.reload();
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  state.unavailable = false;
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByText('Ana Consulta')).toBeVisible();
  await page.goto(`/gestion/miembros/${unknown}`);
  await expect(page.getByText('Persona no encontrada.')).toBeVisible();
  state.expired = true;
  await page.goto('/gestion/miembros');
  await expect(page).toHaveURL(/\/acceso/);
  await expect(page.getByText('Ana Consulta')).toHaveCount(0);
});

test('HU-001 permiso y filtro manipulado no amplían acceso', async ({ page }) => {
  await controlledApi(page);
  await page.goto('/gestion/miembros?branchId=foreign');
  await expect(page).toHaveURL(/miembros\?branchId=foreign/);
  await expect(page.locator('p-toast')).toContainText(
    'No tienes permiso para consultar esta sede.',
  );
});
test('HU-001 acceso directo sin PERSON_VIEW se rechaza', async ({ page }) => {
  await controlledApi(page, false);
  await page.goto(`/gestion/miembros/${id}`);
  await expect(page).toHaveURL(/sin-acceso/);
});
