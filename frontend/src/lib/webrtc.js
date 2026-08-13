/**
 * WebRTCManager — Manages peer-to-peer video/audio connections
 * using WebRTC with the FastAPI WebSocket as the signaling server.
 * 
 * Features:
 * - Comprehensive STUN server pool for cross-device NAT traversal
 * - Queued ICE candidate handling (prevents candidates dropping before remote description is set)
 * - Safe auto-renegotiation with glare protection
 * - Audio & video track synchronization across different devices and networks
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
    this.currentVideoStream = null;
    this._negotiating = new Set();
  }

  /**
   * Initialize the manager with a WebSocket, local media stream,
   * and a callback that fires whenever remote streams change.
   */
  init({ ws, localStream, clientId, onRemoteStreamsChanged }) {
    this.ws = ws;
    this.localStream = localStream;
    this.clientId = String(clientId);
    this.onRemoteStreamsChanged = onRemoteStreamsChanged;
  }

  /** Send a JSON message over the signaling WebSocket */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  /** Announce our presence so existing peers can initiate connections */
  announceJoin() {
    this.send({ type: 'webrtc_join', clientId: this.clientId });
  }

  /**
   * Route an incoming signaling message to the correct handler.
   * Messages with a `targetId` are only processed if they match our clientId.
   */
  async handleMessage(data) {
    // Ignore our own messages
    if (String(data.clientId) === this.clientId) return;

    // If the message has a targetId, only process if it's for us
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

  /** Create an RTCPeerConnection for a remote peer */
  createPeerConnection(remoteId) {
    // Close any existing connection to this peer
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

    // Initialize ICE queue for this peer
    if (!this.iceQueues.has(remoteId)) {
      this.iceQueues.set(remoteId, []);
    }

    // Add local tracks
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });

      if (this.currentVideoTrack) {
        pc.addTrack(this.currentVideoTrack, this.currentVideoStream || this.localStream);
      } else {
        this.localStream.getVideoTracks().forEach((track) => {
          pc.addTrack(track, this.localStream);
        });
      }
    }

    // Handle renegotiation
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
        console.warn('Renegotiation failed (safe to ignore):', err.message);
      } finally {
        this._negotiating.delete(remoteId);
      }
    };

    // When we discover a new ICE candidate, send it immediately
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

    // When remote tracks arrive, store the stream and notify React
    pc.ontrack = (event) => {
      let stream = event.streams && event.streams[0];
      if (!stream) {
        // Fallback: create a MediaStream from received track
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

    // Monitor connection health
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.removePeer(remoteId);
      }
    };

    this.peerConnections.set(remoteId, pc);
    return pc;
  }

  /** Drain queued ICE candidates once remote description is set */
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

  /** Create and send an SDP offer to a remote peer */
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

  /** Handle an incoming SDP offer — create connection, set remote desc, send answer */
  async handleOffer(remoteId, offer) {
    this._negotiating.add(remoteId);
    try {
      const pc = this.createPeerConnection(remoteId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      // Drain any ICE candidates received before the offer
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

  /** Handle an incoming SDP answer — complete the connection */
  async handleAnswer(remoteId, answer) {
    const pc = this.peerConnections.get(remoteId);
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        // Drain any ICE candidates received before the answer
        await this.drainIceCandidates(remoteId, pc);
      } catch (err) {
        console.warn('Failed to set remote description:', err.message);
      }
    }
  }

  /** Handle an incoming ICE candidate (with queuing if remote description is not set yet) */
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
      // Queue candidate until setRemoteDescription is called
      if (!this.iceQueues.has(remoteId)) {
        this.iceQueues.set(remoteId, []);
      }
      this.iceQueues.get(remoteId).push(candidate);
    }
  }

  /** Notify the React component that remote streams have changed */
  notifyStreamsChanged() {
    this.onRemoteStreamsChanged?.(new Map(this.remoteStreams));
  }

  /** Remove a peer and clean up its connection */
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

  /** Tear down all connections */
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

  /** Replace the outgoing video track (e.g. for screen sharing or camera toggle) */
  async replaceVideoTrack(newTrack, newStream) {
    this.currentVideoTrack = newTrack;
    this.currentVideoStream = newStream;

    for (const [, pc] of this.peerConnections.entries()) {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');

      if (videoSender && newTrack) {
        await videoSender.replaceTrack(newTrack);
      } else if (!videoSender && newTrack) {
        pc.addTrack(newTrack, newStream || this.localStream);
      } else if (videoSender && !newTrack) {
        await videoSender.replaceTrack(null);
      }
    }
  }

  /** Update local stream after mute / unmute */
  updateLocalStream(newStream) {
    this.localStream = newStream;
    for (const [, pc] of this.peerConnections.entries()) {
      const senders = pc.getSenders();
      const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
      const audioTrack = newStream?.getAudioTracks()[0] || null;

      if (audioSender && audioTrack) {
        audioSender.replaceTrack(audioTrack);
      } else if (!audioSender && audioTrack) {
        pc.addTrack(audioTrack, newStream);
      }
    }
  }
}
