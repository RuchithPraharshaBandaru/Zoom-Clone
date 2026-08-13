/**
 * WebRTCManager — Production-grade Peer-to-Peer Connection Engine.
 *
 * Architecture:
 * - Uses addTransceiver('audio'/'video', {direction: 'sendrecv'}) to create
 *   proper SDP m=audio and m=video lines WITHOUT needing live tracks on mount.
 * - Camera and mic hardware are ONLY activated when the user clicks the buttons.
 * - replaceTrack() on the transceiver sender swaps in the live track on demand.
 * - ICE candidates are queued until setRemoteDescription completes.
 * - Includes STUN + free TURN servers for symmetric NAT traversal.
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
    this.ws = null;
    this.clientId = null;
    this.onRemoteStreamsChanged = null;
    this._negotiating = new Set();
    // Currently active tracks (null when mic/camera is off)
    this._audioTrack = null;
    this._videoTrack = null;
  }

  init({ ws, clientId, onRemoteStreamsChanged }) {
    this.ws = ws;
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
    if (this.peerConnections.has(remoteId)) {
      try { this.peerConnections.get(remoteId).close(); } catch (_) {}
      this.peerConnections.delete(remoteId);
      this._negotiating.delete(remoteId);
    }

    this.iceQueues.set(remoteId, []);

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });

    // Create sendrecv transceivers for audio and video.
    // This generates proper m=audio and m=video SDP lines with codec info
    // WITHOUT needing any live hardware tracks. The browser fills in codec
    // capabilities from its built-in encoder/decoder support.
    // If we currently have live tracks, attach them; otherwise null (inactive).
    pc.addTransceiver('audio', {
      direction: 'sendrecv',
      streams: [],
    });
    pc.addTransceiver('video', {
      direction: 'sendrecv',
      streams: [],
    });

    // If we have live tracks right now, set them on the senders
    const transceivers = pc.getTransceivers();
    const audioTransceiver = transceivers.find(t => t.receiver.track.kind === 'audio');
    const videoTransceiver = transceivers.find(t => t.receiver.track.kind === 'video');

    if (this._audioTrack && audioTransceiver) {
      audioTransceiver.sender.replaceTrack(this._audioTrack).catch(() => {});
    }
    if (this._videoTrack && videoTransceiver) {
      videoTransceiver.sender.replaceTrack(this._videoTrack).catch(() => {});
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
        stream = this.remoteStreams.get(remoteId) || new MediaStream();
        stream.addTrack(event.track);
      }
      this.remoteStreams.set(remoteId, stream);
      this.notifyStreamsChanged();
    };

    // ── Auto-renegotiation ──
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

    // ── Connection health ──
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`[WebRTC] peer ${remoteId} → ${state}`);
      if (state === 'failed') {
        console.log(`[WebRTC] ICE restart for ${remoteId}`);
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
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (_) {}
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
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
    } else {
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
   * Set or clear the audio track being sent to all peers.
   * Called when user clicks Mute/Unmute.
   * @param {MediaStreamTrack|null} track - live audio track or null to mute
   */
  async setAudioTrack(track) {
    this._audioTrack = track;
    for (const [, pc] of this.peerConnections) {
      const transceivers = pc.getTransceivers();
      const audioT = transceivers.find(t => t.receiver.track.kind === 'audio');
      if (audioT) {
        try { await audioT.sender.replaceTrack(track); } catch (e) {
          console.warn('[WebRTC] replaceTrack(audio) failed:', e);
        }
      }
    }
  }

  /**
   * Set or clear the video track being sent to all peers.
   * Called when user clicks Start/Stop Video or Share Screen.
   * @param {MediaStreamTrack|null} track - live video track or null to stop
   */
  async setVideoTrack(track) {
    this._videoTrack = track;
    for (const [, pc] of this.peerConnections) {
      const transceivers = pc.getTransceivers();
      const videoT = transceivers.find(t => t.receiver.track.kind === 'video');
      if (videoT) {
        try { await videoT.sender.replaceTrack(track); } catch (e) {
          console.warn('[WebRTC] replaceTrack(video) failed:', e);
        }
      }
    }
  }
}
