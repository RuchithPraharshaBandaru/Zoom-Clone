'use client';

/**
 * ChatPanel — Zoom Desktop Client In-Meeting Chat.
 * Vector SVG icons exclusively used throughout.
 */

import { useState, useRef, useEffect } from 'react';

export default function ChatPanel({ onClose, currentUser, messages = [], onSendMessage }) {
  const [inputValue, setInputValue] = useState('');
  const [activeChatTab, setActiveChatTab] = useState('everyone');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;

    onSendMessage(inputValue.trim());
    setInputValue('');
  };

  const formatTime = (isoString) => {
    try {
      return new Date(isoString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false });
    } catch (e) {
      return '1:05';
    }
  };

  const userInitial = (currentUser?.display_name || 'Dummy')[0].toUpperCase();

  return (
    <div className="participant-panel zoom-chat-dark" id="zoom-in-meeting-chat">
      {/* 1. Header (Screenshot 3) */}
      <div className="zoom-chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#60a5fa' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span style={{ color: '#60a5fa' }}>{currentUser?.display_name ? `${currentUser.display_name}'s Zoom Meeting` : "Dummy's Zoom Meeting"}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#9ca3af' }}>
          <button style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '15px' }} title="More">
            •••
          </button>
          <button style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '14px' }} title="Pop out">
            ↗
          </button>
          <button className="modal-close" onClick={onClose} style={{ color: '#9ca3af', fontSize: '16px' }} title="Close">
            ✕
          </button>
        </div>
      </div>

      {/* 2. Subtabs: [Everyone] [+ New chat] */}
      <div className="zoom-chat-subtabs">
        <button
          className={`zoom-chat-tab-pill ${activeChatTab === 'everyone' ? '' : 'zoom-chat-new-tab'}`}
          onClick={() => setActiveChatTab('everyone')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>Everyone</span>
        </button>

        <button
          className={`zoom-chat-tab-pill ${activeChatTab === 'new' ? '' : 'zoom-chat-new-tab'}`}
          onClick={() => setActiveChatTab('new')}
        >
          <span>+</span>
          <span>New chat</span>
        </button>
      </div>

      {/* 3. Messages History */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Date Divider */}
        <div className="zoom-chat-date-divider">Today</div>

        {messages.map((msg) => (
          <div key={msg.id} className="zoom-chat-msg-group">
            {msg.isSystem ? (
              <div style={{ textAlign: 'center', margin: '4px 0' }}>
                <span style={{ fontSize: '11px', color: '#9ca3af', background: '#272f3d', padding: '2px 10px', borderRadius: '10px' }}>
                  {msg.text}
                </span>
              </div>
            ) : (
              <>
                {/* Sender info with Green Square Avatar */}
                <div className="zoom-chat-msg-sender-row">
                  <div className="zoom-chat-avatar-square">
                    {msg.sender ? msg.sender[0].toUpperCase() : userInitial}
                  </div>
                  <span style={{ fontWeight: 600, color: '#e4e4e7' }}>
                    {msg.isMe ? 'You' : msg.sender}
                  </span>
                  <span style={{ fontSize: '11px', color: '#71717a' }}>
                    {formatTime(msg.time)}
                  </span>
                </div>

                {/* Dark Chat Bubble */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: '28px' }}>
                  <div className="zoom-chat-bubble-dark">
                    {msg.text}
                  </div>

                  {/* Reaction icons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#71717a', fontSize: '12px', paddingLeft: '4px', cursor: 'pointer' }}>
                    <span title="Reply">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 17 4 12 9 7" />
                        <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                      </svg>
                    </span>
                    <span title="React">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                        <line x1="9" y1="9" x2="9.01" y2="9" />
                        <line x1="15" y1="9" x2="15.01" y2="9" />
                      </svg>
                    </span>
                    <span title="More">•••</span>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 4. Bottom Input Area */}
      <div style={{ background: '#181c24', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        {/* Info label: Who can see your messages? */}
        <div className="zoom-chat-footer-info">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>Who can see your messages?</span>
        </div>

        {/* Input box */}
        <div style={{ padding: '8px 16px 12px' }}>
          <div style={{ background: '#202632', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', padding: '8px 12px' }}>
            <textarea
              rows={2}
              placeholder=""
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                color: '#ffffff',
                fontSize: '13.5px',
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />

            {/* Bottom Toolbar Icons + Blue Circular Send Button */}
            <div className="zoom-chat-input-toolbar">
              <div className="zoom-chat-tools-icons">
                <span title="Format" style={{ fontWeight: 600, fontSize: '12px' }}>T</span>
                <span title="Emoji">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" />
                    <line x1="15" y1="9" x2="15.01" y2="9" />
                  </svg>
                </span>
                <span title="GIF" style={{ fontSize: '11px', fontWeight: 'bold' }}>GIF</span>
                <span title="File">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </span>
                <span title="Options" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="19" cy="12" r="1" />
                    <circle cx="5" cy="12" r="1" />
                  </svg>
                  <span style={{ fontSize: '9px' }}>▾</span>
                </span>
              </div>

              <button
                type="button"
                className="zoom-chat-send-circle"
                onClick={handleSendMessage}
                disabled={!inputValue.trim()}
                title="Send"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
