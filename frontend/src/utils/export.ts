import type { CanvasDocument } from '../types';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function filename(document: CanvasDocument, extension: string) {
  return `${document.name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase() || 'canvas'}.${extension}`;
}

export function exportToJSON(document: CanvasDocument) {
  downloadBlob(new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' }), filename(document, 'json'));
}

function attributes(values: Record<string, string | number | undefined>) {
  return Object.entries(values).filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}="${escapeXml(String(value))}"`).join(' ');
}

function color(value: string | undefined, fallback = 'transparent') {
  return value && /^(#[0-9a-f]{3,8}|[a-z]+|(?:rgba?|hsla?)\([0-9.,%\s+-]+\))$/i.test(value) ? value : fallback;
}

function bounds(document: CanvasDocument) {
  const items = [...document.data.artboards, ...document.data.elements.filter(element => !element.hidden)];
  const corners = items.flatMap(item => {
    const angle = ('rotation' in item ? item.rotation : 0) * Math.PI / 180;
    const cx = item.x + item.width / 2;
    const cy = item.y + item.height / 2;
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => ({
      x: cx + sx * item.width / 2 * Math.cos(angle) - sy * item.height / 2 * Math.sin(angle),
      y: cy + sx * item.width / 2 * Math.sin(angle) + sy * item.height / 2 * Math.cos(angle),
    }));
  });
  const minX = (corners.length ? Math.min(...corners.map(point => point.x)) : 0) - 60;
  const minY = (corners.length ? Math.min(...corners.map(point => point.y)) : 0) - 60;
  const maxX = (corners.length ? Math.max(...corners.map(point => point.x)) : 680) + 60;
  const maxY = (corners.length ? Math.max(...corners.map(point => point.y)) : 480) + 60;
  return { x: minX, y: minY, width: Math.max(1, Math.ceil(maxX - minX)), height: Math.max(1, Math.ceil(maxY - minY)) };
}

export function generateSVG(document: CanvasDocument, outputSize?: { width: number; height: number }): string {
  const box = bounds(document);
  const data = document.data;
  const elements = data.elements.filter(element => !element.hidden).sort((a, b) => a.zIndex - b.zIndex);
  const byId = new Map(elements.map(element => [element.id, element]));
  const definitions = [
    '<marker id="export-arrow-end" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><polygon points="0,0 10,4 0,8" fill="context-stroke" /></marker>',
    '<marker id="export-arrow-start" markerWidth="10" markerHeight="8" refX="1" refY="4" orient="auto"><polygon points="10,0 0,4 10,8" fill="context-stroke" /></marker>',
  ];
  // Artboards
  for (const frame of data.artboards.filter(frame => frame.clipContent)) {
    definitions.push(`<clipPath ${attributes({ id: `clip-${frame.id}` })}><rect ${attributes({ x: frame.x, y: frame.y, width: frame.width, height: frame.height })} /></clipPath>`);
  }
  for (const element of elements) {
    if (!element.shadow) continue;
    const shadow = element.shadow;
    definitions.push(`<filter ${attributes({ id: `shadow-${element.id}`, x: '-100%', y: '-100%', width: '300%', height: '300%' })}><feDropShadow ${attributes({ dx: shadow.x, dy: shadow.y, stdDeviation: shadow.blur / 2, 'flood-color': color(shadow.color, '#000000') })} /></filter>`);
  }
  const parts = [
    `<svg ${attributes({ xmlns: 'http://www.w3.org/2000/svg', viewBox: `${box.x} ${box.y} ${box.width} ${box.height}`, width: outputSize?.width ?? box.width, height: outputSize?.height ?? box.height })}>`,
    `<defs>${definitions.join('')}</defs>`,
    `<rect ${attributes({ x: box.x, y: box.y, width: box.width, height: box.height, fill: color(data.settings.backgroundColor, '#f8fafc') })} />`,
  ];
  // Draw artboards
  for (const frame of data.artboards) {
    parts.push(`<g ${attributes({ id: frame.id })}><text ${attributes({ x: frame.x, y: frame.y - 10, 'font-family': 'system-ui, sans-serif', 'font-size': 12, fill: '#64748b' })}>${escapeXml(frame.name)}</text><rect ${attributes({ x: frame.x, y: frame.y, width: frame.width, height: frame.height, fill: color(frame.fill, '#ffffff'), stroke: '#cbd5e1', 'stroke-width': 1 })} /></g>`);
  }
  for (const connection of data.connectors) {
    const start = byId.get(connection.fromElementId);
    const end = byId.get(connection.toElementId);
    if (!start || !end) continue;
    const x1 = start.x + start.width / 2;
    const y1 = start.y + start.height / 2;
    const x2 = end.x + end.width / 2;
    const y2 = end.y + end.height / 2;
    parts.push(`<g ${attributes({ id: connection.id })}><path ${attributes({ d: `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${y1}, ${x2} ${y2}`, fill: 'none', stroke: color(connection.stroke, '#0284c7'), 'stroke-width': connection.strokeWidth, 'stroke-dasharray': connection.strokeDash === 'dashed' ? '5,5' : undefined, 'marker-end': connection.arrowEnd ? 'url(#export-arrow-end)' : undefined })} />`);
    if (connection.label) parts.push(`<text ${attributes({ x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 8, 'text-anchor': 'middle', 'font-size': 12, fill: color(connection.stroke, '#0284c7') })}>${escapeXml(connection.label)}</text>`);
    parts.push('</g>');
  }
  // Elements
  const clipping = new Set(data.artboards.filter(frame => frame.clipContent).map(frame => frame.id));
  // Draw elements
  for (const element of elements) {
    const { x, y, width: w, height: h } = element;
    const clipped = !!element.artboardId && clipping.has(element.artboardId);
    if (clipped) parts.push(`<g ${attributes({ 'clip-path': `url(#clip-${element.artboardId})` })}>`);
    parts.push(`<g ${attributes({ id: element.id, opacity: element.opacity ?? 1, transform: element.rotation ? `rotate(${element.rotation} ${x + w / 2} ${y + h / 2})` : undefined, filter: element.shadow ? `url(#shadow-${element.id})` : undefined })}>`);
    const style = { fill: color(element.fill), stroke: color(element.stroke), 'stroke-width': element.strokeWidth, 'stroke-dasharray': element.strokeDash === 'dashed' ? '6,4' : element.strokeDash === 'dotted' ? '2,4' : undefined };
    if (element.type === 'rect' || element.type === 'sticky') {
      parts.push(`<rect ${attributes({ x, y, width: w, height: h, rx: element.cornerRadius ?? 0, ...style })} />`);
    } else if (element.type === 'circle') {
      parts.push(`<ellipse ${attributes({ cx: x + w / 2, cy: y + h / 2, rx: w / 2, ry: h / 2, ...style })} />`);
    } else if (element.type === 'triangle') {
      parts.push(`<polygon ${attributes({ points: `${x+w/2},${y} ${x+w},${y+h} ${x},${y+h}`, ...style })} />`);
    } else if (element.type === 'star') {
      const points = [[0.5, 0], [0.62, 0.38], [1, 0.38], [0.69, 0.62], [0.81, 1], [0.5, 0.77], [0.19, 1], [0.31, 0.62], [0, 0.38], [0.38, 0.38]];
      parts.push(`<polygon ${attributes({ points: points.map(([px, py]) => `${x + w * px},${y + h * py}`).join(' '), ...style })} />`);
    } else if (element.type === 'arrow' || element.type === 'line') {
      parts.push(`<line ${attributes({ x1: x, y1: y + h / 2, x2: x + w, y2: y + h / 2, ...style, 'marker-start': element.arrowStart ? 'url(#export-arrow-start)' : undefined, 'marker-end': element.type === 'arrow' || element.arrowEnd ? 'url(#export-arrow-end)' : undefined })} />`);
    } else if (element.type === 'freehand') {
      parts.push(`<polyline ${attributes({ points: (element.points ?? []).map(point => `${point.x},${point.y}`).join(' '), fill: 'none', stroke: color(element.stroke), 'stroke-width': element.strokeWidth, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })} />`);
    }
    if (element.type === 'text' || element.type === 'sticky') {
      const fontSize = element.fontSize ?? 16;
      const inset = element.type === 'sticky' ? 12 : 0;
      const anchor = element.textAlign === 'center' ? 'middle' : element.textAlign === 'right' ? 'end' : 'start';
      const textX = anchor === 'middle' ? x + w / 2 : anchor === 'end' ? x + w - inset : x + inset;
      const lines = wrapText(element.text ?? '', Math.max(1, Math.floor((w - inset * 2) / (fontSize * 0.55))));
      parts.push(`<text ${attributes({ x: textX, y: y + inset + fontSize, fill: color(element.textColor, '#0f172a'), 'font-size': fontSize, 'font-family': element.fontFamily ?? 'system-ui, sans-serif', 'font-weight': element.fontWeight ?? 'normal', 'text-anchor': anchor })}>`);
      lines.forEach((line, index) => parts.push(`<tspan ${attributes({ x: textX, dy: index === 0 ? 0 : fontSize * 1.3 })}>${escapeXml(line)}</tspan>`));
      parts.push('</text>');
      if (element.type === 'sticky' && element.author) parts.push(`<text ${attributes({ x: x + 12, y: y + h - 12, fill: color(element.textColor, '#0f172a'), 'font-family': 'system-ui, sans-serif', 'font-size': 11, opacity: 0.75 })}>${escapeXml(element.author)}</text>`);
    }
    parts.push('</g>');
    if (clipped) parts.push('</g>');
  }
  parts.push('</svg>');
  return parts.join('\n');
}

export function exportToSVG(document: CanvasDocument) {
  downloadBlob(new Blob([generateSVG(document)], { type: 'image/svg+xml' }), filename(document, 'svg'));
}

export async function exportToPNG(document: CanvasDocument): Promise<void> {
  // Use SVG rasterization via Canvas image
  const box = bounds(document);
  const scale = Math.min(2, 8192 / Math.max(box.width, box.height), Math.sqrt(32 * 1024 * 1024 / (box.width * box.height)));
  const width = Math.max(1, Math.floor(box.width * scale));
  const height = Math.max(1, Math.floor(box.height * scale));
  const canvas = window.document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot create a PNG. Export SVG or JSON instead.');
  // Background
  ctx.fillStyle = color(document.data.settings.backgroundColor, '#f8fafc');
  ctx.fillRect(0, 0, width, height);
  const url = URL.createObjectURL(new Blob([generateSVG(document, { width, height })], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to render this PNG. Export SVG or JSON instead.'));
      image.src = url;
    });
    ctx.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result: Blob | null) => result ? resolve(result) : reject(new Error('Unable to encode the PNG.')), 'image/png'));
    downloadBlob(blob, filename(document, 'png'));
  } finally { URL.revokeObjectURL(url); }
}

function wrapText(text: string, width: number): string[] {
  return text.split('\n').flatMap(paragraph => {
    if (!paragraph) return [''];
    const lines: string[] = [];
    let remaining = paragraph;
    while (remaining.length > width) {
      const space = remaining.lastIndexOf(' ', width);
      const end = space > 0 ? space : width;
      lines.push(remaining.slice(0, end));
      remaining = remaining.slice(end).replace(/^ +/, '');
    }
    lines.push(remaining);
    return lines;
  });
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '\ufffd').replace(/[<>&'\"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
