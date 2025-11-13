"""
Main FastAPI application for AI Trader's Shadow.
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import Dict, Set
import json

from app.core.config import settings
from app.core.logger import logger
from app.api import api_router


# WebSocket connection manager
class ConnectionManager:
    """Manages WebSocket connections for real-time updates."""

    def __init__(self):
        self.active_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        """Accept and register a new WebSocket connection."""
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        logger.info(f"WebSocket connected for user_id={user_id}")

    def disconnect(self, websocket: WebSocket, user_id: int):
        """Remove a WebSocket connection."""
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"WebSocket disconnected for user_id={user_id}")

    async def send_personal_message(self, message: dict, user_id: int):
        """Send a message to all connections for a specific user."""
        if user_id in self.active_connections:
            disconnected = set()
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending message to user {user_id}: {e}")
                    disconnected.add(connection)

            # Clean up disconnected connections
            for conn in disconnected:
                self.active_connections[user_id].discard(conn)

    async def broadcast(self, message: dict):
        """Broadcast a message to all connected clients."""
        for user_id, connections in self.active_connections.items():
            await self.send_personal_message(message, user_id)


# Global connection manager instance
manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.
    """
    # Startup
    logger.info("🚀 Starting AI Trader's Shadow API...")
    logger.info(f"Environment: {'Development' if settings.DEBUG else 'Production'}")
    logger.info(f"Database: {settings.DATABASE_URL.split('@')[-1]}")

    # TODO: Initialize services here
    # - Start CryptoFeed data ingestion
    # - Initialize CCXT exchange connection
    # - Load ML models
    # - Start Telegram bot

    yield

    # Shutdown
    logger.info("🛑 Shutting down AI Trader's Shadow API...")
    # TODO: Cleanup services here


# Create FastAPI application
app = FastAPI(
    title="AI Trader's Shadow API",
    description="Backend API for Crypto Micro-Mentor - Educational paper trading platform",
    version="0.1.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint for health check."""
    return {
        "status": "online",
        "service": "AI Trader's Shadow API",
        "version": "0.1.0",
        "mode": "paper_trading_only",
    }


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    """
    WebSocket endpoint for real-time updates.

    Streams:
    - P&L updates
    - Mood Meter changes
    - Trade executions
    - Market data updates
    - Agent status changes

    Message format:
    {
        "type": "pnl_update" | "mood_update" | "trade_execution" | "market_data" | "agent_status",
        "data": {...},
        "timestamp": "2024-01-01T00:00:00Z"
    }
    """
    await manager.connect(websocket, user_id)
    try:
        while True:
            # Receive messages from client (e.g., subscribe/unsubscribe requests)
            data = await websocket.receive_text()
            message = json.loads(data)

            logger.debug(f"Received WebSocket message from user {user_id}: {message}")

            # Handle client requests
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong", "timestamp": message.get("timestamp")})

            elif message.get("type") == "subscribe":
                # TODO: Handle subscription to specific data streams
                await websocket.send_json({
                    "type": "subscription_confirmed",
                    "stream": message.get("stream"),
                })

    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
        logger.info(f"WebSocket disconnected for user_id={user_id}")
    except Exception as e:
        logger.error(f"WebSocket error for user_id={user_id}: {e}")
        manager.disconnect(websocket, user_id)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG,
    )
