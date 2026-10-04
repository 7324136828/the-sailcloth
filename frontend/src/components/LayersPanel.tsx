import React from 'react';
import { Artboard, CanvasElement } from '../types';

interface LayersPanelProps {
  artboards: Artboard[];
  elements: CanvasElement[];
  selectedElementId: string | null;
  selectedArtboardId: string | null;
  onSelectElement: (id: string | null) => void;
  onSelectArtboard: (id: string | null) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onReorderElement: (id: string, direction: 'up' | 'down') => void;
  onDeleteElement: (id: string) => void;
  onDeleteArtboard: (id: string) => void;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
  artboards,
  elements,
  selectedElementId,
  selectedArtboardId,
  onSelectElement,
  onSelectArtboard,
  onToggleVisibility,
  onToggleLock,
  onReorderElement,
  onDeleteElement,
  onDeleteArtboard,
}) => {
  // Sort elements by zIndex descending (highest on top)
  const sortedElements = [...elements].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));

  const getElementIcon = (type: CanvasElement['type']) => {
    switch (type) {
      case 'rect': return '⬛';
      case 'circle': return '⚪';
      case 'triangle': return '▲';
      case 'star': return '★';
      case 'text': return 'T';
      case 'sticky': return '📝';
      case 'arrow':
      case 'line': return '➔';
      case 'freehand': return '✏️';
      default: return '📦';
    }
  };

  return (
    <aside className="layers-panel">
      <div className="layers-header">
        <span className="layers-title">Layers & Artboards</span>
        <span className="layers-count">{artboards.length + elements.length}</span>
      </div>

      <div className="layers-list">
        {/* Artboards Section */}
        {artboards.length > 0 && (
          <div className="layer-group">
            <div className="group-header">Artboards</div>
            {artboards.map((ab) => (
              <div
                key={ab.id}
                className={`layer-row ${selectedArtboardId === ab.id ? 'active' : ''}`}
                onClick={() => {
                  onSelectElement(null);
                  onSelectArtboard(ab.id);
                }}
              >
                <span className="layer-type-icon">📱</span>
                <span className="layer-name">{ab.name}</span>
                <div className="layer-row-actions">
                  <button
                    className="layer-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteArtboard(ab.id);
                    }}
                    title="Delete Artboard"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Elements Section */}
        <div className="layer-group">
          <div className="group-header">Canvas Objects</div>
          {sortedElements.length === 0 ? (
            <div className="empty-layers">No elements yet. Pick a tool to draw!</div>
          ) : (
            sortedElements.map((el) => (
              <div
                key={el.id}
                className={`layer-row ${selectedElementId === el.id ? 'active' : ''} ${
                  el.hidden ? 'is-hidden' : ''
                } ${el.locked ? 'is-locked' : ''}`}
                onClick={() => {
                  onSelectArtboard(null);
                  onSelectElement(el.id);
                }}
              >
                <span className="layer-type-icon">{getElementIcon(el.type)}</span>
                <span className="layer-name">{el.name || el.type}</span>

                <div className="layer-row-actions">
                  {/* Reorder Up */}
                  <button
                    className="layer-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorderElement(el.id, 'up');
                    }}
                    title="Move layer up"
                  >
                    ↑
                  </button>
                  {/* Reorder Down */}
                  <button
                    className="layer-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorderElement(el.id, 'down');
                    }}
                    title="Move layer down"
                  >
                    ↓
                  </button>
                  {/* Visibility toggle */}
                  <button
                    className={`layer-action-btn ${el.hidden ? 'muted' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVisibility(el.id);
                    }}
                    title={el.hidden ? 'Show element' : 'Hide element'}
                  >
                    {el.hidden ? '🙈' : '👁️'}
                  </button>
                  {/* Lock toggle */}
                  <button
                    className={`layer-action-btn ${el.locked ? 'highlight' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLock(el.id);
                    }}
                    title={el.locked ? 'Unlock element' : 'Lock element'}
                  >
                    {el.locked ? '🔒' : '🔓'}
                  </button>
                  {/* Delete */}
                  <button
                    className="layer-action-btn text-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteElement(el.id);
                    }}
                    title="Delete element"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
};
