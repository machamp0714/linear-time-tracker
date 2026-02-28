import type { TimerState } from '@/shared/types';
import { observeIssueList } from './observers/list-observer';
import { observeIssueDetail } from './observers/detail-observer';

let timerState: TimerState = {
  isRunning: false,
  currentEntry: null,
  currentIssueId: null,
};
let timeMap: Record<string, number> = {};

function getTimerState(): TimerState {
  return timerState;
}

function getTimeMap(): Record<string, number> {
  return timeMap;
}

async function refreshTimerState() {
  const res = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_TIMER' });
  if (res.success) timerState = res.data;
}

async function refreshTimeMap(issueIds: string[]) {
  if (issueIds.length === 0) return;
  const res = await chrome.runtime.sendMessage({
    type: 'GET_TIME_FOR_ISSUES',
    issueIds,
  });
  if (res.success) timeMap = { ...timeMap, ...res.data };
}

function registerIssueId(issueId: string) {
  if (!(issueId in timeMap)) {
    timeMap[issueId] = 0;
    refreshTimeMap([issueId]);
  }
}

async function handleStart(issueId: string, title: string, teamId: number, categoryId: number) {
  const linearUrl = `https://linear.app${window.location.pathname}`;
  const res = await chrome.runtime.sendMessage({
    type: 'START_TIMER',
    teamId,
    categoryId,
    issueId,
    title,
    linearUrl,
  });
  if (res.success) timerState = res.data;
}

async function handleStop() {
  const res = await chrome.runtime.sendMessage({ type: 'STOP_TIMER' });
  if (res.success) {
    timerState = res.data;
    const issueIds = Object.keys(timeMap);
    if (issueIds.length > 0) refreshTimeMap(issueIds);
  }
}

function init() {
  refreshTimerState();

  observeIssueList(getTimerState, getTimeMap, handleStart, handleStop, registerIssueId);
  observeIssueDetail(getTimerState, getTimeMap, handleStart, handleStop, registerIssueId);

  // 30秒ごとに時間データを更新
  setInterval(() => {
    refreshTimerState();
    const issueIds = Object.keys(timeMap);
    if (issueIds.length > 0) refreshTimeMap(issueIds);
  }, 30000);

  // URL変更を検知（SPA遷移対応）
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
    }
  });
  urlObserver.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
