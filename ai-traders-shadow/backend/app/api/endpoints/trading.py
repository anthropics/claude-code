"""
Paper trading endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

from app.db.database import get_db
from app.models.trade import TradePaper
from app.core.logger import logger

router = APIRouter()


# Pydantic schemas
class TradeRequest(BaseModel):
    """Request schema for executing a paper trade."""
    symbol: str = Field(..., example="BTC-USDT")
    side: str = Field(..., example="buy", pattern="^(buy|sell)$")
    quantity: float = Field(..., gt=0, example=0.001)
    order_type: str = Field(default="market", example="market")


class TradeResponse(BaseModel):
    """Response schema for trade execution."""
    id: int
    symbol: str
    side: str
    price: float
    quantity: float
    quote_quantity: float
    fee: float
    pnl: Optional[float]
    status: str
    executed_at: datetime

    class Config:
        from_attributes = True


class PortfolioResponse(BaseModel):
    """Response schema for portfolio status."""
    user_id: int
    current_balance: float
    total_pnl: float
    total_trades: int
    win_rate: float


@router.post("/execute", response_model=TradeResponse)
async def execute_paper_trade(
    trade: TradeRequest,
    user_id: int = 1,  # TODO: Get from auth token
    db: Session = Depends(get_db)
):
    """
    Execute a paper trade (simulated).

    This endpoint simulates trade execution without real money.
    Pre-trade checks are performed before execution.
    """
    # TODO: Integrate with CCXT for price fetching
    # TODO: Run pre-trade checks (spread, liquidity, etc.)

    logger.info(f"Executing paper trade for user {user_id}: {trade}")

    # Placeholder: Simulate trade execution
    simulated_price = 45000.0  # TODO: Fetch real price from CCXT
    simulated_fee = trade.quantity * simulated_price * 0.001  # 0.1% fee

    new_trade = TradePaper(
        user_id=user_id,
        exchange="binance",
        symbol=trade.symbol,
        side=trade.side,
        order_type=trade.order_type,
        price=simulated_price,
        quantity=trade.quantity,
        quote_quantity=trade.quantity * simulated_price,
        fee=simulated_fee,
        fee_currency="USDT",
        status="filled",
        strategy_signal="manual",
    )

    db.add(new_trade)
    db.commit()
    db.refresh(new_trade)

    # TODO: Send WebSocket update to connected clients
    # TODO: Update Mood Meter

    return new_trade


@router.get("/history", response_model=List[TradeResponse])
async def get_trade_history(
    user_id: int = 1,  # TODO: Get from auth token
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get paper trading history for user."""
    trades = db.query(TradePaper).filter(
        TradePaper.user_id == user_id
    ).order_by(TradePaper.executed_at.desc()).limit(limit).all()

    return trades


@router.get("/portfolio", response_model=PortfolioResponse)
async def get_portfolio_status(
    user_id: int = 1,  # TODO: Get from auth token
    db: Session = Depends(get_db)
):
    """Get current portfolio status and P&L."""
    # TODO: Implement proper portfolio calculation
    # This should account for open positions, realized P&L, etc.

    trades = db.query(TradePaper).filter(TradePaper.user_id == user_id).all()

    total_pnl = sum(t.pnl or 0 for t in trades)
    total_trades = len(trades)
    winning_trades = sum(1 for t in trades if (t.pnl or 0) > 0)
    win_rate = winning_trades / total_trades if total_trades > 0 else 0.0

    return PortfolioResponse(
        user_id=user_id,
        current_balance=100.0 + total_pnl,  # TODO: Get from user model
        total_pnl=total_pnl,
        total_trades=total_trades,
        win_rate=win_rate,
    )
