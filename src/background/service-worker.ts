import { TimeCrowdApi } from '@/shared/api';
import { LinearApi } from '@/shared/linear-api';
import type { MessageRequest, MessageResponse } from '@/shared/messages';
import type { TimerState } from '@/shared/types';
import { formatDuration, matchIssueIdInTitle } from '@/utils/issue-parser';

let timerState: TimerState = {
  isRunning: false,
  currentEntry: null,
  currentIssueId: null,
};

interface TimerTracking {
  issueId: string;
  entryId: number;
  startedAt: string;
}

const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5分

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expiry > Date.now()) return entry.data as T;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

async function getApi(): Promise<TimeCrowdApi> {
  const result = await chrome.storage.local.get(['timecrowd_token']);
  const token = result['timecrowd_token'] as string | undefined;
  if (!token)
    throw new Error('TimeCrowdトークンが未設定です。拡張機能の設定画面で入力してください。');
  return new TimeCrowdApi(token);
}

async function syncTimeToLinear(issueId: string, durationToAdd: number): Promise<void> {
  const result = await chrome.storage.local.get(['linear_api_key']);
  const linearKey = result['linear_api_key'] as string | undefined;
  if (!linearKey) return;

  const linearApi = new LinearApi(linearKey);

  const issue = await linearApi.getIssueByIdentifier(issueId);
  if (!issue) {
    console.warn(`[TimeCrowd] Linear issue not found: ${issueId}`);
    return;
  }

  const attachmentUrl = `timecrowd://linear/${issueId}`;
  const attachments = await linearApi.getIssueAttachments(issue.id);
  const existing = attachments.find((a) => a.url === attachmentUrl);

  const previousSeconds =
    existing && typeof existing.metadata?.trackedSeconds === 'number'
      ? existing.metadata.trackedSeconds
      : 0;
  const totalSeconds = previousSeconds + durationToAdd;

  await linearApi.createAttachment({
    issueId: issue.id,
    title: 'TimeCrowd 作業時間',
    subtitle: formatDuration(totalSeconds),
    url: attachmentUrl,
    metadata: {
      trackedSeconds: totalSeconds,
      source: 'timecrowd-linear-tracker',
      lastUpdated: new Date().toISOString(),
    },
  });
}

async function handleMessage(message: MessageRequest): Promise<MessageResponse> {
  try {
    const api = await getApi();

    switch (message.type) {
      case 'GET_TEAMS': {
        const cached = getCached('teams');
        if (cached) return { success: true, data: cached };
        const teams = await api.getTeams();
        setCache('teams', teams);
        return { success: true, data: teams };
      }

      case 'GET_CATEGORIES': {
        const cacheKey = `categories_${message.teamId}`;
        const cached = getCached(cacheKey);
        if (cached) return { success: true, data: cached };
        const categories = await api.getCategories(message.teamId);
        setCache(cacheKey, categories);
        return { success: true, data: categories };
      }

      case 'START_TIMER': {
        if (timerState.isRunning && timerState.currentEntry) {
          await api.stopTimer(timerState.currentEntry.id);
        }
        const entry = await api.startTimer(
          message.teamId,
          message.categoryId,
          message.issueId,
          message.title,
          message.linearUrl,
        );
        timerState = {
          isRunning: true,
          currentEntry: entry,
          currentIssueId: message.issueId,
        };
        await chrome.storage.local.set({
          timer_tracking: {
            issueId: message.issueId,
            entryId: entry.id,
            startedAt: entry.started_at,
          } satisfies TimerTracking,
        });
        return { success: true, data: timerState };
      }

      case 'STOP_TIMER': {
        if (!timerState.isRunning || !timerState.currentEntry) {
          return { success: true, data: timerState };
        }
        const stoppedEntry = await api.stopTimer(timerState.currentEntry.id);
        const stoppedIssueId = timerState.currentIssueId;
        timerState = {
          isRunning: false,
          currentEntry: null,
          currentIssueId: null,
        };
        await chrome.storage.local.remove('timer_tracking');

        if (stoppedIssueId && stoppedEntry.duration > 0) {
          syncTimeToLinear(stoppedIssueId, stoppedEntry.duration).catch((err) => {
            console.error('[TimeCrowd] Linear sync failed:', err);
          });
        }

        return { success: true, data: timerState };
      }

      case 'GET_CURRENT_TIMER': {
        return { success: true, data: timerState };
      }

      case 'GET_TIME_FOR_ISSUES': {
        const entries = await api.getTimeEntries();
        const timeMap: Record<string, number> = {};
        for (const issueId of message.issueIds) {
          const matched = entries.filter(
            (e) => e.task && matchIssueIdInTitle(e.task.title, issueId),
          );
          timeMap[issueId] = matched.reduce((sum, e) => sum + (e.duration || 0), 0);
        }
        return { success: true, data: timeMap };
      }

      default:
        return { success: false, error: '不明なメッセージタイプです' };
    }
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : '不明なエラー';
    return { success: false, error: errMessage };
  }
}

chrome.runtime.onMessage.addListener((message: MessageRequest, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true; // 非同期レスポンス
});
