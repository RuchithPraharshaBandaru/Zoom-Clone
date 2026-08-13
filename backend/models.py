"""
SQLAlchemy ORM models for the Zoom Clone database.
Defines the schema for Users, Meetings, and Participants.
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Boolean,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from database import Base


class User(Base):
    """Represents a user in the system."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    display_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    avatar_url = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    hosted_meetings = relationship("Meeting", back_populates="host", cascade="all, delete-orphan")
    participations = relationship("Participant", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}')>"


class Meeting(Base):
    """Represents a meeting (instant or scheduled)."""

    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    meeting_id = Column(String(20), unique=True, nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    host_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), nullable=False, default="scheduled")  # scheduled, active, ended
    scheduled_time = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, nullable=False, default=60)
    invite_link = Column(String(500), nullable=True)
    passcode = Column(String(10), nullable=True)
    meeting_type = Column(String(20), nullable=False, default="instant")  # instant, scheduled
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    ended_at = Column(DateTime, nullable=True)

    # Relationships
    host = relationship("User", back_populates="hosted_meetings")
    participants = relationship("Participant", back_populates="meeting", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Meeting(id={self.id}, meeting_id='{self.meeting_id}', title='{self.title}')>"


class Participant(Base):
    """Represents a participant in a meeting."""

    __tablename__ = "participants"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Nullable for guest users
    display_name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False, default="participant")  # host, co-host, participant
    is_muted = Column(Boolean, default=False)
    is_video_on = Column(Boolean, default=True)
    joined_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    left_at = Column(DateTime, nullable=True)

    # Relationships
    meeting = relationship("Meeting", back_populates="participants")
    user = relationship("User", back_populates="participations")

    def __repr__(self):
        return f"<Participant(id={self.id}, display_name='{self.display_name}')>"
