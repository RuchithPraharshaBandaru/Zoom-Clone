'use client';

/**
 * ScheduleModal — Zoom Desktop styled Schedule Dialog.
 * Keeps the exact core fields (Title, Description, Date, Time, Duration)
 * with the visual aesthetics from the Zoom screenshot.
 */

import { useState, useEffect } from 'react';

export default function ScheduleModal({ onClose, onSchedule }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Set default date to tomorrow at 10:00 AM
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const pad = (n) => String(n).padStart(2, '0');
    setDate(`${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`);
    setTime('10:00');
  }, []);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');
    if (!title.trim() || !date || !time) return;

    const targetDate = new Date(`${date}T${time}:00`);
    if (targetDate <= new Date()) {
      setError('Cannot schedule a meeting in the past. Please choose a future date and time.');
      return;
    }

    setIsSubmitting(true);
    try {
      const scheduledTime = targetDate.toISOString();
      await onSchedule({
        title: title.trim(),
        description: description.trim() || null,
        scheduled_time: scheduledTime,
        duration_minutes: duration,
      });
      onClose();
    } catch (err) {
      console.error('Failed to schedule meeting:', err);
      setError('Failed to schedule meeting. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      id="schedule-modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        id="schedule-modal"
        style={{
          width: '500px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#ffffff',
          borderRadius: '12px',
          padding: '24px 28px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          color: '#18181b',
          fontSize: '13.5px',
          fontFamily: 'inherit',
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {error && (
            <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '12.5px' }}>
              {error}
            </div>
          )}

          {/* 1. Title Input (Top gray bar matching screenshot) */}
          <div style={{ width: '100%' }}>
            <input
              type="text"
              id="meeting-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Sprint Planning — Q3 Roadmap"
              required
              autoFocus
              style={{
                width: '100%',
                background: '#f1f3f9',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '15px',
                fontWeight: 600,
                color: '#18181b',
                outline: 'none',
              }}
            />
          </div>

          {/* 2. Date & Time Row (Pill styling matching screenshot) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontWeight: 600, color: '#18181b' }}>Date & Time</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Date */}
              <input
                type="date"
                id="meeting-date"
                value={date}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDate(e.target.value)}
                required
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '16px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  color: '#374151',
                  background: '#ffffff',
                  outline: 'none',
                }}
              />

              {/* Time */}
              <input
                type="time"
                id="meeting-time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '16px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  color: '#374151',
                  background: '#ffffff',
                  outline: 'none',
                }}
              />

              {/* Duration Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#6b7280', fontSize: '12px' }}>Duration:</span>
                <select
                  id="meeting-duration"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  style={{
                    border: '1px solid #d1d5db',
                    borderRadius: '16px',
                    padding: '6px 12px',
                    fontSize: '13px',
                    color: '#374151',
                    background: '#ffffff',
                    outline: 'none',
                  }}
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                  <option value={180}>3 hours</option>
                  <option value={240}>4 hours</option>
                </select>
              </div>
            </div>

            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              (GMT+5:30) India Standard Time
            </div>
          </div>

          {/* 3. Description / Agenda */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontWeight: 600, color: '#18181b' }}>Description / Agenda</label>
            <textarea
              id="meeting-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add meeting agenda or notes (optional)..."
              style={{
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '13px',
                color: '#18181b',
                background: '#ffffff',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* 4. Footer (Cancel & Save buttons styled with Zoom blue pill) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              id="schedule-cancel-btn"
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                padding: '6px 12px',
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              id="schedule-save-btn"
              disabled={!title.trim() || !date || !time || isSubmitting}
              style={{
                background: '#0e71eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '18px',
                padding: '7px 22px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: (!title.trim() || !date || !time || isSubmitting) ? 'not-allowed' : 'pointer',
                opacity: (!title.trim() || !date || !time || isSubmitting) ? 0.6 : 1,
                transition: 'background 0.15s',
              }}
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
