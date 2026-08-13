/**
 * WebRTCManager — Production-grade Peer-to-Peer Connection Engine.
 *
 * Architecture:
 * - On init, we request REAL mic+camera media (getUserMedia) so the SDP offer
 *   contains genuine audio/video m-lines with codecs. This is the ONLY way
 *   cross-network WebRTC works reliably.
 * - Mute/unmute and camera toggle use track.enabled (not track.stop()) so
 *   the underlying RTP transceiver stays alive and the remote peer continues
 *   to receive the stream (just silence / black frames when disabled).
 * - ICE candidates are queued until setRemoteDescription completes.
 * - Expanded STUN pool + free TURN relay for symmetric NAT traversal.
 */

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  // Free TURN relay for symmetric NAT (mobile data, corporate firewalls)
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
    this.peerConnections = new Map();
    this.remoteStreams = new Map();
    this.iceQueues = new Map();
    this.localStream = null;
    this.ws = null;
    this.clientId = null;
    this.onRemoteStreamsChanged = null;
    this._negotiating = new Set();
  }

  /**
   * Initialize with a real MediaStream that has at least one audio+video track.
   * Tracks may be disabled (muted / camera off) but they MUST exist in the stream
   * so that the SDP offer includes proper m=audio and m=video lines.
   */
  init({ ws, localStream, clientId, onRemoteStreamsChanged }) {
    this.ws = ws;
    this.localStream = localStream;
    this.clientId = String(clientId);
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
    // Tear down existing connection to this peer
    if (this.peerConnections.has(remoteId)) {
      try { this.peerConnections.get(remoteId).close(); } catch (_) {}
      this.peerConnections.delete(remoteId);
      this._negotiating.delete(remoteId);
    }

    // Reset ICE candidate queue for this peer
    this.iceQueues.set(remoteId, []);

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });

    // Add ALL local tracks (audio + video) from our real media stream.
    // The tracks may be disabled (.enabled = false), but they MUST be added
    // so the SDP negotiation includes the m-lines for both media types.
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    // ── ICE candidate trickle ──
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

    // ── Receive remote tracks ──
    pc.ontrack = (event) => {
      let stream = event.streams && event.streams[0];
      if (!stream) {
        // Firefox sometimes delivers tracks without associated streams
        stream = this.remoteStreams.get(remoteId) || new MediaStream();
        stream.addTrack(event.track);
      }
      this.remoteStreams.set(remoteId, stream);
      this.notifyStreamsChanged();
    };

    // ── Auto-renegotiation (for replaceTrack fallback to addTrack) ──
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

    // ── Connection health monitoring ──
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`[WebRTC] peer ${remoteId} connection state: ${state}`);
      if (state === 'failed') {
        // Attempt ICE restart on failure
        console.log(`[WebRTC] attempting ICE restart for peer ${remoteId}`);
        this.createOffer(remoteId);
      } else if (state === 'closed') {
        this.removePeer(remoteId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] peer ${remoteId} ICE state: ${pc.iceConnectionState}`);
    };

    this.peerConnections.set(remoteId, pc);
    return pc;
  }

  /** Drain queued ICE candidates after setRemoteDescription */
  async drainIceCandidates(remoteId, pc) {
    const queue = this.iceQueues.get(remoteId) || [];
    while (queue.length > 0) {
      const candidate = queue.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[WebRTC] queued ICE candidate failed:', e);
      }
    }
  }

  async createOffer(remoteId) {
    this._negotiating.add(remoteId);
    try {
      const pc = this.createPeerConnection(remoteId);
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      this.send({
        type: 'webrtc_offer',
        clientId: this.clientId,
        targetId: remoteId,
        offer: pc.localDescription,
      });
    } finally {
      this._negotiating.delete(remoteId);
    }
  }

  async handleOffer(remoteId, offer) {
    this._negotiating.add(remoteId);
    try {
      const pc = this.createPeerConnection(remoteId);
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
      // Queue until remote description is set
      if (!this.iceQueues.has(remoteId)) this.iceQueues.set(remoteId, []);
      this.iceQueues.get(remoteId).push(candidate);
    }
  }

  notifyStreamsChanged() {
    this.onRemoteStreamsChanged?.(new Map(this.remoteStreams));
  }

  removePeer(remoteId) {
    const pc = this.peerConnections.get(remoteId);
    if (pc) { try { pc.close(); } catch (_) {} }
    this.peerConnections.delete(remoteId);
    this.remoteStreams.delete(remoteId);
    this.iceQueues.delete(remoteId);
    this._negotiating.delete(remoteId);
    this.notifyStreamsChanged();
  }

  cleanup() {
    this.peerConnections.forEach((pc) => { try { pc.close(); } catch (_) {} });
    this.peerConnections.clear();
    this.remoteStreams.clear();
    this.iceQueues.clear();
    this._negotiating.clear();
  }

  /**
   * Replace the video track being sent to all peers.
   * Used for screen share start/stop and camera toggle when using track.stop() approach.
   */
  async replaceVideoTrack(newTrack) {
    for (const [, pc] of this.peerConnections) {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        try { await sender.replaceTrack(newTrack); } catch (e) {
          console.warn('[WebRTC] replaceVideoTrack failed:', e);
        }
      }
    }
  }
}
