from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Dictionary mapping meeting_id -> list of active WebSockets
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, meeting_id: str):
        await websocket.accept()
        if meeting_id not in self.active_connections:
            self.active_connections[meeting_id] = []
        self.active_connections[meeting_id].append(websocket)

    def disconnect(self, websocket: WebSocket, meeting_id: str):
        if meeting_id in self.active_connections:
            if websocket in self.active_connections[meeting_id]:
                self.active_connections[meeting_id].remove(websocket)
            if len(self.active_connections[meeting_id]) == 0:
                del self.active_connections[meeting_id]

    async def broadcast(self, message: dict, meeting_id: str, sender: WebSocket = None):
        """Broadcasts a JSON message to all clients in the room, optionally excluding the sender."""
        if meeting_id in self.active_connections:
            for connection in self.active_connections[meeting_id]:
                if connection != sender:
                    try:
                        await connection.send_json(message)
                    except Exception as e:
                        print(f"Error broadcasting to client: {e}")

manager = ConnectionManager()
