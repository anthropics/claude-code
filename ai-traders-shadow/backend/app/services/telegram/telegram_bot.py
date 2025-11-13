"""
Telegram Bot Service for AI Trader's Shadow

Provides conversational interface for:
1. Proactive updates (mood changes, trade executions, daily summaries)
2. Reactive queries (current status, P&L, recent trades)
3. Educational tips (risk management, market insights)

Bot is designed to be friendly and educational, not pushy.
"""
import asyncio
from typing import Optional, Dict, Any
from datetime import datetime

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

from app.core.config import settings
from app.core.logger import logger
from app.db.database import SessionLocal
from app.services.monitoring.agent_state_monitor import agent_state_monitor


class TelegramBotService:
    """
    Telegram bot service for user communication.

    Features:
    - Proactive mood updates
    - Trade notifications
    - Daily performance summaries
    - On-demand status queries
    - Educational tips
    """

    def __init__(self):
        self.application: Optional[Application] = None
        self.is_running = False

    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /start command."""
        welcome_message = """
👋 Welcome to **AI Trader's Shadow** - Your Crypto Micro-Mentor!

I'm here to help you learn crypto trading through paper trading (no real money).

**What I can do:**
📊 Track your paper trading performance
🎭 Monitor my "mood" based on market conditions
📈 Send trade signals and alerts
📚 Provide educational insights
⚠️ Warn you about risky market conditions

**Commands:**
/status - Check current mood and performance
/trades - View recent trades
/pnl - Check profit & loss
/mood - Get detailed mood explanation
/help - Show all commands

Let's learn together! 🚀
"""
        await update.message.reply_text(
            welcome_message,
            parse_mode='Markdown'
        )

        # Store user's chat_id for proactive notifications
        chat_id = update.effective_chat.id
        # TODO: Save chat_id to user database
        logger.info(f"New user started bot: chat_id={chat_id}")

    async def help_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /help command."""
        help_text = """
**Available Commands:**

📊 **Status & Performance**
/status - Current mood and market conditions
/pnl - Profit & Loss summary
/trades - Recent trade history
/balance - Current paper trading balance

🎭 **Mood Meter**
/mood - Detailed mood explanation
/moodhistory - Mood changes over time

📈 **Trading**
/signals - Latest trading signals
/market - Current market data
/risk - Risk assessment

⚙️ **Settings**
/settings - Configure notifications
/pause - Pause trading signals
/resume - Resume trading signals

❓ **Help**
/help - Show this message
/about - About AI Trader's Shadow

🎓 **Education**
/learn - Daily educational tip
/glossary - Trading terms explained
"""
        await update.message.reply_text(help_text, parse_mode='Markdown')

    async def status_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /status command - show current mood and performance."""
        chat_id = update.effective_chat.id

        # TODO: Get user_id from chat_id lookup
        user_id = 1  # Placeholder

        try:
            # Get current mood from AgentStateMonitor
            db = SessionLocal()
            mood_data = await agent_state_monitor.get_current_state(
                user_id=user_id,
                symbol="BTC-USDT",  # TODO: Get user's preferred symbol
                db=db
            )
            db.close()

            # Format mood emoji
            mood_emoji = {
                "confident": "😎",
                "cautious": "🤔",
                "fatigued": "😴",
                "conservative": "🛡️",
                "learning": "📚"
            }.get(mood_data["mood"], "🤖")

            status_message = f"""
{mood_emoji} **Current Status**

**Mood:** {mood_data["mood"].title()}
**Mood Score:** {mood_data["mood_score"]:.0f}/100

**Recent Performance:**
• P&L: ${mood_data["recent_pnl"]:.2f}
• Win Rate: {mood_data["win_rate"]*100:.1f}%
• Trades (1h): {mood_data["trades_count_1h"]}

**Market Conditions:**
• Volatility: {mood_data["market_volatility"]:.0f}
• Liquidity: {mood_data["liquidity_score"]:.0f}/100

**Why?**
{mood_data["reason"]}

_Updated: {mood_data["timestamp"].strftime("%H:%M:%S UTC")}_
"""
            await update.message.reply_text(status_message, parse_mode='Markdown')

        except Exception as e:
            logger.error(f"Error in status command: {e}")
            await update.message.reply_text(
                "⚠️ Sorry, I couldn't fetch the current status. Please try again later."
            )

    async def mood_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /mood command - detailed mood explanation."""
        # Similar to /status but with more detailed explanation
        await update.message.reply_text(
            "🎭 **Mood Meter Explained**\n\n"
            "My mood reflects current trading conditions:\n\n"
            "😎 **Confident** - Good performance, stable market\n"
            "🤔 **Cautious** - Mixed conditions, proceed carefully\n"
            "😴 **Fatigued** - Too many trades, taking a break\n"
            "🛡️ **Conservative** - High risk, smaller positions\n"
            "📚 **Learning** - Building experience\n\n"
            "Use /status to see my current mood!",
            parse_mode='Markdown'
        )

    async def pnl_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /pnl command - show P&L summary."""
        # TODO: Query database for actual P&L
        pnl_message = """
💰 **Profit & Loss Summary**

**Overall:**
• Starting Balance: $100.00
• Current Balance: $102.50
• Total P&L: +$2.50 (+2.5%)

**Today:**
• Trades: 3
• Wins: 2
• Losses: 1
• P&L: +$1.20

**This Week:**
• Trades: 12
• Win Rate: 58.3%
• Best Trade: +$3.50
• Worst Trade: -$2.10

Keep it up! 🚀
"""
        await update.message.reply_text(pnl_message, parse_mode='Markdown')

    async def trades_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /trades command - show recent trades."""
        # TODO: Query database for actual trades
        trades_message = """
📊 **Recent Trades**

1️⃣ **SELL BTC-USDT** @ $45,120
   • Quantity: 0.002 BTC
   • P&L: +$1.20 ✅
   • Time: 2 hours ago

2️⃣ **BUY BTC-USDT** @ $44,980
   • Quantity: 0.002 BTC
   • Time: 3 hours ago

3️⃣ **SELL BTC-USDT** @ $44,850
   • Quantity: 0.002 BTC
   • P&L: -$0.50 ❌
   • Time: 5 hours ago

Use /pnl for full summary.
"""
        await update.message.reply_text(trades_message, parse_mode='Markdown')

    async def learn_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /learn command - educational tip of the day."""
        tips = [
            """
📚 **Tip: Position Sizing**

Never risk more than 1-2% of your capital on a single trade.

Even with a 50% win rate, proper position sizing ensures you survive losing streaks and live to trade another day.

Example: With $100 balance, risk max $1-2 per trade.
""",
            """
📚 **Tip: Understanding Spread**

The spread is the difference between bid (sell) and ask (buy) prices.

Wide spread = Higher cost to enter/exit
Narrow spread = Better liquidity

Always check spread before trading!
""",
            """
📚 **Tip: Overtrading**

More trades ≠ More profit

Each trade costs fees (0.1%+). Trading 10 times means at least 1% gone to fees.

Quality over quantity. Wait for good setups.
""",
        ]

        # Rotate tips based on day
        tip_index = datetime.utcnow().day % len(tips)
        await update.message.reply_text(tips[tip_index], parse_mode='Markdown')

    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle general text messages (conversational)."""
        user_message = update.message.text.lower()

        # Simple keyword-based responses
        if "hello" in user_message or "hi" in user_message:
            await update.message.reply_text(
                "👋 Hello! How can I help you today? Try /help to see what I can do."
            )
        elif "mood" in user_message or "status" in user_message:
            await self.status_command(update, context)
        elif "help" in user_message:
            await self.help_command(update, context)
        else:
            await update.message.reply_text(
                "🤔 I'm not sure what you mean. Try /help to see available commands."
            )

    async def send_proactive_mood_update(self, chat_id: int, mood_data: Dict[str, Any]):
        """
        Send proactive mood update to user.

        Called when mood changes significantly.
        """
        mood_emoji = {
            "confident": "😎",
            "cautious": "🤔",
            "fatigued": "😴",
            "conservative": "🛡️",
            "learning": "📚"
        }.get(mood_data["mood"], "🤖")

        message = f"""
{mood_emoji} **Mood Update**

My mood changed to: **{mood_data["mood"].title()}**

{mood_data["reason"]}

Current score: {mood_data["mood_score"]:.0f}/100
"""
        await self.application.bot.send_message(
            chat_id=chat_id,
            text=message,
            parse_mode='Markdown'
        )

    async def send_trade_alert(self, chat_id: int, trade_data: Dict[str, Any]):
        """Send trade execution notification."""
        side_emoji = "🟢" if trade_data["side"] == "buy" else "🔴"

        message = f"""
{side_emoji} **Trade Executed**

**{trade_data["side"].upper()}** {trade_data["symbol"]}
• Price: ${trade_data["price"]:.2f}
• Quantity: {trade_data["quantity"]:.6f}
• Fee: ${trade_data["fee"]:.4f}

Balance: ${trade_data["balance"]:.2f}
"""
        await self.application.bot.send_message(
            chat_id=chat_id,
            text=message,
            parse_mode='Markdown'
        )

    async def start(self):
        """Start the Telegram bot."""
        if self.is_running:
            logger.warning("Telegram bot already running")
            return

        if not settings.TELEGRAM_BOT_TOKEN:
            logger.warning("TELEGRAM_BOT_TOKEN not set, bot disabled")
            return

        logger.info("🤖 Starting Telegram bot...")

        # Create application
        self.application = Application.builder().token(settings.TELEGRAM_BOT_TOKEN).build()

        # Register command handlers
        self.application.add_handler(CommandHandler("start", self.start_command))
        self.application.add_handler(CommandHandler("help", self.help_command))
        self.application.add_handler(CommandHandler("status", self.status_command))
        self.application.add_handler(CommandHandler("mood", self.mood_command))
        self.application.add_handler(CommandHandler("pnl", self.pnl_command))
        self.application.add_handler(CommandHandler("trades", self.trades_command))
        self.application.add_handler(CommandHandler("learn", self.learn_command))

        # Register message handler for conversational messages
        self.application.add_handler(
            MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_message)
        )

        # Start bot
        await self.application.initialize()
        await self.application.start()
        await self.application.updater.start_polling()

        self.is_running = True
        logger.info("✅ Telegram bot started")

    async def stop(self):
        """Stop the Telegram bot."""
        if not self.is_running:
            return

        logger.info("🛑 Stopping Telegram bot...")

        if self.application:
            await self.application.updater.stop()
            await self.application.stop()
            await self.application.shutdown()

        self.is_running = False
        logger.info("✅ Telegram bot stopped")


# Global bot instance
telegram_bot = TelegramBotService()
