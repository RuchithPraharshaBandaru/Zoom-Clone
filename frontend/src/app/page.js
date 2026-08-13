'use client';

/**
 * Landing Dashboard — Zoom Desktop Client exact UI Replica.
 * Pure SVG vector icons used exclusively (no unicode emojis except raise hand).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import ScheduleModal from '@/components/ScheduleModal';
import { listMeetings, createInstantMeeting, scheduleMeeting, deleteMeeting } from '@/lib/api';

export default function Dashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('home');
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [mounted, setMounted] = useState(false);
  const [openCardMenuId, setOpenCardMenuId] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchMeetings = useCallback(async () => {
    try {
      const [upcoming, recent, active] = await Promise.all([
        listMeetings({ status: 'scheduled' }),
        listMeetings({ status: 'ended', limit: 50 }),
        listMeetings({ status: 'active' }),
      ]);

      const sortedUpcoming = (upcoming || []).sort((a, b) =>
        new Date(a.scheduled_time || a.created_at) - new Date(b.scheduled_time || b.created_at)
      );
      setUpcomingMeetings(sortedUpcoming);

      const allRecent = [...(active || []), ...(recent || [])].sort((a, b) =>
        new Date(b.ended_at || b.created_at || b.scheduled_time) - new Date(a.ended_at || a.created_at || a.scheduled_time)
      );
      setRecentMeetings(allRecent);
    } catch (err) {
      console.error('Failed to fetch meetings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, [fetchMeetings]);

  // Combined list of all meetings (scheduled + active + ended)
  const allMeetings = useMemo(() => {
    const map = new Map();
    [...upcomingMeetings, ...recentMeetings].forEach((m) => {
      map.set(m.meeting_id, m);
    });
    return Array.from(map.values()).sort((a, b) => {
      const timeA = new Date(a.scheduled_time || a.created_at).getTime();
      const timeB = new Date(b.scheduled_time || b.created_at).getTime();
      return timeA - timeB;
    });
  }, [upcomingMeetings, recentMeetings]);

  // Check if two dates fall on the same calendar day
  const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };

  // Filter meetings specifically for the selected date on calendar
  const meetingsForSelectedDate = useMemo(() => {
    return allMeetings.filter((m) => {
      const meetDate = m.scheduled_time || m.created_at;
      return isSameDay(meetDate, selectedDate);
    });
  }, [allMeetings, selectedDate]);

  // Handle New Meeting (instant)
  const handleNewMeeting = async () => {
    try {
      const meeting = await createInstantMeeting("Dummy's Zoom Meeting");
      router.push(`/meeting/${meeting.meeting_id}`);
    } catch (err) {
      alert('Failed to create meeting');
    }
  };

  // Handle Schedule Meeting
  const handleScheduleMeeting = async (data) => {
    try {
      await scheduleMeeting(data);
      setShowScheduleModal(false);
      fetchMeetings();
    } catch (err) {
      alert('Failed to schedule meeting');
    }
  };

  // Handle Delete Meeting
  const handleDeleteMeeting = async (meetingId) => {
    try {
      await deleteMeeting(meetingId);
      setOpenCardMenuId(null);
      fetchMeetings();
    } catch (err) {
      console.error('Failed to delete meeting:', err);
    }
  };

  // Format Time Range (e.g. 01:05 - 01:06)
  const formatTimeRange = (meeting) => {
    const startTimeStr = meeting.scheduled_time || meeting.created_at;
    if (!startTimeStr) return '01:05 - 01:06';
    const start = new Date(startTimeStr);

    let end;
    if (meeting.ended_at) {
      end = new Date(meeting.ended_at);
    } else {
      end = new Date(start.getTime() + (meeting.duration_minutes || 30) * 60000);
    }

    const pad = (n) => String(n).padStart(2, '0');
    const startStr = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
    const endStr = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
    return `${startStr} - ${endStr}`;
  };

  // Format Start Time only (01:05)
  const getStartTimeOnly = (meeting) => {
    const str = meeting.scheduled_time || meeting.created_at;
    if (!str) return '01:05';
    const d = new Date(str);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Format End Time only (01:06)
  const getEndTimeOnly = (meeting) => {
    if (meeting.ended_at) {
      const d = new Date(meeting.ended_at);
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    const str = meeting.scheduled_time || meeting.created_at;
    const start = str ? new Date(str) : new Date();
    const end = new Date(start.getTime() + (meeting.duration_minutes || 30) * 60000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(end.getHours())}:${pad(end.getMinutes())}`;
  };

  // Format Card Date Subtitle (e.g. Today, Aug 14)
  const formatCardDate = (dateObj) => {
    const now = new Date();
    const isToday = isSameDay(dateObj, now);
    const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });
    const day = dateObj.getDate();

    if (isToday) return `Today, ${monthName} ${day}`;
    return `${dateObj.toLocaleDateString('en-US', { weekday: 'short' })}, ${monthName} ${day}`;
  };

  // Section header label (e.g. "Today", "Yesterday", "Tomorrow", "Saturday, Aug 15")
  const getDayHeaderLabel = (dateObj) => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (isSameDay(dateObj, now)) return 'Today';
    if (isSameDay(dateObj, yesterday)) return 'Yesterday';
    if (isSameDay(dateObj, tomorrow)) return 'Tomorrow';
    return dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const handlePrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
  };

  const handleNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
  };

  const handleTodayClick = () => {
    setSelectedDate(new Date());
  };

  const handleSelectDayNumber = (dayNum) => {
    const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), dayNum);
    setSelectedDate(d);
  };

  // ─── Render Home Tab (Screenshot 1) ──────────────────────────────
  const renderHomeTab = () => (
    <div className="zoom-desktop-home">
      {/* 1. Large Bold Clock Header */}
      <div className="zoom-clock-container">
        <div className="zoom-clock-time">
          {mounted ? currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '01:06'}
        </div>
        <div className="zoom-clock-date">
          {mounted
            ? currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
            : 'Friday, August 14, 2026'}
        </div>
      </div>

      {/* 2. 4 Squircle Action Buttons Row */}
      <div className="zoom-actions-row">
        {/* New Meeting */}
        <button className="zoom-action-item" onClick={handleNewMeeting} id="btn-new-meeting">
          <div className="zoom-action-icon-box zoom-action-orange">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="3" ry="3" />
            </svg>
          </div>
          <span className="zoom-action-label">
            New meeting <span style={{ fontSize: '10px' }}>▾</span>
          </span>
        </button>

        {/* Join */}
        <button className="zoom-action-item" onClick={() => router.push('/join')} id="btn-join">
          <div className="zoom-action-icon-box zoom-action-blue">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <span className="zoom-action-label">Join</span>
        </button>

        {/* Schedule */}
        <button className="zoom-action-item" onClick={() => setShowScheduleModal(true)} id="btn-schedule">
          <div className="zoom-action-icon-box zoom-action-blue">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="3" ry="3" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <text x="12" y="18" textAnchor="middle" fill="currentColor" stroke="none" fontSize="8" fontWeight="bold">31</text>
            </svg>
          </div>
          <span className="zoom-action-label">Schedule</span>
        </button>

        {/* Share Screen */}
        <button className="zoom-action-item" onClick={() => alert('Please join a meeting first to share your screen.')} id="btn-share">
          <div className="zoom-action-icon-box zoom-action-blue">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </div>
          <span className="zoom-action-label">Share screen</span>
        </button>
      </div>

      {/* 3. Main Calendar Card Widget (Only for the Selected Date) */}
      <div className="zoom-calendar-widget" id="calendar-widget">
        {/* Header */}
        <div className="zoom-calendar-header">
          <button className="zoom-cal-plus-btn" onClick={() => setShowScheduleModal(true)} title="Schedule Meeting">
            +
          </button>
          <button className="zoom-cal-title-dropdown" onClick={handleTodayClick}>
            {formatCardDate(selectedDate)} ▾
          </button>
          <div style={{ width: '28px' }} />
        </div>

        {/* Subbar with [Today] and < > */}
        <div className="zoom-calendar-subbar">
          <button className="zoom-cal-today-pill" onClick={handleTodayClick}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Today
          </button>

          <div className="zoom-cal-nav-arrows">
            <button className="zoom-cal-arrow-btn" onClick={handlePrevDay} title="Previous Day">
              ‹
            </button>
            <button className="zoom-cal-arrow-btn" onClick={handleNextDay} title="Next Day">
              ›
            </button>
          </div>

          <button className="zoom-cal-more-btn" title="Options">
            •••
          </button>
        </div>

        {/* Card Body */}
        {meetingsForSelectedDate.length === 0 ? (
          /* Empty State */
          <div className="zoom-calendar-empty-state">
            <div className="zoom-umbrella-icon">
              <svg width="74" height="74" viewBox="0 0 100 100" fill="none">
                <ellipse cx="50" cy="85" rx="35" ry="8" fill="#e4e8f0" />
                <path d="M50 20 L25 50 L75 50 Z" fill="#b9c7dc" />
                <path d="M50 20 L40 50 L60 50 Z" fill="#d7e0ee" />
                <line x1="50" y1="20" x2="40" y2="82" stroke="#a0aec0" strokeWidth="3" strokeLinecap="round" />
                <path d="M36 78 L65 72 L60 84" stroke="#a0aec0" strokeWidth="2.5" fill="none" />
                <line x1="44" y1="76" x2="52" y2="84" stroke="#cbd5e1" strokeWidth="2" />
              </svg>
            </div>
            <div className="zoom-cal-empty-text">No meetings scheduled for this date.</div>
            <button className="zoom-cal-schedule-link" onClick={() => setShowScheduleModal(true)}>
              + Schedule a meeting
            </button>
          </div>
        ) : (
          /* Scheduled & Completed Meeting Cards for this Selected Date */
          <div className="zoom-cal-items-list">
            {meetingsForSelectedDate.map((meeting) => {
              const isEnded = meeting.status === 'ended';

              return (
                <div key={meeting.id} className="zoom-cal-meeting-card">
                  <div className="zoom-cal-meeting-title-row">
                    <div className="zoom-cal-meeting-title">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2">
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                      </svg>
                      <span>{meeting.title}</span>
                    </div>

                    {!isEnded ? (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ padding: '3px 12px', fontSize: '12px', borderRadius: '6px' }}
                        onClick={() => router.push(`/meeting/${meeting.meeting_id}`)}
                      >
                        Start
                      </button>
                    ) : (
                      <span style={{ fontSize: '11.5px', color: '#71717a', background: '#e4e4e7', padding: '2px 8px', borderRadius: '4px' }}>
                        Completed
                      </span>
                    )}
                  </div>

                  <div className="zoom-cal-meeting-meta">
                    <div>{formatCardDate(new Date(meeting.scheduled_time || meeting.created_at))}</div>
                    <div>{formatTimeRange(meeting)}</div>
                    <div>Host: {meeting.host_name || 'Dummy'}</div>
                  </div>

                  <div className="zoom-cal-meeting-actions">
                    <div style={{ position: 'relative' }}>
                      <button
                        className="zoom-cal-more-btn"
                        onClick={() => setOpenCardMenuId(openCardMenuId === meeting.id ? null : meeting.id)}
                      >
                        •••
                      </button>
                      {openCardMenuId === meeting.id && (
                        <div
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: '100%',
                            background: '#ffffff',
                            border: '1px solid #e4e4e7',
                            borderRadius: '8px',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                            zIndex: 10,
                            width: '140px',
                            overflow: 'hidden',
                          }}
                        >
                          <button
                            style={{ width: '100%', padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer' }}
                            onClick={() => {
                              navigator.clipboard.writeText(meeting.meeting_id);
                              setOpenCardMenuId(null);
                            }}
                          >
                            Copy ID
                          </button>
                          <button
                            style={{ width: '100%', padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', fontSize: '12px', color: '#ef4444', cursor: 'pointer' }}
                            onClick={() => handleDeleteMeeting(meeting.meeting_id)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="zoom-calendar-footer">
          <button className="zoom-cal-recordings-link" onClick={() => setActiveTab('meetings')}>
            Open calendar ›
          </button>
        </div>
      </div>
    </div>
  );

  // ─── Render Meetings / Calendar Tab (Screenshot 2: Interactive Day Selection) ─
  const renderMeetingsTab = () => {
    const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);
    const now = new Date();
    const isSelectedToday = isSameDay(selectedDate, now);

    return (
      <div className="zoom-meetings-split">
        {/* Left Mini-Calendar Sidebar */}
        <div className="zoom-meetings-left-sidebar">
          <div className="zoom-connect-cal-row">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Connect calendar
            </span>
            <button className="zoom-plus-circle-btn" onClick={() => setShowScheduleModal(true)} title="Add Meeting">
              +
            </button>
          </div>

          <div style={{ borderTop: '1px solid #f4f4f5', paddingTop: '12px' }}>
            <div className="zoom-mini-cal-header">
              <span>‹‹ ‹</span>
              <span>{selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
              <span>› ››</span>
            </div>

            <div className="zoom-mini-cal-grid" style={{ marginTop: '10px' }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="zoom-mini-cal-day-name">{d}</div>
              ))}
              {/* Padding placeholder days */}
              <div className="zoom-mini-cal-day" style={{ color: '#d4d4d8' }}>26</div>
              <div className="zoom-mini-cal-day" style={{ color: '#d4d4d8' }}>27</div>
              <div className="zoom-mini-cal-day" style={{ color: '#d4d4d8' }}>28</div>
              <div className="zoom-mini-cal-day" style={{ color: '#d4d4d8' }}>29</div>
              <div className="zoom-mini-cal-day" style={{ color: '#d4d4d8' }}>30</div>
              <div className="zoom-mini-cal-day" style={{ color: '#d4d4d8' }}>31</div>
              {daysInMonth.map((d) => {
                const thisDayDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), d);
                const isDayToday = isSameDay(thisDayDate, now);
                const isDaySelected = isSameDay(thisDayDate, selectedDate);

                return (
                  <div
                    key={d}
                    onClick={() => handleSelectDayNumber(d)}
                    className={`zoom-mini-cal-day ${isDayToday ? 'active' : ''} ${isDaySelected && !isDayToday ? 'selected' : ''}`}
                    style={{ fontWeight: (isDayToday || isDaySelected) ? 600 : 400 }}
                  >
                    {d}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 'auto', borderTop: '1px solid #f4f4f5', paddingTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#18181b' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid #0e71eb', display: 'inline-block' }} />
              <span style={{ width: '18px', height: '18px', borderRadius: '4px', background: '#0e71eb', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>D</span>
              <span>Dummy</span>
            </div>
          </div>
        </div>

        {/* Right Main Agenda / Events Area for the SELECTED DATE */}
        <div className="zoom-meetings-main-area" style={{ background: '#ffffff', padding: '0 24px 32px' }}>
          {/* Top subtle blue border */}
          <div style={{ height: '3px', background: '#3b82f6', margin: '0 -24px 16px' }} />

          {/* Top Toolbar Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button className="zoom-cal-today-pill" onClick={handleTodayClick}>
                ← Today
              </button>
              <div className="zoom-cal-nav-arrows">
                <button className="zoom-cal-arrow-btn" onClick={handlePrevDay} title="Previous Day">‹</button>
                <button className="zoom-cal-arrow-btn" onClick={handleNextDay} title="Next Day">›</button>
              </div>
              <span style={{ fontSize: '16px', fontWeight: 600, color: '#18181b' }}>
                {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#71717a' }}>
              <button className="zoom-cal-arrow-btn" title="Refresh" onClick={fetchMeetings}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6M1 20v-6h6"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
              </button>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#18181b', cursor: 'pointer' }}>Agenda ▾</span>
            </div>
          </div>

          {/* Selected Date Timeline Section Header */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#18181b', marginBottom: '14px' }}>
              {getDayHeaderLabel(selectedDate)}
            </div>

            {meetingsForSelectedDate.length === 0 ? (
              /* Empty state for the selected day (Screenshot 2) */
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', background: '#fafafa', borderRadius: '10px', border: '1px solid #f4f4f5' }}>
                <svg width="48" height="48" viewBox="0 0 100 100" fill="none">
                  <ellipse cx="50" cy="85" rx="35" ry="8" fill="#e4e8f0" />
                  <path d="M50 20 L25 50 L75 50 Z" fill="#b9c7dc" />
                  <path d="M50 20 L40 50 L60 50 Z" fill="#d7e0ee" />
                  <line x1="50" y1="20" x2="40" y2="82" stroke="#a0aec0" strokeWidth="3" strokeLinecap="round" />
                  <path d="M36 78 L65 72 L60 84" stroke="#a0aec0" strokeWidth="2.5" fill="none" />
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '13px', color: '#71717a' }}>No events scheduled for this date.</span>
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    style={{ background: 'none', border: 'none', color: '#0e71eb', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer', textAlign: 'left', padding: 0 }}
                  >
                    + Schedule a meeting
                  </button>
                </div>
              </div>
            ) : (
              /* Meetings timeline for the selected day */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {meetingsForSelectedDate.map((m) => {
                  const isEnded = m.status === 'ended';

                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: '#f9fafb',
                        border: '1px solid #e5e7eb',
                        borderRadius: '10px',
                        padding: '12px 18px',
                        gap: '16px',
                        transition: 'background 0.15s',
                      }}
                    >
                      {/* Left: Start / End time (01:05 / 01:06) */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '48px', fontSize: '12px', color: '#4b5563', fontWeight: 500 }}>
                        <span>{getStartTimeOnly(m)}</span>
                        <span>{getEndTimeOnly(m)}</span>
                      </div>

                      {/* Vertical Blue Bar */}
                      <div style={{ width: '3px', height: '34px', background: '#0e71eb', borderRadius: '2px' }} />

                      {/* Title & Host */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#18181b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2">
                            <polygon points="23 7 16 12 23 17 23 7" />
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                          </svg>
                          <span>{m.title}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#71717a', marginTop: '2px' }}>
                          Host: {m.host_name || 'Dummy'} • ID: <span style={{ fontFamily: 'monospace' }}>{m.meeting_id}</span>
                        </div>
                      </div>

                      {/* Action */}
                      {!isEnded ? (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ padding: '4px 14px', fontSize: '12px', borderRadius: '6px' }}
                          onClick={() => router.push(`/meeting/${m.meeting_id}`)}
                        >
                          Start
                        </button>
                      ) : (
                        <span style={{ fontSize: '11.5px', color: '#71717a', background: '#e4e4e7', padding: '2px 8px', borderRadius: '4px' }}>
                          Completed
                        </span>
                      )}

                      <span style={{ color: '#9ca3af', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}>•••</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Current Time Indicator Red/Orange Line (shown if today is selected) */}
            {isSelectedToday && (
              <div style={{ display: 'flex', alignItems: 'center', margin: '18px 0' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ea580c', display: 'inline-block' }} />
                <div style={{ flex: 1, height: '2px', background: '#ea580c' }} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#ffffff', width: '100%' }}>
      {/* Left Vertical Sidebar with Home & Meetings */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
        {/* Top Header with Search and Profile Avatar */}
        <div
          style={{
            height: '52px',
            borderBottom: '1px solid #e4e4e7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 24px',
            background: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#f4f4f5',
                border: '1px solid #e4e4e7',
                borderRadius: '16px',
                padding: '4px 12px',
                fontSize: '12px',
                color: '#71717a',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search"
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: '12px', color: '#18181b', width: '140px' }}
              />
            </div>

            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: '#22c55e',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Dummy (Host)"
            >
              D
            </div>
          </div>
        </div>

        {/* Tab View Content */}
        {activeTab === 'home' && renderHomeTab()}
        {activeTab === 'meetings' && renderMeetingsTab()}
      </div>

      {showScheduleModal && (
        <ScheduleModal
          onClose={() => setShowScheduleModal(false)}
          onSchedule={handleScheduleMeeting}
        />
      )}
    </div>
  );
}
