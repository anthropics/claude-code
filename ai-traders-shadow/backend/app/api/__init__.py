"""
API routes initialization.
"""
from fastapi import APIRouter
from app.api.endpoints import health, trading, mood, market_data

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(trading.router, prefix="/trading", tags=["trading"])
api_router.include_router(mood.router, prefix="/mood", tags=["mood-meter"])
api_router.include_router(market_data.router, prefix="/market", tags=["market-data"])
