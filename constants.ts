import { PlayerColor } from './types';

// Visual Colors
export const COLOR_MAP: Record<PlayerColor, string> = {
  [PlayerColor.RED]: '#ef4444',    // red-500
  [PlayerColor.BLUE]: '#3b82f6',   // blue-500
  [PlayerColor.GREEN]: '#22c55e',  // green-500
  [PlayerColor.PURPLE]: '#a855f7', // purple-500
  [PlayerColor.ORANGE]: '#f97316', // orange-500
  [PlayerColor.GRAY]: '#475569',   // slate-600 (Darker for better contrast)
};

export const HOVER_COLOR_MAP: Record<PlayerColor, string> = {
  [PlayerColor.RED]: '#b91c1c',
  [PlayerColor.BLUE]: '#1d4ed8',
  [PlayerColor.GREEN]: '#15803d',
  [PlayerColor.PURPLE]: '#7e22ce',
  [PlayerColor.ORANGE]: '#c2410c',
  [PlayerColor.GRAY]: '#334155',
};

// Game Logic Constants
export const GAME_WIDTH = 1200;
export const GAME_HEIGHT = 800;

// Dynamic Node Sizing Constants
export const NODE_RADIUS_BASE = 24; // All nodes start at this size

export const TICK_RATE_MS = 50; // 20 ticks per second
export const GROWTH_INTERVAL_MS = 1000; // Units grow every second

// Old Speed: 0.025. New Speed: 30% of that approx.
// 0.025 * 0.3 = 0.0075.
export const TRAVEL_SPEED = 0.0075; 

export const UNIT_SPAWN_INTERVAL_MS = 150; // How fast units leave the base (ms per unit)
export const OCEAN_CURRENT_INTERVAL_MS = 60000; // 60 Seconds

export const AI_ACTION_INTERVAL = 1000; // AI decides every 1 second (faster)

// Initial Setup
export const INITIAL_NEUTRAL_COUNT = 10; // Neutrals are easier to take initially
export const INITIAL_PLAYER_COUNT = 20;
export const MAX_CAPACITY_BASE = 150; // Cap to prevent infinite growth

export const PLAYABLE_COLORS = [
  PlayerColor.RED,
  PlayerColor.BLUE,
  PlayerColor.GREEN,
  PlayerColor.PURPLE,
  PlayerColor.ORANGE
];