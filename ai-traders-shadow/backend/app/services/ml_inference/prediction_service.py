"""
ML Prediction Service for Real-Time Inference

This service loads the trained PPO model and provides real-time action predictions
based on current market conditions.

Singleton pattern ensures model is loaded only once for efficiency.
"""
import os
from pathlib import Path
from typing import Optional, Dict, Any, List
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

from stable_baselines3 import PPO
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.core.config import settings
from app.services.data_ingestion.cryptofeed_service import cryptofeed_service
from app.services.trading.ccxt_service import ccxt_service


class PredictionService:
    """
    Singleton service for ML model inference.

    Supports multiple models:
    - PPO (Lapis 2): Baseline RL model
    - GAIL (Lapis 3): Imitation learning from expert demonstrations

    Model switching via strategy parameter.
    """

    _instance: Optional['PredictionService'] = None
    _models: Dict[str, Optional[PPO]] = {}  # Support multiple models
    _models_loaded: Dict[str, bool] = {}

    def __new__(cls):
        """Singleton pattern - only one instance allowed."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """Initialize prediction service."""
        # Only initialize once
        if not hasattr(self, '_initialized'):
            self._initialized = True
            self.window_size = 50  # Must match training environment
            self.num_features = 10  # Must match training environment
            self._models = {}
            self._models_loaded = {}
            logger.info("PredictionService initialized (singleton) with multi-model support")

    def load_model(self, model_path: str, model_type: str = "PPO") -> bool:
        """
        Load trained model from file.

        Supports multiple model types:
        - PPO: Baseline RL model
        - GAIL: Imitation learning model

        Args:
            model_path: Path to saved model (.zip file)
            model_type: Model type ('PPO' or 'GAIL')

        Returns:
            True if successful, False otherwise
        """
        model_type = model_type.upper()

        if model_type in self._models_loaded and self._models_loaded[model_type]:
            logger.warning(f"{model_type} model already loaded, skipping reload")
            return True

        try:
            # Check if model file exists
            if not os.path.exists(model_path):
                logger.error(f"Model file not found: {model_path}")
                return False

            logger.info(f"Loading {model_type} model from: {model_path}")

            # Both PPO and GAIL use PPO.load() since GAIL trains a PPO agent
            model = PPO.load(model_path)

            self._models[model_type] = model
            self._models_loaded[model_type] = True

            logger.info(f"✅ {model_type} model loaded successfully")
            logger.info(f"Model policy: {model.policy.__class__.__name__}")

            return True

        except Exception as e:
            logger.error(f"Failed to load {model_type} model: {e}")
            self._models_loaded[model_type] = False
            return False

    def get_model(self, model_type: str = "PPO") -> Optional[PPO]:
        """
        Get the loaded model by type.

        Args:
            model_type: Model type ('PPO' or 'GAIL')

        Returns:
            Loaded model or None if not loaded
        """
        model_type = model_type.upper()

        if not self._models_loaded.get(model_type, False):
            logger.warning(f"{model_type} model not loaded yet")
            return None

        return self._models.get(model_type)

    def is_model_loaded(self, model_type: str = "PPO") -> bool:
        """
        Check if model is loaded.

        Args:
            model_type: Model type ('PPO' or 'GAIL')

        Returns:
            True if loaded, False otherwise
        """
        model_type = model_type.upper()
        return self._models_loaded.get(model_type, False)

    def get_available_models(self) -> List[str]:
        """
        Get list of loaded models.

        Returns:
            List of model types that are loaded
        """
        return [model_type for model_type, loaded in self._models_loaded.items() if loaded]

    async def _prepare_observation_data(
        self,
        symbol: str,
        db: Optional[Session] = None
    ) -> Optional[np.ndarray]:
        """
        Prepare observation data for model prediction.

        CRITICAL: This must produce the EXACT same observation format
        as used during training in CryptoTradingEnv.

        Args:
            symbol: Trading pair symbol (e.g., "BTC/USDT")
            db: Database session (optional, for future use)

        Returns:
            Observation array of shape (window_size, num_features) or None if failed
        """
        try:
            # Convert symbol format for CCXT (BTC-USDT -> BTC/USDT)
            ccxt_symbol = symbol.replace("-", "/")

            # Fetch recent OHLCV data
            logger.debug(f"Fetching recent data for {ccxt_symbol}")

            # Try to get from exchange (fallback if CryptoFeed not running)
            ohlcv = await ccxt_service.exchange.fetch_ohlcv(
                ccxt_symbol,
                timeframe='1m',
                limit=self.window_size + 10  # Extra buffer for normalization
            )

            if not ohlcv or len(ohlcv) < self.window_size:
                logger.error(f"Insufficient data: got {len(ohlcv) if ohlcv else 0} bars, need {self.window_size}")
                return None

            # Convert to DataFrame
            df = pd.DataFrame(
                ohlcv,
                columns=['timestamp', 'open', 'high', 'low', 'close', 'volume']
            )

            # Take last window_size bars
            df = df.tail(self.window_size).reset_index(drop=True)

            # Prepare features (MUST MATCH training environment)
            features = []

            # 1. Normalized OHLCV (same as training)
            for col in ['open', 'high', 'low', 'close', 'volume']:
                if col in df.columns:
                    values = df[col].values
                    # Normalize by first value (same as training)
                    if values[0] != 0:
                        normalized = values / values[0]
                    else:
                        normalized = values
                    features.append(normalized)

            # 2. Position state (for inference, we assume no position)
            # During training, this was: position_value / initial_balance
            # For inference without active position, set to 0
            position_ratio = 0.0
            features.append(np.full(self.window_size, position_ratio))

            # Stack features to create observation
            observation = np.column_stack(features).astype(np.float32)

            # Ensure correct shape
            if observation.shape != (self.window_size, self.num_features):
                # Pad or trim to match expected shape
                if observation.shape[1] < self.num_features:
                    padding = np.zeros((self.window_size, self.num_features - observation.shape[1]))
                    observation = np.hstack([observation, padding])
                elif observation.shape[1] > self.num_features:
                    observation = observation[:, :self.num_features]

            logger.debug(f"Observation prepared: shape={observation.shape}")
            return observation

        except Exception as e:
            logger.error(f"Error preparing observation data: {e}")
            return None

    async def get_predicted_action(
        self,
        symbol: str,
        strategy: str = "PPO",
        deterministic: bool = True
    ) -> Optional[Dict[str, Any]]:
        """
        Get predicted action from selected model.

        Supports multiple strategies:
        - PPO (Lapis 2): Baseline RL model
        - GAIL (Lapis 3): Imitation learning model trained on expert demonstrations

        Args:
            symbol: Trading pair symbol (e.g., "BTC-USDT" or "BTC/USDT")
            strategy: Model type to use ('PPO' or 'GAIL')
            deterministic: Use deterministic policy (True for production)

        Returns:
            Dictionary with:
                - action_id: int (0=HOLD, 1=BUY, 2=SELL)
                - action_name: str ('HOLD', 'BUY', 'SELL')
                - confidence: float (not available in PPO/GAIL, placeholder)
                - timestamp: datetime
                - strategy: str (model type used)
            Or None if prediction failed
        """
        strategy = strategy.upper()

        # Check if requested model is loaded
        if not self.is_model_loaded(strategy):
            logger.error(f"Cannot predict: {strategy} model not loaded")
            logger.info(f"Available models: {self.get_available_models()}")
            return None

        try:
            # Get the model
            model = self.get_model(strategy)

            if model is None:
                logger.error(f"Failed to get {strategy} model")
                return None

            # Prepare observation
            observation = await self._prepare_observation_data(symbol)

            if observation is None:
                logger.error("Failed to prepare observation data")
                return None

            # Get prediction from model
            action, _states = model.predict(observation, deterministic=deterministic)

            # Convert action to int (in case it's numpy type)
            action = int(action)

            # Map action ID to name
            action_map = {
                0: 'HOLD',
                1: 'BUY',
                2: 'SELL'
            }

            action_name = action_map.get(action, 'UNKNOWN')

            # Get current price for context
            current_price = None
            try:
                ticker = await ccxt_service.fetch_ticker(symbol.replace("-", "/"))
                current_price = ticker.get("last")
            except:
                pass

            result = {
                'action_id': action,
                'action_name': action_name,
                'symbol': symbol,
                'current_price': current_price,
                'confidence': None,  # PPO/GAIL don't provide confidence scores
                'timestamp': datetime.utcnow(),
                'strategy': strategy,  # PPO or GAIL
                'model_version': f'{strategy.lower()}_v1',
            }

            logger.info(
                f"Prediction [{strategy}] for {symbol}: {action_name} (action_id={action})"
                + (f" @ ${current_price:.2f}" if current_price else "")
            )

            return result

        except Exception as e:
            logger.error(f"Error during prediction: {e}")
            return None

    async def get_action_explanation(
        self,
        symbol: str,
        action: Dict[str, Any]
    ) -> str:
        """
        Generate human-readable explanation for predicted action.

        Args:
            symbol: Trading pair symbol
            action: Prediction result from get_predicted_action()

        Returns:
            Human-readable explanation string
        """
        action_name = action.get('action_name', 'UNKNOWN')
        current_price = action.get('current_price')

        # Base explanations
        explanations = {
            'HOLD': "Model recommends holding current position. Market conditions suggest waiting for better entry/exit.",
            'BUY': "Model identifies potential buying opportunity based on recent price patterns and market structure.",
            'SELL': "Model suggests taking profit or exiting position based on current market conditions.",
        }

        explanation = explanations.get(action_name, "Unknown action.")

        # Add price context if available
        if current_price:
            explanation += f" Current price: ${current_price:.2f}"

        # Add disclaimer
        explanation += "\n\n⚠️ Remember: This is AI guidance for PAPER TRADING only. Always verify with your own analysis."

        return explanation

    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about all loaded models.

        Returns:
            Dictionary with model metadata for each loaded model
        """
        available_models = self.get_available_models()

        if not available_models:
            return {
                'loaded': False,
                'error': 'No models loaded',
                'available_models': []
            }

        models_info = {}

        for model_type in available_models:
            model = self.get_model(model_type)
            if model:
                models_info[model_type] = {
                    'loaded': True,
                    'model_type': model_type,
                    'policy': model.policy.__class__.__name__,
                    'observation_space': str(model.observation_space),
                    'action_space': str(model.action_space),
                }

        return {
            'loaded': True,
            'available_models': available_models,
            'models': models_info,
            'window_size': self.window_size,
            'num_features': self.num_features,
        }


# Global singleton instance
prediction_service = PredictionService()
