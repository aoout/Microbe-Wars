
export enum PlayerColor {
  RED = 'RED',
  BLUE = 'BLUE',
  GREEN = 'GREEN',
  PURPLE = 'PURPLE',
  ORANGE = 'ORANGE',
  GRAY = 'GRAY' // Neutral
}

export type DifficultyLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type GameMode = 'CLASSIC' | 'HONEYCOMB';

export type NodeType = 'DEFAULT' | 'FORTRESS' | 'HIVE';

export interface Node {
  id: string;
  x: number;
  y: number;
  owner: PlayerColor;
  count: number;
  capacity: number;
  radius: number;
  growthAccumulator: number; // For sub-integer growth handling
  type: NodeType; // New property
  
  // Visual State
  captureProgress: number; // 0 to 1. 1 means fully settled color.
  prevOwner: PlayerColor; // The color being replaced (for ink effect)
}

export type EdgeType = 'PERMANENT' | 'RANDOM';

export interface Edge {
  source: string;
  target: string;
  type: EdgeType;
}

export interface TravelPayload {
  id: string;
  sourceId: string;
  targetId: string;
  owner: PlayerColor;
  count: number; // Usually 1 now
  progress: number; // 0 to 1
  speed: number; // Individual speed based on source size
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface ActiveTransfer {
  id: string;
  sourceId: string;
  targetId: string;
  owner: PlayerColor;
  totalToSend: number; // How many we intend to send
  sentCount: number;   // How many sent so far
  lastSpawnTime: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

// Visual Events (Transient, cleared every tick)
export interface GameEvent {
  type: 'IMPACT';
  targetId: string;
  angle: number; // Radian direction of impact
  force: number; // 0 to 1 scale
  color: PlayerColor; // Color of the projectile
}

export type GameState = 'MENU' | 'TUTORIAL' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'DEFEAT';

export interface GameWorld {
  nodes: Node[];
  edges: Edge[];
  payloads: TravelPayload[];
  transfers: ActiveTransfer[];
  latestEvents: GameEvent[]; // New: For tracking impacts between frames
}

export interface TutorialStep {
  id: number;
  text: string;
  targetNodeId?: string; // If set, highlights this node
  requiredAction?: 'NEXT' | 'SELECT' | 'ATTACK' | 'CAPTURE' | 'STREAM' | 'WIN';
}
