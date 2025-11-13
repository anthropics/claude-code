"""
CCXT service for paper trading and order execution.

This service provides:
- Paper trading simulation
- Order execution (testnet/mainnet)
- Balance management
- Order status tracking
"""
import ccxt
from typing import Dict, Any, Optional, List
from decimal import Decimal
from datetime import datetime

from app.core.config import settings
from app.core.logger import logger


class CCXTService:
    """
    Service for interacting with cryptocurrency exchanges via CCXT.

    For MVP: Only paper trading (no real orders).
    Future: Support testnet execution.
    """

    def __init__(self):
        self.exchange: Optional[ccxt.Exchange] = None
        self.paper_trading_mode = True  # Always True for MVP
        self._initialize_exchange()

    def _initialize_exchange(self):
        """Initialize CCXT exchange connection."""
        exchange_id = settings.EXCHANGE_NAME.lower()

        try:
            exchange_class = getattr(ccxt, exchange_id)

            config = {
                "enableRateLimit": True,
                "timeout": 30000,
            }

            # For testnet (if/when we enable it)
            if settings.EXCHANGE_TESTNET:
                config["sandbox"] = True

            # Add API credentials if provided
            if settings.EXCHANGE_API_KEY and settings.EXCHANGE_API_SECRET:
                config["apiKey"] = settings.EXCHANGE_API_KEY
                config["secret"] = settings.EXCHANGE_API_SECRET

            self.exchange = exchange_class(config)

            logger.info(f"✅ CCXT initialized: {exchange_id}")
            logger.info(f"Paper Trading Mode: {self.paper_trading_mode}")

        except Exception as e:
            logger.error(f"Failed to initialize CCXT exchange: {e}")
            raise

    async def fetch_ticker(self, symbol: str) -> Dict[str, Any]:
        """
        Fetch current ticker data for a symbol.

        Args:
            symbol: Trading pair symbol (e.g., "BTC/USDT")

        Returns:
            Ticker data with bid, ask, last price, etc.
        """
        try:
            ticker = self.exchange.fetch_ticker(symbol)
            return {
                "symbol": symbol,
                "bid": ticker.get("bid"),
                "ask": ticker.get("ask"),
                "last": ticker.get("last"),
                "volume": ticker.get("baseVolume"),
                "timestamp": ticker.get("timestamp"),
            }
        except Exception as e:
            logger.error(f"Error fetching ticker for {symbol}: {e}")
            raise

    async def fetch_order_book(self, symbol: str, limit: int = 10) -> Dict[str, Any]:
        """
        Fetch order book for a symbol.

        Args:
            symbol: Trading pair symbol
            limit: Number of price levels to fetch

        Returns:
            Order book with bids and asks
        """
        try:
            orderbook = self.exchange.fetch_order_book(symbol, limit=limit)
            return {
                "symbol": symbol,
                "bids": orderbook["bids"],
                "asks": orderbook["asks"],
                "timestamp": orderbook.get("timestamp"),
            }
        except Exception as e:
            logger.error(f"Error fetching order book for {symbol}: {e}")
            raise

    async def execute_paper_trade(
        self,
        symbol: str,
        side: str,
        amount: float,
        order_type: str = "market",
        price: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Execute a simulated paper trade.

        This does NOT place a real order. Instead, it simulates execution
        using current market prices.

        Args:
            symbol: Trading pair (e.g., "BTC/USDT")
            side: "buy" or "sell"
            amount: Amount of base currency
            order_type: "market" or "limit"
            price: Limit price (for limit orders)

        Returns:
            Simulated order result
        """
        logger.info(f"📝 Paper Trade: {side.upper()} {amount} {symbol} ({order_type})")

        try:
            # Fetch current market price
            ticker = await self.fetch_ticker(symbol)

            # Determine execution price
            if order_type == "market":
                # Simulate slippage
                if side == "buy":
                    execution_price = ticker["ask"] * 1.0001  # 0.01% slippage
                else:
                    execution_price = ticker["bid"] * 0.9999
            elif order_type == "limit":
                if price is None:
                    raise ValueError("Limit orders require a price")
                execution_price = price
            else:
                raise ValueError(f"Unsupported order type: {order_type}")

            # Calculate costs
            quote_amount = amount * execution_price
            fee_rate = 0.001  # 0.1% fee (typical maker/taker fee)
            fee = quote_amount * fee_rate

            # Simulate order result
            order_result = {
                "id": f"paper_{int(datetime.utcnow().timestamp())}",
                "symbol": symbol,
                "type": order_type,
                "side": side,
                "price": execution_price,
                "amount": amount,
                "cost": quote_amount,
                "fee": {
                    "cost": fee,
                    "currency": symbol.split("/")[1],  # Quote currency
                },
                "status": "filled",
                "filled": amount,
                "timestamp": int(datetime.utcnow().timestamp() * 1000),
            }

            logger.info(
                f"✅ Paper trade executed: {side} {amount} @ {execution_price:.2f} "
                f"| Cost: {quote_amount:.2f} | Fee: {fee:.4f}"
            )

            return order_result

        except Exception as e:
            logger.error(f"Error executing paper trade: {e}")
            raise

    async def check_minimum_order_size(self, symbol: str, amount: float) -> bool:
        """
        Check if order meets minimum size requirements.

        Args:
            symbol: Trading pair
            amount: Order amount in base currency

        Returns:
            True if order meets minimum size, False otherwise
        """
        try:
            markets = self.exchange.load_markets()
            market = markets.get(symbol)

            if not market:
                logger.warning(f"Market not found: {symbol}")
                return False

            # Check minimum amount
            min_amount = market.get("limits", {}).get("amount", {}).get("min")
            if min_amount and amount < min_amount:
                logger.warning(
                    f"Order amount {amount} below minimum {min_amount} for {symbol}"
                )
                return False

            # Check minimum cost (quote currency)
            ticker = await self.fetch_ticker(symbol)
            cost = amount * ticker["last"]

            min_cost = market.get("limits", {}).get("cost", {}).get("min")
            if min_cost and cost < min_cost:
                logger.warning(
                    f"Order cost {cost} below minimum {min_cost} for {symbol}"
                )
                return False

            # Check against our own minimum ($10 USD)
            if cost < settings.MIN_ORDER_SIZE_USD:
                logger.warning(
                    f"Order cost {cost:.2f} below platform minimum "
                    f"${settings.MIN_ORDER_SIZE_USD}"
                )
                return False

            return True

        except Exception as e:
            logger.error(f"Error checking minimum order size: {e}")
            return False

    async def get_market_info(self, symbol: str) -> Dict[str, Any]:
        """Get detailed market information for a symbol."""
        try:
            markets = self.exchange.load_markets()
            market = markets.get(symbol)

            if not market:
                raise ValueError(f"Market not found: {symbol}")

            return {
                "symbol": symbol,
                "base": market["base"],
                "quote": market["quote"],
                "active": market.get("active"),
                "limits": market.get("limits"),
                "precision": market.get("precision"),
            }

        except Exception as e:
            logger.error(f"Error fetching market info: {e}")
            raise


# Global service instance
ccxt_service = CCXTService()
