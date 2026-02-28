const ISSUE_ID_REGEX = /\b([A-Z][A-Z0-9]+-\d+)\b/;

export function extractIssueId(text: string): string | null {
  const match = text.match(ISSUE_ID_REGEX);
  return match ? match[1] : null;
}

export function matchIssueIdInTitle(title: string, issueId: string): boolean {
  return title.includes(issueId);
}

export function formatDuration(seconds: number): string {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}
