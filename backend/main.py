"""
FastAPI application entry point for the Zoom Clone backend.
Configures CORS, includes routers, and seeds the database on startup.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from database import engine, SessionLocal, Base
from models import User, Meeting, Participant  # noqa: F401 — needed so SQLAlchemy registers the models
from routers import meetings, participants
from seed import seed_database
from websocket_manager import manager

# Create all database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="Zoom Clone API",
    description="Backend API for the Zoom Clone video conferencing platform",
    version="1.0.0",
)

# Configure CORS for Next.js frontend (local and deployed on Vercel)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(meetings.router)
app.include_router(participants.router)


@app.websocket("/ws/meeting/{meeting_id}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, meeting_id: str, client_id: str):
    await manager.connect(websocket, meeting_id)
    try:
        while True:
            data = await websocket.receive_json()
            # Broadcast the received message to all other clients in the room
            # Data should already contain fields like 'type', 'sender_id', etc.
            await manager.broadcast(data, meeting_id, sender=websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket, meeting_id)
        await manager.broadcast({
            "type": "participant_left",
            "participant_id": client_id
        }, meeting_id)


@app.on_event("startup")
def startup_event():
    """Seed the database with sample data on startup."""
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()


@app.get("/")
def root():
    """Health check endpoint."""
    return {
        "status": "running",
        "app": "Zoom Clone API",
        "version": "1.0.0",
    }


@app.get("/api/users/me")
def get_current_user():
    """Get the default logged-in user (no auth required)."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == 1).first()
        if user:
            return {
                "id": user.id,
                "username": user.username,
                "display_name": user.display_name,
                "email": user.email,
                "avatar_url": user.avatar_url,
            }
        return {"error": "Default user not found"}
    finally:
        db.close()
