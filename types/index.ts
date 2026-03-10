// Strict TypeScript interfaces for the Spatial AI Workspace

import { Node, Edge } from 'reactflow';

// Available pastel colors from our design system
export type PastelColor =
  | 'pastel-pink'
  | 'pastel-blue'
  | 'pastel-green'
  | 'pastel-lavender';

// Tool modes for the canvas
export type ToolMode = 'hand' | 'select' | 'pen' | 'arrow';

// Clipboard interface
export interface ClipboardData {
  nodes: CanvasNodeType[];
  edges: Edge[];
  arrows: ArrowShape[];
  operation: 'copy' | 'cut';
}

// Drawing stroke interface
export interface DrawingStroke {
  id: string;
  points: number[][];
  color: string;
  size: number;
}

// Arrow shape interface for free-form arrows (FigJam-style)
export interface ArrowShape {
  id: string;
  start: { x: number; y: number };     // tail point
  control: { x: number; y: number };   // mid control point (for curve)
  end: { x: number; y: number };       // head point (arrowhead)
  color: string;
  size: number;                        // stroke width
}

// Color mapping for Tailwind classes
export const PASTEL_COLORS: Record<PastelColor, string> = {
  'pastel-pink': '#FDE2E4',
  'pastel-blue': '#D7E3FC',
  'pastel-green': '#E2F0CB',
  'pastel-lavender': '#EAF4F4',
};

// Smart tag interface for categorization
export interface SmartTag {
  id: string;
  label: string;
  color?: PastelColor;
}

// Data structure for each MindNode
export interface MindNodeData {
  question: string;
  response: string;
  tags: SmartTag[];
  color: PastelColor;
  createdAt: Date;
  collapsed?: boolean;
  isTyping?: boolean; // For typewriter animation
  isFavorite?: boolean; // For favorites feature
}

// Data structure for AI Input Node
export interface AIInputNodeData {
  contextParentId: string;
  inputValue: string;
  color: PastelColor;
}

// Data structure for Image Node
export interface ImageNodeData {
  src: string;
  fileName?: string;
  width?: number;
  height?: number;
  rotation?: number;
}

// Data structure for Text Node
export interface TextNodeData {
  content: string;
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  fontWeight: 'normal' | 'bold';
  textAlign: 'left' | 'center' | 'right';
  color: PastelColor;
  hasBackground?: boolean;
}



// Extended React Flow node types
export type MindNodeType = Node<MindNodeData>;
export type AIInputNodeType = Node<AIInputNodeData>;
export type ImageNodeType = Node<ImageNodeData>;
export type TextNodeType = Node<TextNodeData>;
export type CanvasNodeType = MindNodeType | AIInputNodeType | ImageNodeType | TextNodeType;

// Store state interface
export interface MindStoreState {
  // Canvas data
  nodes: CanvasNodeType[];
  edges: Edge[];

  // Tool state
  tool: ToolMode;
  setTool: (tool: ToolMode) => void;

  // Viewport center (for placing new nodes in visible area)
  viewportCenter: { x: number; y: number };
  setViewportCenter: (center: { x: number; y: number }) => void;

  // Pending viewport to restore when switching workspaces
  pendingViewport: { x: number; y: number; zoom: number } | null;
  setPendingViewport: (viewport: { x: number; y: number; zoom: number } | null) => void;

  // Conversion state - locks edge deletion during node transitions
  isProcessingConversion: boolean;

  // Edge highlight state (for disconnect preview)
  highlightedEdgeId: string | null;
  setHighlightedEdge: (edgeId: string | null) => void;

  // Search state
  searchQuery: string;
  searchMode: 'keyword' | 'tag';
  setSearchQuery: (query: string) => void;
  setSearchMode: (mode: 'keyword' | 'tag') => void;
  getMatchingNodeIds: () => string[];

  // Favorites state
  isFavoritesFilterActive: boolean;
  setFavoritesFilterActive: (active: boolean) => void;
  toggleFavorite: (nodeId: string) => void;
  getFavoriteCount: () => number;
  getFavoriteNodeIds: () => string[];

  // Guest Limit Modal State
  guestLimitReason: 'ai' | 'node' | 'workspace' | null;
  setGuestLimitReason: (reason: 'ai' | 'node' | 'workspace' | null) => void;

  // Drawing state
  strokes: DrawingStroke[];
  strokeHistory: DrawingStroke[][]; // Undo history
  strokeFuture: DrawingStroke[][];  // Redo history
  currentStroke: { points: number[][]; color: string; size: number } | null;
  penColor: string;

  // Arrow state
  arrows: ArrowShape[];
  addArrow: (arrow: Omit<ArrowShape, 'id'>) => void;
  updateArrow: (id: string, updates: Partial<ArrowShape>) => void;
  deleteArrow: (id: string) => void;
  penSize: number;
  isEraser: boolean;
  eraserSize: number;
  addStroke: (stroke: Omit<DrawingStroke, 'id'>) => void;
  setCurrentStroke: (stroke: { points: number[][]; color: string; size: number } | null) => void;
  setPenColor: (color: string) => void;
  setPenSize: (size: number) => void;
  setIsEraser: (isEraser: boolean) => void;
  setEraserSize: (size: number) => void;
  undoStroke: () => void;
  redoStroke: () => void;
  clearStrokes: () => void;
  deleteStroke: (strokeId: string) => void;

  // Actions
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  addRootNode: (position: { x: number; y: number }) => void;
  updateNodeData: (nodeId: string, data: Partial<MindNodeData> | Partial<AIInputNodeData> | Partial<TextNodeData>) => void;

  // AI Input actions
  spawnAIInput: (parentId: string, handleId: string) => void;
  convertAIInputToMind: (nodeId: string, question: string) => void;

  // Tag actions
  updateTag: (nodeId: string, tagId: string, newLabel: string) => void;
  addTag: (nodeId: string, label: string) => void;
  removeTag: (nodeId: string, tagId: string) => void;

  // Image actions
  addImageNode: (file: File, position: { x: number; y: number }) => boolean;

  // Text actions
  addTextNode: (position: { x: number; y: number }) => void;

  // Visibility actions
  toggleNodeCollapse: (nodeId: string) => void;



  // Color actions
  updateNodeColorWithChildren: (nodeId: string, color: PastelColor) => void;

  // Node/Edge helpers
  getConnectedNodes: (nodeId: string) => CanvasNodeType[];
  getEdgesForHandle: (nodeId: string, handleId: string) => Edge[];
  disconnectEdge: (edgeId: string) => void;
  deleteNode: (nodeId: string) => void;
  regenerateNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string) => void;

  // Copy, Paste, Cut, Duplicate actions
  clipboard: ClipboardData | null;
  setClipboard: (data: ClipboardData | null) => void;
  copySelection: (nodeIds: string[], arrowIds: string[]) => void;
  cutSelection: (nodeIds: string[], arrowIds: string[]) => void;
  pasteSelection: (position?: { x: number; y: number }) => boolean;
  duplicateSelection: (nodeIds: string[], arrowIds: string[]) => boolean;

  // Layout actions
  tidyUpNodes: () => void;
}

// Position interface for drag and drop
export interface DropPosition {
  x: number;
  y: number;
}

// Workspace interface for sidebar history
export interface Workspace {
  id: string;
  name: string;
  nodes: CanvasNodeType[];
  edges: Edge[];
  strokes: DrawingStroke[]; // Pen strokes
  arrows: ArrowShape[];     // Free-form arrows
  viewport?: { x: number; y: number; zoom: number }; // Canvas viewport position
  createdAt: Date;
  updatedAt: Date;
  isFavorite?: boolean;
}

// Workspace store state interface
export interface WorkspaceStoreState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  isSidebarOpen: boolean;
  isLoaded: boolean; // True after workspaces loaded
  userId: string | null; // For cloud sync
  isLoading: boolean; // Loading state for async ops

  // Actions
  setUserId: (userId: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  createWorkspace: (name?: string) => Promise<string | null>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
  renameWorkspace: (workspaceId: string, newName: string) => Promise<void>;
  toggleWorkspaceFavorite: (workspaceId: string) => Promise<void>;
  saveCurrentWorkspace: (immediate?: boolean) => Promise<void>;
  loadWorkspaces: () => Promise<void>;
  getActiveWorkspace: () => Workspace | null;
}
