"""
CryptoFeed service for real-time market data ingestion.

This service connects to exchange WebSocket feeds and streams:
- Trade data
- L2 order book data
- Ticker updates

Data is stored in TimescaleDB and broadcasted via WebSocket to clients.
"""
import asyncio
from typing import Dict, Any, Optional
from decimal import Decimal
from datetime import datetime

from cryptofeed import FeedHandler
from cryptofeed.defines import TRADES, L2_BOOK, TICKER
from cryptofeed.exchanges import Binance
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logger import logger
from app.db.database import SessionLocal


class CryptoFeedService:
    """
    Service for ingesting real-time market data using CryptoFeed.

    Features:
    - Low-latency WebSocket connections
    - Automatic reconnection
    - TimescaleDB storage
    - Real-time broadcasting to WebSocket clients
    """

    def __init__(self):
        self.feed_handler: Optional[FeedHandler] = None
        self.db_session: Optional[Session] = None
        self.is_running = False

        # Current market data cache (for quick access)
        self.latest_trades: Dict[str, Dict[str, Any]] = {}
        self.latest_orderbook: Dict[str, Dict[str, Any]] = {}
        self.latest_ticker: Dict[str, Dict[str, Any]] = {}

    async def trade_callback(self, trade, receipt_timestamp):
        """
        Callback for trade updates.

        Args:
            trade: Trade data from cryptofeed
            receipt_timestamp: When the message was received
        """
        symbol = trade.symbol
        logger.debug(f"Trade received: {symbol} @ {trade.price} x {trade.amount}")

        # Update cache
        self.latest_trades[symbol] = {
            "symbol": symbol,
            "price": float(trade.price),
            "amount": float(trade.amount),
            "side": trade.side,
            "timestamp": trade.timestamp,
        }

        # TODO: Store in TimescaleDB (market_data_1m aggregation)
        # TODO: Broadcast to WebSocket clients

    async def orderbook_callback(self, orderbook, receipt_timestamp):
        """
        Callback for L2 order book updates.

        Args:
            orderbook: Order book snapshot/delta
            receipt_timestamp: When the message was received
        """
        symbol = orderbook.symbol

        # Get top of book
        if orderbook.book.bids and orderbook.book.asks:
            best_bid = orderbook.book.bids.index(0)
            best_ask = orderbook.book.asks.index(0)

            bid_price = best_bid[0]
            bid_qty = best_bid[1]
            ask_price = best_ask[0]
            ask_qty = best_ask[1]

            spread = ask_price - bid_price
            spread_bps = (spread / bid_price) * 10000  # Basis points

            # Update cache
            self.latest_orderbook[symbol] = {
                "symbol": symbol,
                "bid_price": float(bid_price),
                "bid_quantity": float(bid_qty),
                "ask_price": float(ask_price),
                "ask_quantity": float(ask_qty),
                "spread_bps": float(spread_bps),
                "mid_price": float((bid_price + ask_price) / 2),
                "timestamp": datetime.utcnow(),
            }

            logger.debug(
                f"OrderBook: {symbol} | Bid: {bid_price} x {bid_qty} | "
                f"Ask: {ask_price} x {ask_qty} | Spread: {spread_bps:.2f} bps"
            )

            # TODO: Store snapshot in order_book_snapshots table
            # TODO: Broadcast to WebSocket clients

    async def ticker_callback(self, ticker, receipt_timestamp):
        """
        Callback for ticker updates.

        Args:
            ticker: Ticker data from cryptofeed
            receipt_timestamp: When the message was received
        """
        symbol = ticker.symbol

        self.latest_ticker[symbol] = {
            "symbol": symbol,
            "bid": float(ticker.bid) if ticker.bid else None,
            "ask": float(ticker.ask) if ticker.ask else None,
            "timestamp": ticker.timestamp,
        }

        logger.debug(f"Ticker: {symbol} | Bid: {ticker.bid} | Ask: {ticker.ask}")

    def get_latest_price(self, symbol: str) -> Optional[float]:
        """Get latest price for a symbol from cache."""
        if symbol in self.latest_ticker:
            ticker = self.latest_ticker[symbol]
            if ticker["bid"] and ticker["ask"]:
                return (ticker["bid"] + ticker["ask"]) / 2

        if symbol in self.latest_trades:
            return self.latest_trades[symbol]["price"]

        return None

    def get_latest_orderbook(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Get latest order book snapshot for a symbol."""
        return self.latest_orderbook.get(symbol)

    async def start(self):
        """Start the CryptoFeed service."""
        if self.is_running:
            logger.warning("CryptoFeed service already running")
            return

        logger.info("🚀 Starting CryptoFeed service...")
        logger.info(f"Symbols: {settings.CRYPTOFEED_SYMBOLS}")
        logger.info(f"Exchange: {settings.CRYPTOFEED_EXCHANGE}")

        self.feed_handler = FeedHandler()

        # Configure feed
        # Note: Adjust symbol format based on exchange (e.g., BTC-USDT vs BTC/USDT)
        symbols = settings.CRYPTOFEED_SYMBOLS

        self.feed_handler.add_feed(
            Binance(
                symbols=symbols,
                channels=[TRADES, L2_BOOK, TICKER],
                callbacks={
                    TRADES: self.trade_callback,
                    L2_BOOK: self.orderbook_callback,
                    TICKER: self.ticker_callback,
                }
            )
        )

        self.is_running = True
        logger.info("✅ CryptoFeed service started")

        # Run feed handler
        await self.feed_handler.run()

    async def stop(self):
        """Stop the CryptoFeed service."""
        if not self.is_running:
            return

        logger.info("🛑 Stopping CryptoFeed service...")
        self.is_running = False

        if self.feed_handler:
            # CryptoFeed doesn't have explicit stop, it stops when run() completes
            pass

        logger.info("✅ CryptoFeed service stopped")


# Global service instance
cryptofeed_service = CryptoFeedService()
