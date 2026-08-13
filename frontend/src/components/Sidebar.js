'use client';

/**
 * Sidebar — Zoom Desktop Client exact Left Sidebar.
 * Matches user's screenshot with Home and Meetings tabs.
 */

export default function Sidebar({ activeTab = 'home', onTabChange }) {
  return (
    <aside
      style={{
        width: '68px',
        minWidth: '68px',
        height: '100vh',
        background: '#e9ecf2',
        borderRight: '1px solid #dce1e9',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 6px',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        userSelect: 'none',
      }}
    >
      {/* Top Nav Buttons (Home and Meetings only) */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%' }}>
        {/* Home Button */}
        <button
          onClick={() => onTabChange?.('home')}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '10px',
            background: activeTab === 'home' ? '#ffffff' : 'transparent',
            boxShadow: activeTab === 'home' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            border: 'none',
            color: activeTab === 'home' ? '#18181b' : '#4b5563',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'home') e.currentTarget.style.background = 'rgba(255,255,255,0.4)';
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'home') e.currentTarget.style.background = 'transparent';
          }}
          title="Home"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 10.5L12 3l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 13 15 13 15 22" />
          </svg>
          <span style={{ fontSize: '11px', marginTop: '2px', fontWeight: activeTab === 'home' ? 600 : 500 }}>
            Home
          </span>
        </button>

        {/* Meetings Button */}
        <button
          onClick={() => onTabChange?.('meetings')}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '10px',
            background: activeTab === 'meetings' ? '#ffffff' : 'transparent',
            boxShadow: activeTab === 'meetings' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            border: 'none',
            color: activeTab === 'meetings' ? '#18181b' : '#4b5563',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'meetings') e.currentTarget.style.background = 'rgba(255,255,255,0.4)';
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'meetings') e.currentTarget.style.background = 'transparent';
          }}
          title="Meetings"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="14" height="14" rx="3" />
            <polygon points="22 8 16 12 22 16 22 8" />
          </svg>
          <span style={{ fontSize: '11px', marginTop: '2px', fontWeight: activeTab === 'meetings' ? 600 : 500 }}>
            Meetings
          </span>
        </button>
      </div>

      {/* Bottom Settings Button */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={() => alert('Zoom Settings')}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '10px',
            background: 'transparent',
            border: 'none',
            color: '#4b5563',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.15s',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
          title="Settings"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span style={{ fontSize: '11px', marginTop: '2px', fontWeight: 500 }}>
            Settings
          </span>
        </button>
      </div>
    </aside>
  );
}
