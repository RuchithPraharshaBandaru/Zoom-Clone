# Zoom Clone

A full-stack video conferencing platform clone replicating Zoom's design, user experience, and core meeting workflows. 

## Tech Stack
- **Frontend**: Next.js 14, React, custom CSS (Zoom 2025 UI guidelines)
- **Backend**: Python 3, FastAPI, SQLAlchemy
- **Database**: SQLite

## Features
- **Landing Dashboard**: Clean Zoom-like UI with Upcoming and Recent meetings.
- **Instant Meetings**: Create a meeting instantly and generate a shareable ID.
- **Schedule Meetings**: Schedule meetings for a later date and time.
- **Join Meeting**: Join by Meeting ID with a custom display name.
- **Meeting Room**:  mute/unmute, start/stop video, and host controls (Mute All, Remove Participant).

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- Python (3.9+)

### 1. Backend Setup
```bash
cd backend
# Install dependencies
pip install fastapi uvicorn sqlalchemy pydantic python-dotenv

# Run the server
uvicorn main:app --reload --port 8000
```
*Note: The database (`zoom_clone.db`) will be automatically created and seeded with sample data on first startup.*

### 2. Frontend Setup
```bash
cd frontend
# Install dependencies
npm install

# Run the development server
npm run dev
```

### 3. Usage
- Open [http://localhost:3000](http://localhost:3000) in your browser.
- You are automatically logged in as a default user ("John Doe") for demonstration purposes.
- Explore creating, scheduling, and joining meetings!

## Assumptions & Simplifications
- **Authentication**: No login required. A default host user is assumed and seeded into the DB.
- **Video/Audio Streaming**: The meeting room simulates a video grid using CSS and participant data. WebRTC/Socket.io implementation for actual video streaming is omitted to focus on the UI/UX and management workflows as requested.
- **Timezones**: Scheduled meetings are stored in UTC and displayed in the user's local timezone.
