export type ToolType =
  | 'select'
  | 'hand'
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'star'
  | 'text'
  | 'sticky'
  | 'artboard'
  | 'line'
  | 'arrow'
  | 'freehand'
  | 'connector';

export type StickyColor = 'yellow' | 'pink' | 'blue' | 'green' | 'orange' | 'purple';

export interface StickyPreset {
  id: StickyColor;
  label: string;
  fill: string;
  stroke: string;
  textColor: string;
}

export const STICKY_PRESETS: Record<StickyColor, StickyPreset> = {
  yellow: {
    id: 'yellow',
    label: 'Yellow',
    fill: '#fef08a',
    stroke: '#facc15',
    textColor: '#713f12',
  },
  pink: {
    id: 'pink',
    label: 'Pink',
    fill: '#fbcfe8',
    stroke: '#f472b6',
    textColor: '#831843',
  },
  blue: {
    id: 'blue',
    label: 'Sky Blue',
    fill: '#bae6fd',
    stroke: '#38bdf8',
    textColor: '#0369a1',
  },
  green: {
    id: 'green',
    label: 'Mint',
    fill: '#bbf7d0',
    stroke: '#4ade80',
    textColor: '#14532d',
  },
  orange: {
    id: 'orange',
    label: 'Peach',
    fill: '#fed7aa',
    stroke: '#fb923c',
    textColor: '#7c2d12',
  },
  purple: {
    id: 'purple',
    label: 'Lavender',
    fill: '#e9d5ff',
    stroke: '#c084fc',
    textColor: '#581c87',
  },
};

export type ArtboardPreset = 'desktop' | 'tablet' | 'mobile' | 'presentation' | 'custom';

export interface ArtboardPresetInfo {
  id: ArtboardPreset;
  label: string;
  width: number;
  height: number;
  icon: string;
}

export const ARTBOARD_PRESETS: Record<ArtboardPreset, ArtboardPresetInfo> = {
  desktop: {
    id: 'desktop',
    label: 'Desktop (1440 × 900)',
    width: 1440,
    height: 900,
    icon: '💻',
  },
  tablet: {
    id: 'tablet',
    label: 'Tablet / iPad (768 × 1024)',
    width: 768,
    height: 1024,
    icon: '📱',
  },
  mobile: {
    id: 'mobile',
    label: 'Mobile / iPhone (375 × 812)',
    width: 375,
    height: 812,
    icon: '📲',
  },
  presentation: {
    id: 'presentation',
    label: 'Slide 16:9 (1920 × 1080)',
    width: 1920,
    height: 1080,
    icon: '🖥️',
  },
  custom: {
    id: 'custom',
    label: 'Custom Size',
    width: 600,
    height: 400,
    icon: '📐',
  },
};

export interface CanvasElement {
  id: string;
  type:
    | 'rect'
    | 'circle'
    | 'triangle'
    | 'star'
    | 'text'
    | 'sticky'
    | 'line'
    | 'arrow'
    | 'freehand';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  artboardId?: string | null;

  // Visual styling
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeDash?: 'solid' | 'dashed' | 'dotted';
  opacity: number;
  cornerRadius?: number;
  shadow?: {
    x: number;
    y: number;
    blur: number;
    color: string;
  } | null;

  // Text & Sticky
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  textAlign?: 'left' | 'center' | 'right';
  textColor?: string;
  author?: string;
  colorPreset?: StickyColor | null;

  // Freehand path
  points?: Array<{ x: number; y: number }>;

  // Connectors / Lines
  arrowStart?: boolean;
  arrowEnd?: boolean;

  // Ordering & State
  zIndex: number;
  locked?: boolean;
  hidden?: boolean;
  layoutPosition?: 'auto' | 'absolute';
}

export interface AutoLayout {
  enabled: boolean;
  direction: 'row' | 'column';
  gap: number;
  padding: number;
  align: 'start' | 'center' | 'end';
  justify: 'start' | 'center' | 'end' | 'space-between' | 'space-around' | 'space-evenly';
  wrap: boolean;
}

export interface Artboard {
  id: string;
  name: string;
  preset: ArtboardPreset;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  clipContent: boolean;
  autoLayout?: AutoLayout | null;
}

export interface Connector {
  id: string;
  fromElementId: string;
  toElementId: string;
  stroke: string;
  strokeWidth: number;
  strokeDash: 'solid' | 'dashed';
  arrowEnd: boolean;
  label?: string;
}

export interface Viewport {
  zoom: number;
  panX: number;
  panY: number;
}

export interface CanvasSettings {
  grid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  theme: 'light' | 'dark';
  backgroundColor: string;
}

export interface CanvasData {
  schemaVersion?: 1;
  viewport: Viewport;
  settings: CanvasSettings;
  artboards: Artboard[];
  elements: CanvasElement[];
  connectors: Connector[];
}

export interface CanvasDocument {
  id: string;
  name: string;
  description: string;
  data: CanvasData;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface CanvasSummary {
  id: string;
  name: string;
  description: string;
  element_count: number;
  artboard_count: number;
  revision?: number;
  created_at: string;
  updated_at: string;
}

export interface CanvasVersion {
  id: string;
  canvas_id: string;
  label: string;
  name: string;
  revision: number;
  created_at: string;
}

export interface RequirementTopic {
  id: string;
  source: string;
  title: string;
  url: string;
  local_path: string;
  outline: Array<{ level: number; text: string }>;
  phase: number;
  status: 'needs_review';
  kind: 'reference' | 'documentation';
}

export interface RequirementTopics {
  total: number;
  offset: number;
  limit: number;
  items: RequirementTopic[];
}

export interface RequirementSource {
  id: string;
  name: string;
  root_url: string;
  downloaded_at: string;
  topic_count: number;
  status: 'snapshot' | 'missing' | 'landing_only';
  issues: string[];
}

export interface ImplementationPhase {
  id: number;
  title: string;
  status: string;
  dependencies: number[];
  scope: string;
  gate: string;
}

export interface PlatformCapability {
  id: string;
  title: string;
  phase: number;
  status: 'implemented' | 'partial' | 'planned' | 'blocked';
  scope: string;
  evidence: string;
  source_topic_ids: string[];
}

export interface RequirementsSummary {
  topic_count: number;
  unreviewed_count: number;
  sources: RequirementSource[];
  phases: ImplementationPhase[];
  capabilities: PlatformCapability[];
  coverage_note: string;
}
