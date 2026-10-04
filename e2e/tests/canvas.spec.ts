import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const backendUrl = 'http://127.0.0.1:8001';
const lastDocumentKey = 'omnicanvas:last-document';
const starterData = {
  artboards: [{ id: 'e2e-frame', name: 'E2E Artboard', x: 100, y: 100, width: 800, height: 500 }],
  elements: [{
    id: 'e2e-sticky', type: 'sticky', name: 'E2E sticky note', x: 160, y: 160,
    width: 220, height: 160, text: 'Starter sticky note', author: 'Canvas test', artboardId: 'e2e-frame',
  }],
  connectors: [],
};

async function openWorkspace(page: Page, request: APIRequestContext) {
  const response = await request.post(`${backendUrl}/api/canvases`, {
    data: { name: 'Canvas E2E Workspace', data: starterData },
  });
  expect(response.status()).toBe(201);
  const document = await response.json() as { id: string };
  await page.addInitScript(({ id, key }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, id);
  }, { id: document.id, key: lastDocumentKey });
  await page.goto('/');
  await expect(page.locator('.project-name-display')).toHaveText('Canvas E2E Workspace');
}

test('loads the canvas workspace with starter artboards and elements', async ({ page, request }) => {
  await openWorkspace(page, request);

  // Navbar branding and title
  await expect(page.locator('.logo-title')).toHaveText('OmniCanvas');
  await expect(page.locator('.save-badge')).toContainText('Saved');

  // Verify toolbar is present
  await expect(page.locator('.canvas-toolbar')).toBeVisible();

  // Verify layers panel and canvas SVG
  await expect(page.locator('.layers-panel')).toBeVisible();
  await expect(page.locator('.canvas-svg')).toBeVisible();

  // Check default artboard and elements
  await expect(page.locator('.artboard-label').first()).toBeVisible();
  await expect(page.locator('.sticky-group').first()).toBeVisible();
});

test('selects an element and displays properties in the inspector', async ({ page, request }) => {
  await openWorkspace(page, request);

  // Click on the sticky note
  const sticky = page.locator('.sticky-group').first();
  await sticky.click();

  // Properties panel should show sticky note controls
  const propertiesPanel = page.locator('.properties-panel');
  await expect(propertiesPanel).toBeVisible();
  await expect(propertiesPanel.locator('.element-badge')).toHaveText('STICKY');
  await expect(propertiesPanel.locator('.section-label', { hasText: 'Sticky Note Note Style' })).toBeVisible();

  // Change author tag
  const authorInput = propertiesPanel.locator('input[placeholder="e.g. Design Team"]');
  await authorInput.fill('Playwright Tester');

  // Verify author is updated on the canvas
  await expect(page.locator('.sticky-group text', { hasText: 'Playwright Tester' })).toBeVisible();
});

test('adds a new sticky note and vector shape to the canvas', async ({ page, request }) => {
  await openWorkspace(page, request);

  // Wait for initial elements to render
  await expect(page.locator('.canvas-element-group').first()).toBeVisible();
  const initialCount = await page.locator('.canvas-element-group').count();

  // Click on the sticky tool in the toolbar (button with 'S' shortcut)
  await page.locator('.tool-btn[title*="Sticky Note"]').click();

  // Click on canvas background to place sticky note
  const canvas = page.locator('.canvas-container');
  await canvas.click({ position: { x: 350, y: 250 } });

  // Element count should increase
  await expect(page.locator('.canvas-element-group')).toHaveCount(initialCount + 1);

  // Click on rectangle tool
  await page.locator('.tool-btn[title*="Vector Shapes"]').click();
  await canvas.click({ position: { x: 450, y: 350 } });

  await expect(page.locator('.canvas-element-group')).toHaveCount(initialCount + 2);
});

test('opens template modal and inserts an agile sprint whiteboard', async ({ page, request }) => {
  await openWorkspace(page, request);

  // Click on Templates button in navbar
  await page.getByRole('button', { name: '🧩 Templates' }).click();

  // Modal appears
  const modal = page.locator('.modal-card');
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('heading', { name: '🧩 Canvas Templates & Layouts' })).toBeVisible();

  // Click Insert Whiteboard
  await modal.getByRole('button', { name: 'Insert Whiteboard' }).click();

  // Modal closes and new Kanban columns appear
  await expect(modal).not.toBeVisible();
  await expect(page.locator('.canvas-element-group text', { hasText: '📋 TO DO' })).toBeVisible();
});

test('persists canvas modifications to SQLite across reloads', async ({ page, request }) => {
  await openWorkspace(page, request);

  // Create a new canvas
  await page.locator('.project-menu-btn').click();
  await page.getByRole('button', { name: '+ New' }).click();

  // Rename the canvas
  await page.locator('.rename-trigger').click();
  const nameInput = page.locator('.nav-name-input');
  await nameInput.fill('SQLite E2E Canvas');
  await nameInput.press('Enter');

  // Add a sticky note
  await page.locator('.tool-btn[title*="Sticky Note"]').click();
  await page.locator('.canvas-container').click({ position: { x: 300, y: 200 } });

  // Wait for save badge to indicate saved
  await expect(page.locator('.save-badge')).toContainText('Saved (SQLite)');

  // Reload the page
  await page.reload();

  // Verify the canvas name and sticky note persist
  await expect(page.locator('.project-name-display')).toHaveText('SQLite E2E Canvas');
  await expect(page.locator('.sticky-group').first()).toBeVisible();

  // Verify backend API returns the canvas list
  const canvasesRes = await request.get(`${backendUrl}/api/canvases`);
  expect(canvasesRes.ok()).toBeTruthy();
  const list = await canvasesRes.json();
  const matched = list.find((c: { name: string }) => c.name === 'SQLite E2E Canvas');
  expect(matched).toBeTruthy();
});
