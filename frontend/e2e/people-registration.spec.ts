import { expect, Page, test } from '@playwright/test';
import type { CreatePersonRequest } from '../src/app/features/members/members.models';
const id = '33333333-3333-4333-8333-333333333333';
async function registrationApi(
  page: Page,
  permissions = ['PERSON_VIEW', 'PERSON_CREATE'],
  multiple = false,
) {
  const state = {
    posts: 0,
    listReads: 0,
    status: 201,
    body: null as CreatePersonRequest | null,
    registered: false,
  };
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/auth/session')
      return route.fulfill({
        json: {
          userId: 'controlled',
          displayName: 'Registro controlado',
          grants: [
            { roleId: 'operator', roleCode: 'OPERATOR', branchId: 'a', permissions },
            ...(multiple
              ? [{ roleId: 'operator', roleCode: 'OPERATOR', branchId: 'b', permissions }]
              : []),
          ],
        },
      });
    if (path === '/api/v1/auth/csrf')
      return route.fulfill({ json: { token: 'controlled-csrf', headerName: 'X-XSRF-TOKEN' } });
    if (path === '/api/v1/people/registration-options')
      return route.fulfill({
        json: {
          branches: multiple
            ? [
                { id: 'a', name: 'Sede A' },
                { id: 'b', name: 'Sede B' },
              ]
            : [{ id: 'a', name: 'Sede A' }],
          countries: ['CO'],
          documentTypes: [{ code: 'CC', name: 'Cédula de Ciudadanía' }],
        },
      });
    const person = () => ({
      id,
      ...state.body?.person,
      isActive: true,
      branchId: state.body?.branchId ?? 'a',
      branchName: state.body?.branchId === 'b' ? 'Sede B' : 'Sede A',
      hasDocuments: true,
      documents: [{ id: 'document', ...state.body?.document, isCurrent: true, endedAt: null }],
      createdAt: '2026-11-07T14:00:00Z',
      updatedAt: '2026-11-07T14:00:00Z',
    });
    if (path === '/api/v1/people' && route.request().method() === 'POST') {
      expect(route.request().headers()['x-xsrf-token']).toBe('controlled-csrf');
      state.posts++;
      state.body = route.request().postDataJSON();
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (state.status !== 201)
        return route.fulfill({ status: state.status, json: { code: 'controlled_error' } });
      state.registered = true;
      return route.fulfill({ status: 201, json: person() });
    }
    if (path === '/api/v1/people') {
      state.listReads++;
      expect(permissions).toContain('PERSON_VIEW');
      return route.fulfill({
        json: {
          items: state.registered ? [person()] : [],
          pageNumber: 1,
          pageSize: 25,
          totalCount: state.registered ? 1 : 0,
          branches: [{ id: 'a', name: 'Sede A' }],
        },
      });
    }
    if (path === `/api/v1/people/${id}`) return route.fulfill({ json: person() });
    return route.fulfill({ status: 404, json: {} });
  });
  return state;
}
async function fillRegistration(page: Page) {
  await page.getByRole('combobox', { name: 'Tipo de documento *', exact: true }).click();
  await page.getByRole('option', { name: 'Cédula de Ciudadanía', exact: true }).click();
  await page.getByLabel('Número de documento *', { exact: true }).fill('000123');
  await page.getByLabel('Nombres *', { exact: true }).fill('Ángela María');
  await page.getByLabel('Apellidos *', { exact: true }).fill('De la Cruz');
  await page.getByLabel('Teléfono', { exact: true }).fill('5700123');
}
test('HU-002 solo digitos y formato de correo antes de guardar', async ({ page }) => {
  const state = await registrationApi(page);
  await page.goto('/gestion/miembros/registrar');
  await fillRegistration(page);
  for (const selector of ['#registration-number', '#registration-phone']) {
    const field = page.locator(selector);
    const original = await field.inputValue();
    await field.pressSequentially('abc-+ ');
    await expect(field).toHaveValue(original);
    const prevented = await field.evaluate((element) => {
      const data = new DataTransfer();
      data.setData('text', '12abc');
      const event = new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented).toBe(true);
  }
  const email = page.locator('#registration-email');
  await email.fill('correo-invalido');
  await email.blur();
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: 'Guardar persona', exact: true })).toBeDisabled();
  await email.fill('persona@example.com');
  await expect(page.getByRole('button', { name: 'Guardar persona', exact: true })).toBeEnabled();
  expect(state.posts).toBe(0);
});

test('HU-002 alta desde listado, documento textual y ficha', async ({ page }, testInfo) => {
  const state = await registrationApi(page);
  await page.goto('/gestion/miembros');
  await page.getByRole('link', { name: 'Registrar persona', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Registrar persona', exact: true });
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Estado inicial', { exact: false })).toHaveCount(0);
  await expect(
    modal.getByRole('combobox', { name: 'País del documento *', exact: true }),
  ).toHaveCount(0);
  await expect(modal.getByRole('button', { name: 'Guardar persona', exact: true })).toHaveAttribute(
    'form',
    'person-registration-form',
  );
  await expect(modal.locator('form button[type=submit]')).toHaveCount(0);
  const saveBox = await modal
    .getByRole('button', { name: 'Guardar persona', exact: true })
    .boundingBox();
  const cancelBox = await modal
    .getByRole('button', { name: 'Cancelar', exact: true })
    .boundingBox();
  expect(Math.abs(saveBox!.y - cancelBox!.y)).toBeLessThan(2);
  await expect(page.getByRole('button', { name: 'Guardar persona', exact: true })).toBeDisabled();
  await fillRegistration(page);
  await expect(page.getByRole('button', { name: 'Elegir fecha', exact: true })).toBeVisible();
  await expect(page.getByText(/Sede:\s*Sede A/)).toBeVisible();
  if (process.env['MLP_SKIP_VISUAL_ARTIFACTS'] !== '1')
    await page.screenshot({
      path: `artifacts/010-registration-${testInfo.project.name}.png`,
      fullPage: true,
    });
  const save = page.getByRole('button', { name: 'Guardar persona', exact: true });
  await modal.getByText('Los campos marcados con * son obligatorios.', { exact: true }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await save.dblclick();
  await expect(page.locator('p-toast')).toContainText('Persona registrada correctamente.');
  expect(state.posts).toBe(1);
  expect(state.body!.document.documentNumber).toBe('000123');
  expect(state.body!.document.issuingCountry).toBe('CO');
  expect(state.body!.person).not.toHaveProperty('isActive');
  expect(state.body!.person.phone).toBe('5700123');
  await expect(modal).toHaveCount(0);
  await page
    .getByRole('link', { name: 'Ver detalle de Ángela María De la Cruz', exact: true })
    .click();
  await expect(
    page
      .getByRole('dialog', { name: 'Ficha de persona', exact: true })
      .getByText('000123', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('dialog', { name: 'Ficha de persona', exact: true })
    .getByRole('button', { name: 'Cerrar', exact: true })
    .click();
  await expect(
    page
      .getByRole('region', { name: 'Listado de personas', exact: true })
      .getByText('Ángela María De la Cruz'),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('HU-002 duplicado conserva datos y cancelación confirma el borrador', async ({ page }) => {
  const state = await registrationApi(page);
  state.status = 409;
  await page.goto('/gestion/miembros/registrar');
  await fillRegistration(page);
  await page.getByRole('button', { name: 'Guardar persona', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo registrar la identificación');
  await expect(page.getByLabel('Nombres *', { exact: true })).toHaveValue('Ángela María');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(
    page.getByRole('alertdialog', { name: '¿Descartar el registro?', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Seguir registrando', exact: true }).click();
  await expect(page).toHaveURL(/registrar$/);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar y salir', exact: true }).click();
  await expect(page).toHaveURL(/\/gestion\/miembros$/);
  expect(state.registered).toBe(false);
});
test('HU-002 varias sedes exigen selección y solo crear no concede lectura', async ({ page }) => {
  const state = await registrationApi(page, ['PERSON_CREATE'], true);
  await page.goto('/gestion');
  await page.getByRole('link', { name: 'Registrar persona', exact: true }).click();
  await fillRegistration(page);
  await expect(page.getByRole('button', { name: 'Guardar persona', exact: true })).toBeDisabled();
  await page.getByRole('combobox', { name: 'Sede *', exact: true }).click();
  await page.getByRole('option', { name: 'Sede B', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar persona', exact: true }).click();
  await expect(page.getByText('Persona registrada correctamente.')).toBeVisible();
  expect(state.body!.branchId).toBe('b');
  expect(state.listReads).toBe(0);
  await expect(page.getByRole('link', { name: 'Consultar ficha' })).toHaveCount(0);
  await page.goto('/gestion/miembros');
  await expect(page).toHaveURL(/sin-acceso/);
});
test('HU-002 sin permiso no muestra acción ni permite ruta directa', async ({ page }) => {
  await registrationApi(page, ['PERSON_VIEW']);
  await page.goto('/gestion/miembros');
  await expect(page.getByRole('link', { name: 'Registrar persona' })).toHaveCount(0);
  await page.goto('/gestion/miembros/registrar');
  await expect(page).toHaveURL(/sin-acceso/);
});
