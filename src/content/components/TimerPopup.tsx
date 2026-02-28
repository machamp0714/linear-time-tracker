import { useState, useEffect } from 'react';
import type { TimeCrowdTeam, TimeCrowdCategory } from '@/shared/types';

interface TimerPopupProps {
  issueId: string;
  issueTitle: string;
  onStart: (teamId: number, categoryId: number) => void;
  onClose: () => void;
}

function sendMessage<T>(message: unknown): Promise<T> {
  return chrome.runtime.sendMessage(message);
}

export function TimerPopup({ issueId, issueTitle, onStart, onClose }: TimerPopupProps) {
  const [teams, setTeams] = useState<TimeCrowdTeam[]>([]);
  const [categories, setCategories] = useState<TimeCrowdCategory[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sendMessage<{
      success: boolean;
      data: TimeCrowdTeam[];
      error?: string;
    }>({ type: 'GET_TEAMS' })
      .then((res) => {
        if (res.success) {
          setTeams(res.data);
          if (res.data.length === 1) setSelectedTeam(res.data[0].id);
        } else {
          setError(res.error || 'チームの読み込みに失敗しました');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTeam) return;
    sendMessage<{
      success: boolean;
      data: TimeCrowdCategory[];
      error?: string;
    }>({
      type: 'GET_CATEGORIES',
      teamId: selectedTeam,
    }).then((res) => {
      if (res.success) {
        setCategories(res.data);
        if (res.data.length > 0) setSelectedCategory(res.data[0].id);
      } else {
        setError(res.error || 'カテゴリの読み込みに失敗しました');
      }
    });
  }, [selectedTeam]);

  const handleStart = () => {
    if (selectedTeam && selectedCategory) {
      onStart(selectedTeam, selectedCategory);
    }
  };

  if (loading) {
    return (
      <div className="tc-popup">
        <span>読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="tc-popup" onClick={(e) => e.stopPropagation()}>
      <div style={{ marginBottom: 4, fontWeight: 500 }}>
        {issueId}: {issueTitle}
      </div>

      <label>チーム</label>
      <select value={selectedTeam ?? ''} onChange={(e) => setSelectedTeam(Number(e.target.value))}>
        <option value="" disabled>
          チームを選択
        </option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      {selectedTeam && (
        <>
          <label>カテゴリ</label>
          <select
            value={selectedCategory ?? ''}
            onChange={(e) => setSelectedCategory(Number(e.target.value))}
          >
            <option value="" disabled>
              カテゴリを選択
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </>
      )}

      <button
        className="tc-popup-btn"
        onClick={handleStart}
        disabled={!selectedTeam || !selectedCategory}
      >
        打刻開始
      </button>

      {error && <div className="tc-popup-error">{error}</div>}

      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: 'none',
          border: 'none',
          color: '#8b8fa3',
          cursor: 'pointer',
          fontSize: 16,
        }}
      >
        ×
      </button>
    </div>
  );
}
