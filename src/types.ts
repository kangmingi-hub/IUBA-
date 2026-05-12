/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Player {
  id: string;      // User ID와 동일
  name: string;    // User username과 동일
  color: string;
  characterUrl: string;
  gold: number;
  buildingPower: number;
}

export interface CountryState {
  id: string;
  name: string;
  ownerId: string | null;
  buildings: number;
  isDestroyed?: boolean;
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'member';
  password?: string;
}

export interface GameState {
  players: Player[];
  countries: Record<string, CountryState>;
  logs: GameLog[];
  users: User[]; // 사용자 목록
}

export interface GameLog {
  id: string;
  timestamp: number;
  message: string;
  type: 'evangelism' | 'speech' | 'purchase' | 'construction';
}

export const TEAM_COLORS = [
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#71717a', // Zinc
];
