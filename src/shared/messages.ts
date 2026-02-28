import type { TimeCrowdTeam, TimeCrowdCategory, TimerState } from './types';

export type MessageRequest =
  | { type: 'GET_TEAMS' }
  | { type: 'GET_CATEGORIES'; teamId: number }
  | {
      type: 'START_TIMER';
      teamId: number;
      categoryId: number;
      issueId: string;
      title: string;
      linearUrl: string;
    }
  | { type: 'STOP_TIMER' }
  | { type: 'GET_CURRENT_TIMER' }
  | { type: 'GET_TIME_FOR_ISSUES'; issueIds: string[] };

export type MessageResponse = { success: true; data: unknown } | { success: false; error: string };

export type TeamsResponse =
  | { success: true; data: TimeCrowdTeam[] }
  | { success: false; error: string };

export type CategoriesResponse =
  | { success: true; data: TimeCrowdCategory[] }
  | { success: false; error: string };

export type TimerResponse = { success: true; data: TimerState } | { success: false; error: string };

export type TimeMapResponse =
  | { success: true; data: Record<string, number> }
  | { success: false; error: string };
