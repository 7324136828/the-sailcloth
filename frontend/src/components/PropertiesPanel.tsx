import React from 'react';
import {
  AutoLayout,
  Artboard,
  ARTBOARD_PRESETS,
  ArtboardPreset,
  CanvasElement,
  CanvasSettings,
  STICKY_PRESETS,
  StickyColor,
} from '../types';

interface PropertiesPanelProps {
  selectedElement: CanvasElement | null;
  selectedArtboard: Artboard | null;
  artboards: Artboard[];
  settings: CanvasSettings;
  elementCount: number;
  artboardCount: number;
  onUpdateElement: (updates: Partial<CanvasElement>) => void;
  onUpdateArtboard: (updates: Partial<Artboard>) => void;
  onUpdateSettings: (updates: Partial<CanvasSettings>) => void;
  onAlignElements: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onReorderElement: (direction: 'front' | 'back' | 'forward' | 'backward') => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onReflowArtboard: (id: string) => void;
}

const PRESET_COLORS = [
  '#ffffff',
  '#000000',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
  '#f1f5f9',
];

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedElement,
  selectedArtboard,
  artboards,
  settings,
  elementCount,
  artboardCount,
  onUpdateElement,
  onUpdateArtboard,
  onUpdateSettings,
  onAlignElements,
  onReorderElement,
  onDuplicateSelected,
  onDeleteSelected,
  onReflowArtboard,
}) => {
  // If an element is selected
  if (selectedElement) {
    const isSticky = selectedElement.type === 'sticky';
    const isText = selectedElement.type === 'text';

    return (
      <aside className="properties-panel">
        <div className="panel-header">
          <div className="panel-title-row">
            <span className="element-badge">{selectedElement.type.toUpperCase()}</span>
            <input
              className="element-name-input"
              value={selectedElement.name}
              onChange={(e) => onUpdateElement({ name: e.target.value })}
              title="Rename element"
            />
          </div>
          <div className="panel-quick-actions">
            <button
              className="btn-icon-subtle"
              onClick={onDuplicateSelected}
              title="Duplicate (Ctrl+D)"
            >
              📋
            </button>
            <button
              className="btn-icon-subtle text-danger"
              onClick={onDeleteSelected}
              title="Delete (Del)"
            >
              🗑️
            </button>
          </div>
        </div>

        {/* Alignment Controls */}
        <div className="prop-section">
          <div className="section-label">Alignment</div>
          <div className="align-button-group">
            <button
              className="align-btn"
              onClick={() => onAlignElements('left')}
              title="Align Left"
            >
              ⇤
            </button>
            <button
              className="align-btn"
              onClick={() => onAlignElements('center')}
              title="Align Horizontal Center"
            >
              ⇹
            </button>
            <button
              className="align-btn"
              onClick={() => onAlignElements('right')}
              title="Align Right"
            >
              ⇥
            </button>
            <button
              className="align-btn"
              onClick={() => onAlignElements('top')}
              title="Align Top"
            >
              ⤒
            </button>
            <button
              className="align-btn"
              onClick={() => onAlignElements('middle')}
              title="Align Vertical Middle"
            >
              ⇕
            </button>
            <button
              className="align-btn"
              onClick={() => onAlignElements('bottom')}
              title="Align Bottom"
            >
              ⤓
            </button>
          </div>
        </div>

        {/* Geometry / Transform */}
        <div className="prop-section">
          <div className="section-label">Layout & Transform</div>
          <div className="grid-2col">
            <div className="field-group">
              <label>X</label>
              <input
                type="number"
                value={Math.round(selectedElement.x)}
                onChange={(e) => onUpdateElement({ x: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="field-group">
              <label>Y</label>
              <input
                type="number"
                value={Math.round(selectedElement.y)}
                onChange={(e) => onUpdateElement({ y: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="field-group">
              <label>W</label>
              <input
                type="number"
                min="10"
                value={Math.round(selectedElement.width)}
                onChange={(e) =>
                  onUpdateElement({ width: Math.max(10, parseFloat(e.target.value) || 10) })
                }
              />
            </div>
            <div className="field-group">
              <label>H</label>
              <input
                type="number"
                min="10"
                value={Math.round(selectedElement.height)}
                onChange={(e) =>
                  onUpdateElement({ height: Math.max(10, parseFloat(e.target.value) || 10) })
                }
              />
            </div>
          </div>
          <div className="field-group mt-2">
            <label>Rotation (°)</label>
            <input
              type="number"
              min="-360"
              max="360"
              value={selectedElement.rotation || 0}
              onChange={(e) => onUpdateElement({ rotation: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="prop-section">
          <div className="section-label">Frame Layout</div>
          <div className="field-group">
            <label htmlFor="element-parent-frame">Parent frame</label>
            <select id="element-parent-frame" value={selectedElement.artboardId ?? ''}
              onChange={(event) => onUpdateElement({ artboardId: event.target.value || null })}>
              <option value="">None (canvas)</option>
              {artboards.map((frame) => <option value={frame.id} key={frame.id}>{frame.name}</option>)}
            </select>
          </div>
          {selectedElement.artboardId && <div className="field-group mt-2">
            <label htmlFor="element-layout-position">Layout position</label>
            <select id="element-layout-position" value={selectedElement.layoutPosition ?? 'auto'}
              onChange={(event) => onUpdateElement({ layoutPosition: event.target.value as 'auto' | 'absolute' })}>
              <option value="auto">Auto (in flow)</option>
              <option value="absolute">Absolute (free position)</option>
            </select>
          </div>}
        </div>

        {/* Sticky Note Specifics */}
        {isSticky && (
          <div className="prop-section sticky-settings">
            <div className="section-label">Sticky Note Note Style</div>
            <div className="sticky-color-swatches">
              {(Object.keys(STICKY_PRESETS) as StickyColor[]).map((c) => {
                const preset = STICKY_PRESETS[c];
                return (
                  <button
                    key={c}
                    className={`swatch-btn ${selectedElement.colorPreset === c ? 'active' : ''}`}
                    style={{ backgroundColor: preset.fill, borderColor: preset.stroke }}
                    title={preset.label}
                    onClick={() =>
                      onUpdateElement({
                        colorPreset: c,
                        fill: preset.fill,
                        stroke: preset.stroke,
                        textColor: preset.textColor,
                      })
                    }
                  />
                );
              })}
            </div>
            <div className="field-group mt-2">
              <label>Author / Tag</label>
              <input
                type="text"
                placeholder="e.g. Design Team"
                value={selectedElement.author || ''}
                onChange={(e) => onUpdateElement({ author: e.target.value })}
              />
            </div>
            <div className="field-group mt-2">
              <label>Note Content</label>
              <textarea
                className="prop-textarea"
                rows={4}
                value={selectedElement.text || ''}
                onChange={(e) => onUpdateElement({ text: e.target.value })}
                placeholder="Type note message..."
              />
            </div>
          </div>
        )}

        {/* Text Specifics */}
        {isText && (
          <div className="prop-section">
            <div className="section-label">Typography</div>
            <div className="field-group">
              <label>Text Content</label>
              <textarea
                className="prop-textarea"
                rows={3}
                value={selectedElement.text || ''}
                onChange={(e) => onUpdateElement({ text: e.target.value })}
              />
            </div>
            <div className="grid-2col mt-2">
              <div className="field-group">
                <label>Font Size</label>
                <input
                  type="number"
                  min="8"
                  max="144"
                  value={selectedElement.fontSize || 16}
                  onChange={(e) =>
                    onUpdateElement({ fontSize: parseInt(e.target.value) || 16 })
                  }
                />
              </div>
              <div className="field-group">
                <label>Weight</label>
                <select
                  value={selectedElement.fontWeight || 'normal'}
                  onChange={(e) => onUpdateElement({ fontWeight: e.target.value })}
                >
                  <option value="normal">Regular</option>
                  <option value="500">Medium</option>
                  <option value="600">Semibold</option>
                  <option value="700">Bold</option>
                  <option value="900">Black</option>
                </select>
              </div>
            </div>
            <div className="field-group mt-2">
              <label>Font Family</label>
              <select
                value={selectedElement.fontFamily || 'Inter, sans-serif'}
                onChange={(e) => onUpdateElement({ fontFamily: e.target.value })}
              >
                <option value="Inter, sans-serif">Inter</option>
                <option value="system-ui, sans-serif">System UI</option>
                <option value="Roboto, sans-serif">Roboto</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="'Courier New', monospace">Monospace</option>
              </select>
            </div>
            <div className="field-group mt-2">
              <label>Text Color</label>
              <div className="color-row">
                <input
                  type="color"
                  value={selectedElement.textColor || '#0f172a'}
                  onChange={(e) => onUpdateElement({ textColor: e.target.value })}
                />
                <input
                  type="text"
                  className="color-hex-input"
                  value={selectedElement.textColor || '#0f172a'}
                  onChange={(e) => onUpdateElement({ textColor: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {/* Fill & Stroke Appearance */}
        {!isText && (
          <div className="prop-section">
            <div className="section-label">Appearance & Styling</div>

            {/* Fill */}
            <div className="field-group">
              <div className="sub-label-row">
                <label>Fill</label>
                <button
                  className="btn-text-subtle"
                  onClick={() =>
                    onUpdateElement({
                      fill: selectedElement.fill === 'transparent' ? '#3b82f6' : 'transparent',
                    })
                  }
                >
                  {selectedElement.fill === 'transparent' ? 'Solid' : 'None'}
                </button>
              </div>
              <div className="color-row">
                <input
                  type="color"
                  value={
                    selectedElement.fill === 'transparent' ? '#3b82f6' : selectedElement.fill
                  }
                  onChange={(e) => onUpdateElement({ fill: e.target.value })}
                />
                <input
                  type="text"
                  className="color-hex-input"
                  value={selectedElement.fill}
                  onChange={(e) => onUpdateElement({ fill: e.target.value })}
                />
              </div>
              <div className="swatches-row">
                {PRESET_COLORS.map((hex) => (
                  <button
                    key={hex}
                    className="mini-swatch"
                    style={{ backgroundColor: hex }}
                    onClick={() => onUpdateElement({ fill: hex })}
                  />
                ))}
              </div>
            </div>

            {/* Stroke */}
            <div className="field-group mt-3">
              <div className="sub-label-row">
                <label>Border / Stroke</label>
                <button
                  className="btn-text-subtle"
                  onClick={() =>
                    onUpdateElement({
                      stroke:
                        selectedElement.stroke === 'transparent' ? '#0f172a' : 'transparent',
                      strokeWidth: selectedElement.strokeWidth === 0 ? 2 : selectedElement.strokeWidth,
                    })
                  }
                >
                  {selectedElement.stroke === 'transparent' || selectedElement.strokeWidth === 0
                    ? 'Add'
                    : 'Remove'}
                </button>
              </div>
              <div className="color-row">
                <input
                  type="color"
                  value={
                    selectedElement.stroke === 'transparent' ? '#0f172a' : selectedElement.stroke
                  }
                  onChange={(e) => onUpdateElement({ stroke: e.target.value })}
                />
                <input
                  type="number"
                  min="0"
                  max="20"
                  className="stroke-width-input"
                  value={selectedElement.strokeWidth}
                  onChange={(e) =>
                    onUpdateElement({ strokeWidth: parseInt(e.target.value) || 0 })
                  }
                  title="Stroke width"
                />
                <select
                  value={selectedElement.strokeDash || 'solid'}
                  onChange={(e) =>
                    onUpdateElement({ strokeDash: e.target.value as 'solid' | 'dashed' | 'dotted' })
                  }
                  className="stroke-dash-select"
                >
                  <option value="solid">— Solid</option>
                  <option value="dashed">-- Dashed</option>
                  <option value="dotted">·· Dotted</option>
                </select>
              </div>
            </div>

            {/* Corner Radius & Opacity */}
            <div className="grid-2col mt-3">
              <div className="field-group">
                <label>Radius (px)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={selectedElement.cornerRadius || 0}
                  onChange={(e) =>
                    onUpdateElement({ cornerRadius: Math.max(0, parseInt(e.target.value) || 0) })
                  }
                />
              </div>
              <div className="field-group">
                <label>Opacity (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={Math.round((selectedElement.opacity ?? 1) * 100)}
                  onChange={(e) =>
                    onUpdateElement({
                      opacity: Math.min(1, Math.max(0, (parseInt(e.target.value) || 0) / 100)),
                    })
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* Layer Ordering */}
        <div className="prop-section">
          <div className="section-label">Layer Order</div>
          <div className="btn-group full-width">
            <button
              className="layer-order-btn"
              onClick={() => onReorderElement('front')}
              title="Bring to Front"
            >
              Bring Front
            </button>
            <button
              className="layer-order-btn"
              onClick={() => onReorderElement('forward')}
              title="Bring Forward"
            >
              Forward
            </button>
            <button
              className="layer-order-btn"
              onClick={() => onReorderElement('backward')}
              title="Send Backward"
            >
              Backward
            </button>
            <button
              className="layer-order-btn"
              onClick={() => onReorderElement('back')}
              title="Send to Back"
            >
              Send Back
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // If an Artboard is selected
  if (selectedArtboard) {
    const layout: AutoLayout = selectedArtboard.autoLayout ?? {
      enabled: false, direction: 'row', gap: 16, padding: 20,
      align: 'start', justify: 'start', wrap: false,
    };
    const updateLayout = (updates: Partial<AutoLayout>) => onUpdateArtboard({ autoLayout: { ...layout, ...updates } });
    return (
      <aside className="properties-panel">
        <div className="panel-header">
          <div className="panel-title-row">
            <span className="element-badge badge-artboard">ARTBOARD</span>
            <input
              className="element-name-input"
              value={selectedArtboard.name}
              onChange={(e) => onUpdateArtboard({ name: e.target.value })}
            />
          </div>
          <button
            className="btn-icon-subtle text-danger"
            onClick={onDeleteSelected}
            title="Delete Artboard"
          >
            🗑️
          </button>
        </div>

        <div className="prop-section">
          <div className="section-label">Preset Size</div>
          <select
            value={selectedArtboard.preset}
            onChange={(e) => {
              const presetKey = e.target.value as ArtboardPreset;
              const preset = ARTBOARD_PRESETS[presetKey];
              if (preset) {
                onUpdateArtboard({
                  preset: presetKey,
                  width: preset.width,
                  height: preset.height,
                });
              }
            }}
          >
            {Object.values(ARTBOARD_PRESETS).map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon} {p.label}
              </option>
            ))}
          </select>

          <div className="grid-2col mt-3">
            <div className="field-group">
              <label>Width</label>
              <input
                type="number"
                value={selectedArtboard.width}
                onChange={(e) =>
                  onUpdateArtboard({ width: Math.max(100, parseInt(e.target.value) || 100) })
                }
              />
            </div>
            <div className="field-group">
              <label>Height</label>
              <input
                type="number"
                value={selectedArtboard.height}
                onChange={(e) =>
                  onUpdateArtboard({ height: Math.max(100, parseInt(e.target.value) || 100) })
                }
              />
            </div>
          </div>
        </div>

        <div className="prop-section">
          <div className="section-label">Background & Frame</div>
          <div className="field-group">
            <label>Artboard Background</label>
            <div className="color-row">
              <input
                type="color"
                value={selectedArtboard.fill}
                onChange={(e) => onUpdateArtboard({ fill: e.target.value })}
              />
              <input
                type="text"
                className="color-hex-input"
                value={selectedArtboard.fill}
                onChange={(e) => onUpdateArtboard({ fill: e.target.value })}
              />
            </div>
          </div>
          <div className="checkbox-row mt-3">
            <label>
              <input
                type="checkbox"
                checked={selectedArtboard.clipContent}
                onChange={(e) => onUpdateArtboard({ clipContent: e.target.checked })}
              />
              <span>Clip content outside frame</span>
            </label>
          </div>
        </div>
        <div className="prop-section">
          <div className="section-label">Auto Layout</div>
          <div className="checkbox-row">
            <label><input type="checkbox" checked={layout.enabled}
              onChange={(event) => updateLayout({ enabled: event.target.checked })} />Enable auto layout</label>
          </div>
          {layout.enabled && <>
            <div className="field-group mt-3">
              <label htmlFor="layout-direction">Direction</label>
              <select id="layout-direction" value={layout.direction}
                onChange={(event) => updateLayout({ direction: event.target.value as AutoLayout['direction'] })}>
                <option value="row">Row (horizontal)</option><option value="column">Column (vertical)</option>
              </select>
            </div>
            <div className="grid-2col mt-2">
              <div className="field-group"><label htmlFor="layout-gap">Gap</label>
                <input id="layout-gap" type="number" min={0} max={10000} value={layout.gap}
                  onChange={(event) => updateLayout({ gap: Math.max(0, Math.min(10000, Number(event.target.value) || 0)) })} />
              </div>
              <div className="field-group"><label htmlFor="layout-padding">Padding</label>
                <input id="layout-padding" type="number" min={0} max={10000} value={layout.padding}
                  onChange={(event) => updateLayout({ padding: Math.max(0, Math.min(10000, Number(event.target.value) || 0)) })} />
              </div>
            </div>
            <div className="field-group mt-2"><label htmlFor="layout-align">Align items</label>
              <select id="layout-align" value={layout.align}
                onChange={(event) => updateLayout({ align: event.target.value as AutoLayout['align'] })}>
                <option value="start">Start</option><option value="center">Center</option><option value="end">End</option>
              </select>
            </div>
            <div className="field-group mt-2"><label htmlFor="layout-justify">Justify content</label>
              <select id="layout-justify" value={layout.justify}
                onChange={(event) => updateLayout({ justify: event.target.value as AutoLayout['justify'] })}>
                <option value="start">Start</option><option value="center">Center</option><option value="end">End</option>
                <option value="space-between">Space between</option><option value="space-around">Space around</option>
                <option value="space-evenly">Space evenly</option>
              </select>
            </div>
            <div className="checkbox-row mt-2"><label><input type="checkbox" checked={layout.wrap}
              onChange={(event) => updateLayout({ wrap: event.target.checked })} />Wrap children</label></div>
            <button className="nav-action-btn btn-secondary full-width mt-3" onClick={() => onReflowArtboard(selectedArtboard.id)}>Reflow children</button>
            <p className="platform-meta">Children follow layer order. Absolute children stay outside the flow. Advanced sizing, nested layout, and grid are tracked in Requirements.</p>
          </>}
        </div>
      </aside>
    );
  }

  // Nothing selected: Canvas settings
  return (
    <aside className="properties-panel">
      <div className="panel-header">
        <div className="panel-title-row">
          <span className="element-badge badge-canvas">CANVAS</span>
          <span className="panel-subtitle">Document Settings</span>
        </div>
      </div>

      <div className="prop-section">
        <div className="section-label">Canvas View</div>
        <div className="field-group">
          <label>Canvas Background</label>
          <div className="color-row">
            <input
              type="color"
              value={settings.backgroundColor}
              onChange={(e) => onUpdateSettings({ backgroundColor: e.target.value })}
            />
            <input
              type="text"
              className="color-hex-input"
              value={settings.backgroundColor}
              onChange={(e) => onUpdateSettings({ backgroundColor: e.target.value })}
            />
          </div>
          <div className="swatches-row">
            {['#f8fafc', '#ffffff', '#0f172a', '#1e293b', '#f1f5f9'].map((hex) => (
              <button
                key={hex}
                className="mini-swatch"
                style={{ backgroundColor: hex }}
                onClick={() => onUpdateSettings({ backgroundColor: hex })}
              />
            ))}
          </div>
        </div>

        <div className="checkbox-row mt-3">
          <label>
            <input
              type="checkbox"
              checked={settings.grid}
              onChange={(e) => onUpdateSettings({ grid: e.target.checked })}
            />
            <span>Show Grid Background</span>
          </label>
        </div>

        <div className="checkbox-row mt-2">
          <label>
            <input
              type="checkbox"
              checked={settings.snapToGrid}
              onChange={(e) => onUpdateSettings({ snapToGrid: e.target.checked })}
            />
            <span>Snap to Grid</span>
          </label>
        </div>

        <div className="field-group mt-3">
          <label>Grid Size: {settings.gridSize}px</label>
          <input
            type="range"
            min="10"
            max="50"
            step="5"
            value={settings.gridSize}
            onChange={(e) => onUpdateSettings({ gridSize: parseInt(e.target.value) || 20 })}
          />
        </div>
      </div>

      <div className="prop-section">
        <div className="section-label">Project Stats</div>
        <div className="stats-box">
          <div className="stat-line">
            <span>Layout Artboards</span>
            <strong>{artboardCount}</strong>
          </div>
          <div className="stat-line">
            <span>Visual Elements</span>
            <strong>{elementCount}</strong>
          </div>
          <div className="stat-line">
            <span>Storage Backend</span>
            <strong className="text-success">SQLite (WAL)</strong>
          </div>
        </div>
      </div>
    </aside>
  );
};
