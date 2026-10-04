import React from 'react';
import { Artboard, CanvasElement, Connector } from '../types';

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTemplate: (artboards: Artboard[], elements: CanvasElement[], connectors: Connector[]) => void;
}

export const TemplateModal: React.FC<TemplateModalProps> = ({ isOpen, onClose, onApplyTemplate }) => {
  if (!isOpen) return null;

  const loadAgileWhiteboard = () => {
    const artboard: Artboard = {
      id: `ab-agile-${Date.now()}`,
      name: 'Team Sprint Whiteboard',
      preset: 'presentation',
      x: 100,
      y: 100,
      width: 1200,
      height: 720,
      fill: '#f8fafc',
      clipContent: true,
    };

    const elements: CanvasElement[] = [
      // 3 Column headers
      {
        id: `col-1-${Date.now()}`,
        type: 'rect',
        name: 'To Do Column',
        x: 140,
        y: 140,
        width: 320,
        height: 640,
        rotation: 0,
        fill: '#f1f5f9',
        stroke: '#e2e8f0',
        strokeWidth: 1,
        cornerRadius: 12,
        opacity: 1,
        zIndex: 1,
      },
      {
        id: `col-title-1-${Date.now()}`,
        type: 'text',
        name: 'To Do Header',
        x: 160,
        y: 160,
        width: 280,
        height: 30,
        rotation: 0,
        fill: 'transparent',
        stroke: 'transparent',
        strokeWidth: 0,
        opacity: 1,
        text: '📋 TO DO (3)',
        fontSize: 18,
        fontWeight: 700,
        textColor: '#334155',
        zIndex: 2,
      },
      {
        id: `sticky-todo-1-${Date.now()}`,
        type: 'sticky',
        name: 'User Research Sticky',
        x: 160,
        y: 210,
        width: 280,
        height: 140,
        rotation: -1,
        fill: '#fef08a',
        stroke: '#facc15',
        strokeWidth: 1,
        cornerRadius: 8,
        opacity: 1,
        text: 'Interview 5 product designers on canvas snapping workflows',
        fontSize: 14,
        textColor: '#713f12',
        author: 'UX Research',
        colorPreset: 'yellow',
        zIndex: 3,
      },
      {
        id: `sticky-todo-2-${Date.now()}`,
        type: 'sticky',
        name: 'Dark Mode Sticky',
        x: 160,
        y: 370,
        width: 280,
        height: 140,
        rotation: 2,
        fill: '#fed7aa',
        stroke: '#fb923c',
        strokeWidth: 1,
        cornerRadius: 8,
        opacity: 1,
        text: 'Implement high-contrast canvas mode for accessibility',
        fontSize: 14,
        textColor: '#7c2d12',
        author: 'Frontend Team',
        colorPreset: 'orange',
        zIndex: 4,
      },

      // In Progress Column
      {
        id: `col-2-${Date.now()}`,
        type: 'rect',
        name: 'In Progress Column',
        x: 500,
        y: 140,
        width: 320,
        height: 640,
        rotation: 0,
        fill: '#f1f5f9',
        stroke: '#e2e8f0',
        strokeWidth: 1,
        cornerRadius: 12,
        opacity: 1,
        zIndex: 1,
      },
      {
        id: `col-title-2-${Date.now()}`,
        type: 'text',
        name: 'In Progress Header',
        x: 520,
        y: 160,
        width: 280,
        height: 30,
        rotation: 0,
        fill: 'transparent',
        stroke: 'transparent',
        strokeWidth: 0,
        opacity: 1,
        text: '⚡ IN PROGRESS (1)',
        fontSize: 18,
        fontWeight: 700,
        textColor: '#0284c7',
        zIndex: 2,
      },
      {
        id: `sticky-prog-1-${Date.now()}`,
        type: 'sticky',
        name: 'Vector Pen Tool Sticky',
        x: 520,
        y: 210,
        width: 280,
        height: 140,
        rotation: 1,
        fill: '#bae6fd',
        stroke: '#38bdf8',
        strokeWidth: 1,
        cornerRadius: 8,
        opacity: 1,
        text: 'Full-stack SQLite persistence with atomic transactions',
        fontSize: 14,
        textColor: '#0369a1',
        author: 'Backend Team',
        colorPreset: 'blue',
        zIndex: 3,
      },

      // Done Column
      {
        id: `col-3-${Date.now()}`,
        type: 'rect',
        name: 'Done Column',
        x: 860,
        y: 140,
        width: 320,
        height: 640,
        rotation: 0,
        fill: '#f1f5f9',
        stroke: '#e2e8f0',
        strokeWidth: 1,
        cornerRadius: 12,
        opacity: 1,
        zIndex: 1,
      },
      {
        id: `col-title-3-${Date.now()}`,
        type: 'text',
        name: 'Done Header',
        x: 880,
        y: 160,
        width: 280,
        height: 30,
        rotation: 0,
        fill: 'transparent',
        stroke: 'transparent',
        strokeWidth: 0,
        opacity: 1,
        text: '✅ DONE (2)',
        fontSize: 18,
        fontWeight: 700,
        textColor: '#16a34a',
        zIndex: 2,
      },
      {
        id: `sticky-done-1-${Date.now()}`,
        type: 'sticky',
        name: 'Design System Done',
        x: 880,
        y: 210,
        width: 280,
        height: 140,
        rotation: -2,
        fill: '#bbf7d0',
        stroke: '#4ade80',
        strokeWidth: 1,
        cornerRadius: 8,
        opacity: 1,
        text: 'Integrated vector shapes, device frames & sticky notes',
        fontSize: 14,
        textColor: '#14532d',
        author: 'Tech Lead',
        colorPreset: 'green',
        zIndex: 3,
      },
    ];

    onApplyTemplate([artboard], elements, []);
    onClose();
  };

  const loadMobileWireframe = () => {
    const artboard: Artboard = {
      id: `ab-mobile-${Date.now()}`,
      name: 'Mobile App Wireframe (375x812)',
      preset: 'mobile',
      x: 200,
      y: 100,
      width: 375,
      height: 720,
      fill: '#ffffff',
      clipContent: true,
    };

    const elements: CanvasElement[] = [
      // Header
      {
        id: `m-header-${Date.now()}`,
        type: 'rect',
        name: 'Header Bar',
        x: 200,
        y: 100,
        width: 375,
        height: 64,
        rotation: 0,
        artboardId: artboard.id,
        fill: '#0f172a',
        stroke: 'transparent',
        strokeWidth: 0,
        opacity: 1,
        zIndex: 1,
      },
      {
        id: `m-title-${Date.now()}`,
        type: 'text',
        name: 'App Title',
        x: 220,
        y: 122,
        width: 200,
        height: 24,
        rotation: 0,
        artboardId: artboard.id,
        fill: 'transparent',
        stroke: 'transparent',
        strokeWidth: 0,
        opacity: 1,
        text: 'OmniStudio App',
        fontSize: 18,
        fontWeight: 700,
        textColor: '#ffffff',
        zIndex: 2,
      },
      // Hero Card
      {
        id: `m-card-${Date.now()}`,
        type: 'rect',
        name: 'Featured Project Card',
        x: 220,
        y: 180,
        width: 335,
        height: 180,
        rotation: 0,
        artboardId: artboard.id,
        fill: '#3b82f6',
        stroke: 'transparent',
        strokeWidth: 0,
        cornerRadius: 16,
        opacity: 1,
        shadow: { x: 0, y: 8, blur: 20, color: 'rgba(59, 130, 246, 0.2)' },
        zIndex: 3,
      },
      {
        id: `m-card-text-${Date.now()}`,
        type: 'text',
        name: 'Card Content',
        x: 240,
        y: 210,
        width: 295,
        height: 50,
        rotation: 0,
        artboardId: artboard.id,
        fill: 'transparent',
        stroke: 'transparent',
        strokeWidth: 0,
        opacity: 1,
        text: 'Design once, prototype anywhere',
        fontSize: 20,
        fontWeight: 700,
        textColor: '#ffffff',
        zIndex: 4,
      },
      // Action button
      {
        id: `m-btn-${Date.now()}`,
        type: 'rect',
        name: 'CTA Button',
        x: 240,
        y: 290,
        width: 140,
        height: 44,
        rotation: 0,
        artboardId: artboard.id,
        fill: '#ffffff',
        stroke: 'transparent',
        strokeWidth: 0,
        cornerRadius: 22,
        opacity: 1,
        zIndex: 5,
      },
      {
        id: `m-btn-label-${Date.now()}`,
        type: 'text',
        name: 'Button Label',
        x: 260,
        y: 304,
        width: 100,
        height: 20,
        rotation: 0,
        artboardId: artboard.id,
        fill: 'transparent',
        stroke: 'transparent',
        strokeWidth: 0,
        opacity: 1,
        text: 'Explore Now',
        fontSize: 14,
        fontWeight: 600,
        textColor: '#2563eb',
        zIndex: 6,
      },
      // Feedback Sticky Note next to phone
      {
        id: `m-sticky-${Date.now()}`,
        type: 'sticky',
        name: 'Design Review Note',
        x: 620,
        y: 200,
        width: 220,
        height: 160,
        rotation: 3,
        fill: '#fbcfe8',
        stroke: '#f472b6',
        strokeWidth: 1,
        cornerRadius: 8,
        opacity: 1,
        text: 'Ensure button touch target adheres to WCAG 44x44px minimum!',
        fontSize: 14,
        textColor: '#831843',
        author: 'Accessibility Review',
        colorPreset: 'pink',
        zIndex: 7,
      },
    ];

    onApplyTemplate([artboard], elements, []);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🧩 Canvas Templates & Layouts</h2>
          <button className="modal-close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <p className="modal-subtitle">
            Insert a complete layout with artboards, vector shapes, and sticky notes into your canvas.
          </p>

          <div className="template-grid">
            <div className="template-card" onClick={loadAgileWhiteboard}>
              <div className="template-icon">📋</div>
              <h3>Team Sprint Whiteboard</h3>
              <p>Miro-style Kanban board with sticky note columns: To Do, In Progress, and Done.</p>
              <button className="template-select-btn">Insert Whiteboard</button>
            </div>

            <div className="template-card" onClick={loadMobileWireframe}>
              <div className="template-icon">📱</div>
              <h3>Mobile App Wireframe</h3>
              <p>Figma-style iPhone layout artboard with navigation, hero card, buttons, and review notes.</p>
              <button className="template-select-btn">Insert Wireframe</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
