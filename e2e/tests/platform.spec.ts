import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import type { CanvasDocument } from '../../frontend/src/types';

const backendUrl = 'http://127.0.0.1:8001';
const lastDocumentKey = 'omnicanvas:last-document';

async function openProject(page: Page, request: APIRequestContext, name: string, data: Record<string, unknown> = {}) {
  const response = await request.post(`${backendUrl}/api/canvases`, { data: { name, data } });
  expect(response.status()).toBe(201);
  const document = await response.json() as CanvasDocument;
  await page.addInitScript(({ id, key }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, id);
  }, { id: document.id, key: lastDocumentKey });
  await page.goto('/');
  await expect(page.locator('.project-name-display')).toHaveText(name);
  return document;
}

async function rename(page: Page, name: string) {
  await page.locator('.rename-trigger').click();
  await page.locator('.nav-name-input').fill(name);
  await page.locator('.nav-name-input').press('Enter');
}

test('requirements inventory exposes source gaps, searchable outlines, and all delivery phases', async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  const response = await request.get(`${backendUrl}/api/requirements`, { timeout: 120_000 });
  expect(response.ok()).toBeTruthy();
  const summary = await response.json();
  expect(summary.topic_count).toBeGreaterThan(0);
  expect(summary.phases).toHaveLength(6);
  expect(summary.sources.find((source: { id: string }) => source.id === 'miro').status).toBe('missing');
  await openProject(page, request, 'Requirements browser test');
  await page.getByRole('button', { name: 'Requirements', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Requirements & delivery' });
  await expect(dialog.getByText('captured topics', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/not a claim of full product parity/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Sources & topics', exact: true }).click();
  await expect(dialog.locator('.source-card').filter({ hasText: 'Miro' })).toContainText('missing');
  await expect(dialog.locator('.source-card').filter({ hasText: 'Framer' })).toContainText('landing only');
  await dialog.getByLabel('Requirement source').selectOption('penpot');
  await dialog.getByLabel('Search requirements').fill('flexible layouts');
  const topic = dialog.locator('.topic-list details').filter({ hasText: /^Flexible Layoutspenpot/ }).first();
  await expect(topic).toBeVisible();
  await topic.locator('summary').click();
  await expect(topic.getByText('Flex Layout', { exact: true })).toBeVisible();
  await expect(topic.getByRole('link', { name: 'Open original source' })).toHaveAttribute('href', /help\.penpot\.app/);
  await page.screenshot({ path: testInfo.outputPath('requirements.png') });
  await dialog.getByRole('button', { name: 'Delivery phases', exact: true }).click();
  await expect(dialog.locator('.phase-list h3')).toHaveCount(6);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Requirements', exact: true })).toBeFocused();
});

test('frame auto layout reflows children and persists its controls', async ({ page, request }, testInfo) => {
  const document = await openProject(page, request, 'Flexible layout test', {
    artboards: [{ id: 'frame', name: 'Layout frame', x: 100, y: 100, width: 300, height: 300 }],
    elements: [
      { id: 'first', type: 'rect', name: 'First child', x: 130, y: 140, width: 60, height: 40, artboardId: 'frame', zIndex: 1 },
      { id: 'second', type: 'circle', name: 'Second child', x: 190, y: 140, width: 60, height: 40, artboardId: 'frame', zIndex: 2 },
    ],
  });
  await page.locator('.layer-row').filter({ hasText: 'Layout frame' }).click();
  await page.getByLabel('Enable auto layout').check();
  await page.getByLabel('Gap', { exact: true }).fill('10');
  await page.getByLabel('Padding', { exact: true }).fill('20');
  await page.getByLabel('Direction', { exact: true }).selectOption('column');
  await page.getByLabel('Align items', { exact: true }).selectOption('center');
  await expect(page.locator('.save-badge')).toContainText('Saved (SQLite)');
  const saved = await (await request.get(`${backendUrl}/api/canvases/${document.id}`)).json();
  expect(saved.data.elements[0]).toMatchObject({ x: 220, y: 120 });
  expect(saved.data.elements[1]).toMatchObject({ x: 220, y: 170 });
  expect(saved.data.artboards[0].autoLayout).toMatchObject({ enabled: true, gap: 10, padding: 20, direction: 'column' });
  await page.screenshot({ path: testInfo.outputPath('layout.png') });
  await page.reload();
  await page.locator('.layer-row').filter({ hasText: 'Layout frame' }).click();
  await expect(page.getByLabel('Enable auto layout')).toBeChecked();
  await expect(page.getByLabel('Direction', { exact: true })).toHaveValue('column');
});

test('named versions restore a document and retain the replaced server state', async ({ page, request }) => {
  const document = await openProject(page, request, 'Version original', {
    elements: [{ id: 'note', type: 'sticky', text: 'Original thought', name: 'Original note' }],
  });
  await page.getByRole('button', { name: 'Versions', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Version history' });
  await dialog.getByLabel('Checkpoint name').fill('Approved layout');
  await dialog.getByRole('button', { name: 'Save version', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Approved layout', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await rename(page, 'Version edited');
  await expect(page.locator('.save-badge')).toContainText('Saved (SQLite)');
  await page.getByRole('button', { name: 'Versions', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Version history' });
  const version = dialog.locator('.platform-card').filter({ hasText: 'Approved layout' });
  page.once('dialog', async confirmation => { await confirmation.accept(); });
  await version.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(page.locator('.project-name-display')).toHaveText('Version original');
  await expect(dialog.getByRole('heading', { name: 'Before restoring: Approved layout', exact: true })).toBeVisible();
  const versions = await (await request.get(`${backendUrl}/api/canvases/${document.id}/versions`)).json();
  expect(versions).toHaveLength(2);
});

test('JSON import creates a new identity rather than overwriting the exported project', async ({ page, request }) => {
  const original = await openProject(page, request, 'Do not overwrite this project');
  await page.getByLabel('Import project JSON').setInputFiles({
    name: 'import.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...original, name: 'Imported project', data: { elements: [{ id: 'imported-note', type: 'sticky', text: 'Imported thought' }] } })),
  });
  await expect(page.locator('.project-name-display')).toHaveText('Imported project');
  await expect(page.locator('.sticky-group')).toHaveCount(1);
  const preserved = await (await request.get(`${backendUrl}/api/canvases/${original.id}`)).json();
  expect(preserved.name).toBe(original.name);
  expect(preserved.revision).toBe(0);
  const projects = await (await request.get(`${backendUrl}/api/canvases`)).json();
  const imported = projects.find((item: { name: string }) => item.name === 'Imported project');
  expect(imported.id).not.toBe(original.id);
  await page.reload();
  await expect(page.locator('.project-name-display')).toHaveText('Imported project');
});

test('invalid JSON imports leave the current document unchanged', async ({ page, request }) => {
  const original = await openProject(page, request, 'Protected import target');
  let message = '';
  page.once('dialog', async dialog => { message = dialog.message(); await dialog.accept(); });
  await page.getByLabel('Import project JSON').setInputFiles({
    name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
      name: 'Invalid import', data: { elements: [{ id: 'duplicate', type: 'rect' }, { id: 'duplicate', type: 'rect' }] },
    })),
  });
  await expect.poll(() => message).toContain('IDs must be unique');
  await expect(page.locator('.project-name-display')).toHaveText(original.name);
});

test('project switches flush pending edits before loading the next document', async ({ page, request }) => {
  const first = await openProject(page, request, 'Project A');
  const secondResponse = await request.post(`${backendUrl}/api/canvases`, { data: { name: 'Project B', data: {} } });
  const second = await secondResponse.json();
  await page.reload();
  await expect(page.locator('.project-name-display')).toHaveText('Project A');
  await rename(page, 'Project A saved before switching');
  await page.locator('.project-menu-btn').click();
  await page.locator('.projects-dropdown .dropdown-item').filter({ hasText: 'Project B' }).click();
  await expect(page.locator('.project-name-display')).toHaveText('Project B');
  const saved = await (await request.get(`${backendUrl}/api/canvases/${first.id}`)).json();
  expect(saved.name).toBe('Project A saved before switching');
  expect(await page.evaluate(key => localStorage.getItem(key), lastDocumentKey)).toBe(second.id);
});

test('failed saves recover across reload and retry without losing the local draft', async ({ page, request }) => {
  const document = await openProject(page, request, 'Network recovery');
  await page.route('**/api/canvases/*', route => route.request().method() === 'PUT' ? route.abort('failed') : route.continue());
  await rename(page, 'Recovered offline draft');
  await expect(page.locator('.save-badge')).toContainText('Sync error');
  const key = `omnicanvas:draft:${document.id}`;
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).document.name, key)).toBe('Recovered offline draft');
  page.once('dialog', async dialog => { await dialog.accept(); });
  await page.reload();
  await expect(page.locator('.project-name-display')).toHaveText('Recovered offline draft');
  await expect(page.locator('.save-badge')).toContainText('Sync error');
  await page.unroute('**/api/canvases/*');
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(page.locator('.save-badge')).toContainText('Saved (SQLite)');
  const saved = await (await request.get(`${backendUrl}/api/canvases/${document.id}`)).json();
  expect(saved.name).toBe('Recovered offline draft');
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBeNull();
});

test('a draft survives reload when its original server project has been deleted', async ({ page, request }) => {
  const document = await openProject(page, request, 'Deleted project recovery');
  await page.route('**/api/canvases/*', route => route.request().method() === 'PUT' ? route.abort('failed') : route.continue());
  await rename(page, 'Keep this unsaved work');
  await expect(page.locator('.save-badge')).toContainText('Sync error');
  expect((await request.delete(`${backendUrl}/api/canvases/${document.id}`)).ok()).toBeTruthy();
  page.once('dialog', async dialog => { await dialog.accept(); });
  await page.reload();
  await expect(page.locator('.project-name-display')).toHaveText('Keep this unsaved work');
  await page.getByRole('button', { name: 'Keep draft as new project', exact: true }).click();
  await expect(page.locator('.project-name-display')).toHaveText('Keep this unsaved work (Recovery)');
});

test('stale editor writes are blocked and the local draft can be kept as a separate project', async ({ page, request }) => {
  const document = await openProject(page, request, 'Concurrent original');
  const remote = await request.put(`${backendUrl}/api/canvases/${document.id}`, { data: { name: 'Remote editor change', expected_revision: 0 } });
  expect(remote.ok()).toBeTruthy();
  await rename(page, 'My local work');
  await expect(page.locator('.save-badge')).toContainText('Revision conflict');
  const saved = await (await request.get(`${backendUrl}/api/canvases/${document.id}`)).json();
  expect(saved.name).toBe('Remote editor change');
  await page.getByRole('button', { name: 'Keep draft as new project', exact: true }).click();
  await expect(page.locator('.project-name-display')).toHaveText('My local work (Recovery)');
  expect((await (await request.get(`${backendUrl}/api/canvases/${document.id}`)).json()).name).toBe('Remote editor change');
});

test('SVG and PNG downloads include the supported drawing types', async ({ page, request }) => {
  await openProject(page, request, 'Drawing exports', {
    elements: ['rect', 'circle', 'triangle', 'star', 'line', 'arrow', 'freehand', 'text', 'sticky'].map((type, index) => ({
      id: `export-${type}`, type, name: type, x: index * 100, y: 100, width: 80, height: 60,
      text: '<script>plain text</script>', fontFamily: 'sans" onload="not-an-attribute',
      points: [{ x: 610, y: 120 }, { x: 630, y: 140 }], zIndex: index,
    })),
    connectors: [{ id: 'export-link', fromElementId: 'export-rect', toElementId: 'export-circle', label: 'Connection' }],
  });
  await page.getByRole('button', { name: /^Export/ }).click();
  const svgDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export as vector SVG/ }).click();
  const svgStream = await (await svgDownload).createReadStream();
  const svgChunks: Buffer[] = [];
  for await (const chunk of svgStream!) svgChunks.push(Buffer.from(chunk));
  const svg = Buffer.concat(svgChunks).toString('utf-8');
  const parsed = await page.evaluate(source => {
    const document = new DOMParser().parseFromString(source, 'image/svg+xml');
    return {
      parserErrors: document.querySelectorAll('parsererror').length,
      scripts: document.querySelectorAll('script').length,
      lines: document.querySelectorAll('line').length,
      polygons: document.querySelectorAll('polygon').length,
      sketches: document.querySelectorAll('polyline').length,
      triangle: !!document.getElementById('export-triangle')?.querySelector('polygon'),
      star: !!document.getElementById('export-star')?.querySelector('polygon'),
    };
  }, svg);
  expect(parsed).toMatchObject({ parserErrors: 0, scripts: 0, lines: 2, sketches: 1 });
  expect(parsed.polygons).toBeGreaterThanOrEqual(2);
  await page.getByRole('button', { name: /^Export/ }).click();
  const pngDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export as PNG image/ }).click();
  const pngStream = await (await pngDownload).createReadStream();
  const pngChunks: Buffer[] = [];
  for await (const chunk of pngStream!) pngChunks.push(Buffer.from(chunk));
  const png = Buffer.concat(pngChunks);
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(png.readUInt32BE(16)).toBeGreaterThan(0);
  expect(png.readUInt32BE(16)).toBeLessThanOrEqual(8192);
});

test('inspector changes are undoable and zero opacity is not treated as full opacity', async ({ page, request }) => {
  const document = await openProject(page, request, 'Undo inspector', {
    elements: [{ id: 'shape', type: 'rect', name: 'Undoable shape', opacity: 1 }],
  });
  await page.locator('.layer-row').filter({ hasText: 'Undoable shape' }).click();
  const opacity = page.locator('.properties-panel label').filter({ hasText: 'Opacity (%)' }).locator('..').locator('input');
  await opacity.fill('0');
  await expect(page.locator('.save-badge')).toContainText('Saved (SQLite)');
  expect((await (await request.get(`${backendUrl}/api/canvases/${document.id}`)).json()).data.elements[0].opacity).toBe(0);
  await page.getByTitle('Undo (Ctrl+Z)').click();
  await expect(opacity).toHaveValue('100');
  await expect(page.locator('.save-badge')).toContainText('Saved (SQLite)');
  expect((await (await request.get(`${backendUrl}/api/canvases/${document.id}`)).json()).data.elements[0].opacity).toBe(1);
});
