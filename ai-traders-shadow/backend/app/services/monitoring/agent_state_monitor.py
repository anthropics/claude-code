"""
Agent State Monitor (Mood Meter)

This module implements the "humanization layer" by tracking AI agent's
emotional state based on performance and market conditions.

The "mood" helps users:
1. Understand why the AI is making certain decisions
2. Build trust through transparency
3. Learn risk management principles

Mood is NOT based on complex ML metrics, but on human-readable factors:
- Recent P&L (last N trades)
- Win rate (percentage of profitable trades)
- Trading frequency (overtrading detection)
- Market volatility (ATR)
- Market liquidity
"""
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum

from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.core.config import settings
from app.core.logger import logger
from app.models.trade import TradePaper
from app.services.data_ingestion.cryptofeed_service import cryptofeed_service


class AgentMood(str, Enum):
    """Possible mood states for the AI agent."""
    CONFIDENT = "confident"  # Good recent performance, stable market
    CAUTIOUS = "cautious"  # Mixed performance or volatile market
    FATIGUED = "fatigued"  # Too many trades (overtrading)
    CONSERVATIVE = "conservative"  # Low liquidity or very high volatility
    LEARNING = "learning"  # New user, insufficient trade history


class MoodMetrics:
    """Metrics used to calculate agent mood."""

    def __init__(
        self,
        recent_pnl: float = 0.0,
        win_rate: float = 0.0,
        trades_count_1h: int = 0,
        market_volatility: float = 0.0,
        liquidity_score: float = 100.0,
        total_trades: int = 0,
    ):
        self.recent_pnl = recent_pnl
        self.win_rate = win_rate
        self.trades_count_1h = trades_count_1h
        self.market_volatility = market_volatility
        self.liquidity_score = liquidity_score
        self.total_trades = total_trades


class AgentStateMonitor:
    """
    Monitors AI agent state and calculates "mood" for UX.

    The mood is a simplified representation of the agent's confidence
    and decision-making context, designed for educational purposes.
    """

    def __init__(self):
        self.mood_lookback_trades = settings.MOOD_LOOKBACK_TRADES

    async def get_recent_trades_metrics(
        self, user_id: int, db: Session
    ) -> MoodMetrics:
        """
        Calculate performance metrics from recent trades.

        Args:
            user_id: User ID
            db: Database session

        Returns:
            MoodMetrics with recent performance data
        """
        # Get recent trades (last N trades)
        recent_trades = (
            db.query(TradePaper)
            .filter(TradePaper.user_id == user_id)
            .order_by(desc(TradePaper.executed_at))
            .limit(self.mood_lookback_trades)
            .all()
        )

        if not recent_trades:
            return MoodMetrics(total_trades=0)

        # Calculate recent P&L
        recent_pnl = sum(float(t.pnl or 0) for t in recent_trades)

        # Calculate win rate
        winning_trades = sum(1 for t in recent_trades if (t.pnl or 0) > 0)
        win_rate = winning_trades / len(recent_trades) if recent_trades else 0.0

        # Calculate trades in last hour
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)
        trades_1h = (
            db.query(func.count(TradePaper.id))
            .filter(
                TradePaper.user_id == user_id,
                TradePaper.executed_at >= one_hour_ago
            )
            .scalar()
        )

        # Get total trades count
        total_trades = db.query(func.count(TradePaper.id)).filter(
            TradePaper.user_id == user_id
        ).scalar()

        return MoodMetrics(
            recent_pnl=recent_pnl,
            win_rate=win_rate,
            trades_count_1h=trades_1h,
            total_trades=total_trades or 0,
        )

    async def get_market_conditions(self, symbol: str) -> Dict[str, float]:
        """
        Get current market conditions (volatility, liquidity).

        Args:
            symbol: Trading pair symbol

        Returns:
            Dict with volatility and liquidity metrics
        """
        # Get order book for liquidity assessment
        orderbook = cryptofeed_service.get_latest_orderbook(symbol)

        liquidity_score = 100.0  # Default
        spread_bps = 0.0

        if orderbook:
            spread_bps = orderbook["spread_bps"]

            # Simple liquidity score (0-100)
            # Lower spread = higher liquidity
            if spread_bps < 5:
                liquidity_score = 100.0
            elif spread_bps < 10:
                liquidity_score = 80.0
            elif spread_bps < 20:
                liquidity_score = 60.0
            elif spread_bps < 50:
                liquidity_score = 40.0
            else:
                liquidity_score = 20.0

        # TODO: Calculate ATR (Average True Range) for volatility
        # For now, use spread as a proxy
        market_volatility = spread_bps * 100  # Simplified

        return {
            "volatility": market_volatility,
            "liquidity_score": liquidity_score,
            "spread_bps": spread_bps,
        }

    def calculate_mood_score(self, metrics: MoodMetrics, market: Dict[str, float]) -> float:
        """
        Calculate numerical mood score (0-100).

        Higher score = more confident/favorable conditions

        Args:
            metrics: Performance metrics
            market: Market conditions

        Returns:
            Mood score (0-100)
        """
        score = 50.0  # Start neutral

        # P&L factor (+/- 20 points)
        if metrics.recent_pnl > 5:
            score += 20
        elif metrics.recent_pnl > 0:
            score += 10
        elif metrics.recent_pnl > -5:
            score -= 10
        else:
            score -= 20

        # Win rate factor (+/- 15 points)
        if metrics.win_rate > 0.6:
            score += 15
        elif metrics.win_rate > 0.5:
            score += 10
        elif metrics.win_rate > 0.4:
            score += 0
        else:
            score -= 15

        # Overtrading penalty (-30 points if trading too much)
        if metrics.trades_count_1h >= settings.MAX_TRADES_PER_HOUR:
            score -= 30

        # Market conditions (+/- 15 points)
        if market["liquidity_score"] > 80:
            score += 10
        elif market["liquidity_score"] < 40:
            score -= 15

        if market["volatility"] > 2000:  # Very high volatility
            score -= 10
        elif market["volatility"] < 500:  # Low volatility
            score += 5

        # Clamp to 0-100
        return max(0, min(100, score))

    def score_to_mood(
        self,
        score: float,
        metrics: MoodMetrics,
        market: Dict[str, float]
    ) -> AgentMood:
        """
        Convert numerical score to mood state.

        Args:
            score: Mood score (0-100)
            metrics: Performance metrics
            market: Market conditions

        Returns:
            AgentMood enum
        """
        # Special cases override score
        if metrics.total_trades < 5:
            return AgentMood.LEARNING

        if metrics.trades_count_1h >= settings.MAX_TRADES_PER_HOUR:
            return AgentMood.FATIGUED

        if market["liquidity_score"] < 30 or market["volatility"] > 3000:
            return AgentMood.CONSERVATIVE

        # Score-based mood
        if score >= 70:
            return AgentMood.CONFIDENT
        elif score >= 40:
            return AgentMood.CAUTIOUS
        else:
            return AgentMood.CONSERVATIVE

    def generate_mood_reason(
        self,
        mood: AgentMood,
        metrics: MoodMetrics,
        market: Dict[str, float]
    ) -> str:
        """
        Generate human-readable explanation for mood.

        Args:
            mood: Current mood
            metrics: Performance metrics
            market: Market conditions

        Returns:
            Human-readable reason string
        """
        if mood == AgentMood.LEARNING:
            return (
                f"Still learning your trading style. "
                f"Only {metrics.total_trades} trades executed so far. "
                f"Building confidence with each trade."
            )

        if mood == AgentMood.FATIGUED:
            return (
                f"Taking a break. {metrics.trades_count_1h} trades in the last hour "
                f"is too many. Overtrading can lead to poor decisions and high fees. "
                f"Recommended: Wait at least 30 minutes before next trade."
            )

        if mood == AgentMood.CONSERVATIVE:
            reasons = []

            if market["liquidity_score"] < 50:
                reasons.append(
                    f"low liquidity (spread: {market['spread_bps']:.1f} bps)"
                )

            if market["volatility"] > 2000:
                reasons.append("high market volatility")

            if metrics.recent_pnl < -10:
                reasons.append(f"recent losses (${metrics.recent_pnl:.2f})")

            reason_str = ", ".join(reasons) if reasons else "unfavorable conditions"

            return (
                f"Being extra cautious due to {reason_str}. "
                f"Recommending smaller position sizes or waiting for better conditions."
            )

        if mood == AgentMood.CAUTIOUS:
            return (
                f"Market conditions are mixed. "
                f"Recent performance: {metrics.win_rate:.0%} win rate, "
                f"${metrics.recent_pnl:.2f} P&L over last {self.mood_lookback_trades} trades. "
                f"Proceeding carefully with standard risk management."
            )

        if mood == AgentMood.CONFIDENT:
            return (
                f"Conditions look favorable! "
                f"Recent performance: {metrics.win_rate:.0%} win rate, "
                f"${metrics.recent_pnl:.2f} profit. "
                f"Market liquidity is good (spread: {market['spread_bps']:.1f} bps). "
                f"However, stay disciplined with risk management."
            )

        return "Analyzing market conditions..."

    async def get_current_state(
        self,
        user_id: int,
        symbol: str,
        db: Session
    ) -> Dict[str, Any]:
        """
        Get current agent state (mood + metrics).

        This is the main method called by the API and WebSocket.

        Args:
            user_id: User ID
            symbol: Trading pair symbol (for market conditions)
            db: Database session

        Returns:
            Dict with mood, score, metrics, and explanation
        """
        logger.info(f"Calculating agent mood for user {user_id}, symbol {symbol}")

        # Get performance metrics
        metrics = await self.get_recent_trades_metrics(user_id, db)

        # Get market conditions
        market = await self.get_market_conditions(symbol)

        # Calculate mood score
        mood_score = self.calculate_mood_score(metrics, market)

        # Determine mood state
        mood = self.score_to_mood(mood_score, metrics, market)

        # Generate explanation
        reason = self.generate_mood_reason(mood, metrics, market)

        result = {
            "mood": mood.value,
            "mood_score": round(mood_score, 2),
            "recent_pnl": round(metrics.recent_pnl, 2),
            "win_rate": round(metrics.win_rate, 4),
            "trades_count_1h": metrics.trades_count_1h,
            "market_volatility": round(market["volatility"], 2),
            "liquidity_score": round(market["liquidity_score"], 2),
            "reason": reason,
            "timestamp": datetime.utcnow(),
        }

        logger.info(f"Agent mood: {mood.value} (score: {mood_score:.1f})")

        return result


# Global monitor instance
agent_state_monitor = AgentStateMonitor()
