'use client';

/**
 * InviteModal — Zoom Desktop Client exact Invite Participants dialog.
 */

import { useState } from 'react';

export default function InviteModal({ meeting, onClose }) {
  const [activeTab, setActiveTab] = useState('contacts');
  const [copiedField, setCopiedField] = useState(null);
  
  const inviteLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/meeting/${meeting?.meeting_id}`
    : '';
  
  const meetingCode = meeting?.meeting_id || '';
  const passcode = meeting?.passcode || '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedField('link');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyInvitation = () => {
    const fullText = [
      `Join Zoom Meeting`,
      ``,
      `Meeting Link: ${inviteLink}`,
      `Meeting ID: ${meetingCode}`,
      passcode ? `Passcode: ${passcode}` : '',
    ].filter(Boolean).join('\n');
    
    navigator.clipboard.writeText(fullText);
    setCopiedField('invitation');
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div 
        className="modal" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          maxWidth: '540px', 
          width: '100%',
          background: '#1c1c1e', 
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.7)',
          padding: '0',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div style={{ 
          display: 'flex', 
          justify: 'space-between', 
          alignItems: 'center', 
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)'
        }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
            Invite participants
          </h3>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'none', border: 'none', color: '#9ca3af', fontSize: '18px', cursor: 'pointer' 
            }}
          >
            ✕
          </button>
        </div>

        {/* Zoom Sub-tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#242426', padding: '0 20px' }}>
          {['contacts', 'zoom_rooms', 'email'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid #0e71eb' : '2px solid transparent',
                color: activeTab === tab ? '#ffffff' : '#9ca3af',
                fontWeight: activeTab === tab ? 600 : 400,
                fontSize: '13px',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '180px' }}>
          {/* Meeting Info Card */}
          <div style={{ background: '#242426', borderRadius: '8px', padding: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>Meeting ID:</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', letterSpacing: '0.5px' }}>{meetingCode}</span>
            </div>
            
            {passcode && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>Passcode:</span>
                <span style={{ fontSize: '13px', color: '#ffffff' }}>{passcode}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>Invite Link:</span>
              <span style={{ fontSize: '12px', color: '#0e71eb', wordBreak: 'break-all' }}>{inviteLink}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer Toolbar */}
        <div style={{ 
          padding: '16px 20px', 
          background: '#18181a', 
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center'
        }}>
          {/* Left Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={handleCopyLink}
              style={{
                padding: '8px 16px',
                background: '#333336',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              {copiedField === 'link' ? '✓ Copied Link' : 'Copy Invite Link'}
            </button>

            <button 
              onClick={handleCopyInvitation}
              style={{
                padding: '8px 16px',
                background: '#333336',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              {copiedField === 'invitation' ? '✓ Copied Invitation' : 'Copy Invitation'}
            </button>
          </div>

          {/* Right Close Button */}
          <button 
            onClick={onClose}
            style={{
              padding: '8px 20px',
              background: 'transparent',
              color: '#9ca3af',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '6px',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
