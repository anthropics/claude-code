"""
Health check endpoints.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db

router = APIRouter()


@router.get("/")
async def health_check():
    """Basic health check."""
    return {"status": "healthy", "service": "AI Trader's Shadow"}


@router.get("/db")
async def database_health(db: Session = Depends(get_db)):
    """Database connection health check."""
    try:
        # Simple query to test database connection
        db.execute("SELECT 1")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}
