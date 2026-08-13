"""
Seed data for the Zoom Clone database.
Creates a default user and sample meetings for demonstration.
"""

from datetime import datetime, timezone, timedelta
import random
import string

from sqlalchemy.orm import Session

from models import User, Meeting, Participant


def generate_meeting_id() -> str:
    """Generate a unique 11-digit meeting ID."""
    digits = "".join(random.choices(string.digits, k=11))
    return f"{digits[:3]}-{digits[3:7]}-{digits[7:]}"


def generate_passcode(length: int = 6) -> str:
    """Generate a random alphanumeric passcode."""
    return "".join(random.choices(string.ascii_letters + string.digits, k=length))


def seed_database(db: Session):
    """Seed the database with sample data if empty."""
    # Check if data already exists
    existing_users = db.query(User).count()
    if existing_users > 0:
        return  # Database already seeded

    print("Seeding database with sample data...")

    # ─── Create Users ──────────────────────────────────────
    users = [
        User(
            username="johndoe",
            display_name="John Doe",
            email="john.doe@company.com",
            avatar_url=None,
        ),
        User(
            username="janesmith",
            display_name="Jane Smith",
            email="jane.smith@company.com",
            avatar_url=None,
        ),
        User(
            username="bobwilson",
            display_name="Bob Wilson",
            email="bob.wilson@company.com",
            avatar_url=None,
        ),
        User(
            username="alicejohnson",
            display_name="Alice Johnson",
            email="alice.johnson@company.com",
            avatar_url=None,
        ),
        User(
            username="mikebrown",
            display_name="Mike Brown",
            email="mike.brown@company.com",
            avatar_url=None,
        ),
    ]
    db.add_all(users)
    db.commit()

    # Refresh to get IDs
    for user in users:
        db.refresh(user)

    now = datetime.now(timezone.utc)

    # ─── Create Upcoming Scheduled Meetings ────────────────
    upcoming_meetings = [
        Meeting(
            meeting_id=generate_meeting_id(),
            title="Sprint Planning — Q3 Roadmap",
            description="Review Q3 product roadmap and assign sprint tasks for the upcoming two weeks.",
            host_id=users[0].id,
            status="scheduled",
            scheduled_time=now + timedelta(hours=2),
            duration_minutes=60,
            invite_link="",
            passcode=generate_passcode(),
            meeting_type="scheduled",
        ),
        Meeting(
            meeting_id=generate_meeting_id(),
            title="Design Review — Mobile App Redesign",
            description="Walk through the latest Figma prototypes for the mobile app refresh.",
            host_id=users[0].id,
            status="scheduled",
            scheduled_time=now + timedelta(days=1, hours=3),
            duration_minutes=45,
            invite_link="",
            passcode=generate_passcode(),
            meeting_type="scheduled",
        ),
        Meeting(
            meeting_id=generate_meeting_id(),
            title="Engineering All-Hands",
            description="Monthly engineering team meeting — updates, demos, and Q&A.",
            host_id=users[0].id,
            status="scheduled",
            scheduled_time=now + timedelta(days=2, hours=5),
            duration_minutes=90,
            invite_link="",
            passcode=generate_passcode(),
            meeting_type="scheduled",
        ),
        Meeting(
            meeting_id=generate_meeting_id(),
            title="1:1 with Manager",
            description="Weekly check-in to discuss progress and blockers.",
            host_id=users[1].id,
            status="scheduled",
            scheduled_time=now + timedelta(days=3, hours=1),
            duration_minutes=30,
            invite_link="",
            passcode=generate_passcode(),
            meeting_type="scheduled",
        ),
        Meeting(
            meeting_id=generate_meeting_id(),
            title="Client Demo — Project Alpha",
            description="Demo the latest features of Project Alpha to the client team.",
            host_id=users[0].id,
            status="scheduled",
            scheduled_time=now + timedelta(days=5, hours=4),
            duration_minutes=60,
            invite_link="",
            passcode=generate_passcode(),
            meeting_type="scheduled",
        ),
    ]

    # Set invite links after creating
    for m in upcoming_meetings:
        m.invite_link = f"/meeting/{m.meeting_id}"

    db.add_all(upcoming_meetings)
    db.commit()

    # ─── Create Recent/Past Meetings ───────────────────────
    past_meetings = [
        Meeting(
            meeting_id=generate_meeting_id(),
            title="Standup — Frontend Team",
            description="Daily standup for the frontend engineering team.",
            host_id=users[0].id,
            status="ended",
            scheduled_time=now - timedelta(hours=3),
            duration_minutes=15,
            invite_link="",
            passcode=generate_passcode(),
            meeting_type="instant",
            ended_at=now - timedelta(hours=2, minutes=45),
        ),
        Meeting(
            meeting_id=generate_meeting_id(),
            title="Backend Architecture Discussion",
            description="Discussion about microservices migration strategy.",
            host_id=users[0].id,
            status="ended",
            scheduled_time=now - timedelta(days=1, hours=2),
            duration_minutes=60,
            invite_link="",
            passcode=generate_passcode(),
            meeting_type="scheduled",
            ended_at=now - timedelta(days=1, hours=1),
        ),
        Meeting(
            meeting_id=generate_meeting_id(),
            title="Product Sync — Week 32",
            description="Weekly product team sync to review metrics and priorities.",
            host_id=users[1].id,
            status="ended",
            scheduled_time=now - timedelta(days=2, hours=4),
            duration_minutes=45,
            invite_link="",
            passcode=generate_passcode(),
            meeting_type="scheduled",
            ended_at=now - timedelta(days=2, hours=3, minutes=15),
        ),
        Meeting(
            meeting_id=generate_meeting_id(),
            title="Interview — Senior Developer",
            description="Technical interview round 2 for senior developer position.",
            host_id=users[0].id,
            status="ended",
            scheduled_time=now - timedelta(days=3, hours=5),
            duration_minutes=60,
            invite_link="",
            passcode=generate_passcode(),
            meeting_type="scheduled",
            ended_at=now - timedelta(days=3, hours=4),
        ),
        Meeting(
            meeting_id=generate_meeting_id(),
            title="Quick Sync — Bug Fix Priority",
            description="Emergency sync about critical production bug.",
            host_id=users[0].id,
            status="ended",
            scheduled_time=now - timedelta(days=4, hours=1),
            duration_minutes=20,
            invite_link="",
            passcode=generate_passcode(),
            meeting_type="instant",
            ended_at=now - timedelta(days=4, minutes=40),
        ),
    ]

    for m in past_meetings:
        m.invite_link = f"/meeting/{m.meeting_id}"

    db.add_all(past_meetings)
    db.commit()

    # ─── Add Sample Participants to Past Meetings ──────────
    for m in past_meetings:
        db.refresh(m)

    participant_names = ["Jane Smith", "Bob Wilson", "Alice Johnson", "Mike Brown"]

    for meeting in past_meetings:
        # Add host participant
        host_p = Participant(
            meeting_id=meeting.id,
            user_id=meeting.host_id,
            display_name=meeting.host.display_name,
            role="host",
            is_muted=False,
            is_video_on=True,
            joined_at=meeting.scheduled_time,
            left_at=meeting.ended_at,
        )
        db.add(host_p)

        # Add 2-4 random participants
        num_participants = random.randint(2, 4)
        selected = random.sample(participant_names, num_participants)
        for name in selected:
            p = Participant(
                meeting_id=meeting.id,
                display_name=name,
                role="participant",
                is_muted=random.choice([True, False]),
                is_video_on=random.choice([True, False]),
                joined_at=meeting.scheduled_time + timedelta(minutes=random.randint(0, 5)),
                left_at=meeting.ended_at,
            )
            db.add(p)

    db.commit()

    print("Database seeded successfully!")
    print(f"   - {len(users)} users")
    print(f"   - {len(upcoming_meetings)} upcoming meetings")
    print(f"   - {len(past_meetings)} past meetings")
