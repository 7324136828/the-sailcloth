import React from 'react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'V', desc: 'Select & Move tool' },
    { key: 'H', desc: 'Hand / Pan Canvas (or Space + Drag)' },
    { key: 'R', desc: 'Rectangle vector shape' },
    { key: 'O', desc: 'Ellipse / Circle shape' },
    { key: 'S', desc: 'Whiteboard Sticky Note' },
    { key: 'F', desc: 'Layout Artboard / Frame' },
    { key: 'T', desc: 'Typography / Text' },
    { key: 'L', desc: 'Connector Line & Arrow' },
    { key: 'P', desc: 'Freehand pencil / draw' },
    { key: 'Ctrl + Z', desc: 'Undo last action' },
    { key: 'Ctrl + Y', desc: 'Redo last action' },
    { key: 'Ctrl + D', desc: 'Duplicate selected element' },
    { key: 'Delete / Backspace', desc: 'Remove selected item' },
    { key: 'G', desc: 'Toggle background grid' },
    { key: 'Double-Click', desc: 'Edit text / sticky note inline' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card shortcuts-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⌨️ Keyboard Shortcuts & Cheatsheet</h2>
          <button className="modal-close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="shortcuts-table">
            {shortcuts.map((s) => (
              <div key={s.key} className="shortcut-row">
                <kbd className="shortcut-kbd">{s.key}</kbd>
                <span className="shortcut-desc">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
