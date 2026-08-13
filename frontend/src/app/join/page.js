'use client';

/**
 * Join Meeting Page — Replicates Zoom Desktop Client exact Join Dialog.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMeeting, joinMeeting } from '@/lib/api';

export default function JoinPage() {
  const router = useRouter();
  const [meetingId, setMeetingId] = useState('');
  const [displayName, setDisplayName] = useState('John Doe');
  const [rememberName, setRememberName] = useState(true);
  const [dontConnectAudio, setDontConnectAudio] = useState(false);
  const [turnOffVideo, setTurnOffVideo] = useState(true);
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const extractMeetingId = (input) => {
    const trimmed = input.trim();
    const pathMatch = trimmed.match(/\/meeting\/([0-9-]+)/);
    if (pathMatch) return pathMatch[1];
    return trimmed;
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');

    const id = extractMeetingId(meetingId);
    if (!id) {
      setError('Please enter a valid Meeting ID or Personal Link Name');
      return;
    }

    if (!displayName.trim()) {
      setError('Please enter your display name');
      return;
    }

    setIsJoining(true);
    try {
      const meeting = await getMeeting(id);

      if (meeting.status === 'ended') {
        setError('This meeting has already ended');
        setIsJoining(false);
        return;
      }

      await joinMeeting(id, displayName.trim());
      router.push(`/meeting/${id}`);
    } catch (err) {
      if (err.message.includes('not found') || err.message.includes('404')) {
        setError('Meeting not found. Please check the ID and try again.');
      } else {
        setError(err.message || 'Failed to join meeting');
      }
      setIsJoining(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#121214',
      padding: '20px'
    }}>
      <div 
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#1c1c1e',
          borderRadius: '16px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08)',
          padding: '28px',
          color: '#ffffff'
        }}
      >
        <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: 600, color: '#ffffff', textAlign: 'center' }}>
          Join Meeting
        </h2>

        <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Meeting ID */}
          <div>
            <input
              type="text"
              placeholder="Meeting ID or Personal Link Name"
              value={meetingId}
              onChange={(e) => {
                setMeetingId(e.target.value);
                setError('');
              }}
              required
              autoFocus
              style={{
                width: '100%',
                padding: '12px 14px',
                background: '#2c2c2e',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>

          {/* Display Name */}
          <div>
            <input
              type="text"
              placeholder="Enter your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                background: '#2c2c2e',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>

          {/* Error Banner */}
          {error && (
            <div style={{ color: '#ef4444', fontSize: '13px', background: 'rgba(239,68,68,0.1)', padding: '10px 12px', borderRadius: '6px' }}>
              {error}
            </div>
          )}

          {/* Checkboxes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '4px 0 12px 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#d1d5db', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={rememberName} 
                onChange={(e) => setRememberName(e.target.checked)} 
                style={{ accentColor: '#0e71eb', width: '16px', height: '16px' }}
              />
              Remember my name for future meetings
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#d1d5db', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={dontConnectAudio} 
                onChange={(e) => setDontConnectAudio(e.target.checked)} 
                style={{ accentColor: '#0e71eb', width: '16px', height: '16px' }}
              />
              Don't connect to audio
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#d1d5db', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={turnOffVideo} 
                onChange={(e) => setTurnOffVideo(e.target.checked)} 
                style={{ accentColor: '#0e71eb', width: '16px', height: '16px' }}
              />
              Turn off my video
            </label>
          </div>

          {/* Buttons Row */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => router.push('/')}
              style={{
                flex: 1,
                padding: '12px',
                background: '#38383a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!meetingId.trim() || isJoining}
              style={{
                flex: 1,
                padding: '12px',
                background: (!meetingId.trim() || isJoining) ? '#0e71eb80' : '#0e71eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: (!meetingId.trim() || isJoining) ? 'not-allowed' : 'pointer'
              }}
            >
              {isJoining ? 'Joining...' : 'Join'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
