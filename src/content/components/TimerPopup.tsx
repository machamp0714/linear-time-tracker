import { useState, useEffect, useCallback, useRef } from 'react';
import type { RecentCategory, CategoryWithTeam } from '@/shared/types';

interface TimerPopupProps {
  issueId: string;
  issueTitle: string;
  onStart: (teamId: number, categoryId: number) => void;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

function sendMessage<T>(message: unknown): Promise<T> {
  return chrome.runtime.sendMessage(message);
}

interface SelectedItem {
  teamId: number;
  categoryId: number;
}

export function TimerPopup({ issueId, issueTitle, onStart, onClose, anchorRef }: TimerPopupProps) {
  const [recentCategories, setRecentCategories] = useState<RecentCategory[]>([]);
  const [allCategories, setAllCategories] = useState<CategoryWithTeam[]>([]);
  const [allCategoriesLoaded, setAllCategoriesLoaded] = useState(false);
  const [allCategoriesLoading, setAllCategoriesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentLoading, setRecentLoading] = useState(true);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);

  // Calculate fixed position from anchor element
  useEffect(() => {
    if (!anchorRef?.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const popupWidth = 280;
    // Position below the button, aligned to the right edge
    let left = rect.right - popupWidth;
    if (left < 8) left = 8;
    setPopupPos({ top: rect.bottom + 4, left });
  }, [anchorRef]);

  const allCategoriesLoadedRef = useRef(false);
  const allCategoriesLoadingRef = useRef(false);

  // Load recent categories on mount
  useEffect(() => {
    sendMessage<{
      success: boolean;
      data: RecentCategory[];
      error?: string;
    }>({ type: 'GET_RECENT_CATEGORIES' })
      .then((res) => {
        if (res.success) {
          setRecentCategories(res.data);
        } else {
          setError(res.error || '最近のカテゴリーの読み込みに失敗しました');
        }
      })
      .catch(() => {
        setError('最近のカテゴリーの読み込みに失敗しました');
      })
      .finally(() => {
        setRecentLoading(false);
      });
  }, []);

  // Lazy-load all categories (called once when user starts typing)
  const loadAllCategories = useCallback(() => {
    if (allCategoriesLoadedRef.current || allCategoriesLoadingRef.current) return;
    allCategoriesLoadingRef.current = true;
    setAllCategoriesLoading(true);

    sendMessage<{
      success: boolean;
      data: CategoryWithTeam[];
      error?: string;
    }>({ type: 'GET_ALL_CATEGORIES' })
      .then((res) => {
        if (res.success) {
          setAllCategories(res.data);
          allCategoriesLoadedRef.current = true;
          setAllCategoriesLoaded(true);
        } else {
          setError(res.error || 'カテゴリーの読み込みに失敗しました');
        }
      })
      .catch(() => {
        setError('カテゴリーの読み込みに失敗しました');
      })
      .finally(() => {
        allCategoriesLoadingRef.current = false;
        setAllCategoriesLoading(false);
      });
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.length > 0) {
      loadAllCategories();
    }
    setSelected(null);
  };

  const handleSelectRecent = (item: RecentCategory) => {
    setSelected({ teamId: item.teamId, categoryId: item.categoryId });
  };

  const handleSelectCategory = (item: CategoryWithTeam) => {
    setSelected({ teamId: item.teamId, categoryId: item.categoryId });
  };

  const handleStart = () => {
    if (!selected) return;
    // Fire-and-forget: save recent category
    const matchedAll = allCategories.find(
      (c) => c.teamId === selected.teamId && c.categoryId === selected.categoryId,
    );
    const matchedRecent = recentCategories.find(
      (c) => c.teamId === selected.teamId && c.categoryId === selected.categoryId,
    );
    if (matchedAll) {
      sendMessage({
        type: 'SAVE_RECENT_CATEGORY',
        teamId: matchedAll.teamId,
        teamName: matchedAll.teamName,
        categoryId: matchedAll.categoryId,
        categoryTitle: matchedAll.categoryTitle,
      }).catch(() => {});
    } else if (matchedRecent) {
      sendMessage({
        type: 'SAVE_RECENT_CATEGORY',
        teamId: matchedRecent.teamId,
        teamName: matchedRecent.teamName,
        categoryId: matchedRecent.categoryId,
        categoryTitle: matchedRecent.categoryTitle,
      }).catch(() => {});
    }
    onStart(selected.teamId, selected.categoryId);
  };

  const isSearching = searchQuery.length > 0;

  const filteredCategories = isSearching
    ? allCategories.filter((c) => {
        const q = searchQuery.toLowerCase();
        return c.categoryTitle.toLowerCase().includes(q) || c.teamName.toLowerCase().includes(q);
      })
    : [];

  const isItemSelected = (teamId: number, categoryId: number) =>
    selected !== null && selected.teamId === teamId && selected.categoryId === categoryId;

  // Styles
  const popupStyle: React.CSSProperties = {
    position: popupPos ? 'fixed' : 'absolute',
    top: popupPos ? popupPos.top : '100%',
    left: popupPos ? popupPos.left : 0,
    zIndex: 10000,
    width: 280,
    background: '#1e1e2e',
    border: '1px solid #383850',
    borderRadius: 8,
    padding: 12,
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: 13,
    color: '#e0e0e0',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  };

  const searchInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 10px',
    background: '#383850',
    border: '1px solid #4a4a66',
    borderRadius: 6,
    color: '#e0e0e0',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const listContainerStyle: React.CSSProperties = {
    maxHeight: 200,
    overflowY: 'auto',
    marginTop: 8,
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 11,
    color: '#8b8fa3',
    marginBottom: 4,
    fontWeight: 500,
  };

  const itemBaseStyle: React.CSSProperties = {
    padding: '6px 8px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    lineHeight: '1.4',
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 0',
    marginTop: 8,
    background: '#5e6ad2',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  const disabledButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    opacity: 0.4,
    cursor: 'default',
  };

  const emptyTextStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#8b8fa3',
    padding: '8px 4px',
    lineHeight: '1.5',
  };

  const closeButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: 8,
    right: 8,
    background: 'none',
    border: 'none',
    color: '#8b8fa3',
    cursor: 'pointer',
    fontSize: 16,
  };

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const getItemStyle = (index: number, teamId: number, categoryId: number): React.CSSProperties => {
    const isSelected = isItemSelected(teamId, categoryId);
    const isHovered = hoveredIndex === index;
    return {
      ...itemBaseStyle,
      background: isSelected ? 'rgba(94, 106, 210, 0.3)' : isHovered ? '#2a2a3e' : 'transparent',
      color: isSelected ? '#c0c8ff' : '#e0e0e0',
    };
  };

  return (
    <div style={popupStyle} onClick={(e) => e.stopPropagation()}>
      <div style={{ marginBottom: 8, fontWeight: 500, paddingRight: 20 }}>
        {issueId}: {issueTitle}
      </div>

      <input
        type="text"
        placeholder="カテゴリーを検索..."
        value={searchQuery}
        onChange={handleSearchChange}
        style={searchInputStyle}
        autoFocus
      />

      <div style={listContainerStyle}>
        {isSearching ? (
          // Search results
          <>
            {allCategoriesLoading && !allCategoriesLoaded && (
              <div style={emptyTextStyle}>検索中...</div>
            )}
            {allCategoriesLoaded && filteredCategories.length === 0 && (
              <div style={emptyTextStyle}>一致するカテゴリーが見つかりません</div>
            )}
            {filteredCategories.map((c, i) => (
              <div
                key={`${String(c.teamId)}-${String(c.categoryId)}`}
                style={getItemStyle(i, c.teamId, c.categoryId)}
                onClick={() => handleSelectCategory(c)}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {c.categoryTitle} - {c.teamName}
              </div>
            ))}
          </>
        ) : (
          // Recent categories
          <>
            <div style={sectionLabelStyle}>最近使用したカテゴリー</div>
            {recentLoading && <div style={emptyTextStyle}>読み込み中...</div>}
            {!recentLoading && recentCategories.length === 0 && (
              <div style={emptyTextStyle}>
                まだ使用履歴がありません。検索からカテゴリーを選択してください。
              </div>
            )}
            {!recentLoading &&
              recentCategories.slice(0, 5).map((c, i) => (
                <div
                  key={`${String(c.teamId)}-${String(c.categoryId)}`}
                  style={getItemStyle(i + 1000, c.teamId, c.categoryId)}
                  onClick={() => handleSelectRecent(c)}
                  onMouseEnter={() => setHoveredIndex(i + 1000)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {c.categoryTitle} - {c.teamName}
                </div>
              ))}
          </>
        )}
      </div>

      <button
        style={selected ? buttonStyle : disabledButtonStyle}
        onClick={handleStart}
        disabled={!selected}
      >
        打刻開始
      </button>

      {error && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{error}</div>}

      <button onClick={onClose} style={closeButtonStyle}>
        ×
      </button>
    </div>
  );
}
