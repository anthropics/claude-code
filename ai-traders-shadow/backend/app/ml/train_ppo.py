"""
PPO Training Script for AI Trader's Shadow

This script trains a PPO (Proximal Policy Optimization) agent to trade BTC/USDT
using realistic market conditions including fees, slippage, and minimum order sizes.

Usage:
    python -m app.ml.train_ppo
"""
import os
import sys
import asyncio
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
import ccxt

from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import (
    CheckpointCallback,
    EvalCallback,
    CallbackList,
)
from stable_baselines3.common.monitor import Monitor

from app.ml.environments.crypto_trading_env import CryptoTradingEnv
from app.core.logger import logger


class PPOTrainer:
    """
    Trainer class for PPO agent on crypto trading task.

    Handles data fetching, preprocessing, training, and evaluation.
    """

    def __init__(
        self,
        symbol: str = "BTC/USDT",
        timeframe: str = "1m",
        n_bars: int = 100000,
        train_test_split: float = 0.8,
        initial_balance: float = 100.0,
        model_save_path: str = "./models",
    ):
        """
        Initialize PPO trainer.

        Args:
            symbol: Trading pair symbol (e.g., "BTC/USDT")
            timeframe: Candle timeframe (e.g., "1m", "5m")
            n_bars: Number of historical bars to fetch
            train_test_split: Ratio of train/test split (0.8 = 80% train, 20% test)
            initial_balance: Starting balance for paper trading
            model_save_path: Path to save trained models
        """
        self.symbol = symbol
        self.timeframe = timeframe
        self.n_bars = n_bars
        self.train_test_split = train_test_split
        self.initial_balance = initial_balance
        self.model_save_path = Path(model_save_path)

        # Create directories
        self.model_save_path.mkdir(parents=True, exist_ok=True)
        (self.model_save_path / "checkpoints").mkdir(exist_ok=True)
        (self.model_save_path / "logs").mkdir(exist_ok=True)

        # Exchange setup
        self.exchange = ccxt.binance({
            'enableRateLimit': True,
            'timeout': 30000,
        })

        logger.info(f"Initialized PPOTrainer for {symbol} ({timeframe})")

    def fetch_historical_data(self) -> pd.DataFrame:
        """
        Fetch historical OHLCV data from exchange.

        Returns:
            DataFrame with columns: timestamp, open, high, low, close, volume
        """
        logger.info(f"Fetching {self.n_bars} bars of {self.symbol} {self.timeframe} data...")

        all_ohlcv = []
        since = None

        # CCXT has a limit on bars per request (usually 1000)
        limit = 1000
        n_requests = int(np.ceil(self.n_bars / limit))

        try:
            for i in range(n_requests):
                logger.info(f"Fetching batch {i+1}/{n_requests}...")

                ohlcv = self.exchange.fetch_ohlcv(
                    self.symbol,
                    timeframe=self.timeframe,
                    since=since,
                    limit=limit
                )

                if not ohlcv:
                    break

                all_ohlcv.extend(ohlcv)

                # Set 'since' to the last timestamp + 1 minute
                since = ohlcv[-1][0] + 60000  # 1 minute in milliseconds

                # Stop if we've fetched enough
                if len(all_ohlcv) >= self.n_bars:
                    break

                # Rate limiting
                self.exchange.sleep(self.exchange.rateLimit)

            # Convert to DataFrame
            df = pd.DataFrame(
                all_ohlcv[:self.n_bars],
                columns=['timestamp', 'open', 'high', 'low', 'close', 'volume']
            )

            # Convert timestamp to datetime
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')

            logger.info(f"✅ Fetched {len(df)} bars from {df['timestamp'].min()} to {df['timestamp'].max()}")

            return df

        except Exception as e:
            logger.error(f"Error fetching data: {e}")
            raise

    def preprocess_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Preprocess raw OHLCV data for training.

        Args:
            df: Raw OHLCV DataFrame

        Returns:
            Preprocessed DataFrame ready for CryptoTradingEnv
        """
        logger.info("Preprocessing data...")

        # Make a copy
        df = df.copy()

        # Sort by timestamp
        df = df.sort_values('timestamp').reset_index(drop=True)

        # Remove any duplicates
        df = df.drop_duplicates(subset=['timestamp']).reset_index(drop=True)

        # Check for missing values
        if df.isnull().any().any():
            logger.warning("Found missing values, filling with forward fill")
            df = df.fillna(method='ffill')

        # Add basic technical indicators (optional - can be expanded)
        # For now, we'll keep it simple and let the RL agent learn from raw OHLCV

        # Log statistics
        logger.info(f"Data range: {df['timestamp'].min()} to {df['timestamp'].max()}")
        logger.info(f"Price range: ${df['close'].min():.2f} - ${df['close'].max():.2f}")
        logger.info(f"Average volume: {df['volume'].mean():.2f}")

        return df

    def split_data(self, df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
        """
        Split data into train and test sets.

        Args:
            df: Preprocessed DataFrame

        Returns:
            Tuple of (train_df, test_df)
        """
        split_idx = int(len(df) * self.train_test_split)

        train_df = df.iloc[:split_idx].reset_index(drop=True)
        test_df = df.iloc[split_idx:].reset_index(drop=True)

        logger.info(f"Train set: {len(train_df)} bars ({df['timestamp'].iloc[0]} to {df['timestamp'].iloc[split_idx-1]})")
        logger.info(f"Test set: {len(test_df)} bars ({df['timestamp'].iloc[split_idx]} to {df['timestamp'].iloc[-1]})")

        return train_df, test_df

    def create_environment(self, df: pd.DataFrame, env_name: str = "train") -> Monitor:
        """
        Create and wrap environment for training/evaluation.

        Args:
            df: DataFrame with OHLCV data
            env_name: Name for logging (e.g., "train", "test")

        Returns:
            Monitored environment
        """
        env = CryptoTradingEnv(
            df=df,
            initial_balance=self.initial_balance,
            fee_rate=0.001,  # 0.1% fee
            min_order_size_usd=10.0,
            slippage_bps=5.0,  # 0.05% slippage
            window_size=50,
        )

        # Wrap with Monitor for logging
        log_path = self.model_save_path / "logs" / env_name
        log_path.mkdir(parents=True, exist_ok=True)

        env = Monitor(env, str(log_path))

        return env

    def create_model(self, env: Monitor) -> PPO:
        """
        Create PPO model with optimized hyperparameters.

        Args:
            env: Training environment

        Returns:
            Initialized PPO model
        """
        logger.info("Creating PPO model...")

        model = PPO(
            policy="MlpPolicy",
            env=env,
            learning_rate=3e-4,
            n_steps=2048,
            batch_size=64,
            n_epochs=10,
            gamma=0.99,
            gae_lambda=0.95,
            clip_range=0.2,
            ent_coef=0.01,  # Encourage exploration
            vf_coef=0.5,
            max_grad_norm=0.5,
            verbose=1,
            tensorboard_log=str(self.model_save_path / "logs" / "tensorboard"),
        )

        logger.info("✅ PPO model created")
        logger.info(f"Policy: {model.policy}")
        logger.info(f"Learning rate: {model.learning_rate}")
        logger.info(f"Batch size: {model.batch_size}")

        return model

    def create_callbacks(self, eval_env: Monitor) -> CallbackList:
        """
        Create training callbacks for checkpointing and evaluation.

        Args:
            eval_env: Evaluation environment

        Returns:
            List of callbacks
        """
        # Checkpoint callback - save model every N steps
        checkpoint_callback = CheckpointCallback(
            save_freq=10000,
            save_path=str(self.model_save_path / "checkpoints"),
            name_prefix="ppo_crypto",
            save_replay_buffer=False,
            save_vecnormalize=False,
        )

        # Evaluation callback - evaluate on test set periodically
        eval_callback = EvalCallback(
            eval_env,
            best_model_save_path=str(self.model_save_path),
            log_path=str(self.model_save_path / "logs" / "eval"),
            eval_freq=5000,
            n_eval_episodes=5,
            deterministic=True,
            render=False,
        )

        return CallbackList([checkpoint_callback, eval_callback])

    def train(
        self,
        total_timesteps: int = 200000,
        eval_enabled: bool = True,
    ) -> PPO:
        """
        Complete training pipeline.

        Args:
            total_timesteps: Number of timesteps to train
            eval_enabled: Whether to enable evaluation callback

        Returns:
            Trained PPO model
        """
        logger.info("=" * 80)
        logger.info("🚀 STARTING PPO TRAINING")
        logger.info("=" * 80)

        # 1. Fetch data
        logger.info("\n📊 STEP 1: Fetching historical data...")
        df = self.fetch_historical_data()

        # 2. Preprocess
        logger.info("\n🔧 STEP 2: Preprocessing data...")
        df = self.preprocess_data(df)

        # 3. Split data
        logger.info("\n✂️ STEP 3: Splitting data...")
        train_df, test_df = self.split_data(df)

        # 4. Create environments
        logger.info("\n🌍 STEP 4: Creating environments...")
        train_env = self.create_environment(train_df, "train")
        test_env = self.create_environment(test_df, "test") if eval_enabled else None

        # 5. Create model
        logger.info("\n🤖 STEP 5: Creating PPO model...")
        model = self.create_model(train_env)

        # 6. Setup callbacks
        logger.info("\n📞 STEP 6: Setting up callbacks...")
        callbacks = self.create_callbacks(test_env) if eval_enabled else None

        # 7. Train!
        logger.info("\n🏋️ STEP 7: Training model...")
        logger.info(f"Total timesteps: {total_timesteps:,}")
        logger.info(f"This may take a while... ☕")
        logger.info("=" * 80)

        start_time = datetime.now()

        model.learn(
            total_timesteps=total_timesteps,
            callback=callbacks,
            progress_bar=True,
        )

        end_time = datetime.now()
        duration = end_time - start_time

        logger.info("=" * 80)
        logger.info(f"✅ Training completed in {duration}")
        logger.info("=" * 80)

        # 8. Save final model
        logger.info("\n💾 STEP 8: Saving final model...")
        model_path = self.model_save_path / "ppo_crypto_final"
        model.save(model_path)
        logger.info(f"✅ Model saved to: {model_path}.zip")

        # 9. Evaluate on test set
        if test_env:
            logger.info("\n📈 STEP 9: Final evaluation on test set...")
            self.evaluate_model(model, test_env, n_episodes=10)

        logger.info("\n" + "=" * 80)
        logger.info("🎉 TRAINING PIPELINE COMPLETE!")
        logger.info("=" * 80)

        return model

    def evaluate_model(
        self,
        model: PPO,
        env: Monitor,
        n_episodes: int = 10,
        render: bool = False,
    ) -> dict:
        """
        Evaluate trained model on test environment.

        Args:
            model: Trained PPO model
            env: Test environment
            n_episodes: Number of evaluation episodes
            render: Whether to render episodes

        Returns:
            Dictionary with evaluation metrics
        """
        logger.info(f"Evaluating model for {n_episodes} episodes...")

        episode_rewards = []
        episode_pnls = []
        episode_win_rates = []
        episode_trades = []

        for ep in range(n_episodes):
            obs, _ = env.reset()
            done = False
            episode_reward = 0

            while not done:
                action, _ = model.predict(obs, deterministic=True)
                obs, reward, terminated, truncated, info = env.step(action)
                episode_reward += reward
                done = terminated or truncated

                if render:
                    env.render()

            # Collect metrics
            episode_rewards.append(episode_reward)
            episode_pnls.append(info['pnl'])
            episode_win_rates.append(info['win_rate'])
            episode_trades.append(info['trades'])

            logger.info(
                f"Episode {ep+1}/{n_episodes}: "
                f"Reward={episode_reward:.2f}, "
                f"P&L=${info['pnl']:.2f}, "
                f"Trades={info['trades']}, "
                f"Win Rate={info['win_rate']:.2%}"
            )

        # Calculate statistics
        metrics = {
            'mean_reward': np.mean(episode_rewards),
            'std_reward': np.std(episode_rewards),
            'mean_pnl': np.mean(episode_pnls),
            'std_pnl': np.std(episode_pnls),
            'mean_win_rate': np.mean(episode_win_rates),
            'mean_trades': np.mean(episode_trades),
            'min_pnl': np.min(episode_pnls),
            'max_pnl': np.max(episode_pnls),
        }

        logger.info("\n" + "=" * 80)
        logger.info("📊 EVALUATION RESULTS")
        logger.info("=" * 80)
        logger.info(f"Mean Reward: {metrics['mean_reward']:.2f} ± {metrics['std_reward']:.2f}")
        logger.info(f"Mean P&L: ${metrics['mean_pnl']:.2f} ± ${metrics['std_pnl']:.2f}")
        logger.info(f"P&L Range: ${metrics['min_pnl']:.2f} to ${metrics['max_pnl']:.2f}")
        logger.info(f"Mean Win Rate: {metrics['mean_win_rate']:.2%}")
        logger.info(f"Mean Trades: {metrics['mean_trades']:.0f}")
        logger.info("=" * 80)

        return metrics


def main():
    """Main training script."""
    # Configuration
    SYMBOL = "BTC/USDT"
    TIMEFRAME = "1m"
    N_BARS = 100000  # ~69 days of 1-minute data
    TOTAL_TIMESTEPS = 200000
    INITIAL_BALANCE = 100.0

    # Create trainer
    trainer = PPOTrainer(
        symbol=SYMBOL,
        timeframe=TIMEFRAME,
        n_bars=N_BARS,
        train_test_split=0.8,
        initial_balance=INITIAL_BALANCE,
        model_save_path="./models",
    )

    # Train model
    try:
        model = trainer.train(
            total_timesteps=TOTAL_TIMESTEPS,
            eval_enabled=True,
        )

        logger.info("\n✅ Training successful!")
        logger.info(f"Model saved to: ./models/ppo_crypto_final.zip")
        logger.info("\nTo use the model:")
        logger.info("  from stable_baselines3 import PPO")
        logger.info("  model = PPO.load('./models/ppo_crypto_final')")

    except KeyboardInterrupt:
        logger.warning("\n⚠️ Training interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n❌ Training failed: {e}")
        raise


if __name__ == "__main__":
    main()
