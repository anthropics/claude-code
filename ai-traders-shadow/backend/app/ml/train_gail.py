"""
GAIL (Generative Adversarial Imitation Learning) Training Script for Modal.com

This script trains a GAIL model using expert demonstrations collected from
profitable paper trades (Data Flywheel).

GAIL Architecture:
- Generator: PPO agent that learns to imitate experts
- Discriminator: Neural network that distinguishes expert vs generated trajectories

Usage:
    # Manual training
    modal run app.ml.train_gail

    # Scheduled training (weekly)
    modal deploy app.modal_app  # (if scheduled function is configured)

References:
    - Paper: "Generative Adversarial Imitation Learning" (Ho & Ermon, 2016)
    - Library: https://imitation.readthedocs.io/
"""
import os
import json
import numpy as np
import pandas as pd
from typing import List, Tuple, Dict
from datetime import datetime
from pathlib import Path

# ML Libraries
from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import DummyVecEnv
from stable_baselines3.common.evaluation import evaluate_policy
import gymnasium as gym

# Imitation Learning
from imitation.data import rollout
from imitation.data.types import Transitions
from imitation.algorithms.adversarial import GAIL
from imitation.rewards.reward_nets import BasicRewardNet
from imitation.util.networks import RunningNorm

# Database
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Local imports
from app.core.config import settings
from app.core.logger import logger
from app.ml.environments.crypto_trading_env import CryptoTradingEnv
from app.models.expert_demonstration import ExpertDemonstration


class GAILTrainer:
    """
    GAIL Trainer for Crypto Trading.

    Data Flywheel Process:
    1. Collect expert demonstrations from profitable trades
    2. Train GAIL discriminator to distinguish expert vs agent
    3. Use discriminator as reward signal for PPO
    4. Deploy improved agent
    5. Collect more expert demonstrations
    6. Repeat
    """

    def __init__(
        self,
        database_url: str,
        min_expert_score: float = 70.0,
        min_demonstrations: int = 100,
    ):
        """
        Initialize GAIL trainer.

        Args:
            database_url: PostgreSQL connection string
            min_expert_score: Minimum quality score for demonstrations
            min_demonstrations: Minimum dataset size to start training
        """
        self.database_url = database_url
        self.min_expert_score = min_expert_score
        self.min_demonstrations = min_demonstrations

        # Database session
        engine = create_engine(database_url)
        SessionLocal = sessionmaker(bind=engine)
        self.db = SessionLocal()

        logger.info(f"🤖 GAIL Trainer initialized")
        logger.info(f"Min expert score: {min_expert_score}")
        logger.info(f"Min demonstrations: {min_demonstrations}")

    def fetch_expert_demonstrations(
        self,
        symbol: str = "BTC-USDT",
        limit: int = 10000,
    ) -> List[ExpertDemonstration]:
        """
        Fetch expert demonstrations from database.

        Args:
            symbol: Trading pair filter
            limit: Maximum demonstrations to fetch

        Returns:
            List of expert demonstrations
        """
        logger.info(f"📥 Fetching expert demonstrations for {symbol}...")

        demonstrations = self.db.query(ExpertDemonstration).filter(
            ExpertDemonstration.is_expert_trade == True,
            ExpertDemonstration.expert_score >= self.min_expert_score,
            ExpertDemonstration.symbol == symbol,
        ).order_by(
            ExpertDemonstration.expert_score.desc()
        ).limit(limit).all()

        logger.info(f"✅ Fetched {len(demonstrations)} expert demonstrations")

        if len(demonstrations) < self.min_demonstrations:
            logger.warning(
                f"⚠️ Only {len(demonstrations)} demonstrations available. "
                f"Minimum {self.min_demonstrations} required for training."
            )

        return demonstrations

    def prepare_expert_dataset(
        self,
        demonstrations: List[ExpertDemonstration]
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Convert demonstrations to format required by imitation library.

        Args:
            demonstrations: List of ExpertDemonstration objects

        Returns:
            Tuple of (observations, actions, rewards)
            - observations: (N, 50, 10) array
            - actions: (N,) array of action indices
            - rewards: (N,) array of rewards
        """
        logger.info(f"🔄 Preparing dataset from {len(demonstrations)} demonstrations...")

        observations = []
        actions = []
        rewards = []

        for demo in demonstrations:
            try:
                # Extract observation from JSONB
                obs_data = demo.observation_data
                obs_features = np.array(obs_data['features'])
                obs_shape = tuple(obs_data['shape'])

                # Reshape to original (50, 10) shape
                obs = obs_features.reshape(obs_shape)

                observations.append(obs)
                actions.append(demo.action)
                rewards.append(demo.reward)

            except Exception as e:
                logger.error(f"Error processing demonstration {demo.id}: {e}")
                continue

        observations = np.array(observations, dtype=np.float32)
        actions = np.array(actions, dtype=np.int32)
        rewards = np.array(rewards, dtype=np.float32)

        logger.info(f"✅ Dataset prepared:")
        logger.info(f"   Observations shape: {observations.shape}")
        logger.info(f"   Actions shape: {actions.shape}")
        logger.info(f"   Rewards shape: {rewards.shape}")

        return observations, actions, rewards

    def create_transitions(
        self,
        observations: np.ndarray,
        actions: np.ndarray,
        rewards: np.ndarray,
    ) -> Transitions:
        """
        Create Transitions object for imitation library.

        The Transitions format is required by GAIL algorithm.

        Args:
            observations: Expert observations
            actions: Expert actions
            rewards: Expert rewards

        Returns:
            Transitions object
        """
        # Create next observations (shift by 1)
        # For terminal transitions, next_obs = obs
        next_observations = np.concatenate([
            observations[1:],
            observations[-1:],  # Repeat last observation
        ], axis=0)

        # Create done flags (last transition is terminal)
        dones = np.zeros(len(observations), dtype=bool)
        dones[-1] = True

        # Create Transitions object
        transitions = Transitions(
            obs=observations,
            acts=actions,
            next_obs=next_observations,
            dones=dones,
            infos=np.array([{}] * len(observations)),  # Empty infos
        )

        logger.info(f"✅ Created {len(transitions)} transitions for GAIL")

        return transitions

    def train_gail_model(
        self,
        demonstrations: List[ExpertDemonstration],
        total_timesteps: int = 100000,
        symbol: str = "BTC-USDT",
    ) -> Tuple[PPO, GAIL]:
        """
        Train GAIL model using expert demonstrations.

        Args:
            demonstrations: List of expert demonstrations
            total_timesteps: Training duration
            symbol: Trading pair

        Returns:
            Tuple of (trained_ppo_agent, gail_trainer)
        """
        logger.info(f"🚀 Starting GAIL training...")
        logger.info(f"Total timesteps: {total_timesteps}")

        # Prepare dataset
        observations, actions, rewards = self.prepare_expert_dataset(demonstrations)

        if len(observations) < self.min_demonstrations:
            raise ValueError(
                f"Insufficient demonstrations: {len(observations)} < {self.min_demonstrations}"
            )

        # Create transitions for GAIL
        expert_transitions = self.create_transitions(observations, actions, rewards)

        # Create environment (using dummy historical data)
        # In production, this should use actual market data
        env = self._create_training_environment(symbol)

        # Initialize PPO agent (generator)
        logger.info("🤖 Initializing PPO agent (generator)...")
        ppo_agent = PPO(
            policy="MlpPolicy",
            env=env,
            learning_rate=3e-4,
            n_steps=2048,
            batch_size=64,
            n_epochs=10,
            gamma=0.99,
            gae_lambda=0.95,
            clip_range=0.2,
            ent_coef=0.0,
            verbose=1,
            tensorboard_log="./gail_tensorboard/",
        )

        # Initialize reward network (discriminator)
        logger.info("🎯 Initializing reward network (discriminator)...")
        reward_net = BasicRewardNet(
            observation_space=env.observation_space,
            action_space=env.action_space,
            normalize_input_layer=RunningNorm,
        )

        # Initialize GAIL trainer
        logger.info("🔥 Initializing GAIL trainer...")
        gail_trainer = GAIL(
            demonstrations=expert_transitions,
            demo_batch_size=32,
            gen_replay_buffer_capacity=512,
            n_disc_updates_per_round=4,
            gen_algo=ppo_agent,
            reward_net=reward_net,
        )

        # Train GAIL
        logger.info("📚 Training GAIL model...")
        gail_trainer.train(total_timesteps=total_timesteps)

        logger.info("✅ GAIL training completed!")

        return ppo_agent, gail_trainer

    def _create_training_environment(self, symbol: str) -> gym.Env:
        """
        Create Gym environment for GAIL training.

        In production, this should fetch real historical data.
        For now, we use placeholder data.
        """
        # TODO: Fetch real historical data from database
        # For now, create dummy data
        df = pd.DataFrame({
            'timestamp': pd.date_range(start='2024-01-01', periods=1000, freq='1min'),
            'open': 45000 + np.random.randn(1000) * 100,
            'high': 45100 + np.random.randn(1000) * 100,
            'low': 44900 + np.random.randn(1000) * 100,
            'close': 45000 + np.random.randn(1000) * 100,
            'volume': 100 + np.random.randn(1000) * 10,
        })

        env = CryptoTradingEnv(
            df=df,
            initial_balance=100.0,
            fee_rate=0.001,
            min_order_size_usd=10.0,
            slippage_bps=5.0,
        )

        # Wrap in DummyVecEnv for stable-baselines3
        env = DummyVecEnv([lambda: env])

        return env

    def evaluate_model(
        self,
        model: PPO,
        env: gym.Env,
        n_eval_episodes: int = 10,
    ) -> Dict:
        """
        Evaluate trained GAIL model.

        Args:
            model: Trained PPO model
            env: Evaluation environment
            n_eval_episodes: Number of episodes

        Returns:
            Dict with evaluation metrics
        """
        logger.info(f"📊 Evaluating model on {n_eval_episodes} episodes...")

        mean_reward, std_reward = evaluate_policy(
            model,
            env,
            n_eval_episodes=n_eval_episodes,
            deterministic=True,
        )

        metrics = {
            'mean_reward': float(mean_reward),
            'std_reward': float(std_reward),
            'n_eval_episodes': n_eval_episodes,
        }

        logger.info(f"✅ Evaluation completed:")
        logger.info(f"   Mean reward: {mean_reward:.2f} ± {std_reward:.2f}")

        return metrics

    def save_model(
        self,
        model: PPO,
        model_path: str,
        metadata: Optional[Dict] = None,
    ):
        """
        Save trained GAIL model.

        Args:
            model: Trained PPO model
            model_path: Path to save model
            metadata: Additional metadata to save
        """
        logger.info(f"💾 Saving model to {model_path}...")

        # Save PPO model
        model.save(model_path)

        # Save metadata
        if metadata:
            metadata_path = model_path.replace('.zip', '_metadata.json')
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)

        logger.info(f"✅ Model saved successfully")

    def close(self):
        """Close database connection."""
        self.db.close()


# ============================================================================
# Modal.com Integration
# ============================================================================

def train_gail_with_modal(
    database_url: str,
    symbol: str = "BTC-USDT",
    total_timesteps: int = 100000,
    min_expert_score: float = 70.0,
    model_save_path: str = "/models/gail_crypto_model.zip",
) -> Dict:
    """
    Train GAIL model using Modal.com function.

    This function can be called:
    1. Manually: modal run app.ml.train_gail::train_gail_with_modal
    2. Scheduled: modal.Cron("0 0 * * 0") for weekly training
    3. Triggered: From API endpoint

    Args:
        database_url: PostgreSQL connection string (from Modal secrets)
        symbol: Trading pair
        total_timesteps: Training duration
        min_expert_score: Minimum demonstration quality
        model_save_path: Where to save trained model

    Returns:
        Dict with training results
    """
    logger.info("="  * 70)
    logger.info("🚀 GAIL Training Started (Modal.com)")
    logger.info("=" * 70)

    start_time = datetime.now()

    try:
        # Initialize trainer
        trainer = GAILTrainer(
            database_url=database_url,
            min_expert_score=min_expert_score,
            min_demonstrations=100,
        )

        # Fetch expert demonstrations
        demonstrations = trainer.fetch_expert_demonstrations(
            symbol=symbol,
            limit=10000,
        )

        if len(demonstrations) < trainer.min_demonstrations:
            logger.error(
                f"❌ Insufficient demonstrations: {len(demonstrations)} < {trainer.min_demonstrations}"
            )
            return {
                'status': 'failed',
                'error': 'insufficient_demonstrations',
                'demonstrations_count': len(demonstrations),
            }

        # Train GAIL model
        ppo_agent, gail_trainer = trainer.train_gail_model(
            demonstrations=demonstrations,
            total_timesteps=total_timesteps,
            symbol=symbol,
        )

        # Evaluate model
        env = trainer._create_training_environment(symbol)
        eval_metrics = trainer.evaluate_model(ppo_agent, env, n_eval_episodes=10)

        # Save model
        model_dir = Path(model_save_path).parent
        model_dir.mkdir(parents=True, exist_ok=True)

        metadata = {
            'symbol': symbol,
            'total_timesteps': total_timesteps,
            'demonstrations_count': len(demonstrations),
            'min_expert_score': min_expert_score,
            'evaluation_metrics': eval_metrics,
            'trained_at': datetime.now().isoformat(),
            'training_duration_seconds': (datetime.now() - start_time).total_seconds(),
        }

        trainer.save_model(ppo_agent, model_save_path, metadata=metadata)

        # Cleanup
        trainer.close()

        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        logger.info("=" * 70)
        logger.info(f"✅ GAIL Training Completed in {duration:.1f}s")
        logger.info("=" * 70)

        return {
            'status': 'success',
            'model_path': model_save_path,
            'demonstrations_count': len(demonstrations),
            'evaluation_metrics': eval_metrics,
            'training_duration_seconds': duration,
            'metadata': metadata,
        }

    except Exception as e:
        logger.error(f"❌ GAIL training failed: {e}")
        return {
            'status': 'failed',
            'error': str(e),
        }


if __name__ == "__main__":
    # Local testing
    database_url = os.getenv("DATABASE_URL", "postgresql://localhost/ai_traders_shadow")
    result = train_gail_with_modal(database_url)
    print(json.dumps(result, indent=2))
