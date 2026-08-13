/**
 * WebRTCManager — Robust Peer-to-Peer Media Engine.
 * 
 * Features:
 * - Dynamic renegotiation: mic and camera hardware are ONLY activated on user click.
 * - Connection persistence: peer connections are NEVER destroyed on renegotiation.
 * - Dynamic addTrack / removeTrack / replaceTrack for seamless mute/unmute and camera toggles.
 * - STUN + Free TURN relays for cross-network and symmetric NAT traversal.
 */

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export class WebRTCManager {
  constructor() {
    this.peerConnections = new Map(); // remoteClientId -> RTCPeerConnection
    this.remoteStreams = new Map();   // remoteClientId -> MediaStream
    this.iceQueues = new Map();       // remoteClientId -> RTCIceCandidate[]
    this.ws = null;
    this.clientId = null;
    this.localStream = null;
    this.onRemoteStreamsChanged = null;
    this._negotiating = new Set();
  }

  init({ ws, clientId, localStream, onRemoteStreamsChanged }) {
    this.ws = ws;
    this.clientId = String(clientId);
    this.localStream = localStream || new MediaStream();
    this.onRemoteStreamsChanged = onRemoteStreamsChanged;
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  announceJoin() {
    this.send({ type: 'webrtc_join', clientId: this.clientId });
  }

  async handleMessage(data) {
    if (String(data.clientId) === this.clientId) return;
    if (data.targetId && String(data.targetId) !== this.clientId) return;

    const remoteId = String(data.clientId);

    try {
      switch (data.type) {
        case 'webrtc_join':
          await this.createOffer(remoteId);
          break;
        case 'webrtc_offer':
          await this.handleOffer(remoteId, data.offer);
          break;
        case 'webrtc_answer':
          await this.handleAnswer(remoteId, data.answer);
          break;
        case 'webrtc_ice_candidate':
          await this.handleIceCandidate(remoteId, data.candidate);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error(`[WebRTC] signaling error (${data.type}):`, err);
    }
  }

  createPeerConnection(remoteId) {
    if (this.peerConnections.has(remoteId)) {
      try {
        this.peerConnections.get(remoteId).close();
      } catch (e) {}
      this.peerConnections.delete(remoteId);
      this._negotiating.delete(remoteId);
    }

    this.iceQueues.set(remoteId, []);

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });

    // Add any existing local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    // ICE Candidate trickle
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.send({
          type: 'webrtc_ice_candidate',
          clientId: this.clientId,
          targetId: remoteId,
          candidate: event.candidate,
        });
      }
    };

    // Receive Remote Track
    pc.ontrack = (event) => {
      let stream = event.streams && event.streams[0];
      if (!stream) {
        stream = this.remoteStreams.get(remoteId) || new MediaStream();
        stream.addTrack(event.track);
      }
      this.remoteStreams.set(remoteId, stream);
      this.notifyStreamsChanged();
    };

    // Auto-renegotiation
    pc.onnegotiationneeded = async () => {
      if (this._negotiating.has(remoteId)) return;
      this._negotiating.add(remoteId);
      try {
        if (pc.signalingState !== 'stable') return;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.send({
          type: 'webrtc_offer',
          clientId: this.clientId,
          targetId: remoteId,
          offer: pc.localDescription,
        });
      } catch (err) {
        console.warn('[WebRTC] renegotiation failed:', err);
      } finally {
        this._negotiating.delete(remoteId);
      }
    };

    // Connection Health Monitoring
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`[WebRTC] peer ${remoteId} connection state: ${state}`);
      if (state === 'failed') {
        this.createOffer(remoteId);
      } else if (state === 'closed') {
        this.removePeer(remoteId);
      }
    };

    this.peerConnections.set(remoteId, pc);
    return pc;
  }

  async drainIceCandidates(remoteId, pc) {
    const queue = this.iceQueues.get(remoteId) || [];
    while (queue.length > 0) {
      const c = queue.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {
        console.warn('[WebRTC] queued candidate failed:', e);
      }
    }
  }

  async createOffer(remoteId) {
    this._negotiating.add(remoteId);
    try {
      let pc = this.peerConnections.get(remoteId);
      if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
        pc = this.createPeerConnection(remoteId);
      }
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.send({
        type: 'webrtc_offer',
        clientId: this.clientId,
        targetId: remoteId,
        offer: pc.localDescription,
      });
    } catch (err) {
      console.warn('[WebRTC] createOffer error:', err);
    } finally {
      this._negotiating.delete(remoteId);
    }
  }

  async handleOffer(remoteId, offer) {
    this._negotiating.add(remoteId);
    try {
      let pc = this.peerConnections.get(remoteId);
      if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
        pc = this.createPeerConnection(remoteId);
      }
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await this.drainIceCandidates(remoteId, pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.send({
        type: 'webrtc_answer',
        clientId: this.clientId,
        targetId: remoteId,
        answer: pc.localDescription,
      });
    } catch (err) {
      console.warn('[WebRTC] handleOffer error:', err);
    } finally {
      this._negotiating.delete(remoteId);
    }
  }

  async handleAnswer(remoteId, answer) {
    const pc = this.peerConnections.get(remoteId);
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      await this.drainIceCandidates(remoteId, pc);
    } catch (err) {
      console.warn('[WebRTC] setRemoteDescription(answer) failed:', err);
    }
  }

  async handleIceCandidate(remoteId, candidate) {
    if (!candidate) return;
    const pc = this.peerConnections.get(remoteId);
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[WebRTC] addIceCandidate failed:', e);
      }
    } else {
      if (!this.iceQueues.has(remoteId)) {
        this.iceQueues.set(remoteId, []);
      }
      this.iceQueues.get(remoteId).push(candidate);
    }
  }

  notifyStreamsChanged() {
    this.onRemoteStreamsChanged?.(new Map(this.remoteStreams));
  }

  removePeer(remoteId) {
    const pc = this.peerConnections.get(remoteId);
    if (pc) {
      try { pc.close(); } catch (_) {}
    }
    this.peerConnections.delete(remoteId);
    this.remoteStreams.delete(remoteId);
    this.iceQueues.delete(remoteId);
    this._negotiating.delete(remoteId);
    this.notifyStreamsChanged();
  }

  cleanup() {
    this.peerConnections.forEach((pc) => {
      try { pc.close(); } catch (_) {}
    });
    this.peerConnections.clear();
    this.remoteStreams.clear();
    this.iceQueues.clear();
    this._negotiating.clear();
  }

  /**
   * Add a new live track to all peer connections (triggers automatic renegotiation).
   */
  addTrackToPeers(track, stream) {
    for (const [, pc] of this.peerConnections) {
      try {
        pc.addTrack(track, stream || this.localStream);
      } catch (e) {
        console.warn('[WebRTC] addTrack failed:', e);
      }
    }
  }

  /**
   * Remove a track of kind ('audio' or 'video') from all peer connections.
   */
  removeTrackFromPeers(kind) {
    for (const [, pc] of this.peerConnections) {
      const senders = pc.getSenders();
      const sender = senders.find((s) => s.track && s.track.kind === kind);
      if (sender) {
        try {
          pc.removeTrack(sender);
        } catch (e) {
          console.warn('[WebRTC] removeTrack failed:', e);
        }
      }
    }
  }

  /**
   * Replace the video track directly (e.g. for screen sharing).
   */
  async replaceVideoTrack(newTrack) {
    for (const [, pc] of this.peerConnections) {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
      if (videoSender && newTrack) {
        try {
          await videoSender.replaceTrack(newTrack);
        } catch (e) {
          console.warn('[WebRTC] replaceTrack video failed:', e);
        }
      } else if (newTrack) {
        try {
          pc.addTrack(newTrack, this.localStream);
        } catch (e) {
          console.warn('[WebRTC] addTrack video failed:', e);
        }
      } else if (videoSender && !newTrack) {
        try {
          pc.removeTrack(videoSender);
        } catch (e) {
          console.warn('[WebRTC] removeTrack video failed:', e);
        }
      }
    }
  }
}
