import React, { useState } from 'react';
import {
  ARTBOARD_PRESETS,
  ArtboardPreset,
  STICKY_PRESETS,
  StickyColor,
  ToolType,
} from '../types';

interface ToolbarProps {
  activeTool: ToolType;
  selectedStickyColor: StickyColor;
  onSelectTool: (tool: ToolType) => void;
  onSelectStickyColor: (color: StickyColor) => void;
  onAddArtboardPreset: (preset: ArtboardPreset) => void;
  onAddQuickSticky: (color: StickyColor) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  selectedStickyColor,
  onSelectTool,
  onSelectStickyColor,
  onAddArtboardPreset,
  onAddQuickSticky,
}) => {
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [showStickyMenu, setShowStickyMenu] = useState(false);
  const [showArtboardMenu, setShowArtboardMenu] = useState(false);

  const isShapeActive = ['rect', 'circle', 'triangle', 'star'].includes(activeTool);

  const getShapeIcon = () => {
    switch (activeTool) {
      case 'circle': return '⚪';
      case 'triangle': return '▲';
      case 'star': return '★';
      case 'rect':
      default: return '⬛';
    }
  };

  return (
    <aside className="canvas-toolbar">
      {/* Selection Tool */}
      <button
        className={`tool-btn ${activeTool === 'select' ? 'active' : ''}`}
        onClick={() => onSelectTool('select')}
        title="Select / Move (V)"
      >
        <span className="tool-icon">↖</span>
        <span className="tool-shortcut">V</span>
      </button>

      {/* Hand / Pan Tool */}
      <button
        className={`tool-btn ${activeTool === 'hand' ? 'active' : ''}`}
        onClick={() => onSelectTool('hand')}
        title="Hand / Pan Canvas (H or Space+drag)"
      >
        <span className="tool-icon">✋</span>
        <span className="tool-shortcut">H</span>
      </button>

      <div className="toolbar-divider"></div>

      {/* Layout Artboard / Frame Tool with Dropdown */}
      <div className="tool-menu-container">
        <button
          className={`tool-btn ${activeTool === 'artboard' ? 'active' : ''}`}
          onClick={() => {
            onSelectTool('artboard');
            setShowArtboardMenu(!showArtboardMenu);
          }}
          title="Layout Frame / Artboard (F)"
        >
          <span className="tool-icon">📱</span>
          <span className="tool-shortcut">F</span>
        </button>

        {showArtboardMenu && (
          <div className="tool-flyout artboard-flyout">
            <div className="flyout-title">Layout Artboard Presets</div>
            {Object.values(ARTBOARD_PRESETS).map((p) => (
              <button
                key={p.id}
                className="flyout-item"
                onClick={() => {
                  setShowArtboardMenu(false);
                  onAddArtboardPreset(p.id);
                }}
              >
                <span className="preset-icon">{p.icon}</span>
                <span className="preset-label">{p.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Vector Shapes Dropdown */}
      <div className="tool-menu-container">
        <button
          className={`tool-btn ${isShapeActive ? 'active' : ''}`}
          onClick={() => {
            if (!isShapeActive) onSelectTool('rect');
            setShowShapeMenu(!showShapeMenu);
          }}
          title="Vector Shapes (R for Rectangle, O for Circle)"
        >
          <span className="tool-icon">{getShapeIcon()}</span>
          <span className="tool-shortcut">R</span>
        </button>

        {showShapeMenu && (
          <div className="tool-flyout shape-flyout">
            <button
              className={`flyout-item ${activeTool === 'rect' ? 'active' : ''}`}
              onClick={() => {
                setShowShapeMenu(false);
                onSelectTool('rect');
              }}
            >
              <span>⬛</span> Rectangle (R)
            </button>
            <button
              className={`flyout-item ${activeTool === 'circle' ? 'active' : ''}`}
              onClick={() => {
                setShowShapeMenu(false);
                onSelectTool('circle');
              }}
            >
              <span>⚪</span> Ellipse / Circle (O)
            </button>
            <button
              className={`flyout-item ${activeTool === 'triangle' ? 'active' : ''}`}
              onClick={() => {
                setShowShapeMenu(false);
                onSelectTool('triangle');
              }}
            >
              <span>▲</span> Triangle
            </button>
            <button
              className={`flyout-item ${activeTool === 'star' ? 'active' : ''}`}
              onClick={() => {
                setShowShapeMenu(false);
                onSelectTool('star');
              }}
            >
              <span>★</span> Star
            </button>
          </div>
        )}
      </div>

      {/* Sticky Note Tool with Color Palette Flyout */}
      <div className="tool-menu-container">
        <button
          className={`tool-btn ${activeTool === 'sticky' ? 'active' : ''}`}
          onClick={() => {
            onSelectTool('sticky');
            setShowStickyMenu(!showStickyMenu);
          }}
          title="Whiteboard Sticky Note (S)"
          style={{
            borderColor: activeTool === 'sticky' ? STICKY_PRESETS[selectedStickyColor].stroke : undefined,
          }}
        >
          <span
            className="tool-sticky-preview"
            style={{
              backgroundColor: STICKY_PRESETS[selectedStickyColor].fill,
              borderColor: STICKY_PRESETS[selectedStickyColor].stroke,
            }}
          ></span>
          <span className="tool-shortcut">S</span>
        </button>

        {showStickyMenu && (
          <div className="tool-flyout sticky-flyout">
            <div className="flyout-title">Sticky Note Colors</div>
            <div className="sticky-color-grid">
              {(Object.keys(STICKY_PRESETS) as StickyColor[]).map((c) => (
                <button
                  key={c}
                  className={`sticky-color-chip ${selectedStickyColor === c ? 'selected' : ''}`}
                  style={{
                    backgroundColor: STICKY_PRESETS[c].fill,
                    borderColor: STICKY_PRESETS[c].stroke,
                  }}
                  onClick={() => {
                    onSelectStickyColor(c);
                    onSelectTool('sticky');
                    setShowStickyMenu(false);
                    onAddQuickSticky(c);
                  }}
                  title={STICKY_PRESETS[c].label}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Text Tool */}
      <button
        className={`tool-btn ${activeTool === 'text' ? 'active' : ''}`}
        onClick={() => onSelectTool('text')}
        title="Typography & Text (T)"
      >
        <span className="tool-icon">T</span>
        <span className="tool-shortcut">T</span>
      </button>

      {/* Connector / Arrow Tool */}
      <button
        className={`tool-btn ${activeTool === 'connector' || activeTool === 'arrow' ? 'active' : ''}`}
        onClick={() => onSelectTool('arrow')}
        title="Connector Line & Arrow (L)"
      >
        <span className="tool-icon">➔</span>
        <span className="tool-shortcut">L</span>
      </button>

      {/* Freehand Brush Tool */}
      <button
        className={`tool-btn ${activeTool === 'freehand' ? 'active' : ''}`}
        onClick={() => onSelectTool('freehand')}
        title="Freehand Pencil / Draw (P)"
      >
        <span className="tool-icon">✏️</span>
        <span className="tool-shortcut">P</span>
      </button>
    </aside>
  );
};
