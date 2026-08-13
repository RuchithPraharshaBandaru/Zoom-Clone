"""
Meeting API endpoints.
Handles creating, listing, updating, and managing meetings.
"""

import random
import string
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import Meeting, User, Participant
from schemas import (
    MeetingCreate,
    MeetingSchedule,
    MeetingUpdate,
    MeetingResponse,
    MeetingListResponse,
    ParticipantInMeeting,
)

router = APIRouter(prefix="/api/meetings", tags=["meetings"])

# Default host user ID (since no auth is required)
DEFAULT_HOST_ID = 1


def generate_meeting_id() -> str:
    """Generate a unique 11-digit meeting ID in format XXX-XXXX-XXXX."""
    digits = "".join(random.choices(string.digits, k=11))
    return f"{digits[:3]}-{digits[3:7]}-{digits[7:]}"


def generate_passcode(length: int = 6) -> str:
    """Generate a random alphanumeric passcode."""
    return "".join(random.choices(string.ascii_letters + string.digits, k=length))


def build_meeting_response(meeting: Meeting) -> MeetingResponse:
    """Convert a Meeting ORM object to a MeetingResponse."""
    active_participants = [p for p in meeting.participants if p.left_at is None]
    return MeetingResponse(
        id=meeting.id,
        meeting_id=meeting.meeting_id,
        title=meeting.title,
        description=meeting.description,
        host_id=meeting.host_id,
        host_name=meeting.host.display_name if meeting.host else None,
        status=meeting.status,
        scheduled_time=meeting.scheduled_time,
        duration_minutes=meeting.duration_minutes,
        invite_link=meeting.invite_link,
        passcode=meeting.passcode,
        meeting_type=meeting.meeting_type,
        created_at=meeting.created_at,
        ended_at=meeting.ended_at,
        participant_count=len(active_participants),
        participants=[
            ParticipantInMeeting(
                id=p.id,
                display_name=p.display_name,
                role=p.role,
                is_muted=p.is_muted,
                is_video_on=p.is_video_on,
                joined_at=p.joined_at,
            )
            for p in active_participants
        ],
    )


def build_meeting_list_response(meeting: Meeting) -> MeetingListResponse:
    """Convert a Meeting ORM object to a MeetingListResponse."""
    # For ended meetings, show total participants; for active/scheduled, show active only
    if meeting.status == "ended":
        count = len(meeting.participants)
    else:
        count = len([p for p in meeting.participants if p.left_at is None])
    return MeetingListResponse(
        id=meeting.id,
        meeting_id=meeting.meeting_id,
        title=meeting.title,
        host_name=meeting.host.display_name if meeting.host else None,
        status=meeting.status,
        scheduled_time=meeting.scheduled_time,
        duration_minutes=meeting.duration_minutes,
        meeting_type=meeting.meeting_type,
        created_at=meeting.created_at,
        ended_at=meeting.ended_at,
        participant_count=count,
    )


@router.post("", response_model=MeetingResponse)
def create_instant_meeting(
    meeting_data: MeetingCreate,
    db: Session = Depends(get_db),
):
    """Create an instant meeting and start it immediately."""
    # Verify the host user exists
    host = db.query(User).filter(User.id == DEFAULT_HOST_ID).first()
    if not host:
        raise HTTPException(status_code=404, detail="Default host user not found. Run seed data first.")

    meeting_id = generate_meeting_id()
    passcode = generate_passcode()
    invite_link = f"/meeting/{meeting_id}"

    new_meeting = Meeting(
        meeting_id=meeting_id,
        title=meeting_data.title,
        host_id=DEFAULT_HOST_ID,
        status="active",
        scheduled_time=datetime.now(timezone.utc),
        duration_minutes=60,
        invite_link=invite_link,
        passcode=passcode,
        meeting_type="instant",
    )
    db.add(new_meeting)
    db.commit()
    db.refresh(new_meeting)

    # Auto-add host as participant
    host_participant = Participant(
        meeting_id=new_meeting.id,
        user_id=host.id,
        display_name=host.display_name,
        role="host",
        is_muted=False,
        is_video_on=True,
    )
    db.add(host_participant)
    db.commit()
    db.refresh(new_meeting)

    return build_meeting_response(new_meeting)


@router.post("/schedule", response_model=MeetingResponse)
def schedule_meeting(
    meeting_data: MeetingSchedule,
    db: Session = Depends(get_db),
):
    """Schedule a meeting for a future date/time."""
    host = db.query(User).filter(User.id == DEFAULT_HOST_ID).first()
    if not host:
        raise HTTPException(status_code=404, detail="Default host user not found.")

    meeting_id = generate_meeting_id()
    passcode = generate_passcode()
    invite_link = f"/meeting/{meeting_id}"

    new_meeting = Meeting(
        meeting_id=meeting_id,
        title=meeting_data.title,
        description=meeting_data.description,
        host_id=DEFAULT_HOST_ID,
        status="scheduled",
        scheduled_time=meeting_data.scheduled_time,
        duration_minutes=meeting_data.duration_minutes,
        invite_link=invite_link,
        passcode=passcode,
        meeting_type="scheduled",
    )
    db.add(new_meeting)
    db.commit()
    db.refresh(new_meeting)

    return build_meeting_response(new_meeting)


@router.get("", response_model=list[MeetingListResponse])
def list_meetings(
    status: Optional[str] = Query(None, description="Filter by status: scheduled, active, ended"),
    meeting_type: Optional[str] = Query(None, description="Filter by type: instant, scheduled"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List all meetings with optional filters."""
    query = db.query(Meeting)

    if status:
        query = query.filter(Meeting.status == status)
    if meeting_type:
        query = query.filter(Meeting.meeting_type == meeting_type)

    meetings = query.order_by(Meeting.created_at.desc()).limit(limit).all()
    return [build_meeting_list_response(m) for m in meetings]


@router.get("/{meeting_id}", response_model=MeetingResponse)
def get_meeting(meeting_id: str, db: Session = Depends(get_db)):
    """Get meeting details by meeting ID (the shareable code, not the DB id)."""
    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return build_meeting_response(meeting)


@router.put("/{meeting_id}", response_model=MeetingResponse)
def update_meeting(
    meeting_id: str,
    update_data: MeetingUpdate,
    db: Session = Depends(get_db),
):
    """Update meeting details."""
    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(meeting, key, value)

    db.commit()
    db.refresh(meeting)
    return build_meeting_response(meeting)


@router.delete("/{meeting_id}")
def delete_meeting(meeting_id: str, db: Session = Depends(get_db)):
    """Delete/cancel a meeting."""
    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    db.delete(meeting)
    db.commit()
    return {"message": "Meeting deleted successfully"}


@router.post("/{meeting_id}/end", response_model=MeetingResponse)
def end_meeting(meeting_id: str, db: Session = Depends(get_db)):
    """End an active meeting."""
    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if meeting.status == "ended":
        raise HTTPException(status_code=400, detail="Meeting already ended")

    meeting.status = "ended"
    meeting.ended_at = datetime.now(timezone.utc)

    # Mark all participants as left
    for participant in meeting.participants:
        if participant.left_at is None:
            participant.left_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(meeting)
    return build_meeting_response(meeting)
