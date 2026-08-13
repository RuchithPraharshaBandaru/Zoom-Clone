'use client';

/**
 * MeetingCard — Reusable card component for displaying meeting information.
 * Used in the Upcoming Meetings section on the dashboard.
 */

import { useRouter } from 'next/navigation';

/**
 * Format a date string to a readable format.
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  if (isToday) return `Today, ${timeStr}`;
  if (isTomorrow) return `Tomorrow, ${timeStr}`;

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
}

export default function MeetingCard({ meeting, onJoin }) {
  const router = useRouter();

  const handleJoin = () => {
    if (onJoin) {
      onJoin(meeting);
    } else {
      router.push(`/meeting/${meeting.meeting_id}`);
    }
  };

  const handleCopyId = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(meeting.meeting_id);
  };

  return (
    <div className="meeting-card" id={`meeting-card-${meeting.meeting_id}`} onClick={handleJoin}>
      <div className="meeting-card-header">
        <h3 className="meeting-card-title">{meeting.title}</h3>
        <span className={`meeting-card-status ${meeting.status}`}>
          <span className="status-dot" />
          {meeting.status}
        </span>
      </div>

      <div className="meeting-card-meta">
        {/* Date/Time */}
        <div className="meeting-card-meta-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>{formatDate(meeting.scheduled_time)}</span>
        </div>

        {/* Duration */}
        <div className="meeting-card-meta-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          <span>{formatDuration(meeting.duration_minutes)}</span>
        </div>

        {/* Meeting ID */}
        <div className="meeting-card-meta-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span style={{ fontFamily: 'monospace' }}>{meeting.meeting_id}</span>
        </div>

        {/* Host */}
        {meeting.host_name && (
          <div className="meeting-card-meta-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>{meeting.host_name}</span>
          </div>
        )}
      </div>

      <div className="meeting-card-actions">
        <button className="btn btn-primary btn-sm" onClick={handleJoin} id={`join-btn-${meeting.meeting_id}`}>
          {meeting.status === 'active' ? 'Join Now' : 'Start'}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={handleCopyId} id={`copy-btn-${meeting.meeting_id}`}>
          Copy ID
        </button>
      </div>
    </div>
  );
}
