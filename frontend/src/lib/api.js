/**
 * API client for communicating with the Zoom Clone FastAPI backend.
 * All functions return promises and handle JSON parsing.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Generic fetch wrapper with error handling.
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) return null;

  return response.json();
}

// ─── User API ─────────────────────────────────────────────

export async function getCurrentUser() {
  return apiFetch("/api/users/me");
}

// ─── Meeting API ──────────────────────────────────────────

export async function createInstantMeeting(title = "Quick Meeting") {
  return apiFetch("/api/meetings", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function scheduleMeeting(data) {
  return apiFetch("/api/meetings/schedule", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listMeetings(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.meeting_type) query.set("meeting_type", params.meeting_type);
  if (params.limit) query.set("limit", params.limit.toString());

  const queryStr = query.toString();
  return apiFetch(`/api/meetings${queryStr ? `?${queryStr}` : ""}`);
}

export async function getMeeting(meetingId) {
  return apiFetch(`/api/meetings/${meetingId}`);
}

export async function updateMeeting(meetingId, data) {
  return apiFetch(`/api/meetings/${meetingId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteMeeting(meetingId) {
  return apiFetch(`/api/meetings/${meetingId}`, {
    method: "DELETE",
  });
}

export async function endMeeting(meetingId) {
  return apiFetch(`/api/meetings/${meetingId}/end`, {
    method: "POST",
  });
}

// ─── Participant API ──────────────────────────────────────

export async function joinMeeting(meetingId, displayName, userId = null) {
  return apiFetch(`/api/meetings/${meetingId}/join`, {
    method: "POST",
    body: JSON.stringify({ display_name: displayName, user_id: userId }),
  });
}

export async function listParticipants(meetingId) {
  return apiFetch(`/api/meetings/${meetingId}/participants`);
}

export async function updateParticipant(meetingId, participantId, data) {
  return apiFetch(`/api/meetings/${meetingId}/participants/${participantId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function removeParticipant(meetingId, participantId) {
  return apiFetch(`/api/meetings/${meetingId}/participants/${participantId}`, {
    method: "DELETE",
  });
}

export async function muteAllParticipants(meetingId) {
  return apiFetch(`/api/meetings/${meetingId}/mute-all`, {
    method: "POST",
  });
}
