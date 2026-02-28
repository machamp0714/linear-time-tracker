export interface TimeCrowdTeam {
  id: number;
  name: string;
}

export interface TimeCrowdCategory {
  id: number;
  title: string;
  color: string;
}

export interface TimeCrowdTask {
  id: number;
  title: string;
  url: string;
  team: TimeCrowdTeam;
  category: TimeCrowdCategory | null;
  time_entries: TimeCrowdTimeEntry[];
}

export interface TimeCrowdTimeEntry {
  id: number;
  started_at: string;
  stopped_at: string | null;
  duration: number;
  user: {
    id: number;
    nickname: string;
  };
  task: TimeCrowdTask;
}

export interface TimeCrowdUser {
  id: number;
  nickname: string;
  teams: TimeCrowdTeam[];
}

export interface TimerState {
  isRunning: boolean;
  currentEntry: TimeCrowdTimeEntry | null;
  currentIssueId: string | null;
}

// Linear API types
export interface LinearIssueNode {
  id: string;
  identifier: string;
}

export interface LinearAttachmentNode {
  id: string;
  url: string;
  title: string;
  subtitle: string;
  metadata: Record<string, unknown>;
}

export interface LinearAttachmentCreateInput {
  issueId: string;
  title: string;
  subtitle: string;
  url: string;
  metadata: Record<string, unknown>;
}
