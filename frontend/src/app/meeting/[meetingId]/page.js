'use client';

/**
 * Meeting Room Page — The actual video conferencing interface.
 * Shows video grid, bottom toolbar, and participant panel.
 */

import { useState, useEffect, useCallback, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { getMeeting, listParticipants, updateParticipant, removeParticipant, muteAllParticipants, endMeeting, joinMeeting } from '@/lib/api';
import ParticipantPanel from '@/components/ParticipantPanel';
import ChatPanel from '@/components/ChatPanel';
import InviteModal from '@/components/InviteModal';
import LeaveModal from '@/components/LeaveModal';
import { WebRTCManager } from '@/lib/webrtc';

/** Renders a remote peer's stream — using a dedicated audio element for guaranteed audio playback */
function RemoteVideo({ stream, isVideoOn = true, style, muted }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (stream) {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      if (audioRef.current) {
        audioRef.current.srcObject = stream;
        audioRef.current.play().catch(() => {});
      }

      const handleTrackChange = () => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        if (audioRef.current) {
          audioRef.current.srcObject = stream;
          audioRef.current.play().catch(() => {});
        }
      };
      stream.addEventListener('addtrack', handleTrackChange);
      stream.addEventListener('removetrack', handleTrackChange);
      return () => {
        stream.removeEventListener('addtrack', handleTrackChange);
        stream.removeEventListener('removetrack', handleTrackChange);
      };
    }
  }, [stream]);

  return (
    <>
      {/* Audio element ALWAYS active regardless of video state */}
      <audio ref={audioRef} autoPlay playsInline muted={muted} />
      {/* Video element rendered when camera is on */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={true}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: isVideoOn ? 'block' : 'none',
          ...style,
        }}
      />
    </>
  );
}

export default function MeetingRoom(props) {
  const router = useRouter();
  const params = use(props.params);
  const { meetingId } = params;
  
  const [meeting, setMeeting] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Local user state — Muted and Video Off by default
  // We request real getUserMedia on mount but immediately disable tracks.
  // This ensures the SDP offer contains real m=audio and m=video lines
  // which is REQUIRED for cross-device WebRTC to work.
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [mediaReady, setMediaReady] = useState(false);
  const isLeavingRef = useRef(false);
  const videoRef = useRef(null);
  
  // UI State
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [raisedHands, setRaisedHands] = useState(new Set());
  
  // Screen Sharing
  const [screenStream, setScreenStream] = useState(null);
  const screenRef = useRef(null);
  const [remoteScreenShareId, setRemoteScreenShareId] = useState(null);
  const [duration, setDuration] = useState(0); // in seconds
  
  // Chat state
  const [messages, setMessages] = useState([
    { id: 1, sender: 'System', text: 'Welcome to the Zoom Chat!', time: new Date().toISOString(), isSystem: true }
  ]);
  const socketRef = useRef(null);
  
  // WebRTC
  const webrtcRef = useRef(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  
  // Current user (mocked as the first participant for demo if host, or match by logic)
  const [currentUser, setCurrentUser] = useState(null);

  const fetchMeetingData = useCallback(async () => {
    try {
      let data = await getMeeting(meetingId);
      setMeeting(data);
      
      let parts = await listParticipants(meetingId);

      // Auto-join meeting if participant list is empty (e.g. starting a scheduled meeting)
      if (parts.length === 0) {
        try {
          const joinedUser = await joinMeeting(meetingId, data.host_name || 'Host User');
          parts = [joinedUser];
          // Refresh meeting data to get active status
          data = await getMeeting(meetingId);
          setMeeting(data);
        } catch (e) {
          console.warn('Auto-join meeting failed', e);
        }
      }

      setParticipants(parts);
      
      if (!currentUser && parts.length > 0) {
        setCurrentUser(parts[parts.length - 1]);
      } else if (currentUser) {
        const stillInMeeting = parts.find(p => p.id === currentUser.id);
        if (!stillInMeeting) {
          if (!isLeavingRef.current) {
            alert('You have been removed from the meeting by the host.');
          }
          router.push('/');
          return;
        }
        
        if (stillInMeeting.role !== currentUser.role || stillInMeeting.display_name !== currentUser.display_name) {
          setCurrentUser(stillInMeeting);
        }
      }
      
    } catch (err) {
      if (err.message.includes('404')) {
        setError('Meeting not found.');
      } else {
        setError('Failed to load meeting details.');
      }
    } finally {
      setLoading(false);
    }
  }, [meetingId, currentUser]);

  // Initial load and polling
  useEffect(() => {
    fetchMeetingData();
    
    // Slower fallback poll (WebSockets handle immediate updates)
    const interval = setInterval(fetchMeetingData, 10000);
    return () => clearInterval(interval);
  }, [fetchMeetingData]);

  // WebSocket Connection
  useEffect(() => {
    if (!currentUser || !meetingId) return;

    const wsBase = process.env.NEXT_PUBLIC_WS_URL ||
      (process.env.NEXT_PUBLIC_API_URL
        ? process.env.NEXT_PUBLIC_API_URL.replace(/^http/, 'ws')
        : 'ws://localhost:8000');
    const ws = new WebSocket(`${wsBase}/ws/meeting/${meetingId}/${currentUser.id}`);
    socketRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chat') {
        setMessages((prev) => [...prev, {
          id: data.id,
          sender: data.sender_name,
          text: data.text,
          time: data.time,
          isSystem: false,
          isMe: false
        }]);
      } else if (data.type === 'participant_update' || data.type === 'participant_left') {
        fetchMeetingData();
        if (data.type === 'participant_left' && data.participant_id === remoteScreenShareId) {
          setRemoteScreenShareId(null);
        }
      } else if (data.type === 'screen_share_start') {
        setRemoteScreenShareId(data.clientId);
      } else if (data.type === 'screen_share_stop') {
        setRemoteScreenShareId(null);
      } else if (data.type.startsWith('webrtc_')) {
        // If someone new joins and we are sharing our screen, let them know!
        if (data.type === 'webrtc_join' && screenStream && socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: 'screen_share_start',
            clientId: currentUser.id,
            targetId: data.clientId
          }));
        }
        if (webrtcRef.current) {
          webrtcRef.current.handleMessage(data);
        }
      } else if (data.type === 'host_action' && (String(data.targetId) === String(currentUser.id) || data.targetId === 'all')) {
        if (data.action === 'ask_video') {
          const accept = window.confirm('The host has asked you to start your video. Turn on your camera?');
          if (accept) {
            handleToggleVideoRef.current?.();
          }
        } else if (data.action === 'ask_unmute') {
          const accept = window.confirm('The host has asked you to unmute. Unmute your microphone?');
          if (accept) {
            const muteBtn = document.getElementById('toolbar-mute-btn');
            if (muteBtn) muteBtn.click();
          }
        } else if (data.action === 'force_mute') {
          setIsMuted(true);
          if (localStream) {
            localStream.getAudioTracks().forEach(t => { t.enabled = false; });
          }
        }
      } else if (data.type === 'meeting_ended') {
        alert('The host has ended the meeting.');
        router.push('/');
      } else if (data.type === 'raise_hand') {
        setRaisedHands(prev => {
          const next = new Set(prev);
          if (data.isRaised) next.add(data.clientId);
          else next.delete(data.clientId);
          return next;
        });
      }
    };

    return () => {
      ws.close();
    };
  }, [currentUser, meetingId, fetchMeetingData]);

  // WebRTC Initialization — create peer connections when media + socket are ready
  useEffect(() => {
    if (!localStream || !mediaReady || !currentUser || !socketRef.current) return;
    
    const ws = socketRef.current;
    const mgr = new WebRTCManager();
    webrtcRef.current = mgr;
    
    const initWebRTC = () => {
      mgr.init({
        ws,
        localStream,
        clientId: currentUser.id,
        onRemoteStreamsChanged: (streams) => setRemoteStreams(streams),
      });
      // Small delay to ensure other peers' WebSockets are ready
      setTimeout(() => mgr.announceJoin(), 800);
    };
    
    if (ws.readyState === WebSocket.OPEN) {
      initWebRTC();
    } else {
      ws.addEventListener('open', initWebRTC, { once: true });
    }
    
    return () => {
      mgr.cleanup();
      webrtcRef.current = null;
    };
  }, [localStream, mediaReady, currentUser]);

  const handleSendMessage = (text) => {
    const newMessage = {
      id: Date.now(),
      sender: currentUser?.display_name || 'You',
      text: text,
      time: new Date().toISOString(),
      isSystem: false,
      isMe: true
    };
    setMessages((prev) => [...prev, newMessage]);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'chat',
        id: newMessage.id,
        sender_id: currentUser?.id,
        sender_name: currentUser?.display_name || 'User',
        text: text,
        time: newMessage.time
      }));
    }
  };

  // Initialize REAL local media stream on mount.
  // We request mic + camera, then immediately disable both tracks.
  // This gives us a genuine MediaStream with real audio/video tracks
  // so WebRTC SDP offers include proper m=audio and m=video lines.
  // Without real tracks, cross-network peers cannot exchange media.
  useEffect(() => {
    let cancelled = false;
    let acquiredStream = null;

    const acquireMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: true,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        acquiredStream = stream;

        // Immediately disable both tracks (user starts muted + camera off)
        stream.getAudioTracks().forEach(t => { t.enabled = false; });
        stream.getVideoTracks().forEach(t => { t.enabled = false; });

        setLocalStream(stream);
        setMediaReady(true);
      } catch (err) {
        console.warn('[Media] getUserMedia failed, trying audio-only:', err);
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (cancelled) {
            audioOnly.getTracks().forEach(t => t.stop());
            return;
          }
          acquiredStream = audioOnly;
          audioOnly.getAudioTracks().forEach(t => { t.enabled = false; });
          setLocalStream(audioOnly);
          setMediaReady(true);
        } catch (err2) {
          console.error('[Media] No media devices available:', err2);
          // Fallback: empty stream (WebRTC will use transceivers)
          const empty = new MediaStream();
          setLocalStream(empty);
          setMediaReady(true);
        }
      }
    };

    acquireMedia();

    return () => {
      cancelled = true;
      if (acquiredStream) {
        acquiredStream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (screenRef.current && screenStream) {
      screenRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  // Timer — Live meeting session timer starting at 00:00
  useEffect(() => {
    if (!meeting || meeting.status !== 'active') return;

    const timer = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [meeting?.status]);

  const formatDuration = (seconds) => {
    const totalSecs = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;

    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleToggleMute = async () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    // Simply toggle track.enabled — the track stays in the SDP/RTP stream.
    // enabled=false sends silence frames, enabled=true sends real audio.
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !nextMuted;
      });
    }

    if (currentUser) {
      updateParticipant(meetingId, currentUser.id, { is_muted: nextMuted }).then(() => {
        fetchMeetingData();
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'participant_update' }));
        }
      });
    }
  };

  const handleToggleVideo = async () => {
    const nextVideoOn = !isVideoOn;
    setIsVideoOn(nextVideoOn);

    // Simply toggle track.enabled — sends black frames when disabled.
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = nextVideoOn;
      });
    }

    if (currentUser) {
      updateParticipant(meetingId, currentUser.id, { is_video_on: nextVideoOn }).then(() => {
        fetchMeetingData();
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'participant_update' }));
        }
      });
    }
  };

  const handleToggleVideoRef = useRef(handleToggleVideo);
  useEffect(() => {
    handleToggleVideoRef.current = handleToggleVideo;
  });

  const handleShareScreen = async () => {
    if (screenStream) {
      // Stop sharing — switch back to camera track
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
      
      const camTrack = localStream?.getVideoTracks()[0] || null;
      if (webrtcRef.current) {
        await webrtcRef.current.replaceVideoTrack(camTrack);
      }
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'screen_share_stop', clientId: currentUser.id }));
      }
    } else {
      // Start sharing
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setScreenStream(stream);
        
        const screenTrack = stream.getVideoTracks()[0];
        if (webrtcRef.current) {
          await webrtcRef.current.replaceVideoTrack(screenTrack);
        }
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'screen_share_start', clientId: currentUser.id }));
        }
        
        // Listen for when user stops sharing via browser UI
        screenTrack.onended = async () => {
          setScreenStream(null);
          const camTrack = localStream?.getVideoTracks()[0] || null;
          if (webrtcRef.current) {
            await webrtcRef.current.replaceVideoTrack(camTrack);
          }
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'screen_share_stop', clientId: currentUser.id }));
          }
        };
      } catch (err) {
        console.warn('Screen sharing cancelled or failed.', err);
      }
    }
  };

  const cleanupMedia = () => {
    isLeavingRef.current = true;
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (screenStream) screenStream.getTracks().forEach(t => t.stop());
    if (webrtcRef.current) webrtcRef.current.cleanup();
  };

  const handleRaiseHand = () => {
    const currentIdStr = String(currentUser?.id);
    const isRaised = !raisedHands.has(currentIdStr);
    setRaisedHands(prev => {
      const next = new Set(prev);
      if (isRaised) next.add(currentIdStr);
      else next.delete(currentIdStr);
      return next;
    });
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ 
        type: 'raise_hand', 
        clientId: currentIdStr, 
        isRaised 
      }));
    }
  };

  const handleLeaveMeeting = async () => {
    cleanupMedia();
    
    // If we are the host, auto-transfer host role to a random remaining participant
    if (currentUser && currentUser.role === 'host') {
      const otherParticipants = participants.filter(p => p.id !== currentUser.id);
      if (otherParticipants.length > 0) {
        const randomNext = otherParticipants[Math.floor(Math.random() * otherParticipants.length)];
        await updateParticipant(meetingId, randomNext.id, { role: 'host' });
      }
    }
    
    if (currentUser) {
      await removeParticipant(meetingId, currentUser.id);
    }
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'participant_update' }));
    }
    router.push('/');
  };

  const handleEndMeeting = async () => {
    cleanupMedia();
    
    // Broadcast meeting_ended to all participants so they get redirected
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'meeting_ended' }));
    }
    
    await endMeeting(meetingId);
    router.push('/');
  };

  // Host Actions
  const handleMuteAll = async () => {
    await muteAllParticipants(meetingId);
    fetchMeetingData();
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'participant_update' }));
      socketRef.current.send(JSON.stringify({
        type: 'host_action',
        action: 'force_mute',
        targetId: 'all'
      }));
    }
  };

  const handleParticipantMuteToggle = async (participant) => {
    const nextMuted = !participant.is_muted;
    await updateParticipant(meetingId, participant.id, { is_muted: nextMuted });
    fetchMeetingData();
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'participant_update' }));
      socketRef.current.send(JSON.stringify({
        type: 'host_action',
        action: nextMuted ? 'force_mute' : 'ask_unmute',
        targetId: participant.id
      }));
    }
  };

  const handleRemoveParticipant = async (participant) => {
    if (window.confirm(`Remove ${participant.display_name}?`)) {
      await removeParticipant(meetingId, participant.id);
      fetchMeetingData();
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'participant_update' }));
      }
    }
  };

  const handleAskToStartVideo = (participant) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ 
        type: 'host_action', 
        action: 'ask_video',
        targetId: participant.id
      }));
    }
  };

  const handleMakeHost = async (participant) => {
    await updateParticipant(meetingId, participant.id, { role: 'host' });
    await updateParticipant(meetingId, currentUser.id, { role: 'participant' }); // Demote self
    fetchMeetingData();
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'participant_update' }));
    }
  };

  const handleRename = async (participant, newName) => {
    await updateParticipant(meetingId, participant.id, { display_name: newName });
    if (currentUser && currentUser.id === participant.id) {
      setCurrentUser(prev => prev ? { ...prev, display_name: newName } : null);
    }
    fetchMeetingData();
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'participant_update' }));
    }
  };

  if (loading) {
    return (
      <div className="meeting-room" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.1)', borderTopColor: 'var(--zoom-blue)', width: '48px', height: '48px' }} />
        <p style={{ color: 'white', marginTop: '20px' }}>Connecting...</p>
      </div>
    );
  }

  if (error || (meeting && meeting.status === 'ended')) {
    return (
      <div className="meeting-room" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'var(--bg-card)', padding: '40px', borderRadius: 'var(--border-radius-lg)', textAlign: 'center' }}>
          <h2 style={{ color: 'white', marginBottom: '16px' }}>{error || 'This meeting has ended.'}</h2>
          <button className="btn btn-primary" onClick={() => router.push('/')}>Return Home</button>
        </div>
      </div>
    );
  }

  // Determine grid layout class
  const getGridClass = (count) => {
    if (count === 1) return 'grid-1';
    if (count === 2) return 'grid-2';
    if (count <= 4) return 'grid-3-4';
    if (count <= 6) return 'grid-5-6';
    return 'grid-many';
  };

  const isHost = currentUser?.role === 'host';

  return (
    <div className="meeting-room">
      {/* Top Info Bar */}
      <div className="meeting-room-header">
        <div className="meeting-room-info">
          <button style={{ background: 'transparent', border: 'none', color: 'var(--success)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
          </button>
          <div>
            <div className="meeting-room-title">{meeting?.title || 'Zoom Meeting'}</div>
            <div className="meeting-room-id">ID: {meetingId}</div>
          </div>
        </div>
        
        <div className="meeting-room-actions-top">
          <div className="meeting-room-timer">
            <span className="rec-dot" />
            {formatDuration(duration)}
          </div>
          <button className="btn btn-sm btn-ghost" style={{ color: 'white' }} onClick={() => setShowInviteModal(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Invite
          </button>
        </div>
      </div>

      {/* Main Video Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        <div style={{ flex: 1, display: 'flex', flexDirection: (screenStream || remoteScreenShareId) ? 'column' : 'row', overflow: 'hidden' }}>
          
          {/* Screen Share Area */}
          {(screenStream || remoteScreenShareId) && (
            <div style={{ flex: 1, minHeight: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
              {screenStream ? (
                <video
                  ref={screenRef}
                  autoPlay
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <RemoteVideo 
                  stream={remoteStreams.get(String(remoteScreenShareId))} 
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                  muted={true}
                />
              )}
              <div style={{ position: 'absolute', top: '16px', left: '16px', background: 'rgba(0,0,0,0.6)', padding: '4px 12px', borderRadius: '4px', color: 'white', fontSize: '13px' }}>
                {screenStream ? 'You are sharing your screen' : 'Viewing shared screen'}
              </div>
            </div>
          )}

          <div className={`video-grid ${(screenStream || remoteScreenShareId) ? 'screen-share-strip' : getGridClass(participants.length)}`}>
            {participants.map((p, i) => {
            const isSpeaking = false;
            const pIdStr = String(p.id);
            const isSelf = p.id === currentUser?.id;
            const hasRemoteStream = remoteStreams.has(pIdStr);
            const showAvatar = isSelf ? !isVideoOn : !p.is_video_on;
            
            return (
              <div key={p.id} className={`video-tile ${isSpeaking ? 'speaking' : ''}`}>
                {/* Always render video element for streams so audio plays even when video is hidden */}
                {isSelf && localStream ? (
                  <video
                    ref={(el) => {
                      if (el && localStream && el.srcObject !== localStream) {
                        el.srcObject = localStream;
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: 'scaleX(-1)',
                      display: isVideoOn ? 'block' : 'none',
                    }}
                  />
                ) : hasRemoteStream ? (
                  <RemoteVideo 
                    stream={remoteStreams.get(pIdStr)} 
                    isVideoOn={p.is_video_on}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : null}

                {/* Avatar fallback when video is off */}
                {showAvatar && (
                  <div 
                    className="video-tile-avatar" 
                    style={{ background: `hsl(${(p.id * 137) % 360}, 70%, 50%)` }}
                  >
                    {p.display_name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                )}
                
                <div className="video-tile-name">
                  {p.is_muted && (
                    <svg className="mute-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  )}
                  {p.display_name} {isSelf ? '(You)' : ''}
                  {raisedHands.has(pIdStr) && <span style={{ marginLeft: '4px', fontSize: '14px' }}>✋</span>}
                </div>
              </div>
            );
          })}
        </div>
        </div>

        {/* Side Panels */}
        {showParticipants && (
          <ParticipantPanel
            participants={participants}
            onClose={() => setShowParticipants(false)}
            onMuteAll={isHost ? handleMuteAll : undefined}
            onToggleMute={isHost ? handleParticipantMuteToggle : undefined}
            onRemove={isHost ? handleRemoveParticipant : undefined}
            onAskToStartVideo={isHost ? handleAskToStartVideo : undefined}
            onMakeHost={isHost ? handleMakeHost : undefined}
            onRename={handleRename}
            isHost={isHost}
            raisedHands={raisedHands}
            currentUser={currentUser}
            onOpenInvite={() => setShowInviteModal(true)}
          />
        )}
        
        {showChat && (
          <ChatPanel 
            onClose={() => setShowChat(false)} 
            currentUser={currentUser} 
            messages={messages}
            onSendMessage={handleSendMessage}
          />
        )}
      </div>

      {/* Bottom Toolbar */}
      <div className="meeting-toolbar">
        {/* Audio/Video */}
        <div style={{ display: 'flex' }}>
          <button id="toolbar-mute-btn" className={`toolbar-btn ${isMuted ? 'muted' : ''}`} onClick={handleToggleMute}>
            <div className="toolbar-btn-icon">
              {isMuted ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .72-.11 1.42-.31 2.07" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                </svg>
              )}
            </div>
            <span>{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>
          
          <button id="start-video-btn" className={`toolbar-btn ${!isVideoOn ? 'muted' : ''}`} onClick={handleToggleVideo}>
            <div className="toolbar-btn-icon">
              {!isVideoOn ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 16v3a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              )}
            </div>
            <span>{isVideoOn ? 'Stop Video' : 'Start Video'}</span>
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Center Controls */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`toolbar-btn ${showParticipants ? 'active' : ''}`} 
            onClick={() => {
              setShowParticipants(!showParticipants);
              setShowChat(false);
            }}
          >
            <div style={{ position: 'relative' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span style={{
                position: 'absolute', top: '-4px', right: '-8px',
                background: 'var(--zoom-blue)', color: 'white',
                fontSize: '9px', padding: '2px 4px', borderRadius: '10px',
                fontWeight: 'bold'
              }}>
                {participants.length}
              </span>
            </div>
            <span>Participants</span>
          </button>

          <button 
            className={`toolbar-btn ${showChat ? 'active' : ''}`}
            onClick={() => {
              setShowChat(!showChat);
              setShowParticipants(false);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>Chat</span>
          </button>

          <button 
            className={`toolbar-btn ${screenStream ? 'active' : ''}`} 
            style={{ color: 'var(--success)' }}
            onClick={handleShareScreen}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
              <line x1="12" y1="12" x2="12" y2="20" />
              <line x1="8" y1="16" x2="12" y2="12" />
              <line x1="16" y1="16" x2="12" y2="12" />
            </svg>
            <span>{screenStream ? 'Stop Share' : 'Share Screen'}</span>
          </button>
          
          <button 
            className={`toolbar-btn ${raisedHands.has(String(currentUser?.id)) ? 'active' : ''}`}
            onClick={handleRaiseHand}
          >
            <div style={{ fontSize: '20px', lineHeight: '24px' }}>✋</div>
            <span>{raisedHands.has(String(currentUser?.id)) ? 'Lower Hand' : 'Raise Hand'}</span>
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Leave / End */}
        <button className="toolbar-btn-leave" onClick={() => setShowLeaveModal(true)}>
          {isHost ? 'End' : 'Leave'}
        </button>
      </div>
      {showInviteModal && (
        <InviteModal meeting={meeting} onClose={() => setShowInviteModal(false)} />
      )}
      {showLeaveModal && (
        <LeaveModal 
          isHost={isHost} 
          onConfirmLeave={handleLeaveMeeting} 
          onConfirmEnd={handleEndMeeting} 
          onClose={() => setShowLeaveModal(false)} 
        />
      )}
    </div>
  );
}
