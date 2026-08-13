"""
Participant API endpoints.
Handles joining meetings, listing participants, and host controls.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Meeting, Participant
from schemas import ParticipantJoin, ParticipantUpdate, ParticipantResponse

router = APIRouter(prefix="/api/meetings", tags=["participants"])


@router.post("/{meeting_id}/join", response_model=ParticipantResponse)
def join_meeting(
    meeting_id: str,
    join_data: ParticipantJoin,
    db: Session = Depends(get_db),
):
    """Join a meeting as a participant."""
    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if meeting.status == "ended":
        raise HTTPException(status_code=400, detail="This meeting has ended")

    # If meeting is scheduled, activate it when someone joins
    if meeting.status == "scheduled":
        meeting.status = "active"

    participant = Participant(
        meeting_id=meeting.id,
        user_id=join_data.user_id,
        display_name=join_data.display_name,
        role="participant",
        is_muted=False,
        is_video_on=True,
    )
    db.add(participant)
    db.commit()
    db.refresh(participant)

    return participant


@router.get("/{meeting_id}/participants", response_model=list[ParticipantResponse])
def list_participants(meeting_id: str, db: Session = Depends(get_db)):
    """List all active participants in a meeting."""
    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    participants = (
        db.query(Participant)
        .filter(Participant.meeting_id == meeting.id, Participant.left_at.is_(None))
        .all()
    )
    return participants


@router.put("/{meeting_id}/participants/{participant_id}", response_model=ParticipantResponse)
def update_participant(
    meeting_id: str,
    participant_id: int,
    update_data: ParticipantUpdate,
    db: Session = Depends(get_db),
):
    """Update participant state (mute, video, role)."""
    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    participant = (
        db.query(Participant)
        .filter(Participant.id == participant_id, Participant.meeting_id == meeting.id)
        .first()
    )
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(participant, key, value)

    db.commit()
    db.refresh(participant)
    return participant


@router.delete("/{meeting_id}/participants/{participant_id}")
def remove_participant(
    meeting_id: str,
    participant_id: int,
    db: Session = Depends(get_db),
):
    """Remove a participant from a meeting (host control)."""
    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    participant = (
        db.query(Participant)
        .filter(Participant.id == participant_id, Participant.meeting_id == meeting.id)
        .first()
    )
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    participant.left_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": f"Participant '{participant.display_name}' removed from meeting"}


@router.post("/{meeting_id}/mute-all")
def mute_all_participants(meeting_id: str, db: Session = Depends(get_db)):
    """Mute all participants in a meeting (host control)."""
    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    participants = (
        db.query(Participant)
        .filter(
            Participant.meeting_id == meeting.id,
            Participant.left_at.is_(None),
            Participant.role != "host",
        )
        .all()
    )

    for p in participants:
        p.is_muted = True

    db.commit()
    return {"message": f"Muted {len(participants)} participants"}
