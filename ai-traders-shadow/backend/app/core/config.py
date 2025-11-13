"""
Core configuration settings for AI Trader's Shadow backend.
"""
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API Configuration
    API_HOST: str = Field(default="0.0.0.0", env="API_HOST")
    API_PORT: int = Field(default=8000, env="API_PORT")
    DEBUG: bool = Field(default=True, env="DEBUG")
    SECRET_KEY: str = Field(default="change-this-in-production", env="SECRET_KEY")
    CORS_ORIGINS: List[str] = Field(default=["http://localhost:3000"], env="CORS_ORIGINS")

    # Database Configuration
    DATABASE_URL: str = Field(
        default="postgresql://postgres:password@localhost:5432/ai_traders_shadow",
        env="DATABASE_URL"
    )

    # Exchange Configuration (Paper Trading)
    EXCHANGE_NAME: str = Field(default="binance", env="EXCHANGE_NAME")
    EXCHANGE_API_KEY: str = Field(default="", env="EXCHANGE_API_KEY")
    EXCHANGE_API_SECRET: str = Field(default="", env="EXCHANGE_API_SECRET")
    EXCHANGE_TESTNET: bool = Field(default=True, env="EXCHANGE_TESTNET")

    # CryptoFeed Configuration
    CRYPTOFEED_SYMBOLS: List[str] = Field(
        default=["BTC-USDT", "ETH-USDT"],
        env="CRYPTOFEED_SYMBOLS"
    )
    CRYPTOFEED_EXCHANGE: str = Field(default="BINANCE", env="CRYPTOFEED_EXCHANGE")
    CRYPTOFEED_CHANNELS: List[str] = Field(
        default=["trades", "l2_book", "ticker"],
        env="CRYPTOFEED_CHANNELS"
    )

    # Telegram Bot Configuration
    TELEGRAM_BOT_TOKEN: str = Field(default="", env="TELEGRAM_BOT_TOKEN")
    TELEGRAM_ADMIN_CHAT_ID: str = Field(default="", env="TELEGRAM_ADMIN_CHAT_ID")

    # ML Configuration
    MODEL_PATH: str = Field(default="./models", env="MODEL_PATH")
    RL_TRAINING_MODE: bool = Field(default=False, env="RL_TRAINING_MODE")
    PAPER_TRADING_INITIAL_BALANCE: float = Field(default=100.0, env="PAPER_TRADING_INITIAL_BALANCE")

    # Risk Management (Pre-Trade Checks)
    MAX_SPREAD_BPS: float = Field(default=50.0, env="MAX_SPREAD_BPS")  # 0.5%
    MIN_LIQUIDITY_USD: float = Field(default=10000.0, env="MIN_LIQUIDITY_USD")
    MAX_TRADES_PER_HOUR: int = Field(default=5, env="MAX_TRADES_PER_HOUR")
    MIN_ORDER_SIZE_USD: float = Field(default=10.0, env="MIN_ORDER_SIZE_USD")

    # Mood Meter Configuration
    MOOD_LOOKBACK_TRADES: int = Field(default=10, env="MOOD_LOOKBACK_TRADES")
    MOOD_UPDATE_INTERVAL_SECONDS: int = Field(default=60, env="MOOD_UPDATE_INTERVAL_SECONDS")

    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
