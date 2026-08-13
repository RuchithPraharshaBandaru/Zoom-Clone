'use client';

/**
 * LeaveModal — Zoom Desktop Client exact popup for Leaving / Ending a meeting.
 * Positioned in the bottom-right corner above the Leave button.
 */

export default function LeaveModal({ isHost, onConfirmLeave, onConfirmEnd, onClose }) {
  return (
    <div 
      className="modal-overlay" 
      onClick={onClose} 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        zIndex: 10000, 
        background: 'transparent' // Click outside to close
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          position: 'fixed',
          bottom: '72px',
          right: '24px',
          width: '320px', 
          background: '#1c1c1e', 
          borderRadius: '16px', 
          boxShadow: '0 12px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeInUp 0.15s ease-out'
        }}
      >
        {/* Main Buttons Container */}
        <div style={{ padding: '12px', background: '#242426', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {isHost ? (
            <>
              <button 
                onClick={onConfirmEnd}
                style={{ 
                  width: '100%', 
                  padding: '14px', 
                  background: '#c9252b', 
                  color: '#ffffff', 
                  fontWeight: 700, 
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'opacity 0.15s'
                }}
                onMouseEnter={(e) => e.target.style.opacity = '0.9'}
                onMouseLeave={(e) => e.target.style.opacity = '1'}
              >
                End Meeting for All
              </button>
              
              <button 
                onClick={onConfirmLeave}
                style={{ 
                  width: '100%', 
                  padding: '14px', 
                  background: '#38383a', 
                  color: '#ffffff', 
                  fontWeight: 700, 
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => e.target.style.background = '#444446'}
                onMouseLeave={(e) => e.target.style.background = '#38383a'}
              >
                Leave Meeting
              </button>
            </>
          ) : (
            <button 
              onClick={onConfirmLeave}
              style={{ 
                width: '100%', 
                padding: '14px', 
                background: '#c9252b', 
                color: '#ffffff', 
                fontWeight: 700, 
                borderRadius: '10px',
                border: 'none',
                fontSize: '16px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'opacity 0.15s'
              }}
              onMouseEnter={(e) => e.target.style.opacity = '0.9'}
              onMouseLeave={(e) => e.target.style.opacity = '1'}
            >
              Leave Meeting
            </button>
          )}
        </div>

        {/* Footer with right-aligned Cancel button */}
        <div style={{ padding: '12px 16px', background: '#1c1c1e', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            onClick={onClose}
            style={{ 
              background: 'none',
              border: 'none',
              color: '#ffffff', 
              fontWeight: 500, 
              fontSize: '15px',
              cursor: 'pointer',
              padding: '4px 8px'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
