import type { TimeCrowdTeam, TimeCrowdCategory, TimeCrowdTimeEntry } from './types';

const BASE_URL = 'https://timecrowd.net/api/v1';

export class TimeCrowdApi {
  constructor(private token: string) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || `API error: ${res.status}`);
    }
    return data;
  }

  async getTeams(): Promise<TimeCrowdTeam[]> {
    return this.request<TimeCrowdTeam[]>('/teams');
  }

  async getCategories(teamId: number): Promise<TimeCrowdCategory[]> {
    return this.request<TimeCrowdCategory[]>(`/teams/${teamId}/categories`);
  }

  async startTimer(
    teamId: number,
    categoryId: number,
    issueId: string,
    title: string,
    linearUrl: string,
  ): Promise<TimeCrowdTimeEntry> {
    const task = await this.request<{ id: number }>(`/teams/${teamId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        title: `[${issueId}] ${title}`,
        url: linearUrl,
        category_id: categoryId,
      }),
    });

    return this.request<TimeCrowdTimeEntry>(`/teams/${teamId}/tasks/${task.id}/start`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async stopTimer(entryId: number): Promise<TimeCrowdTimeEntry> {
    return this.request<TimeCrowdTimeEntry>(`/time_entries/${entryId}/stop`, {
      method: 'PATCH',
    });
  }

  async getTimeEntries(): Promise<TimeCrowdTimeEntry[]> {
    return this.request<TimeCrowdTimeEntry[]>('/time_entries');
  }
}
