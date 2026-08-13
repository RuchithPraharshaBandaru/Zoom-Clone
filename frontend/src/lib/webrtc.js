/**
 * WebRTCManager — Manages peer-to-peer video/audio connections
 * using WebRTC with the FastAPI WebSocket as the signaling server.
 * 
 * Flow:
 * 1. User joins meeting → announces via WebSocket ("webrtc_join")
 * 2. Existing peers receive the announcement → each creates an RTCPeerConnection and sends an "offer"
 * 3. New user receives offers → creates answers
 * 4. ICE candidates are exchanged
 * 5. Once connected, remote video/audio streams flow directly peer-to-peer
 */

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export class WebRTCManager {
  constructor() {
    this.peerConnections = new Map(); // remoteClientId → RTCPeerConnection
    this.remoteStreams = new Map();   // remoteClientId → MediaStream
    this.localStream = null;
    this.ws = null;
    this.clientId = null;
    this.onRemoteStreamsChanged = null;
    this.currentVideoTrack = null;
    this.currentVideoStream = null;
    this._negotiating = new Set(); // Track which PCs are currently negotiating
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
      this.peerConnections.get(remoteId).close();
      this._negotiating.delete(remoteId);
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local tracks (audio from localStream, video from either localStream or active screen share)
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

    // Handle renegotiation automatically (with glare protection)
    pc.onnegotiationneeded = async () => {
      // Prevent multiple simultaneous negotiations
      if (this._negotiating.has(remoteId)) return;
      this._negotiating.add(remoteId);
      
      try {
        const offer = await pc.createOffer();
        // Check if signaling state is still stable (could have changed)
        if (pc.signalingState !== 'stable') {
          this._negotiating.delete(remoteId);
          return;
        }
        await pc.setLocalDescription(offer);
        this.send({
          type: 'webrtc_offer',
          clientId: this.clientId,
          targetId: remoteId,
          offer: pc.localDescription,
        });
      } catch (err) {
        console.warn('Renegotiation failed (safe to ignore)', err.message);
      } finally {
        this._negotiating.delete(remoteId);
      }
    };

    // When we discover a new ICE candidate, send it to the remote peer
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

    // When we receive remote tracks, store the stream
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        this.remoteStreams.set(remoteId, stream);
        this.notifyStreamsChanged();
      }
    };

    // Clean up on disconnect/failure
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.removePeer(remoteId);
      }
    };

    this.peerConnections.set(remoteId, pc);
    return pc;
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

  /** Handle an incoming SDP offer — create a connection and send back an answer */
  async handleOffer(remoteId, offer) {
    this._negotiating.add(remoteId);
    try {
      const pc = this.createPeerConnection(remoteId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
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
      } catch (err) {
        console.warn('Failed to set remote description:', err.message);
      }
    }
  }

  /** Handle an incoming ICE candidate */
  async handleIceCandidate(remoteId, candidate) {
    const pc = this.peerConnections.get(remoteId);
    if (pc && candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('Failed to add ICE candidate:', e);
      }
    }
  }

  /** Notify the React component that remote streams have changed */
  notifyStreamsChanged() {
    this.onRemoteStreamsChanged?.(new Map(this.remoteStreams));
  }

  /** Remove a peer and clean up its connection */
  removePeer(remoteId) {
    const pc = this.peerConnections.get(remoteId);
    if (pc) pc.close();
    this.peerConnections.delete(remoteId);
    this.remoteStreams.delete(remoteId);
    this._negotiating.delete(remoteId);
    this.notifyStreamsChanged();
  }

  /** Tear down all connections */
  cleanup() {
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.remoteStreams.clear();
    this._negotiating.clear();
  }

  /** Replace the outgoing video track (e.g. for screen sharing) */
  async replaceVideoTrack(newTrack, newStream) {
    this.currentVideoTrack = newTrack;
    this.currentVideoStream = newStream;

    for (const [remoteId, pc] of this.peerConnections) {
      const senders = pc.getSenders();
      const sender = senders.find((s) => s.track && s.track.kind === 'video');
      
      try {
        if (sender) {
          await sender.replaceTrack(newTrack);
        } else {
          pc.addTrack(newTrack, newStream || this.localStream);
        }
      } catch (err) {
        console.warn('Failed to update video track', err);
      }
    }
  }

  /** Replace the outgoing audio track (e.g. dynamically adding mic) */
  async replaceAudioTrack(newTrack, newStream) {
    for (const [remoteId, pc] of this.peerConnections) {
      const senders = pc.getSenders();
      const sender = senders.find((s) => s.track && s.track.kind === 'audio');
      
      try {
        if (sender) {
          await sender.replaceTrack(newTrack);
        } else {
          pc.addTrack(newTrack, newStream || this.localStream);
        }
      } catch (err) {
        console.warn('Failed to update audio track', err);
      }
    }
  }
}
