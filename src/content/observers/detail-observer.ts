import { createRoot, Root } from 'react-dom/client';
import { createElement } from 'react';
import { extractIssueId } from '@/utils/issue-parser';
import { TimerButton } from '../components/TimerButton';
import { TimeBadge } from '../components/TimeBadge';
import type { TimerState } from '@/shared/types';

const PROCESSED_ATTR = 'data-tc-detail-processed';

let currentRoot: Root | null = null;
let currentInterval: ReturnType<typeof setInterval> | null = null;

export function observeIssueDetail(
  getTimerState: () => TimerState,
  getTimeMap: () => Record<string, number>,
  onStart: (issueId: string, title: string, teamId: number, categoryId: number) => void,
  onStop: () => void,
) {
  function processDetail() {
    const header = document.querySelector('[class*="IssueDetailHeader"], [class*="issueHeader"]');
    if (!header || header.getAttribute(PROCESSED_ATTR)) return;

    const url = window.location.pathname;
    const extractedId = extractIssueId(url);
    if (!extractedId) return;
    const issueId = extractedId;

    const titleEl = document.querySelector('[class*="issueTitle"], [class*="IssueTitle"], h1');
    const title = titleEl?.textContent || '';

    header.setAttribute(PROCESSED_ATTR, 'true');

    if (currentRoot) {
      currentRoot.unmount();
      currentRoot = null;
    }
    if (currentInterval) {
      clearInterval(currentInterval);
      currentInterval = null;
    }

    const container = document.createElement('div');
    container.style.display = 'inline-flex';
    container.style.alignItems = 'center';
    container.style.marginLeft = '8px';

    header.appendChild(container);

    const shadow = container.attachShadow({ mode: 'open' });
    const mountPoint = document.createElement('div');
    shadow.appendChild(mountPoint);

    currentRoot = createRoot(mountPoint);

    function render() {
      const state = getTimerState();
      const timeMap = getTimeMap();
      currentRoot!.render(
        createElement(
          'div',
          {
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            },
          },
          createElement(TimerButton, {
            issueId,
            issueTitle: title,
            isRunning: state.isRunning,
            isCurrentIssue: state.currentIssueId === issueId,
            onStart: (teamId: number, categoryId: number) =>
              onStart(issueId, title, teamId, categoryId),
            onStop,
          }),
          createElement(TimeBadge, {
            seconds: timeMap[issueId] || 0,
            variant: 'detail',
          }),
        ),
      );
    }

    render();
    currentInterval = setInterval(render, 3000);
  }

  processDetail();

  const observer = new MutationObserver(() => {
    processDetail();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return () => {
    observer.disconnect();
    if (currentRoot) currentRoot.unmount();
    if (currentInterval) clearInterval(currentInterval);
  };
}
