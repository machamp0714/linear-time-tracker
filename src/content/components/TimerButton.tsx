import { useState } from 'react';
import { TimerPopup } from './TimerPopup';

interface TimerButtonProps {
  issueId: string;
  issueTitle: string;
  isRunning: boolean;
  isCurrentIssue: boolean;
  onStart: (teamId: number, categoryId: number) => void;
  onStop: () => void;
}

export function TimerButton({
  issueId,
  issueTitle,
  isRunning,
  isCurrentIssue,
  onStart,
  onStop,
}: TimerButtonProps) {
  const [showPopup, setShowPopup] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isRunning && isCurrentIssue) {
      onStop();
    } else {
      setShowPopup(!showPopup);
    }
  };

  const handleStart = (teamId: number, categoryId: number) => {
    onStart(teamId, categoryId);
    setShowPopup(false);
  };

  const isActive = isRunning && isCurrentIssue;
  const btnClass = `tc-timer-btn${isActive ? ' tc-timer-btn--active' : ''}`;

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        className={btnClass}
        onClick={handleClick}
        title={isActive ? 'タイマー停止' : 'タイマー開始'}
      >
        {isActive ? '■' : '▶'}
      </button>
      {showPopup && (
        <TimerPopup
          issueId={issueId}
          issueTitle={issueTitle}
          onStart={handleStart}
          onClose={() => setShowPopup(false)}
        />
      )}
    </div>
  );
}
