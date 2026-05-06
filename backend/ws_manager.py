from fastapi import WebSocket
from typing import Dict, List
import json


class ConnectionManager:
    def __init__(self):
        self.connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, tenant_id: str):
        await websocket.accept()
        self.connections.setdefault(tenant_id, []).append(websocket)

    def disconnect(self, websocket: WebSocket, tenant_id: str):
        if tenant_id in self.connections:
            try:
                self.connections[tenant_id].remove(websocket)
            except ValueError:
                pass

    async def broadcast(self, tenant_id: str, message: dict):
        dead = []
        for ws in self.connections.get(tenant_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            try:
                self.connections[tenant_id].remove(ws)
            except ValueError:
                pass

    async def broadcast_all(self, message: dict):
        for tenant_id in list(self.connections.keys()):
            await self.broadcast(tenant_id, message)


manager = ConnectionManager()
