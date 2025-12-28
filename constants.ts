import { PlayerColor, DifficultyLevel } from './types';

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
export const NODE_RADIUS_BASE = 19; // All nodes start at this size

export const TICK_RATE_MS = 50; // 20 ticks per second
export const GROWTH_INTERVAL_MS = 1000; // Units grow every second

// Movement & Combat Constants
// 4 pixels per tick (50ms) = 80 pixels/second.
// Max distance (~1200px) takes ~15s. Min distance (~150px) takes ~2s.
export const TRAVEL_SPEED_PIXELS = 4; 

// Base interval for spawning. Actual interval = BASE / (1 + ln(count))
// At count 10: ~150ms. At count 100: ~90ms.
export const BASE_SPAWN_INTERVAL_MS = 500; 

export const OCEAN_CURRENT_INTERVAL_MS = 60000; // 60 Seconds

export const AI_ACTION_INTERVAL_BASE = 1000; // Default base, overridden by difficulty

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

// AI Difficulty Configuration
interface DifficultyConfig {
  name: string;
  description: string;
  actionInterval: number; // How often AI thinks (ms)
  maxActionsPerTick: number; // How many nodes can attack simultaneously
  hesitationChance: number; // Chance (0-1) to skip an action even if good
}

export const DIFFICULTY_SETTINGS: Record<DifficultyLevel, DifficultyConfig> = {
  1: {
    name: "等级 1: 单核",
    description: "注意力极度有限。一次只能管理一个输出。",
    actionInterval: 2000,
    maxActionsPerTick: 1,
    hesitationChance: 0.5
  },
  2: {
    name: "等级 2: 双核",
    description: "反应速度慢。只能勉强应付两条战线。",
    actionInterval: 1800,
    maxActionsPerTick: 2,
    hesitationChance: 0.4
  },
  3: {
    name: "等级 3: 四核",
    description: "标准处理能力。有效管理小分队。",
    actionInterval: 1500,
    maxActionsPerTick: 4,
    hesitationChance: 0.3
  },
  4: {
    name: "等级 4: 八核",
    description: "高性能。能够进行多线作战。",
    actionInterval: 1200,
    maxActionsPerTick: 8,
    hesitationChance: 0.2
  },
  5: {
    name: "等级 5: 数据中心",
    description: "精英级处理能力。极少错失良机。",
    actionInterval: 1000,
    maxActionsPerTick: 16,
    hesitationChance: 0.1
  },
  6: {
    name: "等级 6: 蜂巢思维",
    description: "神一般的多任务处理能力。瞬间的全局指挥。",
    actionInterval: 1000,
    maxActionsPerTick: Infinity,
    hesitationChance: 0.0
  }
};