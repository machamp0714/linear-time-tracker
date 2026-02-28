import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { extractIssueId } from '@/utils/issue-parser';
import { TimerButton } from '../components/TimerButton';
import { TimeBadge } from '../components/TimeBadge';
import type { TimerState } from '@/shared/types';

const PROCESSED_ATTR = 'data-tc-processed';

export function observeIssueList(
  getTimerState: () => TimerState,
  getTimeMap: () => Record<string, number>,
  onStart: (issueId: string, title: string, teamId: number, categoryId: number) => void,
  onStop: () => void,
) {
  function processIssueRows() {
    const rows = document.querySelectorAll(
      '[data-testid*="issue"], [class*="IssueRow"], [class*="issueRow"]',
    );

    rows.forEach((row) => {
      if (row.getAttribute(PROCESSED_ATTR)) return;

      const issueIdEl = row.querySelector('[class*="identifier"], [class*="Identifier"]');
      const issueIdText = issueIdEl?.textContent || '';
      const extractedId = extractIssueId(issueIdText);
      if (!extractedId) return;
      const issueId = extractedId;

      const titleEl = row.querySelector('[class*="title"], [class*="Title"]');
      const title = titleEl?.textContent || '';

      row.setAttribute(PROCESSED_ATTR, 'true');

      const container = document.createElement('div');
      container.style.display = 'inline-flex';
      container.style.alignItems = 'center';
      container.style.marginLeft = '4px';

      const insertTarget = issueIdEl?.parentElement || row;
      insertTarget.appendChild(container);

      const shadow = container.attachShadow({ mode: 'open' });
      const styleSheet = document.createElement('style');
      shadow.appendChild(styleSheet);

      const mountPoint = document.createElement('div');
      shadow.appendChild(mountPoint);

      const root = createRoot(mountPoint);

      function render() {
        const state = getTimerState();
        const timeMap = getTimeMap();
        root.render(
          createElement(
            'div',
            {
              style: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
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
              variant: 'compact',
            }),
          ),
        );
      }

      render();

      const interval = setInterval(render, 3000);

      const cleanupObserver = new MutationObserver(() => {
        if (!document.contains(row)) {
          clearInterval(interval);
          root.unmount();
          cleanupObserver.disconnect();
        }
      });
      cleanupObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    });
  }

  processIssueRows();

  const observer = new MutationObserver(() => {
    processIssueRows();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return () => observer.disconnect();
}
