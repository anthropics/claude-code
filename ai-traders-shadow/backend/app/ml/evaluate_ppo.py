"""
Model Evaluation Script

Evaluates a trained PPO model on historical or live data.

Usage:
    python -m app.ml.evaluate_ppo --model ./models/ppo_crypto_final.zip
"""
import argparse
import pandas as pd
import numpy as np
from pathlib import Path
import ccxt

from stable_baselines3 import PPO
from stable_baselines3.common.monitor import Monitor

from app.ml.environments.crypto_trading_env import CryptoTradingEnv
from app.core.logger import logger


def fetch_test_data(
    symbol: str = "BTC/USDT",
    timeframe: str = "1m",
    n_bars: int = 10000,
) -> pd.DataFrame:
    """Fetch recent data for evaluation."""
    logger.info(f"Fetching {n_bars} bars of {symbol} {timeframe} for evaluation...")

    exchange = ccxt.binance({'enableRateLimit': True})

    all_ohlcv = []
    since = None
    limit = 1000

    try:
        while len(all_ohlcv) < n_bars:
            ohlcv = exchange.fetch_ohlcv(symbol, timeframe, since, limit)
            if not ohlcv:
                break

            all_ohlcv.extend(ohlcv)
            since = ohlcv[-1][0] + 60000

            if len(all_ohlcv) >= n_bars:
                break

            exchange.sleep(exchange.rateLimit)

        df = pd.DataFrame(
            all_ohlcv[:n_bars],
            columns=['timestamp', 'open', 'high', 'low', 'close', 'volume']
        )
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')

        logger.info(f"✅ Fetched {len(df)} bars")
        return df

    except Exception as e:
        logger.error(f"Error fetching data: {e}")
        raise


def evaluate_model(
    model_path: str,
    n_episodes: int = 10,
    initial_balance: float = 100.0,
    symbol: str = "BTC/USDT",
    verbose: bool = True,
):
    """
    Evaluate a trained model.

    Args:
        model_path: Path to saved model (.zip file)
        n_episodes: Number of evaluation episodes
        initial_balance: Starting balance
        symbol: Trading pair symbol
        verbose: Print detailed results
    """
    logger.info("=" * 80)
    logger.info("📊 MODEL EVALUATION")
    logger.info("=" * 80)

    # Load model
    logger.info(f"\n📥 Loading model from: {model_path}")
    model = PPO.load(model_path)
    logger.info("✅ Model loaded successfully")

    # Fetch data
    logger.info(f"\n📊 Fetching evaluation data...")
    df = fetch_test_data(symbol=symbol, n_bars=10000)

    # Create environment
    logger.info(f"\n🌍 Creating evaluation environment...")
    env = CryptoTradingEnv(
        df=df,
        initial_balance=initial_balance,
        fee_rate=0.001,
        min_order_size_usd=10.0,
        slippage_bps=5.0,
    )

    # Run evaluation episodes
    logger.info(f"\n🎮 Running {n_episodes} evaluation episodes...")
    logger.info("=" * 80)

    results = []

    for ep in range(n_episodes):
        obs, _ = env.reset()
        done = False
        episode_reward = 0
        actions_taken = {'hold': 0, 'buy': 0, 'sell': 0}

        while not done:
            action, _ = model.predict(obs, deterministic=True)
            obs, reward, terminated, truncated, info = env.step(action)
            episode_reward += reward
            done = terminated or truncated

            # Track actions
            action_names = ['hold', 'buy', 'sell']
            actions_taken[action_names[action]] += 1

        results.append({
            'episode': ep + 1,
            'reward': episode_reward,
            'pnl': info['pnl'],
            'pnl_pct': info['pnl_pct'],
            'trades': info['trades'],
            'win_rate': info['win_rate'],
            'drawdown': info['drawdown'],
            'total_fees': info['total_fees'],
            'actions_hold': actions_taken['hold'],
            'actions_buy': actions_taken['buy'],
            'actions_sell': actions_taken['sell'],
        })

        if verbose:
            logger.info(
                f"Episode {ep+1:2d}: "
                f"P&L=${info['pnl']:7.2f} ({info['pnl_pct']:+6.2f}%) | "
                f"Trades={info['trades']:3d} | "
                f"WinRate={info['win_rate']:.1%} | "
                f"DD={info['drawdown']:.1%} | "
                f"Actions: H={actions_taken['hold']:4d} B={actions_taken['buy']:3d} S={actions_taken['sell']:3d}"
            )

    # Calculate statistics
    logger.info("\n" + "=" * 80)
    logger.info("📈 EVALUATION SUMMARY")
    logger.info("=" * 80)

    pnls = [r['pnl'] for r in results]
    win_rates = [r['win_rate'] for r in results]
    trades = [r['trades'] for r in results]

    logger.info(f"\n💰 P&L Statistics:")
    logger.info(f"  Mean P&L:     ${np.mean(pnls):7.2f} ± ${np.std(pnls):.2f}")
    logger.info(f"  Median P&L:   ${np.median(pnls):7.2f}")
    logger.info(f"  Min P&L:      ${np.min(pnls):7.2f}")
    logger.info(f"  Max P&L:      ${np.max(pnls):7.2f}")
    logger.info(f"  Profit Prob:  {sum(1 for p in pnls if p > 0) / len(pnls):.1%}")

    logger.info(f"\n📊 Trading Statistics:")
    logger.info(f"  Mean Trades:  {np.mean(trades):.1f}")
    logger.info(f"  Mean WinRate: {np.mean(win_rates):.1%}")
    logger.info(f"  Total Fees:   ${np.mean([r['total_fees'] for r in results]):.2f}")

    logger.info(f"\n🎯 Action Distribution:")
    total_actions = sum(r['actions_hold'] + r['actions_buy'] + r['actions_sell'] for r in results)
    hold_pct = sum(r['actions_hold'] for r in results) / total_actions * 100
    buy_pct = sum(r['actions_buy'] for r in results) / total_actions * 100
    sell_pct = sum(r['actions_sell'] for r in results) / total_actions * 100
    logger.info(f"  Hold: {hold_pct:.1f}%")
    logger.info(f"  Buy:  {buy_pct:.1f}%")
    logger.info(f"  Sell: {sell_pct:.1f}%")

    logger.info("\n" + "=" * 80)

    # Return results for further analysis
    return pd.DataFrame(results)


def main():
    """Main evaluation script."""
    parser = argparse.ArgumentParser(description='Evaluate PPO trading model')
    parser.add_argument(
        '--model',
        type=str,
        default='./models/ppo_crypto_final.zip',
        help='Path to trained model (.zip file)'
    )
    parser.add_argument(
        '--episodes',
        type=int,
        default=10,
        help='Number of evaluation episodes'
    )
    parser.add_argument(
        '--balance',
        type=float,
        default=100.0,
        help='Initial balance in USD'
    )
    parser.add_argument(
        '--symbol',
        type=str,
        default='BTC/USDT',
        help='Trading pair symbol'
    )
    parser.add_argument(
        '--save-results',
        type=str,
        default=None,
        help='Save results to CSV file'
    )

    args = parser.parse_args()

    # Check if model exists
    if not Path(args.model).exists():
        logger.error(f"❌ Model not found: {args.model}")
        logger.info("Train a model first using: python -m app.ml.train_ppo")
        return

    # Run evaluation
    try:
        results_df = evaluate_model(
            model_path=args.model,
            n_episodes=args.episodes,
            initial_balance=args.balance,
            symbol=args.symbol,
            verbose=True,
        )

        # Save results if requested
        if args.save_results:
            results_df.to_csv(args.save_results, index=False)
            logger.info(f"\n💾 Results saved to: {args.save_results}")

    except Exception as e:
        logger.error(f"❌ Evaluation failed: {e}")
        raise


if __name__ == "__main__":
    main()
