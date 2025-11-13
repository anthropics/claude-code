"""
Pre-Trade Safety Checks (Layer 1 - Heuristic)

This module implements rule-based safety checks before trade execution:
1. Spread Check: Block if spread too wide
2. Liquidity Check: Block if insufficient liquidity
3. News Filter: Block during high-impact news events
4. Overtrading Check: Limit trading frequency
5. Minimum Order Size: Enforce exchange minimums

Purpose: Protect novice traders from unfavorable market conditions.
"""
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from decimal import Decimal

from app.core.config import settings
from app.core.logger import logger
from app.services.data_ingestion.cryptofeed_service import cryptofeed_service
from app.services.trading.ccxt_service import ccxt_service


class PreTradeCheckResult:
    """Result of a pre-trade check."""

    def __init__(
        self,
        passed: bool,
        check_type: str,
        reason: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.passed = passed
        self.check_type = check_type
        self.reason = reason or ("Check passed" if passed else "Check failed")
        self.details = details or {}
        self.timestamp = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage/API response."""
        return {
            "passed": self.passed,
            "check_type": self.check_type,
            "reason": self.reason,
            "details": self.details,
            "timestamp": self.timestamp.isoformat(),
        }


class PreTradeChecker:
    """
    Pre-trade safety checker implementing Layer 1 heuristics.

    All checks must pass for a trade to be executed.
    """

    def __init__(self):
        self.max_spread_bps = settings.MAX_SPREAD_BPS
        self.min_liquidity_usd = settings.MIN_LIQUIDITY_USD
        self.max_trades_per_hour = settings.MAX_TRADES_PER_HOUR
        self.min_order_size_usd = settings.MIN_ORDER_SIZE_USD

    async def check_spread(self, symbol: str) -> PreTradeCheckResult:
        """
        Check if bid-ask spread is within acceptable limits.

        Wide spreads indicate:
        - Low liquidity
        - High volatility
        - Unfavorable execution conditions

        Args:
            symbol: Trading pair symbol

        Returns:
            PreTradeCheckResult indicating pass/fail
        """
        try:
            # Get latest order book from CryptoFeed cache
            orderbook = cryptofeed_service.get_latest_orderbook(symbol)

            if not orderbook:
                # Fallback to CCXT
                logger.warning("No orderbook in cache, fetching from CCXT")
                ob_data = await ccxt_service.fetch_order_book(symbol, limit=1)
                if ob_data["bids"] and ob_data["asks"]:
                    bid_price = ob_data["bids"][0][0]
                    ask_price = ob_data["asks"][0][0]
                    spread_bps = ((ask_price - bid_price) / bid_price) * 10000
                else:
                    return PreTradeCheckResult(
                        passed=False,
                        check_type="spread_check",
                        reason="Unable to fetch order book data",
                    )
            else:
                spread_bps = orderbook["spread_bps"]
                bid_price = orderbook["bid_price"]
                ask_price = orderbook["ask_price"]

            # Check against threshold
            if spread_bps > self.max_spread_bps:
                return PreTradeCheckResult(
                    passed=False,
                    check_type="spread_check",
                    reason=f"Spread too wide: {spread_bps:.2f} bps (max: {self.max_spread_bps} bps)",
                    details={
                        "spread_bps": spread_bps,
                        "threshold_bps": self.max_spread_bps,
                        "bid": bid_price,
                        "ask": ask_price,
                    },
                )

            return PreTradeCheckResult(
                passed=True,
                check_type="spread_check",
                reason=f"Spread acceptable: {spread_bps:.2f} bps",
                details={
                    "spread_bps": spread_bps,
                    "threshold_bps": self.max_spread_bps,
                },
            )

        except Exception as e:
            logger.error(f"Error in spread check: {e}")
            return PreTradeCheckResult(
                passed=False,
                check_type="spread_check",
                reason=f"Check error: {str(e)}",
            )

    async def check_liquidity(self, symbol: str, order_size_usd: float) -> PreTradeCheckResult:
        """
        Check if there's sufficient liquidity at top of book.

        Insufficient liquidity leads to:
        - High slippage
        - Difficulty exiting positions
        - Poor execution

        Args:
            symbol: Trading pair symbol
            order_size_usd: Intended order size in USD

        Returns:
            PreTradeCheckResult indicating pass/fail
        """
        try:
            # Get order book
            orderbook = cryptofeed_service.get_latest_orderbook(symbol)

            if not orderbook:
                ob_data = await ccxt_service.fetch_order_book(symbol, limit=5)
                if ob_data["bids"] and ob_data["asks"]:
                    # Calculate liquidity at top 5 levels
                    bid_liquidity = sum(price * qty for price, qty in ob_data["bids"][:5])
                    ask_liquidity = sum(price * qty for price, qty in ob_data["asks"][:5])
                    total_liquidity = (bid_liquidity + ask_liquidity) / 2
                else:
                    return PreTradeCheckResult(
                        passed=False,
                        check_type="liquidity_check",
                        reason="Unable to fetch order book data",
                    )
            else:
                # Simplified: use top of book only (would need full book for better estimate)
                bid_liquidity = orderbook["bid_price"] * orderbook["bid_quantity"]
                ask_liquidity = orderbook["ask_price"] * orderbook["ask_quantity"]
                total_liquidity = (bid_liquidity + ask_liquidity) / 2

            # Check if liquidity sufficient
            if total_liquidity < self.min_liquidity_usd:
                return PreTradeCheckResult(
                    passed=False,
                    check_type="liquidity_check",
                    reason=f"Insufficient liquidity: ${total_liquidity:.2f} (min: ${self.min_liquidity_usd})",
                    details={
                        "liquidity_usd": total_liquidity,
                        "threshold_usd": self.min_liquidity_usd,
                        "order_size_usd": order_size_usd,
                    },
                )

            # Check if order size is too large relative to liquidity
            if order_size_usd > total_liquidity * 0.1:  # More than 10% of available liquidity
                return PreTradeCheckResult(
                    passed=False,
                    check_type="liquidity_check",
                    reason=f"Order too large for available liquidity ({order_size_usd:.2f} > 10% of {total_liquidity:.2f})",
                    details={
                        "liquidity_usd": total_liquidity,
                        "order_size_usd": order_size_usd,
                    },
                )

            return PreTradeCheckResult(
                passed=True,
                check_type="liquidity_check",
                reason=f"Liquidity sufficient: ${total_liquidity:.2f}",
                details={"liquidity_usd": total_liquidity},
            )

        except Exception as e:
            logger.error(f"Error in liquidity check: {e}")
            return PreTradeCheckResult(
                passed=False,
                check_type="liquidity_check",
                reason=f"Check error: {str(e)}",
            )

    async def check_minimum_order_size(
        self, symbol: str, amount: float, price: Optional[float] = None
    ) -> PreTradeCheckResult:
        """
        Check if order meets minimum size requirements.

        Enforces both:
        - Exchange minimum order size
        - Platform minimum ($10 USD)

        Args:
            symbol: Trading pair symbol
            amount: Order amount in base currency
            price: Order price (if None, use current market price)

        Returns:
            PreTradeCheckResult indicating pass/fail
        """
        try:
            # Get current price if not provided
            if price is None:
                price = cryptofeed_service.get_latest_price(symbol)
                if not price:
                    ticker = await ccxt_service.fetch_ticker(symbol)
                    price = ticker["last"]

            # Calculate order value in USD
            order_value_usd = amount * price

            # Check platform minimum
            if order_value_usd < self.min_order_size_usd:
                return PreTradeCheckResult(
                    passed=False,
                    check_type="minimum_order_size",
                    reason=f"Order below platform minimum: ${order_value_usd:.2f} (min: ${self.min_order_size_usd})",
                    details={
                        "order_value_usd": order_value_usd,
                        "min_order_size_usd": self.min_order_size_usd,
                    },
                )

            # Check exchange minimum
            exchange_check = await ccxt_service.check_minimum_order_size(symbol, amount)
            if not exchange_check:
                return PreTradeCheckResult(
                    passed=False,
                    check_type="minimum_order_size",
                    reason="Order does not meet exchange minimum requirements",
                    details={"order_value_usd": order_value_usd},
                )

            return PreTradeCheckResult(
                passed=True,
                check_type="minimum_order_size",
                reason=f"Order size acceptable: ${order_value_usd:.2f}",
                details={"order_value_usd": order_value_usd},
            )

        except Exception as e:
            logger.error(f"Error in minimum order size check: {e}")
            return PreTradeCheckResult(
                passed=False,
                check_type="minimum_order_size",
                reason=f"Check error: {str(e)}",
            )

    async def check_overtrading(self, user_id: int, recent_trades_count: int) -> PreTradeCheckResult:
        """
        Check if user is overtrading (too many trades in short period).

        Overtrading leads to:
        - Death by a thousand cuts (fees)
        - Emotional/impulsive decisions
        - Poor risk management

        Args:
            user_id: User ID
            recent_trades_count: Number of trades in last hour

        Returns:
            PreTradeCheckResult indicating pass/fail
        """
        # TODO: Query database for actual recent trades count
        # For now, use provided count

        if recent_trades_count >= self.max_trades_per_hour:
            return PreTradeCheckResult(
                passed=False,
                check_type="overtrading_check",
                reason=f"Too many trades recently: {recent_trades_count} in last hour (max: {self.max_trades_per_hour})",
                details={
                    "recent_trades": recent_trades_count,
                    "max_trades_per_hour": self.max_trades_per_hour,
                },
            )

        return PreTradeCheckResult(
            passed=True,
            check_type="overtrading_check",
            reason=f"Trading frequency acceptable: {recent_trades_count}/{self.max_trades_per_hour} trades in last hour",
            details={
                "recent_trades": recent_trades_count,
                "max_trades_per_hour": self.max_trades_per_hour,
            },
        )

    async def check_news_filter(self, symbol: str) -> PreTradeCheckResult:
        """
        Check if there are upcoming high-impact news events.

        High-impact news (e.g., Fed announcements, CPI) causes:
        - Extreme volatility
        - Widened spreads
        - Unpredictable price action

        Args:
            symbol: Trading pair symbol

        Returns:
            PreTradeCheckResult indicating pass/fail
        """
        # TODO: Integrate with economic calendar API
        # For MVP, this is a placeholder that always passes

        # Example implementation would check:
        # - Fed meetings
        # - CPI/NFP releases
        # - Major crypto announcements (e.g., Bitcoin halving)

        return PreTradeCheckResult(
            passed=True,
            check_type="news_filter",
            reason="No high-impact news events detected",
            details={"news_events": []},
        )

    async def run_all_checks(
        self,
        user_id: int,
        symbol: str,
        amount: float,
        price: Optional[float] = None,
        recent_trades_count: int = 0,
    ) -> Tuple[bool, list[PreTradeCheckResult]]:
        """
        Run all pre-trade checks.

        Args:
            user_id: User ID
            symbol: Trading pair symbol
            amount: Order amount in base currency
            price: Order price (optional)
            recent_trades_count: Number of recent trades

        Returns:
            Tuple of (all_passed: bool, results: List[PreTradeCheckResult])
        """
        logger.info(f"Running pre-trade checks for {symbol} (user: {user_id})")

        # Calculate order size in USD
        if price is None:
            price = cryptofeed_service.get_latest_price(symbol)
            if not price:
                ticker = await ccxt_service.fetch_ticker(symbol)
                price = ticker["last"]

        order_size_usd = amount * price

        # Run all checks
        results = [
            await self.check_spread(symbol),
            await self.check_liquidity(symbol, order_size_usd),
            await self.check_minimum_order_size(symbol, amount, price),
            await self.check_overtrading(user_id, recent_trades_count),
            await self.check_news_filter(symbol),
        ]

        # Check if all passed
        all_passed = all(r.passed for r in results)

        # Log results
        for result in results:
            status = "✅ PASS" if result.passed else "❌ FAIL"
            logger.info(f"{status} | {result.check_type}: {result.reason}")

        if all_passed:
            logger.info(f"✅ All pre-trade checks passed for {symbol}")
        else:
            failed_checks = [r.check_type for r in results if not r.passed]
            logger.warning(f"❌ Pre-trade checks failed: {', '.join(failed_checks)}")

        return all_passed, results


# Global checker instance
pre_trade_checker = PreTradeChecker()
