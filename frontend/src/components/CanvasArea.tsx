import React, { useEffect, useRef, useState } from 'react';
import {
  Artboard,
  CanvasElement,
  CanvasSettings,
  Connector,
  STICKY_PRESETS,
  StickyColor,
  ToolType,
  Viewport,
} from '../types';

interface CanvasAreaProps {
  viewport: Viewport;
  settings: CanvasSettings;
  artboards: Artboard[];
  elements: CanvasElement[];
  connectors: Connector[];
  activeTool: ToolType;
  selectedElementId: string | null;
  selectedArtboardId: string | null;
  selectedStickyColor: StickyColor;
  onUpdateViewport: (viewport: Viewport) => void;
  onSelectElement: (id: string | null) => void;
  onSelectArtboard: (id: string | null) => void;
  onUpdateElement: (id: string, updates: Partial<CanvasElement>) => void;
  onAddElement: (element: CanvasElement) => void;
  onAddArtboard: (artboard: Artboard) => void;
  onSetTool: (tool: ToolType) => void;
  onSaveHistorySnapshot: () => void;
}

type DragMode =
  | 'none'
  | 'pan'
  | 'move-element'
  | 'resize-element'
  | 'rotate-element'
  | 'draw-freehand'
  | 'draw-shape'
  | 'marquee';

export const CanvasArea: React.FC<CanvasAreaProps> = ({
  viewport,
  settings,
  artboards,
  elements,
  connectors,
  activeTool,
  selectedElementId,
  selectedArtboardId,
  selectedStickyColor,
  onUpdateViewport,
  onSelectElement,
  onSelectArtboard,
  onUpdateElement,
  onAddElement,
  onAddArtboard,
  onSetTool,
  onSaveHistorySnapshot,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialElemGeom, setInitialElemGeom] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
    rot: number;
  }>({ x: 0, y: 0, w: 0, h: 0, rot: 0 });
  const [resizeHandle, setResizeHandle] = useState<string>('');
  const [freehandPoints, setFreehandPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [marqueeBox, setMarqueeBox] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null
  );
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [spacePressed, setSpacePressed] = useState<boolean>(false);

  const selectedElement = elements.find((el) => el.id === selectedElementId) || null;

  // Spacebar tracking for quick panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !editingTextId && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        setSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [editingTextId]);

  // Convert screen coordinates to canvas world coordinates
  const screenToCanvas = (screenX: number, screenY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = (screenX - rect.left - viewport.panX) / viewport.zoom;
    const y = (screenY - rect.top - viewport.panY) / viewport.zoom;
    return { x, y };
  };

  // Grid snap helper
  const snap = (val: number): number => {
    if (!settings.snapToGrid) return Math.round(val);
    const size = settings.gridSize || 20;
    return Math.round(val / size) * size;
  };

  // Wheel zoom and pan
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom centered at cursor
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(4.0, Math.max(0.15, viewport.zoom * zoomFactor));

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const newPanX = mouseX - ((mouseX - viewport.panX) / viewport.zoom) * newZoom;
        const newPanY = mouseY - ((mouseY - viewport.panY) / viewport.zoom) * newZoom;

        onUpdateViewport({ zoom: newZoom, panX: newPanX, panY: newPanY });
      }
    } else {
      // Pan
      onUpdateViewport({
        ...viewport,
        panX: viewport.panX - e.deltaX,
        panY: viewport.panY - e.deltaY,
      });
    }
  };

  // Pointer Down
  const handlePointerDown = (e: React.PointerEvent) => {
    if (editingTextId) {
      setEditingTextId(null);
    }

    const isPan = e.button === 1 || activeTool === 'hand' || spacePressed;

    if (isPan) {
      setDragMode('pan');
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (e.button !== 0) return; // Only primary button

    const pt = screenToCanvas(e.clientX, e.clientY);

    // If drawing freehand
    if (activeTool === 'freehand') {
      onSaveHistorySnapshot();
      setDragMode('draw-freehand');
      setFreehandPoints([{ x: pt.x, y: pt.y }]);
      return;
    }

    // If creating a shape or sticky or artboard
    if (['rect', 'circle', 'triangle', 'star', 'sticky', 'artboard', 'text', 'line', 'arrow'].includes(activeTool)) {
      onSaveHistorySnapshot();
      const startX = snap(pt.x);
      const startY = snap(pt.y);

      if (activeTool === 'sticky') {
        const preset = STICKY_PRESETS[selectedStickyColor];
        const newSticky: CanvasElement = {
          id: `sticky-${Date.now()}`,
          type: 'sticky',
          name: `${preset.label} Sticky Note`,
          x: startX,
          y: startY,
          width: 200,
          height: 180,
          rotation: 0,
          fill: preset.fill,
          stroke: preset.stroke,
          strokeWidth: 1,
          opacity: 1,
          cornerRadius: 6,
          text: 'Double click to edit note...',
          fontSize: 14,
          textColor: preset.textColor,
          colorPreset: selectedStickyColor,
          zIndex: elements.length + 1,
        };
        onAddElement(newSticky);
        onSelectElement(newSticky.id);
        onSetTool('select');
        return;
      }

      if (activeTool === 'text') {
        const newText: CanvasElement = {
          id: `text-${Date.now()}`,
          type: 'text',
          name: 'Text Item',
          x: startX,
          y: startY,
          width: 240,
          height: 40,
          rotation: 0,
          fill: 'transparent',
          stroke: 'transparent',
          strokeWidth: 0,
          opacity: 1,
          text: 'Type text here...',
          fontSize: 20,
          fontWeight: 600,
          textColor: '#0f172a',
          zIndex: elements.length + 1,
        };
        onAddElement(newText);
        onSelectElement(newText.id);
        onSetTool('select');
        return;
      }

      if (activeTool === 'artboard') {
        const newArtboard: Artboard = {
          id: `artboard-${Date.now()}`,
          name: 'Artboard',
          preset: 'custom',
          x: startX,
          y: startY,
          width: 480,
          height: 360,
          fill: '#ffffff',
          clipContent: true,
        };
        onAddArtboard(newArtboard);
        onSelectArtboard(newArtboard.id);
        onSetTool('select');
        return;
      }

      // Default vector shape (rect, circle, triangle, star, arrow)
      const isCircle = activeTool === 'circle';
      const isStar = activeTool === 'star';
      const isTriangle = activeTool === 'triangle';
      const isArrow = activeTool === 'arrow';

      const newShape: CanvasElement = {
        id: `shape-${Date.now()}`,
        type: activeTool as CanvasElement['type'],
        name: isCircle ? 'Circle' : isStar ? 'Star' : isTriangle ? 'Triangle' : isArrow ? 'Arrow' : 'Rectangle',
        x: startX,
        y: startY,
        width: 140,
        height: isArrow ? 40 : 120,
        rotation: 0,
        fill: isArrow ? 'transparent' : '#3b82f6',
        stroke: isArrow ? '#0284c7' : '#2563eb',
        strokeWidth: isArrow ? 3 : 2,
        opacity: 1,
        cornerRadius: isCircle ? 0 : 8,
        arrowEnd: isArrow,
        zIndex: elements.length + 1,
      };
      onAddElement(newShape);
      onSelectElement(newShape.id);
      onSetTool('select');
      return;
    }

    // If clicking background in Select mode -> Marquee selection or Deselect
    onSelectElement(null);
    onSelectArtboard(null);
    setDragMode('marquee');
    setDragStart({ x: pt.x, y: pt.y });
    setMarqueeBox({ x: pt.x, y: pt.y, w: 0, h: 0 });
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragMode === 'none') return;

    if (dragMode === 'pan') {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      onUpdateViewport({
        ...viewport,
        panX: viewport.panX + dx,
        panY: viewport.panY + dy,
      });
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    const pt = screenToCanvas(e.clientX, e.clientY);

    if (dragMode === 'draw-freehand') {
      setFreehandPoints((prev) => [...prev, { x: pt.x, y: pt.y }]);
      return;
    }

    if (dragMode === 'marquee') {
      const x = Math.min(dragStart.x, pt.x);
      const y = Math.min(dragStart.y, pt.y);
      const w = Math.abs(pt.x - dragStart.x);
      const h = Math.abs(pt.y - dragStart.y);
      setMarqueeBox({ x, y, w, h });
      return;
    }

    if (dragMode === 'move-element' && selectedElement) {
      const dx = pt.x - dragStart.x;
      const dy = pt.y - dragStart.y;
      const newX = snap(initialElemGeom.x + dx);
      const newY = snap(initialElemGeom.y + dy);
      onUpdateElement(selectedElement.id, { x: newX, y: newY });
      return;
    }

    if (dragMode === 'resize-element' && selectedElement) {
      const dx = pt.x - dragStart.x;
      const dy = pt.y - dragStart.y;
      let newW = initialElemGeom.w;
      let newH = initialElemGeom.h;
      let newX = initialElemGeom.x;
      let newY = initialElemGeom.y;

      if (resizeHandle.includes('e')) newW = Math.max(15, initialElemGeom.w + dx);
      if (resizeHandle.includes('s')) newH = Math.max(15, initialElemGeom.h + dy);
      if (resizeHandle.includes('w')) {
        const possibleW = initialElemGeom.w - dx;
        if (possibleW > 15) {
          newW = possibleW;
          newX = initialElemGeom.x + dx;
        }
      }
      if (resizeHandle.includes('n')) {
        const possibleH = initialElemGeom.h - dy;
        if (possibleH > 15) {
          newH = possibleH;
          newY = initialElemGeom.y + dy;
        }
      }

      onUpdateElement(selectedElement.id, {
        x: snap(newX),
        y: snap(newY),
        width: snap(newW),
        height: snap(newH),
      });
      return;
    }

    if (dragMode === 'rotate-element' && selectedElement) {
      const centerX = initialElemGeom.x + initialElemGeom.w / 2;
      const centerY = initialElemGeom.y + initialElemGeom.h / 2;
      const rad = Math.atan2(pt.y - centerY, pt.x - centerX);
      let deg = Math.round((rad * 180) / Math.PI) + 90;
      if (deg < 0) deg += 360;
      if (deg > 360) deg -= 360;

      // Snap to 15 degrees if shift held or near 45/90/180
      if (deg % 15 < 3 || deg % 15 > 12) {
        deg = Math.round(deg / 15) * 15;
      }
      onUpdateElement(selectedElement.id, { rotation: deg });
      return;
    }
  };

  // Pointer Up
  const handlePointerUp = () => {
    if (dragMode === 'draw-freehand' && freehandPoints.length > 1) {
      const newFreehand: CanvasElement = {
        id: `draw-${Date.now()}`,
        type: 'freehand',
        name: 'Pencil Sketch',
        x: Math.min(...freehandPoints.map((p) => p.x)),
        y: Math.min(...freehandPoints.map((p) => p.y)),
        width: Math.max(...freehandPoints.map((p) => p.x)) - Math.min(...freehandPoints.map((p) => p.x)),
        height: Math.max(...freehandPoints.map((p) => p.y)) - Math.min(...freehandPoints.map((p) => p.y)),
        rotation: 0,
        fill: 'transparent',
        stroke: '#0f172a',
        strokeWidth: 3,
        opacity: 1,
        points: freehandPoints,
        zIndex: elements.length + 1,
      };
      onAddElement(newFreehand);
      setFreehandPoints([]);
    }

    if (dragMode === 'marquee' && marqueeBox) {
      // Find element inside marquee
      const found = elements.find((el) => {
        return (
          el.x < marqueeBox.x + marqueeBox.w &&
          el.x + el.width > marqueeBox.x &&
          el.y < marqueeBox.y + marqueeBox.h &&
          el.y + el.height > marqueeBox.y
        );
      });
      if (found) {
        onSelectElement(found.id);
      }
      setMarqueeBox(null);
    }

    setDragMode('none');
  };

  // Double click for inline editing
  const handleElementDoubleClick = (el: CanvasElement, e: React.MouseEvent) => {
    e.stopPropagation();
    if (el.type === 'text' || el.type === 'sticky') {
      setEditingTextId(el.id);
    }
  };

  // Element Pointer Down for move
  const handleElementPointerDown = (el: CanvasElement, e: React.PointerEvent) => {
    if (spacePressed || activeTool === 'hand') return;
    if (activeTool !== 'select') return;
    e.stopPropagation();
    if (el.locked) return;

    onSaveHistorySnapshot();
    onSelectArtboard(null);
    onSelectElement(el.id);

    const pt = screenToCanvas(e.clientX, e.clientY);
    setDragMode('move-element');
    setDragStart({ x: pt.x, y: pt.y });
    setInitialElemGeom({
      x: el.x,
      y: el.y,
      w: el.width,
      h: el.height,
      rot: el.rotation || 0,
    });
  };

  // Resize Handle Pointer Down
  const handleResizePointerDown = (handle: string, e: React.PointerEvent) => {
    e.stopPropagation();
    if (!selectedElement) return;

    onSaveHistorySnapshot();
    const pt = screenToCanvas(e.clientX, e.clientY);
    setDragMode('resize-element');
    setResizeHandle(handle);
    setDragStart({ x: pt.x, y: pt.y });
    setInitialElemGeom({
      x: selectedElement.x,
      y: selectedElement.y,
      w: selectedElement.width,
      h: selectedElement.height,
      rot: selectedElement.rotation || 0,
    });
  };

  // Rotate Handle Pointer Down
  const handleRotatePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!selectedElement) return;

    onSaveHistorySnapshot();
    setDragMode('rotate-element');
    setInitialElemGeom({
      x: selectedElement.x,
      y: selectedElement.y,
      w: selectedElement.width,
      h: selectedElement.height,
      rot: selectedElement.rotation || 0,
    });
  };

  return (
    <div
      className={`canvas-container ${spacePressed || activeTool === 'hand' ? 'is-panning' : ''}`}
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ backgroundColor: settings.backgroundColor }}
    >
      <svg
        className="canvas-svg"
        style={{
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <defs>
          {/* Dot Grid Pattern */}
          {settings.grid && (
            <pattern
              id="grid-pattern"
              width={settings.gridSize}
              height={settings.gridSize}
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx={settings.gridSize / 2}
                cy={settings.gridSize / 2}
                r="1"
                fill="#94a3b8"
                opacity="0.4"
              />
            </pattern>
          )}

          {/* Arrowhead marker */}
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#0284c7" />
          </marker>
        </defs>

        {/* Infinite Grid Background */}
        {settings.grid && (
          <rect
            x="-50000"
            y="-50000"
            width="100000"
            height="100000"
            fill="url(#grid-pattern)"
            pointerEvents="none"
          />
        )}

        {/* Render Artboards */}
        {artboards.map((ab) => {
          const isSelected = selectedArtboardId === ab.id;
          return (
            <g
              key={ab.id}
              className={`artboard-node ${isSelected ? 'is-selected' : ''}`}
              onClick={(e) => {
                if (activeTool !== 'select') return;
                e.stopPropagation();
                onSelectElement(null);
                onSelectArtboard(ab.id);
              }}
            >
              {/* Artboard Header Label */}
              <text
                x={ab.x}
                y={ab.y - 10}
                className="artboard-label"
                fill="#64748b"
                fontSize="12"
                fontWeight="600"
              >
                {ab.name} · {ab.width}×{ab.height}
              </text>

              {/* Artboard Frame Box */}
              <rect
                x={ab.x}
                y={ab.y}
                width={ab.width}
                height={ab.height}
                fill={ab.fill}
                stroke={isSelected ? '#3b82f6' : '#cbd5e1'}
                strokeWidth={isSelected ? 2 : 1}
                rx="6"
                className="artboard-box"
              />
            </g>
          );
        })}

        {/* Render Connectors */}
        {connectors.map((conn) => {
          const fromEl = elements.find((e) => e.id === conn.fromElementId);
          const toEl = elements.find((e) => e.id === conn.toElementId);
          if (!fromEl || !toEl) return null;

          const startX = fromEl.x + fromEl.width / 2;
          const startY = fromEl.y + fromEl.height / 2;
          const endX = toEl.x + toEl.width / 2;
          const endY = toEl.y + toEl.height / 2;

          const midX = (startX + endX) / 2;
          const midY = (startY + endY) / 2;

          return (
            <g key={conn.id} className="connector-group">
              <path
                d={`M ${startX} ${startY} Q ${midX} ${startY}, ${endX} ${endY}`}
                fill="none"
                stroke={conn.stroke || '#0284c7'}
                strokeWidth={conn.strokeWidth || 2}
                strokeDasharray={conn.strokeDash === 'dashed' ? '5,5' : undefined}
                markerEnd="url(#arrowhead)"
              />
              {conn.label && (
                <text
                  x={midX}
                  y={midY - 8}
                  fill="#0284c7"
                  fontSize="12"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {conn.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Render Canvas Elements */}
        {elements
          .filter((el) => !el.hidden)
          .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
          .map((el) => {
            const isSelected = selectedElementId === el.id;
            const transform = el.rotation
              ? `rotate(${el.rotation} ${el.x + el.width / 2} ${el.y + el.height / 2})`
              : undefined;

            return (
              <g
                key={el.id}
                className={`canvas-element-group ${isSelected ? 'selected' : ''}`}
                transform={transform}
                onPointerDown={(e) => handleElementPointerDown(el, e)}
                onDoubleClick={(e) => handleElementDoubleClick(el, e)}
              >
                {/* Rect */}
                {el.type === 'rect' && (
                  <rect
                    x={el.x}
                    y={el.y}
                    width={el.width}
                    height={el.height}
                    fill={el.fill}
                    stroke={el.stroke}
                    strokeWidth={el.strokeWidth}
                    strokeDasharray={
                      el.strokeDash === 'dashed' ? '6,4' : el.strokeDash === 'dotted' ? '2,4' : undefined
                    }
                    rx={el.cornerRadius || 0}
                    opacity={el.opacity ?? 1}
                  />
                )}

                {/* Circle / Ellipse */}
                {el.type === 'circle' && (
                  <ellipse
                    cx={el.x + el.width / 2}
                    cy={el.y + el.height / 2}
                    rx={el.width / 2}
                    ry={el.height / 2}
                    fill={el.fill}
                    stroke={el.stroke}
                    strokeWidth={el.strokeWidth}
                    opacity={el.opacity ?? 1}
                  />
                )}

                {/* Triangle */}
                {el.type === 'triangle' && (
                  <polygon
                    points={`${el.x + el.width / 2},${el.y} ${el.x + el.width},${el.y + el.height} ${el.x},${
                      el.y + el.height
                    }`}
                    fill={el.fill}
                    stroke={el.stroke}
                    strokeWidth={el.strokeWidth}
                    opacity={el.opacity ?? 1}
                  />
                )}

                {/* Star */}
                {el.type === 'star' && (
                  <polygon
                    points={`${el.x + el.width * 0.5},${el.y} ${el.x + el.width * 0.62},${
                      el.y + el.height * 0.38
                    } ${el.x + el.width},${el.y + el.height * 0.38} ${el.x + el.width * 0.69},${
                      el.y + el.height * 0.62
                    } ${el.x + el.width * 0.81},${el.y + el.height} ${el.x + el.width * 0.5},${
                      el.y + el.height * 0.77
                    } ${el.x + el.width * 0.19},${el.y + el.height} ${el.x + el.width * 0.31},${
                      el.y + el.height * 0.62
                    } ${el.x},${el.y + el.height * 0.38} ${el.x + el.width * 0.38},${el.y + el.height * 0.38}`}
                    fill={el.fill}
                    stroke={el.stroke}
                    strokeWidth={el.strokeWidth}
                    opacity={el.opacity ?? 1}
                  />
                )}

                {/* Arrow / Line */}
                {el.type === 'arrow' && (
                  <line
                    x1={el.x}
                    y1={el.y + el.height / 2}
                    x2={el.x + el.width}
                    y2={el.y + el.height / 2}
                    stroke={el.stroke}
                    strokeWidth={el.strokeWidth}
                    markerEnd="url(#arrowhead)"
                  />
                )}

                {/* Freehand Polyline */}
                {el.type === 'freehand' && el.points && (
                  <polyline
                    points={el.points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke={el.stroke}
                    strokeWidth={el.strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={el.opacity ?? 1}
                  />
                )}

                {/* Sticky Note */}
                {el.type === 'sticky' && (
                  <g className="sticky-group" opacity={el.opacity ?? 1}>
                    {/* Shadow / Fold effect */}
                    <rect
                      x={el.x}
                      y={el.y}
                      width={el.width}
                      height={el.height}
                      fill={el.fill}
                      stroke={el.stroke}
                      strokeWidth={el.strokeWidth || 1}
                      rx={el.cornerRadius || 6}
                      className="sticky-card-box"
                    />

                    {editingTextId === el.id ? (
                      <foreignObject x={el.x + 8} y={el.y + 8} width={el.width - 16} height={el.height - 36}>
                        <textarea
                          className="inline-sticky-editor"
                          autoFocus
                          value={el.text || ''}
                          onChange={(e) => onUpdateElement(el.id, { text: e.target.value })}
                          onBlur={() => setEditingTextId(null)}
                        />
                      </foreignObject>
                    ) : (
                      <foreignObject
                        x={el.x + 12}
                        y={el.y + 12}
                        width={el.width - 24}
                        height={el.height - 40}
                        style={{ pointerEvents: 'none' }}
                      >
                        <div
                          className="sticky-text-display"
                          style={{
                            color: el.textColor || '#1e293b',
                            fontSize: `${el.fontSize || 14}px`,
                            fontFamily: el.fontFamily || 'Inter, sans-serif',
                          }}
                        >
                          {el.text}
                        </div>
                      </foreignObject>
                    )}

                    {/* Author / Tag */}
                    {el.author && (
                      <text
                        x={el.x + 12}
                        y={el.y + el.height - 10}
                        fontSize="11"
                        fontWeight="bold"
                        fill={el.textColor || '#1e293b'}
                        opacity="0.75"
                        style={{ pointerEvents: 'none' }}
                      >
                        {el.author}
                      </text>
                    )}
                  </g>
                )}

                {/* Text Item */}
                {el.type === 'text' && (
                  <g className="text-group" opacity={el.opacity ?? 1}>
                    {editingTextId === el.id ? (
                      <foreignObject x={el.x} y={el.y} width={Math.max(200, el.width)} height={el.height + 60}>
                        <textarea
                          className="inline-text-editor"
                          autoFocus
                          value={el.text || ''}
                          onChange={(e) => onUpdateElement(el.id, { text: e.target.value })}
                          onBlur={() => setEditingTextId(null)}
                        />
                      </foreignObject>
                    ) : (
                      <text
                        x={el.x}
                        y={el.y + (el.fontSize || 20)}
                        fontSize={el.fontSize || 20}
                        fontFamily={el.fontFamily || 'Inter, sans-serif'}
                        fontWeight={el.fontWeight || '600'}
                        fill={el.textColor || '#0f172a'}
                        style={{ userSelect: 'none' }}
                      >
                        {el.text}
                      </text>
                    )}
                  </g>
                )}
              </g>
            );
          })}

        {/* Live Freehand Sketch in Progress */}
        {dragMode === 'draw-freehand' && freehandPoints.length > 1 && (
          <polyline
            points={freehandPoints.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#0f172a"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.8"
          />
        )}

        {/* Marquee Selection Rectangle */}
        {marqueeBox && (
          <rect
            x={marqueeBox.x}
            y={marqueeBox.y}
            width={marqueeBox.w}
            height={marqueeBox.h}
            fill="rgba(59, 130, 246, 0.15)"
            stroke="#3b82f6"
            strokeWidth="1"
            strokeDasharray="4,4"
          />
        )}

        {/* Transform / Selection Overlay for Selected Element */}
        {selectedElement && !editingTextId && (
          <g
            className="selection-overlay"
            transform={
              selectedElement.rotation
                ? `rotate(${selectedElement.rotation} ${selectedElement.x + selectedElement.width / 2} ${
                    selectedElement.y + selectedElement.height / 2
                  })`
                : undefined
            }
          >
            {/* Blue bounding outline */}
            <rect
              x={selectedElement.x - 2}
              y={selectedElement.y - 2}
              width={selectedElement.width + 4}
              height={selectedElement.height + 4}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="1.5"
              pointerEvents="none"
            />

            {/* 8 Resize Handles */}
            {[
              { id: 'nw', x: selectedElement.x - 5, y: selectedElement.y - 5, cursor: 'nwse-resize' },
              {
                id: 'n',
                x: selectedElement.x + selectedElement.width / 2 - 4,
                y: selectedElement.y - 5,
                cursor: 'ns-resize',
              },
              {
                id: 'ne',
                x: selectedElement.x + selectedElement.width - 3,
                y: selectedElement.y - 5,
                cursor: 'nesw-resize',
              },
              {
                id: 'e',
                x: selectedElement.x + selectedElement.width - 3,
                y: selectedElement.y + selectedElement.height / 2 - 4,
                cursor: 'ew-resize',
              },
              {
                id: 'se',
                x: selectedElement.x + selectedElement.width - 3,
                y: selectedElement.y + selectedElement.height - 3,
                cursor: 'nwse-resize',
              },
              {
                id: 's',
                x: selectedElement.x + selectedElement.width / 2 - 4,
                y: selectedElement.y + selectedElement.height - 3,
                cursor: 'ns-resize',
              },
              {
                id: 'sw',
                x: selectedElement.x - 5,
                y: selectedElement.y + selectedElement.height - 3,
                cursor: 'nesw-resize',
              },
              {
                id: 'w',
                x: selectedElement.x - 5,
                y: selectedElement.y + selectedElement.height / 2 - 4,
                cursor: 'ew-resize',
              },
            ].map((h) => (
              <rect
                key={h.id}
                x={h.x}
                y={h.y}
                width="8"
                height="8"
                fill="#ffffff"
                stroke="#3b82f6"
                strokeWidth="1.5"
                style={{ cursor: h.cursor }}
                onPointerDown={(e) => handleResizePointerDown(h.id, e)}
              />
            ))}

            {/* Rotation Handle */}
            <line
              x1={selectedElement.x + selectedElement.width / 2}
              y1={selectedElement.y - 2}
              x2={selectedElement.x + selectedElement.width / 2}
              y2={selectedElement.y - 20}
              stroke="#3b82f6"
              strokeWidth="1.5"
            />
            <circle
              cx={selectedElement.x + selectedElement.width / 2}
              cy={selectedElement.y - 20}
              r="4.5"
              fill="#ffffff"
              stroke="#3b82f6"
              strokeWidth="1.5"
              style={{ cursor: 'grab' }}
              onPointerDown={handleRotatePointerDown}
            />
          </g>
        )}
      </svg>
    </div>
  );
};
