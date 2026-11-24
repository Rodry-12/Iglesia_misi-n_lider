import { expect, test } from '@playwright/test';
// Opt-in fixture supplies ephemeral credentials and a loopback API backed by isolated PostgreSQL.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
// Playwright can capture an ARIA snapshot even with tracing disabled. Clear sensitive
// form values before context teardown, including a failed/pending login.
test.afterEach(async ({ page }) => {
  if (!page.isClosed())
    await page
      .locator('input[autocomplete="current-password"], input[autocomplete="username"]')
      .evaluateAll((inputs) => {
        for (const input of inputs) (input as HTMLInputElement).value = '';
      });
});

test('HU-008/009 real: asignación y seguimiento, API HTTPS y PostgreSQL aislado', async ({
  page,
}, info) => {
  test.skip(process.env['MLP_PEOPLE_REAL'] !== '1', 'Requires isolated .NET fixture');
  await page.goto('/acceso');
  await page
    .getByLabel('Correo electrónico', { exact: true })
    .fill(process.env['MLP_ASSIGN_EMAIL']!);
  await page.getByLabel('Contraseña', { exact: true }).fill(process.env['MLP_PEOPLE_PASSWORD']!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/gestion$/);
  await page.goto('/gestion/formacion/asignar');
  await page
    .getByLabel('Buscar participante', { exact: true })
    .fill(process.env['MLP_ASSIGN_PARTICIPANT_DOCUMENT']!);
  await expect(page.getByText('Página 1 · 1 resultados', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Participante *', exact: true }).click();
  await page.getByRole('option', { name: /^HU008 Participante/ }).click();
  await expect(
    page.getByText('TEST ' + process.env['MLP_ASSIGN_PARTICIPANT_DOCUMENT'], { exact: true }),
  ).toBeVisible();
  await page.getByRole('combobox', { name: 'Categoría *', exact: true }).click();
  await page
    .getByRole('option', { name: process.env['MLP_ASSIGN_CATEGORY']!, exact: true })
    .click();
  await page.getByRole('combobox', { name: 'Proceso *', exact: true }).click();
  await page.getByRole('option', { name: 'HU008 ' + info.project.name, exact: true }).click();
  await page.getByRole('button', { name: 'Guardar asignación', exact: true }).click();
  await expect(
    page.getByText('Selecciona participante, categoría, proceso y responsable.', { exact: true }),
  ).toBeVisible();
  const responsibleSearch = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname.endsWith('/people-options') &&
      new URL(r.url()).searchParams.get('search') ===
        process.env['MLP_ASSIGN_RESPONSIBLE_DOCUMENT'],
  );
  await page
    .getByLabel('Buscar responsable', { exact: true })
    .fill(process.env['MLP_ASSIGN_RESPONSIBLE_DOCUMENT']!);
  expect((await responsibleSearch).status()).toBe(200);
  await page.getByRole('combobox', { name: 'Responsable *', exact: true }).click();
  await page.getByRole('option', { name: /^HU008 Responsable/ }).click();
  const created = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/v1/process-assignments' &&
      r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Guardar asignación', exact: true }).click();
  const response = await created;
  expect(response.status(), await response.text()).toBe(201);
  const assignment = await response.json();
  expect(assignment.stateCode).toBe('PENDING');
  expect(assignment.startedAt).toBeNull();
  expect(assignment.finishedAt).toBeNull();
  await expect(page.getByText('Asignación guardada correctamente.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Consultar asignación', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/asignaciones/' + assignment.id + '$'));
  await page.getByText('Información técnica', { exact: true }).click();
  await expect(page.getByText(assignment.id, { exact: true })).toBeVisible();
  await page.reload();
  await page.getByText('Información técnica', { exact: true }).click();
  await expect(page.getByText(assignment.id, { exact: true })).toBeVisible();
  const listRead = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/v1/process-assignments' && r.request().method() === 'GET',
  );
  await page.getByRole('link', { name: 'Volver al seguimiento', exact: true }).click();
  const listResponse = await listRead;
  expect(listResponse.status()).toBe(200);
  const list = await listResponse.json();
  expect(list.items.some((row: { id: string }) => row.id === assignment.id)).toBe(true);
  let ministerialWrites = 0;
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/v1/process-assignments') && r.method() !== 'GET')
      ++ministerialWrites;
  });
  await page
    .getByLabel('Buscar participante', { exact: true })
    .fill(process.env['MLP_ASSIGN_PARTICIPANT_DOCUMENT']!);
  await expect
    .poll(() => new URL(page.url()).searchParams.get('search'))
    .toBe(process.env['MLP_ASSIGN_PARTICIPANT_DOCUMENT']);
  await page.getByRole('combobox', { name: 'Categoría', exact: true }).click();
  await page
    .getByRole('option', { name: process.env['MLP_ASSIGN_CATEGORY']!, exact: true })
    .click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get('categoryId'))
    .toBe(list.items[0].categoryId);
  await page.getByRole('combobox', { name: 'Proceso', exact: true }).click();
  await page.getByRole('option', { name: 'HU008 ' + info.project.name, exact: true }).click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get('processId'))
    .toBe(assignment.processId);
  await expect(page.getByText('1 asignaciones encontradas', { exact: true })).toBeVisible();
  const entry =
    info.project.name === 'desktop'
      ? page.getByRole('row').filter({ hasText: 'HU008 Participante' })
      : page.getByRole('article').filter({ hasText: 'HU008 Participante' });
  await expect(entry).toContainText(process.env['MLP_ASSIGN_PARTICIPANT_DOCUMENT']!);
  await expect(entry).toContainText('HU008 Responsable');
  await expect(entry).toContainText('Sin iniciar');
  await entry.getByRole('link', { name: 'Ver detalle de HU008 Participante', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Detalle de asignación', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('HU008 Responsable', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('HU008 Participante', { exact: true })).toBeVisible();
  await expect(page.getByText('Sin finalizar', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Volver al seguimiento', exact: true }).click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get('processId'))
    .toBe(assignment.processId);
  await expect(page.getByLabel('Buscar participante', { exact: true })).toHaveValue(
    process.env['MLP_ASSIGN_PARTICIPANT_DOCUMENT']!,
  );
  expect(ministerialWrites).toBe(0);
  if (process.env['MLP_ASSIGN_RESPONSIBLE_REAL'] === '1') {
    const baselineRead = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === `/api/v1/process-assignments/${assignment.id}` &&
        r.request().method() === 'GET',
    );
    await entry
      .getByRole('link', { name: 'Ver detalle de HU008 Participante', exact: true })
      .click();
    const baseline = await (await baselineRead).json();
    const optionsRead = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname.endsWith('/responsible-options') &&
        new URL(r.url()).searchParams.get('search') ===
          process.env['MLP_ASSIGN_REPLACEMENT_DOCUMENT'],
    );
    await page
      .getByLabel('Buscar nuevo responsable', { exact: true })
      .fill(process.env['MLP_ASSIGN_REPLACEMENT_DOCUMENT']!);
    const candidates = await (await optionsRead).json();
    expect(candidates.totalCount).toBe(1);
    const candidate = candidates.items[0];
    expect(candidate.documentNumber).toBe(process.env['MLP_ASSIGN_REPLACEMENT_DOCUMENT']);
    await page.getByRole('combobox', { name: 'Nuevo responsable *', exact: true }).click();
    await page.getByRole('option', { name: /^HU011 Relevo/ }).click();
    await page.getByRole('button', { name: 'Guardar responsable', exact: true }).click();
    await expect(
      page.getByRole('alertdialog', { name: '¿Cambiar el responsable?', exact: true }),
    ).toContainText('HU008 Responsable');
    await expect(
      page.getByRole('alertdialog', { name: '¿Cambiar el responsable?', exact: true }),
    ).toContainText('HU011 Relevo');
    await page.getByRole('button', { name: 'Cancelar cambio', exact: true }).click();
    expect(ministerialWrites).toBe(0);
    await page.getByRole('button', { name: 'Guardar responsable', exact: true }).click();
    const updatedRead = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === `/api/v1/process-assignments/${assignment.id}` &&
        r.request().method() === 'GET',
    );
    const update = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname.endsWith(`/${assignment.id}/responsible`) &&
        r.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: 'Confirmar responsable', exact: true }).click();
    const response = await update;
    expect(response.status()).toBe(200);
    const updated = await (await updatedRead).json();
    expect(updated.responsiblePersonId).toBe(candidate.id);
    for (const key of [
      'id',
      'personId',
      'processId',
      'categoryId',
      'branchId',
      'stateCode',
      'assignedAt',
      'startedAt',
      'finishedAt',
    ])
      expect(updated[key]).toBe(baseline[key]);
    await expect(
      page.getByText('Responsable actualizado correctamente.', { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByText('HU011 Relevo', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('link', { name: 'Volver al seguimiento', exact: true }).click();
    await expect(entry).toContainText('HU011 Relevo');
    await page.reload();
    await expect(entry).toContainText('HU011 Relevo');
    expect(ministerialWrites).toBe(1);
  }
  const stateWriteBaseline = ministerialWrites;
  if (process.env['MLP_ASSIGN_STATE_REAL'] === '1') {
    const transitionRead = () =>
      page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === '/api/v1/process-assignments/states' &&
          new URL(r.url()).searchParams.get('assignmentId') === assignment.id,
      );
    const initialTransitions = transitionRead();
    const baselineRead = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === `/api/v1/process-assignments/${assignment.id}` &&
        r.request().method() === 'GET',
    );
    await entry
      .getByRole('link', { name: 'Ver detalle de HU008 Participante', exact: true })
      .click();
    const options = await (await initialTransitions).json();
    const baseline = await (await baselineRead).json();
    const start = options.find((s: { code: string }) => s.code === 'IN_PROGRESS');
    expect(start).toBeTruthy();
    await page.getByRole('combobox', { name: 'Nuevo estado *', exact: true }).click();
    await page.getByRole('option', { name: start.name, exact: true }).click();
    await page.getByRole('button', { name: 'Guardar estado', exact: true }).click();
    const progressWrite = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === `/api/v1/process-assignments/${assignment.id}/state` &&
        r.request().method() === 'PUT',
    );
    const afterStartOptions = transitionRead();
    await page.getByRole('button', { name: 'Confirmar cambio', exact: true }).click();
    const progressResponse = await progressWrite;
    expect(progressResponse.status()).toBe(200);
    const progress = await progressResponse.json();
    expect(progress.startedAt).toBeTruthy();
    expect(progress.finishedAt).toBeNull();
    const destinations = await (await afterStartOptions).json();
    const complete = destinations.find((s: { code: string }) => s.code === 'COMPLETED');
    expect(complete.isFinal).toBe(true);
    await page.getByRole('combobox', { name: 'Nuevo estado *', exact: true }).click();
    await page.getByRole('option', { name: complete.name, exact: true }).click();
    await page.getByRole('button', { name: 'Guardar estado', exact: true }).click();
    await page.getByRole('button', { name: 'Cancelar cambio', exact: true }).click();
    expect(ministerialWrites).toBe(stateWriteBaseline + 1);
    await expect(page.getByText('Sin finalizar', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Guardar estado', exact: true }).click();
    const finalWrite = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === `/api/v1/process-assignments/${assignment.id}/state` &&
        r.request().method() === 'PUT',
    );
    const finalOptions = transitionRead();
    await page.getByRole('button', { name: 'Confirmar finalización', exact: true }).click();
    const finalResponse = await finalWrite;
    expect(finalResponse.status()).toBe(200);
    const final = await finalResponse.json();
    expect(final.stateCode).toBe('COMPLETED');
    expect(final.startedAt).toBe(progress.startedAt);
    expect(Date.parse(final.finishedAt)).toBeGreaterThanOrEqual(Date.parse(final.startedAt));
    for (const key of [
      'id',
      'personId',
      'responsiblePersonId',
      'processId',
      'branchId',
      'assignedAt',
    ])
      expect(final[key]).toBe(baseline[key]);
    expect(await (await finalOptions).json()).toEqual([]);
    await expect(
      page.getByText('No hay cambios de estado disponibles para esta asignación.', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar estado', exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: 'Volver al seguimiento', exact: true }).click();
    await expect(entry).toContainText(complete.name);
    await page.reload();
    await expect(entry).toContainText(complete.name);
    expect(ministerialWrites).toBe(stateWriteBaseline + 2);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Menú de cuenta', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/acceso$/);
});

test('HU-007 real: categorías y procesos con API HTTPS y PostgreSQL aislado', async ({ page }) => {
  test.skip(process.env['MLP_PEOPLE_REAL'] !== '1', 'Requires isolated .NET fixture');
  await page.goto('/acceso');
  await page
    .getByLabel('Correo electrónico', { exact: true })
    .fill(process.env['MLP_CATALOG_EMAIL']!);
  await page.getByLabel('Contraseña', { exact: true }).fill(process.env['MLP_PEOPLE_PASSWORD']!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/gestion$/);
  await page.goto('/gestion/formacion');
  const name = 'Navegador ' + crypto.randomUUID();
  await page.goto('/gestion/formacion/categorias');
  await page.locator('main').getByRole('link', { name: 'Crear categoría', exact: true }).click();
  await page.getByLabel('Nombre *', { exact: true }).fill(name);
  await page.getByLabel('Descripción', { exact: true }).fill('Descripción de prueba controlada');
  const createCategory = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/v1/process-categories' && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Guardar categoría', exact: true }).click();
  const response = await createCategory;
  expect(response.status()).toBe(201);
  const category = await response.json();
  await page.getByRole('link', { name: 'Ver categoría ' + name, exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Detalle de categoría', exact: true }),
  ).toContainText(name);
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('link', { name: 'Editar categoría ' + name, exact: true }).click();
  await expect(page.getByLabel('Nombre *', { exact: true })).toHaveValue(name);
  await page.getByLabel('Nombre *', { exact: true }).fill(name + ' editada');
  const editCategory = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/v1/process-categories/' + category.id &&
      r.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Guardar categoría', exact: true }).click();
  const categoryUpdate = await editCategory;
  expect(categoryUpdate.status(), await categoryUpdate.text()).toBe(200);
  await page.getByRole('link', { name: 'Ver categoría ' + name + ' editada', exact: true }).click();
  await expect(page.getByRole('heading', { name: name + ' editada', exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page
    .getByRole('button', { name: 'Desactivar categoría ' + name + ' editada', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirmar desactivación', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: name + ' editada' })).toContainText(
    'Inactiva',
  );
  await page
    .getByRole('button', { name: 'Activar categoría ' + name + ' editada', exact: true })
    .click();
  await expect(page.getByRole('row').filter({ hasText: name + ' editada' })).toContainText(
    'Activa',
  );
  await page.goto('/gestion/formacion/procesos');
  await page.locator('main').getByRole('link', { name: 'Crear proceso', exact: true }).click();
  await page.getByRole('combobox', { name: 'Categoría *', exact: true }).click();
  await page.getByRole('option', { name: name + ' editada', exact: true }).click();
  await page.getByLabel('Nombre *', { exact: true }).fill(name + ' proceso');
  const createProcess = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/v1/processes' && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Guardar proceso', exact: true }).click();
  const processResponse = await createProcess;
  expect(processResponse.status()).toBe(201);
  const createdProcess = await processResponse.json();
  expect(createdProcess.categoryId).toBe(category.id);
  await page.getByRole('link', { name: 'Ver proceso ' + name + ' proceso', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Detalle de proceso', exact: true })).toContainText(
    name + ' proceso',
  );
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page
    .getByRole('link', { name: 'Editar proceso ' + name + ' proceso', exact: true })
    .click();
  await page.getByLabel('Descripción', { exact: true }).fill('Proceso actualizado');
  const editProcess = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/v1/processes/' + createdProcess.id &&
      r.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Guardar proceso', exact: true }).click();
  const processUpdate = await editProcess;
  expect(processUpdate.status(), await processUpdate.text()).toBe(200);
  await page.getByRole('link', { name: 'Ver proceso ' + name + ' proceso', exact: true }).click();
  await expect(page.getByText('Proceso actualizado', { exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page
    .getByRole('button', { name: 'Desactivar proceso ' + name + ' proceso', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirmar desactivación', exact: true }).click();
  await expect(page.getByText('Inactivo', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Ver proceso ' + name + ' proceso', exact: true }).click();
  await expect(
    page.getByText('Este proceso no está disponible para nuevas asignaciones.', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole('dialog')).toContainText('Inactivo');
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page
    .getByRole('button', { name: 'Activar proceso ' + name + ' proceso', exact: true })
    .click();
  await expect(page.getByText('Activo', { exact: true })).toBeVisible();
  await page.goto('/gestion/formacion/categorias');
  await page.getByLabel('Buscar categoría', { exact: true }).fill(name);
  await expect.poll(() => new URL(page.url()).searchParams.get('categorySearch')).toBe(name);
  await page
    .getByRole('button', { name: 'Ver procesos de ' + name + ' editada', exact: true })
    .click();
  await expect(
    page.getByRole('link', { name: 'Ver proceso ' + name + ' proceso', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Menú de cuenta', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/acceso$/);
});
test('HU-002/003/004 reales: navegador -> API HTTPS -> PostgreSQL aislado', async ({ page }) => {
  test.skip(
    process.env['MLP_PEOPLE_REAL'] !== '1',
    'Requires isolated .NET fixture; never use production credentials',
  );
  const email = process.env['MLP_PEOPLE_EMAIL'];
  const password = process.env['MLP_PEOPLE_PASSWORD'];
  expect(!!email && !!password).toBe(true);
  await page.goto('/acceso');
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email!);
  await page.getByLabel('Contraseña', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/gestion$/);
  await page.goto('/gestion/miembros');
  await page.getByRole('link', { name: 'Registrar persona', exact: true }).click();
  await page.getByLabel('Tipo de documento *', { exact: true }).fill('cc');
  const number = '000' + crypto.randomUUID().replaceAll('-', '').toUpperCase();
  await page.getByLabel('Número de documento *', { exact: true }).fill(number);
  await page.getByLabel('Nombres *', { exact: true }).fill('Ángela Browser');
  await page.getByLabel('Apellidos *', { exact: true }).fill('Prueba aislada');
  await page.getByLabel('Teléfono', { exact: true }).fill('+57 001234');
  await page
    .getByLabel('Correo electrónico', { exact: true })
    .fill('browser-person@example.invalid');
  const post = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/v1/people' && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Guardar persona', exact: true }).click();
  const createdResponse = await post;
  expect(createdResponse.status()).toBe(201);
  const created = await createdResponse.json();
  await expect(page.getByText('Persona registrada correctamente.')).toBeVisible();
  await page.getByRole('link', { name: 'Consultar ficha', exact: true }).click();
  await expect(page.getByText(number, { exact: true })).toBeVisible();
  await expect(page.getByText('+57 001234', { exact: true })).toBeVisible();
  await expect(page.getByText('browser-person@example.invalid', { exact: true })).toBeVisible();
  await expect(page.getByText('Activo', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(number, { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Volver al listado' }).click();
  await page.getByLabel('Buscar persona', { exact: true }).fill(number);
  await expect.poll(() => new URL(page.url()).searchParams.get('search')).toBe(number);
  await expect(page.getByText('CC ' + number, { exact: true })).toBeVisible();
  await page
    .getByRole('row')
    .filter({ hasText: 'CC ' + number })
    .getByRole('link', { name: /Ver detalle de/ })
    .click();
  await expect(page).toHaveURL(new RegExp('/miembros/' + created.id + '(\\?|$)'));
  const snapshotResponse = await page.request.get('/api/v1/people/' + created.id);
  expect(snapshotResponse.status()).toBe(200);
  const before = await snapshotResponse.json();
  await page.getByRole('link', { name: 'Editar persona', exact: true }).click();
  await expect(page.getByLabel('Nombres *', { exact: true })).toHaveValue('Ángela Browser');
  await expect(page.getByRole('button', { name: 'Guardar cambios', exact: true })).toBeDisabled();
  await expect(page.getByText(number, { exact: true })).toBeVisible();
  await page.getByLabel('Nombres *', { exact: true }).fill('Ángela actualizada');
  await page.getByLabel('Teléfono', { exact: true }).fill('+57 009988');
  await page.getByLabel('Correo electrónico', { exact: true }).fill('edited@example.invalid');
  const put = page.waitForResponse(
    (r) =>
      r.request().method() === 'PUT' && new URL(r.url()).pathname === '/api/v1/people/' + before.id,
  );
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  const result = await put;
  expect(result.status()).toBe(200);
  const updated = await result.json();
  expect(updated.id).toBe(before.id);
  expect(updated.branchId).toBe(before.branchId);
  expect(updated.isActive).toBe(before.isActive);
  expect(updated.createdAt).toBe(before.createdAt);
  expect(updated.documents).toEqual(before.documents);
  expect(updated.updatedAt).not.toBe(before.updatedAt);
  await expect(page.getByText('Cambios guardados correctamente.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Volver al detalle', exact: true }).click();
  await expect(page.getByText('Ángela actualizada', { exact: true })).toBeVisible();
  await expect(page.getByText('+57 009988', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('edited@example.invalid', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Volver al listado', exact: true }).click();
  await expect(page.getByLabel('Buscar persona', { exact: true })).toHaveValue(number);
  await expect(page.getByText('Ángela actualizada Prueba aislada', { exact: true })).toBeVisible();
  await page
    .getByRole('row')
    .filter({ hasText: 'CC ' + number })
    .getByRole('link', { name: /Ver detalle de/ })
    .click();
  await expect(page.getByText(number, { exact: true })).toBeVisible();
  const statePath = '/api/v1/people/' + created.id + '/active';
  await page
    .getByRole('button', { name: 'Desactivar a Ángela actualizada Prueba aislada', exact: true })
    .click();
  await expect(
    page.getByRole('alertdialog', { name: '¿Desactivar persona?', exact: true }),
  ).toBeVisible();
  const disable = page.waitForResponse(
    (r) => new URL(r.url()).pathname === statePath && r.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Confirmar desactivación', exact: true }).click();
  expect((await disable).status()).toBe(204);
  await expect(page.getByText('Desactivación confirmada.', { exact: true })).toBeVisible();
  await expect(page.getByText('Inactivo', { exact: true })).toBeVisible();
  const disabled = await (await page.request.get('/api/v1/people/' + created.id)).json();
  expect(disabled.id).toBe(created.id);
  expect(disabled.branchId).toBe(before.branchId);
  expect(disabled.documents).toEqual(before.documents);
  expect(disabled.isActive).toBe(false);
  await page.reload();
  await expect(page.getByText('Inactivo', { exact: true })).toBeVisible();
  const enable = page.waitForResponse(
    (r) => new URL(r.url()).pathname === statePath && r.request().method() === 'PUT',
  );
  await page
    .getByRole('button', { name: 'Activar a Ángela actualizada Prueba aislada', exact: true })
    .click();
  expect((await enable).status()).toBe(204);
  await expect(page.getByText('Activación confirmada.', { exact: true })).toBeVisible();
  await expect(page.getByText('Activo', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Volver al listado' }).click();
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: 'CC ' + number })
      .getByText('Activo', { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Menú de cuenta', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/acceso$/);
  await expect(page.getByText(number, { exact: true })).toHaveCount(0);
});
