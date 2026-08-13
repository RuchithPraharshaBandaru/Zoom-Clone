"""
Pydantic schemas for request/response validation.
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


# ─── User Schemas ──────────────────────────────────────────

class UserBase(BaseModel):
    username: str
    display_name: str
    email: str

class UserResponse(UserBase):
    id: int
    avatar_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Meeting Schemas ───────────────────────────────────────

class MeetingCreate(BaseModel):
    """Schema for creating an instant meeting."""
    title: str = Field(default="Quick Meeting", max_length=200)

class MeetingSchedule(BaseModel):
    """Schema for scheduling a meeting."""
    title: str = Field(..., max_length=200)
    description: Optional[str] = None
    scheduled_time: datetime
    duration_minutes: int = Field(default=60, ge=15, le=480)

class MeetingUpdate(BaseModel):
    """Schema for updating a meeting."""
    title: Optional[str] = None
    description: Optional[str] = None
    scheduled_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    status: Optional[str] = None

class ParticipantInMeeting(BaseModel):
    """Participant info embedded in meeting response."""
    id: int
    display_name: str
    role: str
    is_muted: bool
    is_video_on: bool
    joined_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class MeetingResponse(BaseModel):
    """Full meeting response with host info."""
    id: int
    meeting_id: str
    title: str
    description: Optional[str] = None
    host_id: int
    host_name: Optional[str] = None
    status: str
    scheduled_time: Optional[datetime] = None
    duration_minutes: int
    invite_link: Optional[str] = None
    passcode: Optional[str] = None
    meeting_type: str
    created_at: datetime
    ended_at: Optional[datetime] = None
    participant_count: int = 0
    participants: List[ParticipantInMeeting] = []

    class Config:
        from_attributes = True

class MeetingListResponse(BaseModel):
    """Simplified meeting response for list views."""
    id: int
    meeting_id: str
    title: str
    host_name: Optional[str] = None
    status: str
    scheduled_time: Optional[datetime] = None
    duration_minutes: int
    meeting_type: str
    created_at: datetime
    ended_at: Optional[datetime] = None
    participant_count: int = 0

    class Config:
        from_attributes = True


# ─── Participant Schemas ───────────────────────────────────

class ParticipantJoin(BaseModel):
    """Schema for joining a meeting."""
    display_name: str = Field(..., max_length=100)
    user_id: Optional[int] = None

class ParticipantUpdate(BaseModel):
    """Schema for updating participant state."""
    is_muted: Optional[bool] = None
    is_video_on: Optional[bool] = None
    role: Optional[str] = None
    display_name: Optional[str] = None

class ParticipantResponse(BaseModel):
    """Full participant response."""
    id: int
    meeting_id: int
    user_id: Optional[int] = None
    display_name: str
    role: str
    is_muted: bool
    is_video_on: bool
    joined_at: Optional[datetime] = None
    left_at: Optional[datetime] = None

    class Config:
        from_attributes = True
