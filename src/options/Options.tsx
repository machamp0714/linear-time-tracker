import { useState, useEffect } from 'react';

export function Options() {
  const [token, setToken] = useState('');
  const [linearKey, setLinearKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(['timecrowd_token', 'linear_api_key'], (result) => {
      const val = result['timecrowd_token'] as string | undefined;
      if (val) setToken(val);
      const linearVal = result['linear_api_key'] as string | undefined;
      if (linearVal) setLinearKey(linearVal);
    });
  }, []);

  const handleSave = () => {
    chrome.storage.local.set({ timecrowd_token: token, linear_api_key: linearKey }, () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    fontSize: 14,
    borderRadius: 6,
    border: '1px solid #ccc',
  };

  return (
    <div
      style={{
        maxWidth: 480,
        margin: '40px auto',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: 20 }}>TimeCrowd for Linear</h1>

      <div style={{ marginTop: 16 }}>
        <label htmlFor="token" style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
          TimeCrowd アクセストークン
        </label>
        <input
          id="token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="TimeCrowdのアクセストークンを貼り付けてください"
          style={inputStyle}
        />
        <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
          トークンは{' '}
          <a href="https://timecrowd.net/oauth/applications" target="_blank" rel="noopener">
            TimeCrowd OAuthアプリ
          </a>{' '}
          から取得できます
        </p>
      </div>

      <div style={{ marginTop: 20 }}>
        <label htmlFor="linearKey" style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
          Linear API Key（オプション）
        </label>
        <input
          id="linearKey"
          type="password"
          value={linearKey}
          onChange={(e) => setLinearKey(e.target.value)}
          placeholder="lin_api_..."
          style={inputStyle}
        />
        <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
          打刻停止時にLinear Issueに作業時間を記録します。 Settings &gt; Account &gt; API &gt;
          Personal API Keys から取得できます
        </p>
      </div>

      <button
        onClick={handleSave}
        style={{
          marginTop: 16,
          padding: '8px 24px',
          fontSize: 14,
          borderRadius: 6,
          border: 'none',
          background: '#5e6ad2',
          color: 'white',
          cursor: 'pointer',
        }}
      >
        保存
      </button>
      {saved && <span style={{ marginLeft: 12, color: '#22c55e' }}>保存しました!</span>}
    </div>
  );
}
