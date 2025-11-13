"""
PPO Training Script for Crypto Trading Agent
Train a Proximal Policy Optimization (PPO) agent to trade cryptocurrency

This script:
1. Fetches historical OHLCV data from Bybit using ccxt
2. Preprocesses data into format expected by CryptoTradingEnv
3. Trains a PPO model using Stable Baselines3
4. Saves the trained model for deployment

Author: AI Trader's Shadow Team
Date: 2024-11-13
"""

import os
import sys
import argparse
import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple
import warnings

# Suppress warnings
warnings.filterwarnings('ignore')

import ccxt
import pandas as pd
import numpy as np
from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import DummyVecEnv, SubprocVecEnv
from stable_baselines3.common.callbacks import (
    BaseCallback,
    EvalCallback,
    CheckpointCallback,
    CallbackList
)
from stable_baselines3.common.monitor import Monitor

# Import our custom environment
try:
    from backend.app.ml.environments.crypto_trading_env import CryptoTradingEnv
except ImportError:
    # Handle case where running from different directory
    sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    from environments.crypto_trading_env import CryptoTradingEnv


# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('ppo_training.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


# ==========================================
# DATA FETCHING FUNCTIONS
# ==========================================

def fetch_ohlcv_data(
    exchange_name: str = 'bybit',
    symbol: str = 'BTC/USDT',
    timeframe: str = '1m',
    limit: int = 100000,
    use_testnet: bool = False,
) -> pd.DataFrame:
    """
    Fetch historical OHLCV data from cryptocurrency exchange using ccxt

    Args:
        exchange_name: Name of exchange ('bybit', 'binance', etc.)
        symbol: Trading pair symbol (e.g., 'BTC/USDT', 'ETH/USDT')
        timeframe: Candle timeframe ('1m', '5m', '15m', '1h', etc.)
        limit: Number of candles to fetch (max varies by exchange)
        use_testnet: Whether to use testnet

    Returns:
        pd.DataFrame: OHLCV data with columns [timestamp, open, high, low, close, volume]
    """
    logger.info(f"Fetching {limit} {timeframe} candles for {symbol} from {exchange_name}...")

    try:
        # Initialize exchange
        exchange_class = getattr(ccxt, exchange_name)
        exchange = exchange_class({
            'enableRateLimit': True,
            'options': {
                'defaultType': 'linear',  # For perpetual futures
            }
        })

        if use_testnet and exchange_name == 'bybit':
            exchange.set_sandbox_mode(True)
            logger.info("Using testnet mode")

        # Fetch OHLCV data in batches (exchanges have limits)
        max_batch_size = 1000  # Most exchanges limit to 1000 candles per request
        all_candles = []

        # Calculate how far back we need to go
        timeframe_ms = {
            '1m': 60 * 1000,
            '5m': 5 * 60 * 1000,
            '15m': 15 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '4h': 4 * 60 * 60 * 1000,
            '1d': 24 * 60 * 60 * 1000,
        }

        if timeframe not in timeframe_ms:
            raise ValueError(f"Unsupported timeframe: {timeframe}")

        # Start from current time and go backwards
        since = exchange.milliseconds() - (limit * timeframe_ms[timeframe])

        while len(all_candles) < limit:
            batch_size = min(max_batch_size, limit - len(all_candles))

            try:
                candles = exchange.fetch_ohlcv(
                    symbol=symbol,
                    timeframe=timeframe,
                    since=since,
                    limit=batch_size
                )

                if not candles:
                    logger.warning("No more candles available")
                    break

                all_candles.extend(candles)
                logger.info(f"Fetched {len(candles)} candles (total: {len(all_candles)}/{limit})")

                # Update since to last candle timestamp + 1ms
                since = candles[-1][0] + 1

                # Stop if we've caught up to current time
                if since >= exchange.milliseconds():
                    break

            except ccxt.RateLimitExceeded:
                logger.warning("Rate limit exceeded, waiting 5 seconds...")
                import time
                time.sleep(5)
                continue

            except Exception as e:
                logger.error(f"Error fetching batch: {e}")
                break

        if not all_candles:
            raise ValueError("No data fetched from exchange")

        # Convert to DataFrame
        df = pd.DataFrame(
            all_candles,
            columns=['timestamp', 'open', 'high', 'low', 'close', 'volume']
        )

        # Convert timestamp to datetime
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')

        # Sort by timestamp
        df = df.sort_values('timestamp').reset_index(drop=True)

        # Remove duplicates
        df = df.drop_duplicates(subset=['timestamp'], keep='last')

        logger.info(f"✅ Successfully fetched {len(df)} candles")
        logger.info(f"   Date range: {df['timestamp'].min()} to {df['timestamp'].max()}")
        logger.info(f"   Price range: ${df['close'].min():.2f} - ${df['close'].max():.2f}")
        logger.info(f"   Avg volume: {df['volume'].mean():.2f}")

        return df

    except Exception as e:
        logger.error(f"❌ Error fetching OHLCV data: {e}")
        raise


def preprocess_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Preprocess raw OHLCV data for training

    Args:
        df: Raw OHLCV DataFrame

    Returns:
        pd.DataFrame: Preprocessed data
    """
    logger.info("Preprocessing data...")

    # Make a copy
    df = df.copy()

    # Check for missing values
    if df.isnull().any().any():
        logger.warning(f"Found {df.isnull().sum().sum()} missing values, filling with forward fill")
        df = df.fillna(method='ffill').fillna(method='bfill')

    # Check for zero or negative prices
    price_cols = ['open', 'high', 'low', 'close']
    for col in price_cols:
        if (df[col] <= 0).any():
            logger.warning(f"Found zero or negative values in {col}, removing...")
            df = df[df[col] > 0]

    # Check for anomalies (price spikes > 50% in 1 candle)
    price_change = df['close'].pct_change().abs()
    anomalies = price_change > 0.5
    if anomalies.any():
        logger.warning(f"Found {anomalies.sum()} anomalous price spikes, removing...")
        df = df[~anomalies]

    # Reset index
    df = df.reset_index(drop=True)

    logger.info(f"✅ Preprocessing complete: {len(df)} candles remaining")

    return df


def split_train_test(
    df: pd.DataFrame,
    train_ratio: float = 0.8
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Split data into training and testing sets

    Args:
        df: Full dataset
        train_ratio: Proportion of data for training (0-1)

    Returns:
        Tuple of (train_df, test_df)
    """
    split_idx = int(len(df) * train_ratio)

    train_df = df.iloc[:split_idx].reset_index(drop=True)
    test_df = df.iloc[split_idx:].reset_index(drop=True)

    logger.info(f"Train set: {len(train_df)} candles ({df['timestamp'].iloc[0]} to {df['timestamp'].iloc[split_idx-1]})")
    logger.info(f"Test set: {len(test_df)} candles ({df['timestamp'].iloc[split_idx]} to {df['timestamp'].iloc[-1]})")

    return train_df, test_df


# ==========================================
# TRAINING CALLBACKS
# ==========================================

class TradingCallback(BaseCallback):
    """
    Custom callback for logging training metrics
    """

    def __init__(self, verbose: int = 1):
        super(TradingCallback, self).__init__(verbose)
        self.episode_rewards = []
        self.episode_lengths = []
        self.episode_balances = []
        self.episode_trades = []
        self.episode_win_rates = []

    def _on_step(self) -> bool:
        # Log episode statistics when episode ends
        for idx, done in enumerate(self.locals['dones']):
            if done:
                info = self.locals['infos'][idx]

                # Extract episode metrics
                self.episode_balances.append(info.get('balance', 0))
                self.episode_trades.append(info.get('total_trades', 0))
                self.episode_win_rates.append(info.get('win_rate', 0))

                # Log to console
                if self.verbose > 0 and self.num_timesteps % 1000 == 0:
                    logger.info(
                        f"Step {self.num_timesteps}: "
                        f"Balance={info.get('balance', 0):.2f} USDT, "
                        f"PnL={info.get('total_pnl', 0):.2f}, "
                        f"Trades={info.get('total_trades', 0)}, "
                        f"WinRate={info.get('win_rate', 0)*100:.1f}%, "
                        f"MaxDD={info.get('max_drawdown', 0)*100:.1f}%"
                    )

        return True

    def _on_training_end(self) -> None:
        """Called when training ends"""
        if self.episode_balances:
            logger.info("\n" + "="*60)
            logger.info("TRAINING SUMMARY")
            logger.info("="*60)
            logger.info(f"Total episodes: {len(self.episode_balances)}")
            logger.info(f"Average final balance: {np.mean(self.episode_balances):.2f} USDT")
            logger.info(f"Average trades per episode: {np.mean(self.episode_trades):.1f}")
            logger.info(f"Average win rate: {np.mean(self.episode_win_rates)*100:.1f}%")
            logger.info("="*60 + "\n")


# ==========================================
# MAIN TRAINING FUNCTION
# ==========================================

def train_ppo_agent(
    symbol: str = 'BTC/USDT',
    timeframe: str = '1m',
    num_candles: int = 100000,
    initial_balance: float = 100.0,
    total_timesteps: int = 200000,
    save_path: str = 'models/ppo_crypto_model',
    log_dir: str = 'logs/',
    n_envs: int = 4,  # Number of parallel environments
    learning_rate: float = 3e-4,
    batch_size: int = 64,
    n_epochs: int = 10,
    use_testnet: bool = False,
):
    """
    Main training function for PPO agent

    Args:
        symbol: Trading symbol (e.g., 'BTC/USDT', 'ETH/USDT')
        timeframe: Candle timeframe ('1m', '5m', '15m', '1h')
        num_candles: Number of historical candles to fetch
        initial_balance: Starting balance for trading environment
        total_timesteps: Total training timesteps
        save_path: Path to save trained model
        log_dir: Directory for training logs
        n_envs: Number of parallel environments
        learning_rate: Learning rate for PPO
        batch_size: Batch size for training
        n_epochs: Number of epochs per update
        use_testnet: Whether to use exchange testnet
    """
    logger.info("\n" + "="*60)
    logger.info("PPO CRYPTO TRADING AGENT - TRAINING")
    logger.info("="*60)
    logger.info(f"Symbol: {symbol}")
    logger.info(f"Timeframe: {timeframe}")
    logger.info(f"Num candles: {num_candles:,}")
    logger.info(f"Initial balance: ${initial_balance:.2f}")
    logger.info(f"Total timesteps: {total_timesteps:,}")
    logger.info(f"Parallel envs: {n_envs}")
    logger.info("="*60 + "\n")

    # Step 1: Fetch data
    logger.info("STEP 1: Fetching historical data...")
    df = fetch_ohlcv_data(
        exchange_name='bybit',
        symbol=symbol,
        timeframe=timeframe,
        limit=num_candles,
        use_testnet=use_testnet,
    )

    # Step 2: Preprocess data
    logger.info("\nSTEP 2: Preprocessing data...")
    df = preprocess_data(df)

    # Step 3: Split train/test
    logger.info("\nSTEP 3: Splitting train/test sets...")
    train_df, test_df = split_train_test(df, train_ratio=0.8)

    # Save test data for later evaluation
    test_df.to_csv('data/test_data.csv', index=False)
    logger.info("Test data saved to data/test_data.csv")

    # Step 4: Create environments
    logger.info(f"\nSTEP 4: Creating {n_envs} parallel training environments...")

    def make_env(rank: int):
        """Create a single environment"""
        def _init():
            env = CryptoTradingEnv(
                df=train_df,
                initial_balance=initial_balance,
                commission=0.0004,  # 0.04% Bybit taker fee
                max_position_size=1.0,
                lookback_window=20,
            )
            env = Monitor(env, log_dir + f"/env_{rank}")
            return env
        return _init

    # Create vectorized environments
    if n_envs > 1:
        env = SubprocVecEnv([make_env(i) for i in range(n_envs)])
    else:
        env = DummyVecEnv([make_env(0)])

    # Create evaluation environment (single env with test data)
    eval_env = DummyVecEnv([lambda: Monitor(
        CryptoTradingEnv(test_df, initial_balance=initial_balance),
        log_dir + "/eval"
    )])

    logger.info("✅ Environments created")

    # Step 5: Initialize PPO model
    logger.info("\nSTEP 5: Initializing PPO model...")

    model = PPO(
        policy="MlpPolicy",
        env=env,
        learning_rate=learning_rate,
        n_steps=2048,  # Number of steps per update
        batch_size=batch_size,
        n_epochs=n_epochs,
        gamma=0.99,  # Discount factor
        gae_lambda=0.95,  # GAE parameter
        clip_range=0.2,  # PPO clipping parameter
        ent_coef=0.01,  # Entropy coefficient (exploration)
        vf_coef=0.5,  # Value function coefficient
        max_grad_norm=0.5,  # Gradient clipping
        verbose=1,
        tensorboard_log=log_dir + "/tensorboard/",
        device='auto',  # Use GPU if available
    )

    logger.info("✅ PPO model initialized")
    logger.info(f"   Policy: MlpPolicy")
    logger.info(f"   Learning rate: {learning_rate}")
    logger.info(f"   Batch size: {batch_size}")
    logger.info(f"   Device: {model.device}")

    # Step 6: Setup callbacks
    logger.info("\nSTEP 6: Setting up training callbacks...")

    # Create directories
    os.makedirs(save_path, exist_ok=True)
    os.makedirs(log_dir, exist_ok=True)
    os.makedirs('data', exist_ok=True)

    # Checkpoint callback (save model every N steps)
    checkpoint_callback = CheckpointCallback(
        save_freq=10000,
        save_path=save_path + '/checkpoints/',
        name_prefix='ppo_model',
        verbose=1
    )

    # Evaluation callback (evaluate on test set periodically)
    eval_callback = EvalCallback(
        eval_env,
        best_model_save_path=save_path + '/best/',
        log_path=log_dir + '/eval/',
        eval_freq=5000,
        n_eval_episodes=5,
        deterministic=True,
        render=False,
        verbose=1
    )

    # Custom trading callback
    trading_callback = TradingCallback(verbose=1)

    # Combine callbacks
    callback = CallbackList([checkpoint_callback, eval_callback, trading_callback])

    logger.info("✅ Callbacks configured")

    # Step 7: Train the model
    logger.info("\n" + "="*60)
    logger.info("STEP 7: TRAINING PPO AGENT")
    logger.info("="*60)
    logger.info(f"Training for {total_timesteps:,} timesteps...")
    logger.info("This may take several hours. Monitor progress in TensorBoard:")
    logger.info(f"  tensorboard --logdir={log_dir}/tensorboard/")
    logger.info("="*60 + "\n")

    try:
        model.learn(
            total_timesteps=total_timesteps,
            callback=callback,
            progress_bar=True,
        )

        logger.info("\n✅ Training completed successfully!")

    except KeyboardInterrupt:
        logger.warning("\n⚠️  Training interrupted by user")

    except Exception as e:
        logger.error(f"\n❌ Training failed: {e}")
        raise

    # Step 8: Save final model
    logger.info("\nSTEP 8: Saving trained model...")

    final_model_path = save_path + '/ppo_crypto_model_final.zip'
    model.save(final_model_path)

    logger.info(f"✅ Model saved to: {final_model_path}")

    # Step 9: Evaluate final model
    logger.info("\nSTEP 9: Evaluating final model on test set...")

    obs = eval_env.reset()
    total_reward = 0
    episode_count = 0
    max_episodes = 10

    while episode_count < max_episodes:
        action, _states = model.predict(obs, deterministic=True)
        obs, reward, done, info = eval_env.step(action)
        total_reward += reward[0]

        if done[0]:
            episode_count += 1
            logger.info(f"Episode {episode_count}/{max_episodes} - "
                       f"Reward: {total_reward:.2f}, "
                       f"Balance: {info[0].get('balance', 0):.2f}, "
                       f"Trades: {info[0].get('total_trades', 0)}, "
                       f"Win Rate: {info[0].get('win_rate', 0)*100:.1f}%")
            total_reward = 0

    logger.info("\n" + "="*60)
    logger.info("TRAINING COMPLETE!")
    logger.info("="*60)
    logger.info(f"Model saved to: {final_model_path}")
    logger.info(f"Test data saved to: data/test_data.csv")
    logger.info(f"Logs saved to: {log_dir}")
    logger.info("\nNext steps:")
    logger.info("1. Review training metrics in TensorBoard")
    logger.info("2. Backtest the model on test data")
    logger.info("3. Deploy the model for live trading")
    logger.info("="*60 + "\n")

    # Cleanup
    env.close()
    eval_env.close()

    return model


# ==========================================
# COMMAND LINE INTERFACE
# ==========================================

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Train PPO agent for crypto trading')

    parser.add_argument('--symbol', type=str, default='BTC/USDT',
                       help='Trading symbol (default: BTC/USDT)')
    parser.add_argument('--timeframe', type=str, default='1m',
                       help='Candle timeframe (default: 1m)')
    parser.add_argument('--num-candles', type=int, default=100000,
                       help='Number of candles to fetch (default: 100000)')
    parser.add_argument('--initial-balance', type=float, default=100.0,
                       help='Initial balance in USDT (default: 100)')
    parser.add_argument('--total-timesteps', type=int, default=200000,
                       help='Total training timesteps (default: 200000)')
    parser.add_argument('--save-path', type=str, default='models/ppo_crypto_model',
                       help='Path to save model (default: models/ppo_crypto_model)')
    parser.add_argument('--log-dir', type=str, default='logs/',
                       help='Directory for logs (default: logs/)')
    parser.add_argument('--n-envs', type=int, default=4,
                       help='Number of parallel environments (default: 4)')
    parser.add_argument('--learning-rate', type=float, default=3e-4,
                       help='Learning rate (default: 3e-4)')
    parser.add_argument('--batch-size', type=int, default=64,
                       help='Batch size (default: 64)')
    parser.add_argument('--n-epochs', type=int, default=10,
                       help='Number of epochs per update (default: 10)')
    parser.add_argument('--testnet', action='store_true',
                       help='Use exchange testnet')

    return parser.parse_args()


# ==========================================
# MAIN ENTRY POINT
# ==========================================

if __name__ == "__main__":
    args = parse_args()

    logger.info("="*60)
    logger.info("AI TRADER'S SHADOW - PPO TRAINING SCRIPT")
    logger.info("="*60)
    logger.info(f"Start time: {datetime.now()}")
    logger.info("="*60 + "\n")

    try:
        model = train_ppo_agent(
            symbol=args.symbol,
            timeframe=args.timeframe,
            num_candles=args.num_candles,
            initial_balance=args.initial_balance,
            total_timesteps=args.total_timesteps,
            save_path=args.save_path,
            log_dir=args.log_dir,
            n_envs=args.n_envs,
            learning_rate=args.learning_rate,
            batch_size=args.batch_size,
            n_epochs=args.n_epochs,
            use_testnet=args.testnet,
        )

        logger.info(f"\n✅ SUCCESS! Training completed at {datetime.now()}")

    except Exception as e:
        logger.error(f"\n❌ FAILURE! Training failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
