import type { Artboard, CanvasElement } from '../types';

export function applyAutoLayoutToArtboard(artboard: Artboard, elements: CanvasElement[]): CanvasElement[] {
  const layout = artboard.autoLayout;
  if (!layout?.enabled) return elements;

  const horizontal = layout.direction === 'row';
  const padding = Math.max(0, layout.padding);
  const gap = Math.max(0, layout.gap);
  const mainSize = Math.max(0, (horizontal ? artboard.width : artboard.height) - padding * 2);
  const crossSize = Math.max(0, (horizontal ? artboard.height : artboard.width) - padding * 2);
  const children = elements
    .filter(element => element.artboardId === artboard.id && !element.hidden && element.layoutPosition !== 'absolute')
    .sort((a, b) => a.zIndex - b.zIndex);
  if (!children.length) return elements;

  const main = (element: CanvasElement) => horizontal ? element.width : element.height;
  const cross = (element: CanvasElement) => horizontal ? element.height : element.width;
  const lines: CanvasElement[][] = [[]];
  let used = 0;
  for (const child of children) {
    let line = lines[lines.length - 1];
    if (layout.wrap && line.length && used + gap + main(child) > mainSize) {
      line = [];
      lines.push(line);
      used = 0;
    }
    used += (line.length ? gap : 0) + main(child);
    line.push(child);
  }

  const positions = new Map<string, { x: number; y: number }>();
  let crossCursor = padding;
  for (const line of lines) {
    const contentSize = line.reduce((sum, child) => sum + main(child), 0);
    const remaining = Math.max(0, mainSize - contentSize - gap * (line.length - 1));
    let spacing = gap;
    let start = padding;
    if (layout.justify === 'center') start += remaining / 2;
    if (layout.justify === 'end') start += remaining;
    if (layout.justify === 'space-between' && line.length > 1) spacing += remaining / (line.length - 1);
    if (layout.justify === 'space-around') {
      spacing += remaining / line.length;
      start += remaining / line.length / 2;
    }
    if (layout.justify === 'space-evenly') {
      spacing += remaining / (line.length + 1);
      start += remaining / (line.length + 1);
    }
    const lineCrossSize = layout.wrap ? Math.max(...line.map(cross)) : crossSize;
    let mainCursor = start;
    for (const child of line) {
      const spare = Math.max(0, lineCrossSize - cross(child));
      const crossOffset = layout.align === 'center' ? spare / 2 : layout.align === 'end' ? spare : 0;
      positions.set(child.id, {
        x: artboard.x + (horizontal ? mainCursor : crossCursor + crossOffset),
        y: artboard.y + (horizontal ? crossCursor + crossOffset : mainCursor),
      });
      mainCursor += main(child) + spacing;
    }
    crossCursor += lineCrossSize + gap;
  }

  return elements.map(element => {
    const position = positions.get(element.id);
    if (!position) return element;
    const dx = position.x - element.x;
    const dy = position.y - element.y;
    return {
      ...element, ...position,
      ...(element.points?.length ? { points: element.points.map(point => ({ x: point.x + dx, y: point.y + dy })) } : {}),
    };
  });
}
