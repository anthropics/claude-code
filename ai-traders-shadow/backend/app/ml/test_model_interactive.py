"""
Interactive Model Testing Script

Test a trained model step-by-step with visualization.

Usage:
    python -m app.ml.test_model_interactive
"""
import pandas as pd
import numpy as np
import ccxt
from stable_baselines3 import PPO

from app.ml.environments.crypto_trading_env import CryptoTradingEnv
from app.core.logger import logger


def fetch_recent_data(n_bars: int = 5000) -> pd.DataFrame:
    """Fetch recent market data."""
    logger.info(f"Fetching {n_bars} recent bars...")

    exchange = ccxt.binance({'enableRateLimit': True})
    ohlcv = []

    while len(ohlcv) < n_bars:
        batch = exchange.fetch_ohlcv('BTC/USDT', '1m', limit=1000)
        if not batch:
            break
        ohlcv.extend(batch)
        if len(ohlcv) >= n_bars:
            break
        exchange.sleep(exchange.rateLimit)

    df = pd.DataFrame(
        ohlcv[:n_bars],
        columns=['timestamp', 'open', 'high', 'low', 'close', 'volume']
    )
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')

    return df


def interactive_test():
    """Run interactive testing session."""
    logger.info("=" * 80)
    logger.info("🎮 INTERACTIVE MODEL TESTING")
    logger.info("=" * 80)

    # Load model
    model_path = "./models/ppo_crypto_final.zip"
    logger.info(f"\n📥 Loading model from: {model_path}")

    try:
        model = PPO.load(model_path)
        logger.info("✅ Model loaded")
    except FileNotFoundError:
        logger.error(f"❌ Model not found at {model_path}")
        logger.info("Train a model first using: python -m app.ml.train_ppo")
        return

    # Fetch data
    logger.info("\n📊 Fetching recent market data...")
    df = fetch_recent_data(n_bars=5000)
    logger.info(f"✅ Loaded {len(df)} bars from {df['timestamp'].min()} to {df['timestamp'].max()}")

    # Create environment
    logger.info("\n🌍 Creating environment...")
    env = CryptoTradingEnv(
        df=df,
        initial_balance=100.0,
        fee_rate=0.001,
        min_order_size_usd=10.0,
    )

    # Reset environment
    obs, info = env.reset()
    logger.info("✅ Environment ready")

    logger.info("\n" + "=" * 80)
    logger.info("Starting trading episode...")
    logger.info("=" * 80)

    done = False
    step = 0
    actions_count = {'hold': 0, 'buy': 0, 'sell': 0}

    while not done:
        # Predict action
        action, _states = model.predict(obs, deterministic=True)
        action_name = ['HOLD', 'BUY', 'SELL'][action]
        actions_count[action_name.lower()] += 1

        # Execute action
        obs, reward, terminated, truncated, info = env.step(action)
        done = terminated or truncated

        step += 1

        # Print every N steps or when action is taken
        if action != 0 or step % 100 == 0:
            logger.info(
                f"Step {step:4d} | "
                f"Action: {action_name:4s} | "
                f"Reward: {reward:+7.4f} | "
                f"Equity: ${info['equity']:8.2f} | "
                f"P&L: ${info['pnl']:+7.2f} ({info['pnl_pct']:+6.2f}%) | "
                f"Trades: {info['trades']:2d}"
            )

    # Final results
    logger.info("\n" + "=" * 80)
    logger.info("📊 EPISODE COMPLETE")
    logger.info("=" * 80)

    logger.info(f"\n💰 Final Results:")
    logger.info(f"  Starting Balance:  ${100.00:.2f}")
    logger.info(f"  Final Equity:      ${info['equity']:.2f}")
    logger.info(f"  Total P&L:         ${info['pnl']:.2f} ({info['pnl_pct']:+.2f}%)")
    logger.info(f"  Max Equity:        ${info['max_equity']:.2f}")
    logger.info(f"  Max Drawdown:      {info['drawdown']:.2%}")

    logger.info(f"\n📈 Trading Statistics:")
    logger.info(f"  Total Trades:      {info['trades']}")
    logger.info(f"  Win Rate:          {info['win_rate']:.2%}")
    logger.info(f"  Total Fees Paid:   ${info['total_fees']:.2f}")
    logger.info(f"  Total Slippage:    ${info['total_slippage']:.2f}")

    logger.info(f"\n🎯 Action Distribution:")
    logger.info(f"  Hold: {actions_count['hold']:5d} ({actions_count['hold']/step*100:.1f}%)")
    logger.info(f"  Buy:  {actions_count['buy']:5d} ({actions_count['buy']/step*100:.1f}%)")
    logger.info(f"  Sell: {actions_count['sell']:5d} ({actions_count['sell']/step*100:.1f}%)")

    logger.info("\n" + "=" * 80)

    # Performance assessment
    if info['pnl'] > 0:
        logger.info("✅ Profitable episode!")
    else:
        logger.info("❌ Losing episode")

    if info['win_rate'] > 0.5:
        logger.info("✅ Positive win rate")
    else:
        logger.info("⚠️ Low win rate")

    if info['drawdown'] < 0.2:
        logger.info("✅ Good risk management (drawdown < 20%)")
    else:
        logger.warning("⚠️ High drawdown - risky!")


if __name__ == "__main__":
    interactive_test()
