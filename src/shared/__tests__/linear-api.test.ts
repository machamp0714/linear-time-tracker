import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LinearApi } from '../linear-api';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('LinearApi', () => {
  let api: LinearApi;

  beforeEach(() => {
    api = new LinearApi('lin_api_test_token');
    mockFetch.mockReset();
  });

  it('Issue識別子からLinear内部IDを解決する', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            issue: { id: 'uuid-123', identifier: 'TIM-42' },
          },
        }),
    });

    const issue = await api.getIssueByIdentifier('TIM-42');
    expect(issue).toEqual({ id: 'uuid-123', identifier: 'TIM-42' });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.linear.app/graphql',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'lin_api_test_token',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('Issue が見つからない場合はnullを返す', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () =>
        Promise.resolve({
          errors: [{ message: 'Entity not found' }],
        }),
    });

    const issue = await api.getIssueByIdentifier('NONE-999');
    expect(issue).toBeNull();
  });

  it('Issueのattachment一覧を取得する', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            issue: {
              attachments: {
                nodes: [
                  {
                    id: 'att-1',
                    url: 'timecrowd://linear/TIM-42',
                    title: 'TimeCrowd 作業時間',
                    subtitle: '45m',
                    metadata: { trackedSeconds: 2700, source: 'timecrowd-linear-tracker' },
                  },
                ],
              },
            },
          },
        }),
    });

    const attachments = await api.getIssueAttachments('uuid-123');
    expect(attachments).toHaveLength(1);
    expect(attachments[0].url).toBe('timecrowd://linear/TIM-42');
  });

  it('Attachmentを作成する（upsert）', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            attachmentCreate: {
              success: true,
              attachment: { id: 'att-new', metadata: { trackedSeconds: 3600 } },
            },
          },
        }),
    });

    const result = await api.createAttachment({
      issueId: 'uuid-123',
      title: 'TimeCrowd 作業時間',
      subtitle: '1h 0m',
      url: 'timecrowd://linear/TIM-42',
      metadata: {
        trackedSeconds: 3600,
        source: 'timecrowd-linear-tracker',
        lastUpdated: '2026-02-28T15:00:00Z',
      },
    });

    expect(result.success).toBe(true);
  });

  it('GraphQL APIエラー時にthrowする', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ errors: [{ message: 'Authentication required' }] }),
    });

    await expect(api.getIssueAttachments('uuid-123')).rejects.toThrow('Authentication required');
  });
});
