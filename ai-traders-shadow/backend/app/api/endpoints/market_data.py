"""
Market data endpoints.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from datetime import datetime

from app.db.database import get_db

router = APIRouter()


class OHLCVData(BaseModel):
    """OHLCV candle data."""
    timestamp: datetime
    symbol: str
    open: float
    high: float
    low: float
    close: float
    volume: float


class OrderBookSnapshot(BaseModel):
    """Order book snapshot data."""
    timestamp: datetime
    symbol: str
    bid_price: float
    bid_quantity: float
    ask_price: float
    ask_quantity: float
    spread_bps: float


@router.get("/ohlcv/{symbol}", response_model=List[OHLCVData])
async def get_ohlcv_data(
    symbol: str,
    interval: str = "1m",
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get OHLCV (candlestick) data for a symbol.

    Supported intervals: 1m, 5m, 15m, 1h, 4h, 1d
    """
    # TODO: Query market_data_1m or aggregated views
    # TODO: Support different timeframes using continuous aggregates

    return []


@router.get("/orderbook/{symbol}", response_model=OrderBookSnapshot)
async def get_orderbook_snapshot(
    symbol: str,
    db: Session = Depends(get_db)
):
    """Get latest order book snapshot for spread/liquidity analysis."""
    # TODO: Query order_book_snapshots table

    return OrderBookSnapshot(
        timestamp=datetime.utcnow(),
        symbol=symbol,
        bid_price=45000.0,
        bid_quantity=1.5,
        ask_price=45025.0,
        ask_quantity=1.2,
        spread_bps=5.5,
    )


@router.get("/ticker/{symbol}")
async def get_ticker(symbol: str):
    """Get current ticker data (real-time from CryptoFeed)."""
    # TODO: Get from CryptoFeed live stream

    return {
        "symbol": symbol,
        "last_price": 45000.0,
        "bid": 44995.0,
        "ask": 45005.0,
        "volume_24h": 1250000.0,
        "timestamp": datetime.utcnow(),
    }
