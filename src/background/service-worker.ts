import { TimeCrowdApi } from '@/shared/api';
import { LinearApi } from '@/shared/linear-api';
import type { MessageRequest, MessageResponse } from '@/shared/messages';
import type { TimerState, RecentCategory, CategoryWithTeam } from '@/shared/types';
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

async function syncTimeToLinear(issueId: string): Promise<void> {
  console.log(`[TimeCrowd] syncTimeToLinear called: issueId=${issueId}`);

  const stored = await chrome.storage.local.get(['linear_api_key', 'timecrowd_token']);
  const linearKey = stored['linear_api_key'] as string | undefined;
  const tcToken = stored['timecrowd_token'] as string | undefined;
  if (!linearKey) {
    console.log('[TimeCrowd] Linear API key not set, skipping sync');
    return;
  }
  if (!tcToken) {
    console.log('[TimeCrowd] TimeCrowd token not set, skipping sync');
    return;
  }

  // TimeCrowdから全エントリを取得し、このIssueの合計時間を算出
  const tcApi = new TimeCrowdApi(tcToken);
  const entries = await tcApi.getTimeEntries();
  const matchingEntries = entries.filter(
    (e) => e.task && matchIssueIdInTitle(e.task.title, issueId),
  );
  const totalSeconds = matchingEntries.reduce((sum, e) => sum + (e.duration || 0), 0);
  console.log(
    `[TimeCrowd] Total time from TimeCrowd: ${totalSeconds}s (${formatDuration(totalSeconds)})`,
  );

  if (totalSeconds === 0) return;

  const linearApi = new LinearApi(linearKey);

  console.log(`[TimeCrowd] Resolving issue identifier: ${issueId}`);
  const issue = await linearApi.getIssueByIdentifier(issueId);
  if (!issue) {
    console.warn(`[TimeCrowd] Linear issue not found: ${issueId}`);
    return;
  }
  console.log(`[TimeCrowd] Resolved issue: ${issue.identifier} -> ${issue.id}`);

  const taskId = matchingEntries[0]?.task?.id;
  const attachmentUrl = taskId
    ? `https://timecrowd.net/app/mytasks/${taskId}/edit`
    : `https://timecrowd.net/app/mytasks`;
  const attachResult = await linearApi.createAttachment({
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
  console.log(`[TimeCrowd] Attachment created/updated: success=${attachResult.success}`);
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
          const prevEntry = await api.stopTimer(timerState.currentEntry.id);
          const prevIssueId = timerState.currentIssueId;
          if (prevIssueId && prevEntry.duration > 0) {
            syncTimeToLinear(prevIssueId).catch((err) => {
              console.error('[TimeCrowd] Linear sync failed (auto-switch):', err);
            });
          }
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
        console.log('[TimeCrowd] STOP_TIMER received', {
          isRunning: timerState.isRunning,
          currentEntry: timerState.currentEntry?.id,
          currentIssueId: timerState.currentIssueId,
        });
        if (!timerState.isRunning || !timerState.currentEntry) {
          console.log('[TimeCrowd] No active timer, skipping');
          return { success: true, data: timerState };
        }
        const stoppedEntry = await api.stopTimer(timerState.currentEntry.id);
        console.log('[TimeCrowd] TimeCrowd stop response:', {
          id: stoppedEntry.id,
          duration: stoppedEntry.duration,
          stopped_at: stoppedEntry.stopped_at,
        });
        const stoppedIssueId = timerState.currentIssueId;
        timerState = {
          isRunning: false,
          currentEntry: null,
          currentIssueId: null,
        };
        await chrome.storage.local.remove('timer_tracking');

        console.log('[TimeCrowd] Will sync to Linear?', {
          stoppedIssueId,
          duration: stoppedEntry.duration,
          willSync: !!(stoppedIssueId && stoppedEntry.duration > 0),
        });
        if (stoppedIssueId && stoppedEntry.duration > 0) {
          syncTimeToLinear(stoppedIssueId).catch((err) => {
            console.error('[TimeCrowd] Linear sync failed:', err);
          });
        }

        return { success: true, data: timerState };
      }

      case 'GET_CURRENT_TIMER': {
        return { success: true, data: timerState };
      }

      case 'GET_RECENT_CATEGORIES': {
        const stored = await chrome.storage.local.get(['recent_categories']);
        const recent = (stored['recent_categories'] as RecentCategory[]) || [];
        return { success: true, data: recent };
      }

      case 'GET_ALL_CATEGORIES': {
        const cacheKey = 'all_categories';
        const cached = getCached<CategoryWithTeam[]>(cacheKey);
        if (cached) return { success: true, data: cached };

        const teams = await api.getTeams();
        const allCategories: CategoryWithTeam[] = [];
        const results = await Promise.all(
          teams.map((team) => api.getCategories(team.id).then((cats) => ({ team, cats }))),
        );
        for (const { team, cats } of results) {
          for (const cat of cats) {
            allCategories.push({
              teamId: team.id,
              teamName: team.name,
              categoryId: cat.id,
              categoryTitle: cat.title,
              categoryColor: cat.color,
            });
          }
        }
        setCache(cacheKey, allCategories);
        return { success: true, data: allCategories };
      }

      case 'SAVE_RECENT_CATEGORY': {
        const stored = await chrome.storage.local.get(['recent_categories']);
        let recent = (stored['recent_categories'] as RecentCategory[]) || [];
        // 重複削除
        recent = recent.filter(
          (r) => !(r.teamId === message.teamId && r.categoryId === message.categoryId),
        );
        // 先頭に追加
        recent.unshift({
          teamId: message.teamId,
          teamName: message.teamName,
          categoryId: message.categoryId,
          categoryTitle: message.categoryTitle,
          usedAt: new Date().toISOString(),
        });
        // 最大5件に制限
        recent = recent.slice(0, 5);
        await chrome.storage.local.set({ recent_categories: recent });
        return { success: true, data: recent };
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

// --- Polling: detect timer stops from TimeCrowd UI ---
const POLL_ALARM_NAME = 'timecrowd-poll';
const POLL_INTERVAL_MINUTES = 5;

async function handlePollAlarm(): Promise<void> {
  const stored = await chrome.storage.local.get(['timer_tracking', 'timecrowd_token']);
  const tracking = stored['timer_tracking'] as TimerTracking | undefined;
  const token = stored['timecrowd_token'] as string | undefined;

  if (!tracking || !token) return;

  const api = new TimeCrowdApi(token);
  try {
    let entry;
    try {
      entry = await api.getTimeEntry(tracking.entryId);
    } catch {
      await chrome.storage.local.remove('timer_tracking');
      timerState = { isRunning: false, currentEntry: null, currentIssueId: null };
      return;
    }

    if (entry.stopped_at) {
      console.log(`[TimeCrowd] Detected external stop for ${tracking.issueId}`);

      await chrome.storage.local.remove('timer_tracking');
      timerState = { isRunning: false, currentEntry: null, currentIssueId: null };

      if (entry.duration > 0) {
        await syncTimeToLinear(tracking.issueId);
      }
    }
  } catch (err) {
    console.error('[TimeCrowd] Poll check failed:', err);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM_NAME) {
    handlePollAlarm();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(POLL_ALARM_NAME, { periodInMinutes: POLL_INTERVAL_MINUTES });
});

chrome.alarms.get(POLL_ALARM_NAME, (alarm) => {
  if (!alarm) {
    chrome.alarms.create(POLL_ALARM_NAME, { periodInMinutes: POLL_INTERVAL_MINUTES });
  }
});
