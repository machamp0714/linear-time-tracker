import { describe, it, expect } from 'vitest';
import { extractIssueId, matchIssueIdInTitle, formatDuration } from '../issue-parser';

describe('extractIssueId', () => {
  it('LinearのURLパスからIssue IDを抽出する', () => {
    expect(extractIssueId('/team/TIM/issue/TIM-123/some-title')).toBe('TIM-123');
  });

  it('DOMテキスト "TIM-123" からIssue IDを抽出する', () => {
    expect(extractIssueId('TIM-123')).toBe('TIM-123');
  });

  it('異なるチームプレフィックスでもIssue IDを抽出する', () => {
    expect(extractIssueId('ABC-456')).toBe('ABC-456');
    expect(extractIssueId('MY-1')).toBe('MY-1');
  });

  it('Issue IDがない文字列ではnullを返す', () => {
    expect(extractIssueId('no issue here')).toBeNull();
    expect(extractIssueId('')).toBeNull();
  });
});

describe('matchIssueIdInTitle', () => {
  it('[TIM-123]形式のTimeCrowdタスクタイトルにマッチする', () => {
    expect(matchIssueIdInTitle('[TIM-123] Fix login bug', 'TIM-123')).toBe(true);
  });

  it('括弧なしのTIM-123にもマッチする', () => {
    expect(matchIssueIdInTitle('TIM-123 Fix login bug', 'TIM-123')).toBe(true);
  });

  it('Issue IDが見つからない場合はfalseを返す', () => {
    expect(matchIssueIdInTitle('Some other task', 'TIM-123')).toBe(false);
  });
});

describe('formatDuration', () => {
  it('秒数をHH:MM:SS形式にフォーマットする', () => {
    expect(formatDuration(3600)).toBe('01:00:00');
    expect(formatDuration(5400)).toBe('01:30:00');
    expect(formatDuration(900)).toBe('00:15:00');
    expect(formatDuration(0)).toBe('00:00:00');
    expect(formatDuration(3661)).toBe('01:01:01');
  });
});
