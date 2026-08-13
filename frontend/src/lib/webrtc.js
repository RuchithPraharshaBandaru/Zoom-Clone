/**
 * WebRTCManager — Robust Peer-to-Peer Video/Audio Connection Engine.
 * 
 * Features:
 * - Bidirectional 'sendrecv' audio & video transceivers in all peer connections
 * - Guaranteed track addition/replacement for on-demand mic and camera toggles
 * - Queued ICE candidates to prevent dropped packets during cross-device handshakes
 * - Extensive multi-region STUN server pool
 */

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.services.mozilla.com' },
  { urls: 'stun:stun.stunprotocol.org:3478' },
  { urls: 'stun:stun.voiparound.com' },
  { urls: 'stun:stun.voipbuster.com' },
];

export class WebRTCManager {
  constructor() {
    this.peerConnections = new Map(); // remoteClientId → RTCPeerConnection
    this.remoteStreams = new Map();   // remoteClientId → MediaStream
    this.iceQueues = new Map();       // remoteClientId → Array of RTCIceCandidate
    this.localStream = null;
    this.ws = null;
    this.clientId = null;
    this.onRemoteStreamsChanged = null;
    this.currentVideoTrack = null;
    this.currentAudioTrack = null;
    this._negotiating = new Set();
  }

  init({ ws, localStream, clientId, onRemoteStreamsChanged }) {
    this.ws = ws;
    this.localStream = localStream;
    this.clientId = String(clientId);
    this.onRemoteStreamsChanged = onRemoteStreamsChanged;

    if (localStream) {
      this.currentAudioTrack = localStream.getAudioTracks()[0] || null;
      this.currentVideoTrack = localStream.getVideoTracks()[0] || null;
    }
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
      console.error(`WebRTC signaling error (${data.type}):`, err);
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

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });

    if (!this.iceQueues.has(remoteId)) {
      this.iceQueues.set(remoteId, []);
    }

    // Always create sendrecv transceivers for audio & video
    const audioTrack = this.currentAudioTrack || (this.localStream ? this.localStream.getAudioTracks()[0] : null);
    const videoTrack = this.currentVideoTrack || (this.localStream ? this.localStream.getVideoTracks()[0] : null);

    if (audioTrack && this.localStream) {
      pc.addTrack(audioTrack, this.localStream);
    } else {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    }

    if (videoTrack && this.localStream) {
      pc.addTrack(videoTrack, this.localStream);
    } else {
      pc.addTransceiver('video', { direction: 'sendrecv' });
    }

    pc.onnegotiationneeded = async () => {
      if (this._negotiating.has(remoteId)) return;
      this._negotiating.add(remoteId);

      try {
        if (pc.signalingState !== 'stable') {
          this._negotiating.delete(remoteId);
          return;
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
        console.warn('Renegotiation failed:', err);
      } finally {
        this._negotiating.delete(remoteId);
      }
    };

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

    pc.ontrack = (event) => {
      let stream = event.streams && event.streams[0];
      if (!stream) {
        if (!this.remoteStreams.has(remoteId)) {
          stream = new MediaStream();
          this.remoteStreams.set(remoteId, stream);
        } else {
          stream = this.remoteStreams.get(remoteId);
        }
        stream.addTrack(event.track);
      } else {
        this.remoteStreams.set(remoteId, stream);
      }
      this.notifyStreamsChanged();
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.removePeer(remoteId);
      }
    };

    this.peerConnections.set(remoteId, pc);
    return pc;
  }

  async drainIceCandidates(remoteId, pc) {
    const queue = this.iceQueues.get(remoteId) || [];
    while (queue.length > 0) {
      const candidate = queue.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('Failed to add queued ICE candidate:', e);
      }
    }
  }

  async createOffer(remoteId) {
    this._negotiating.add(remoteId);
    try {
      const pc = this.createPeerConnection(remoteId);
      const offer = await pc.createOffer();
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
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await this.drainIceCandidates(remoteId, pc);
      } catch (err) {
        console.warn('Failed to set remote description:', err);
      }
    }
  }

  async handleIceCandidate(remoteId, candidate) {
    if (!candidate) return;
    const pc = this.peerConnections.get(remoteId);

    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('Failed to add ICE candidate directly:', e);
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
      try {
        pc.close();
      } catch (e) {}
    }
    this.peerConnections.delete(remoteId);
    this.remoteStreams.delete(remoteId);
    this.iceQueues.delete(remoteId);
    this._negotiating.delete(remoteId);
    this.notifyStreamsChanged();
  }

  cleanup() {
    this.peerConnections.forEach((pc) => {
      try {
        pc.close();
      } catch (e) {}
    });
    this.peerConnections.clear();
    this.remoteStreams.clear();
    this.iceQueues.clear();
    this._negotiating.clear();
  }

  /** Replace or set the outgoing audio track (mute/unmute) */
  async replaceAudioTrack(newTrack, stream) {
    this.currentAudioTrack = newTrack;
    if (stream) this.localStream = stream;

    for (const [, pc] of this.peerConnections.entries()) {
      const senders = pc.getSenders();
      const audioSender = senders.find((s) => s.track && s.track.kind === 'audio') ||
        senders.find((s) => !s.track);

      if (audioSender) {
        try {
          await audioSender.replaceTrack(newTrack);
        } catch (e) {
          console.warn('Failed to replace audio track:', e);
        }
      } else if (newTrack) {
        try {
          pc.addTrack(newTrack, stream || this.localStream);
        } catch (e) {
          console.warn('Failed to add audio track:', e);
        }
      }
    }
  }

  /** Replace or set the outgoing video track (camera toggle or screen share) */
  async replaceVideoTrack(newTrack, stream) {
    this.currentVideoTrack = newTrack;
    if (stream) this.localStream = stream;

    for (const [, pc] of this.peerConnections.entries()) {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video') ||
        senders.find((s) => !s.track);

      if (videoSender) {
        try {
          await videoSender.replaceTrack(newTrack);
        } catch (e) {
          console.warn('Failed to replace video track:', e);
        }
      } else if (newTrack) {
        try {
          pc.addTrack(newTrack, stream || this.localStream);
        } catch (e) {
          console.warn('Failed to add video track:', e);
        }
      }
    }
  }
}
