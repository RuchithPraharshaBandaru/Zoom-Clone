'use client';

/**
 * Navbar — Top navigation bar with tabs, search, and profile avatar.
 * Replicates Zoom's desktop client header design.
 */

import { useState } from 'react';

export default function Navbar({ activeTab = 'home', onTabChange }) {
  const userName = 'Ben K';
  const initials = 'BK';

  const tabs = [
    {
      id: 'home',
      label: 'Home',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3l9 8h-3v10H6V11H3l9-8z" />
        </svg>
      )
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      )
    },
    {
      id: 'meetings',
      label: 'Meetings',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )
    },
    {
      id: 'contacts',
      label: 'Contacts',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )
    }
  ];

  return (
    <header className="zoom-topbar" id="topbar">
      <div className="topbar-left">
        {/* Empty space for window controls in desktop app */}
      </div>

      <div className="topbar-center">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`topbar-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange?.(tab.id)}
          >
            <div className="tab-icon">{tab.icon}</div>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="topbar-right">
        {/* Search Bar */}
        <div className="topbar-search">
          <svg className="topbar-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search"
          />
        </div>

        {/* Profile Avatar */}
        <div className="topbar-avatar" title={userName}>
          {initials}
        </div>
      </div>
    </header>
  );
}
