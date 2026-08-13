'use client';

/**
 * ParticipantPanel — Zoom Desktop Client In-Meeting Participants Panel.
 * Matches Screenshot 4.
 */

import { useState } from 'react';

export default function ParticipantPanel({
  participants = [],
  onClose,
  onMuteAll,
  onToggleMute,
  onRemove,
  onAskToStartVideo,
  onMakeHost,
  onRename,
  isHost,
  raisedHands,
  currentUser,
  onOpenInvite,
}) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const handleStartRename = (participant) => {
    setEditingId(participant.id);
    setEditName(participant.display_name);
    setOpenMenuId(null);
  };

  const handleSaveRename = (participant) => {
    if (editName.trim() && editName.trim() !== participant.display_name) {
      onRename?.(participant, editName.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="participant-panel zoom-participants-dark" id="zoom-in-meeting-participants">
      {/* 1. Header (Screenshot 4) */}
      <div className="zoom-chat-header">
        <div style={{ fontSize: '14.5px', fontWeight: 600, color: '#ffffff' }}>
          Participants ({participants.length})
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#9ca3af' }}>
          <button style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '14px' }} title="Pop out">
            ↗
          </button>
          <button className="modal-close" onClick={onClose} style={{ color: '#9ca3af', fontSize: '16px' }} title="Close">
            ✕
          </button>
        </div>
      </div>

      {/* 2. Participants List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {participants.map((participant) => {
          const isSelf = participant.id === currentUser?.id;
          const isParticipantHost = participant.role === 'host';
          const isHandRaised = raisedHands?.has(String(participant.id));
          const initial = (participant.display_name || 'D')[0].toUpperCase();

          // Role text: e.g. "Dummy (Host, me)" or "Dummy (Host)" or "Dummy (me)"
          let roleSuffix = '';
          if (isParticipantHost && isSelf) roleSuffix = ' (Host, me)';
          else if (isParticipantHost) roleSuffix = ' (Host)';
          else if (isSelf) roleSuffix = ' (me)';

          return (
            <div key={participant.id} className="zoom-participants-row">
              {/* Left: Green Avatar Square + Name */}
              <div className="zoom-participants-left">
                <div className="zoom-chat-avatar-square" style={{ background: isSelf ? '#22c55e' : '#0e71eb' }}>
                  {initial}
                </div>

                {editingId === participant.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => handleSaveRename(participant)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename(participant);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    autoFocus
                    style={{
                      background: '#272f3d',
                      border: '1px solid #0e71eb',
                      borderRadius: '4px',
                      color: '#fff',
                      padding: '2px 6px',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                ) : (
                  <div className="zoom-participants-name">
                    {participant.display_name}
                    <span style={{ color: '#9ca3af', fontWeight: 400 }}>{roleSuffix}</span>
                  </div>
                )}
              </div>

              {/* Right: Status Icons & Options Menu */}
              <div className="zoom-participants-right">
                {/* Hand Raised */}
                {isHandRaised && <span title="Hand Raised" style={{ fontSize: '14px' }}>✋</span>}

                {/* Slashed Red Mic or Green Mic */}
                <div title={participant.is_muted ? 'Muted' : 'Unmuted'}>
                  {participant.is_muted ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  )}
                </div>

                {/* Slashed Red Video or Blue Video */}
                <div title={participant.is_video_on ? 'Video On' : 'Video Off'}>
                  {participant.is_video_on ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round">
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M21 21l-3.34-3.34L23 17V7l-7 5v-1.66m-4-4H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.34" />
                    </svg>
                  )}
                </div>

                {/* More Options Dropdown */}
                <div style={{ position: 'relative' }}>
                  <button
                    style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}
                    onClick={() => setOpenMenuId(openMenuId === participant.id ? null : participant.id)}
                    title="More options"
                  >
                    •••
                  </button>

                  {openMenuId === participant.id && (
                    <div
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: '100%',
                        background: '#242a35',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '8px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                        zIndex: 100,
                        width: '160px',
                        overflow: 'hidden',
                        marginTop: '4px',
                      }}
                    >
                      {/* Self or Host Rename */}
                      <button
                        style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', color: '#ffffff', fontSize: '13px', cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.target.style.background = '#333d4e')}
                        onMouseLeave={(e) => (e.target.style.background = 'none')}
                        onClick={() => handleStartRename(participant)}
                      >
                        Rename
                      </button>

                      {/* Host-only options */}
                      {isHost && !isSelf && (
                        <>
                          <button
                            style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', color: '#ffffff', fontSize: '13px', cursor: 'pointer' }}
                            onMouseEnter={(e) => (e.target.style.background = '#333d4e')}
                            onMouseLeave={(e) => (e.target.style.background = 'none')}
                            onClick={() => {
                              onAskToStartVideo?.(participant);
                              setOpenMenuId(null);
                            }}
                          >
                            Ask to Start Video
                          </button>

                          <button
                            style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', color: '#ffffff', fontSize: '13px', cursor: 'pointer' }}
                            onMouseEnter={(e) => (e.target.style.background = '#333d4e')}
                            onMouseLeave={(e) => (e.target.style.background = 'none')}
                            onClick={() => {
                              onToggleMute?.(participant);
                              setOpenMenuId(null);
                            }}
                          >
                            {participant.is_muted ? 'Ask to Unmute' : 'Mute'}
                          </button>

                          <button
                            style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', color: '#ffffff', fontSize: '13px', cursor: 'pointer' }}
                            onMouseEnter={(e) => (e.target.style.background = '#333d4e')}
                            onMouseLeave={(e) => (e.target.style.background = 'none')}
                            onClick={() => {
                              onMakeHost?.(participant);
                              setOpenMenuId(null);
                            }}
                          >
                            Make Host
                          </button>

                          <button
                            style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', color: '#ef4444', fontSize: '13px', cursor: 'pointer', borderTop: '1px solid rgba(255,255,255,0.08)' }}
                            onMouseEnter={(e) => (e.target.style.background = '#333d4e')}
                            onMouseLeave={(e) => (e.target.style.background = 'none')}
                            onClick={() => {
                              onRemove?.(participant);
                              setOpenMenuId(null);
                            }}
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Bottom 3 Dark Pill Buttons (Screenshot 4) */}
      <div className="zoom-participants-footer-pills">
        <button className="zoom-part-pill-btn" onClick={onOpenInvite} title="Invite participants">
          Invite
        </button>

        {isHost && (
          <button className="zoom-part-pill-btn" onClick={onMuteAll} title="Mute all participants">
            Mute all
          </button>
        )}

        <div style={{ position: 'relative' }}>
          <button className="zoom-part-pill-btn" onClick={() => setShowMoreMenu(!showMoreMenu)} title="More host options">
            More
          </button>

          {showMoreMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                bottom: '100%',
                background: '#242a35',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                zIndex: 100,
                width: '200px',
                overflow: 'hidden',
                marginBottom: '6px',
              }}
            >
              <div style={{ padding: '8px 14px', fontSize: '12px', color: '#9ca3af', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                Meeting Security
              </div>
              <button
                style={{ width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', color: '#ffffff', fontSize: '12.5px', cursor: 'pointer' }}
                onClick={() => setShowMoreMenu(false)}
              >
                ✓ Mute Participants upon Entry
              </button>
              <button
                style={{ width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', color: '#ffffff', fontSize: '12.5px', cursor: 'pointer' }}
                onClick={() => setShowMoreMenu(false)}
              >
                ✓ Allow Participants to Rename
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
