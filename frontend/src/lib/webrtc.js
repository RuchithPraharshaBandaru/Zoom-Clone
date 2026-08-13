/**
 * WebRTCManager — Robust Peer-to-Peer Media Engine.
 * 
 * Architecture:
 * - Uses in-memory Dummy Media (AudioContext silence + Canvas black frame) on initial connection.
 *   This gives 100% valid SDP m=audio and m=video lines across all devices WITHOUT touching
 *   the physical camera or microphone hardware on mount (no camera light, no mic recording).
 * - When user clicks Unmute / Start Video: browser requests real hardware, and sender.replaceTrack()
 *   instantly swaps the dummy track with the live hardware stream.
 * - When user clicks Mute / Stop Video: hardware track is stopped (turning off webcam light / mic),
 *   and swapped back to the in-memory dummy track.
 * - STUN + Free TURN servers ensure cross-network connectivity.
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

/**
 * Creates in-memory silent audio and black canvas video tracks.
 * Uses 0 hardware devices, 0 permissions, 0 camera lights.
 */
export function createDummyTracks() {
  let dummyAudioTrack = null;
  let dummyVideoTrack = null;

  if (typeof window !== 'undefined') {
    // 1. Silent audio track via Web Audio API (in-memory, 0 mic hardware)
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0;
        osc.connect(gain);
        const dest = ctx.createMediaStreamDestination();
        gain.connect(dest);
        osc.start();
        dummyAudioTrack = dest.stream.getAudioTracks()[0] || null;
      }
    } catch (e) {
      console.warn('AudioContext dummy track creation failed:', e);
    }

    // 2. Black canvas video track (in-memory, 0 webcam hardware)
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 640, 480);
      }
      const stream = canvas.captureStream ? canvas.captureStream(10) : null;
      dummyVideoTrack = stream ? stream.getVideoTracks()[0] : null;
    } catch (e) {
      console.warn('Canvas dummy track creation failed:', e);
    }
  }

  const dummyStream = new MediaStream();
  if (dummyAudioTrack) dummyStream.addTrack(dummyAudioTrack);
  if (dummyVideoTrack) dummyStream.addTrack(dummyVideoTrack);

  return { dummyStream, dummyAudioTrack, dummyVideoTrack };
}

export class WebRTCManager {
  constructor() {
    this.peerConnections = new Map();
    this.remoteStreams = new Map();
    this.iceQueues = new Map();
    this.ws = null;
    this.clientId = null;
    this.onRemoteStreamsChanged = null;
    this._negotiating = new Set();
    this.baseStream = null;
    this.currentAudioTrack = null;
    this.currentVideoTrack = null;
  }

  init({ ws, clientId, baseStream, initialAudioTrack, initialVideoTrack, onRemoteStreamsChanged }) {
    this.ws = ws;
    this.clientId = String(clientId);
    this.baseStream = baseStream;
    this.currentAudioTrack = initialAudioTrack || null;
    this.currentVideoTrack = initialVideoTrack || null;
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

    // Add audio and video tracks from baseStream to generate real SDP media descriptions
    if (this.currentAudioTrack && this.baseStream) {
      pc.addTrack(this.currentAudioTrack, this.baseStream);
    }
    if (this.currentVideoTrack && this.baseStream) {
      pc.addTrack(this.currentVideoTrack, this.baseStream);
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
      console.log(`[WebRTC] peer ${remoteId} state: ${state}`);
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
   * Swap out the audio track across all active peer connections.
   * If track is null, swaps back to dummyAudioTrack (silence).
   */
  async setAudioTrack(track, fallbackDummyTrack) {
    const trackToSend = track || fallbackDummyTrack;
    this.currentAudioTrack = trackToSend;

    for (const [, pc] of this.peerConnections) {
      const senders = pc.getSenders();
      const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
      if (audioSender && trackToSend) {
        try {
          await audioSender.replaceTrack(trackToSend);
        } catch (e) {
          console.warn('[WebRTC] replaceTrack audio failed:', e);
        }
      }
    }
  }

  /**
   * Swap out the video track across all active peer connections.
   * If track is null, swaps back to dummyVideoTrack (black canvas).
   */
  async setVideoTrack(track, fallbackDummyTrack) {
    const trackToSend = track || fallbackDummyTrack;
    this.currentVideoTrack = trackToSend;

    for (const [, pc] of this.peerConnections) {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
      if (videoSender && trackToSend) {
        try {
          await videoSender.replaceTrack(trackToSend);
        } catch (e) {
          console.warn('[WebRTC] replaceTrack video failed:', e);
        }
      }
    }
  }
}
