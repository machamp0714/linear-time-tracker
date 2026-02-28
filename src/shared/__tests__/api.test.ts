import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimeCrowdApi } from '../api';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('TimeCrowdApi', () => {
  let api: TimeCrowdApi;

  beforeEach(() => {
    api = new TimeCrowdApi('test-token');
    mockFetch.mockReset();
  });

  it('チーム一覧を取得する', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ id: 10, name: 'Team A' }]),
    });

    const teams = await api.getTeams();
    expect(teams).toEqual([{ id: 10, name: 'Team A' }]);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://timecrowd.net/api/v1/teams',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  it('チームのカテゴリ一覧を取得する', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ id: 1, title: 'Development', color: '#ff0000' }]),
    });

    const categories = await api.getCategories(10);
    expect(categories).toEqual([{ id: 1, title: 'Development', color: '#ff0000' }]);
  });

  it('タスクを作成してタイマーを開始する', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 100, title: '[TIM-1] Test' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 200, started_at: '2026-01-01T00:00:00Z' }),
      });

    const entry = await api.startTimer(
      10,
      1,
      'TIM-1',
      'Test task',
      'https://linear.app/team/TIM/issue/TIM-1/test-task',
    );
    expect(mockFetch).toHaveBeenCalledTimes(2);
    // Verify task creation uses nested "task" key and parent_id for category
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://timecrowd.net/api/v1/teams/10/tasks',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          task: {
            title: '[TIM-1] Test task',
            url: 'https://linear.app/team/TIM/issue/TIM-1/test-task',
            parent_id: 1,
          },
        }),
      }),
    );
    expect(entry).toEqual({ id: 200, started_at: '2026-01-01T00:00:00Z' });
  });

  it('現在のタイマーを停止する', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 200, stopped_at: '2026-01-01T01:00:00Z' }),
    });

    await api.stopTimer(200);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://timecrowd.net/api/v1/time_entries/200/stop',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('非OKレスポンスの場合はエラーをスローする', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    });

    await expect(api.getTeams()).rejects.toThrow('Unauthorized');
  });
});
