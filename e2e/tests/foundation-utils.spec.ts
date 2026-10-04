import { expect, test } from '@playwright/test';
import { applyAutoLayoutToArtboard } from '../../frontend/src/utils/autoLayout';
import { CanvasSaveQueue } from '../../frontend/src/utils/saveQueue';
import { generateSVG } from '../../frontend/src/utils/export';
import type { Artboard, CanvasDocument, CanvasElement } from '../../frontend/src/types';

const frame: Artboard = {
  id: 'frame', name: 'Frame', preset: 'custom', x: 100, y: 200,
  width: 300, height: 300, fill: '#ffffff', clipContent: true,
  autoLayout: { enabled: true, direction: 'row', gap: 10, padding: 20, align: 'center', justify: 'start', wrap: false },
};

function element(id: string, width = 60, height = 40): CanvasElement {
  return {
    id, type: 'rect', name: id, x: 0, y: 0, width, height, rotation: 0,
    fill: '#ffffff', stroke: '#000000', strokeWidth: 1, opacity: 1,
    artboardId: frame.id, zIndex: Number(id.replace('shape', '')) || 1,
  };
}

function document(id: string, name = id, revision = 0): CanvasDocument {
  return {
    id, name, description: '', revision, created_at: '', updated_at: '',
    data: {
      viewport: { zoom: 1, panX: 0, panY: 0 },
      settings: { grid: true, snapToGrid: true, gridSize: 20, theme: 'light', backgroundColor: '#ffffff' },
      artboards: [], elements: [], connectors: [],
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('SVG generation escapes attributes and text while retaining supported shapes and connectors', () => {
  const doc = document('safe-export');
  doc.data.artboards = [{ ...frame, name: '<script>unsafe</script> & Frame' }];
  doc.data.elements = [
    ...(['rect', 'circle', 'triangle', 'star', 'line', 'arrow', 'freehand'] as CanvasElement['type'][])
      .map(type => ({ ...element(type), type, artboardId: null, points: [{ x: 0, y: 0 }, { x: 30, y: 20 }] })),
    { ...element('text'), type: 'text', width: 600, text: '<script>unsafe</script>', fontFamily: 'sans" onload="unsafe', textColor: 'red; background:url(external)', artboardId: null },
    { ...element('hidden'), type: 'text', text: 'HIDDEN CONTENT', hidden: true },
  ];
  doc.data.connectors = [{ id: 'connection', fromElementId: 'rect', toElementId: 'circle', stroke: '#000000', strokeWidth: 2, strokeDash: 'dashed', arrowEnd: true, label: '<unsafe>' }];
  const svg = generateSVG(doc);
  expect(svg).not.toContain('<script>');
  expect(svg).not.toContain('onload="');
  expect(svg).not.toContain('background:url');
  expect(svg).not.toContain('HIDDEN CONTENT');
  expect(svg).toContain('&lt;script&gt;');
  expect(svg).toContain('<ellipse');
  expect(svg).toContain('<polygon');
  expect(svg).toContain('<line');
  expect(svg).toContain('<polyline');
  expect(svg).toContain('<path');
  expect(svg).toContain('clipPath');
});

test('flex layout respects padding, alignment, ordering, and immutability', () => {
  const input = [element('shape2', 80, 60), element('shape1'), { ...element('outside'), artboardId: null }];
  const result = applyAutoLayoutToArtboard(frame, input);
  expect(result.find(e => e.id === 'shape1')).toMatchObject({ x: 120, y: 330 });
  expect(result.find(e => e.id === 'shape2')).toMatchObject({ x: 190, y: 320 });
  expect(result.find(e => e.id === 'outside')).toEqual(input[2]);
  expect(input[0].x).toBe(0);
});

test('column layout and space-between distribute remaining space', () => {
  const result = applyAutoLayoutToArtboard({
    ...frame, autoLayout: { ...frame.autoLayout!, direction: 'column', align: 'end', justify: 'space-between' },
  }, [element('shape1'), element('shape2')]);
  expect(result[0]).toMatchObject({ x: 320, y: 220 });
  expect(result[1]).toMatchObject({ x: 320, y: 440 });
});

test('wrapped layout starts a new line and excludes absolute children', () => {
  const input = [element('shape1', 160), element('shape2', 160), { ...element('absolute'), layoutPosition: 'absolute' as const }];
  const result = applyAutoLayoutToArtboard({
    ...frame, autoLayout: { ...frame.autoLayout!, wrap: true, align: 'start' },
  }, input);
  expect(result[0]).toMatchObject({ x: 120, y: 220 });
  expect(result[1]).toMatchObject({ x: 120, y: 270 });
  expect(result[2]).toEqual(input[2]);
});

test('disabled layout leaves children untouched and zero spacing is respected', () => {
  const input = [element('shape1')];
  expect(applyAutoLayoutToArtboard({ ...frame, autoLayout: undefined }, input)).toBe(input);
  const result = applyAutoLayoutToArtboard({
    ...frame, autoLayout: { ...frame.autoLayout!, gap: 0, padding: 0, align: 'start' },
  }, input);
  expect(result[0]).toMatchObject({ x: 100, y: 200 });
});

test('save queue serializes requests and preserves newer edits made during a save', async () => {
  const first = deferred<CanvasDocument>();
  const calls: Array<{ name: string; revision: number }> = [];
  const queue = new CanvasSaveQueue(async (doc, revision) => {
    calls.push({ name: doc.name, revision });
    return calls.length === 1 ? first.promise : { ...doc, revision: revision + 1 };
  });
  queue.register(document('a'));
  queue.enqueue(document('a', 'First'));
  const saving = queue.flush();
  queue.enqueue(document('a', 'Latest'));
  expect(calls).toEqual([{ name: 'First', revision: 0 }]);
  first.resolve(document('a', 'First', 1));
  await saving;
  expect(calls).toEqual([{ name: 'First', revision: 0 }, { name: 'Latest', revision: 1 }]);
  expect(queue.hasPending()).toBe(false);
});

test('save queue keeps independent document revisions when switching projects', async () => {
  const calls: Array<{ id: string; revision: number }> = [];
  const queue = new CanvasSaveQueue(async (doc, revision) => {
    calls.push({ id: doc.id, revision });
    return { ...doc, revision: revision + 1 };
  });
  queue.register(document('a', 'A', 4));
  queue.register(document('b', 'B', 9));
  queue.enqueue(document('a', 'Edited A', 4));
  queue.enqueue(document('b', 'Edited B', 9));
  await queue.flush();
  expect(calls).toEqual([{ id: 'a', revision: 4 }, { id: 'b', revision: 9 }]);
});

test('failed saves retain the draft and can be retried without overwriting a conflict', async () => {
  let attempts = 0;
  const queue = new CanvasSaveQueue(async (doc, revision) => {
    if (++attempts === 1) throw new Error('Network unavailable');
    return { ...doc, revision: revision + 1 };
  });
  queue.enqueue(document('a'));
  await expect(queue.flush()).rejects.toThrow('Network unavailable');
  expect(queue.hasPending()).toBe(true);
  await queue.flush();
  expect(queue.hasPending()).toBe(false);
});
