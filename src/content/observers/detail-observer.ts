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
  registerIssueId: (issueId: string) => void,
) {
  function findProjectSection(): Element | null {
    // Find the "Project" label span in the right sidebar.
    // Structure: div (section) > span "Project" + div (value with data-detail-button inside)
    const spans = document.querySelectorAll('main span');
    for (const span of spans) {
      if (span.textContent?.trim() !== 'Project') continue;
      const section = span.parentElement;
      if (!section) continue;
      // Verify this is a sidebar property section by checking for data-detail-button in siblings
      if (section.querySelector('[data-detail-button]')) {
        return section;
      }
    }
    return null;
  }

  function processDetail() {
    const projectSection = findProjectSection();
    if (!projectSection || projectSection.getAttribute(PROCESSED_ATTR)) return;

    const url = window.location.pathname;
    const extractedId = extractIssueId(url);
    if (!extractedId) return;
    const issueId = extractedId;

    projectSection.setAttribute(PROCESSED_ATTR, 'true');
    registerIssueId(issueId);

    if (currentRoot) {
      currentRoot.unmount();
      currentRoot = null;
    }
    if (currentInterval) {
      clearInterval(currentInterval);
      currentInterval = null;
    }

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.padding = '4px 0';
    container.style.marginTop = '4px';

    // Insert after the Project section
    projectSection.after(container);

    const shadow = container.attachShadow({ mode: 'open' });
    const mountPoint = document.createElement('div');
    shadow.appendChild(mountPoint);

    currentRoot = createRoot(mountPoint);

    function getTitle(): string {
      return document.querySelector('[aria-label="Issue title"]')?.textContent?.trim() || '';
    }

    function render() {
      const state = getTimerState();
      const timeMap = getTimeMap();
      const title = getTitle();
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
            isRunning: state.isRunning && state.currentIssueId === issueId,
            startedAt: state.currentEntry?.started_at ?? null,
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
