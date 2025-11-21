"""
ML Prediction endpoints.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.services.ml_inference.prediction_service import prediction_service
from app.core.logger import logger

router = APIRouter()


class PredictionResponse(BaseModel):
    """Response schema for prediction."""
    action_id: int
    action_name: str
    symbol: str
    current_price: Optional[float]
    confidence: Optional[float]
    timestamp: datetime
    strategy: str  # PPO or GAIL
    model_version: str
    explanation: Optional[str] = None


class ModelInfoResponse(BaseModel):
    """Response schema for model info."""
    loaded: bool
    model_type: Optional[str] = None
    policy: Optional[str] = None
    observation_space: Optional[str] = None
    action_space: Optional[str] = None
    window_size: Optional[int] = None
    num_features: Optional[int] = None
    error: Optional[str] = None


@router.get("/predict/{symbol}", response_model=PredictionResponse)
async def get_prediction(
    symbol: str,
    strategy: str = "PPO",
    include_explanation: bool = False
):
    """
    Get ML prediction for a trading symbol.

    Supports multiple strategies:
    - PPO (Lapis 2): Baseline RL model
    - GAIL (Lapis 3): Imitation learning from expert demonstrations

    Args:
        symbol: Trading pair symbol (e.g., "BTC-USDT" or "BTC/USDT")
        strategy: Model to use - "PPO" or "GAIL" (default: "PPO")
        include_explanation: Include human-readable explanation

    Returns:
        Prediction with action recommendation
    """
    strategy = strategy.upper()

    # Check if requested model is loaded
    if not prediction_service.is_model_loaded(strategy):
        available_models = prediction_service.get_available_models()
        raise HTTPException(
            status_code=503,
            detail=f"{strategy} model not loaded. Available models: {available_models}. "
                   f"Train model first: python -m app.ml.train_ppo (for PPO) or "
                   f"python -m app.ml.train_gail (for GAIL)"
        )

    logger.info(f"Prediction request for {symbol} using strategy: {strategy}")

    prediction = await prediction_service.get_predicted_action(symbol, strategy=strategy)

    if prediction is None:
        raise HTTPException(
            status_code=500,
            detail="Failed to generate prediction. Check logs for details."
        )

    # Add explanation if requested
    explanation = None
    if include_explanation:
        explanation = await prediction_service.get_action_explanation(symbol, prediction)

    return PredictionResponse(
        **prediction,
        explanation=explanation
    )


@router.get("/model/info", response_model=ModelInfoResponse)
async def get_model_info():
    """
    Get information about the loaded ML model.

    Returns:
        Model metadata and configuration
    """
    info = prediction_service.get_model_info()
    return ModelInfoResponse(**info)


@router.get("/model/health")
async def check_model_health(strategy: str = "PPO"):
    """
    Check if ML model is loaded and ready.

    Args:
        strategy: Model type to check - "PPO" or "GAIL" (default: "PPO")

    Returns:
        Health status of ML inference service
    """
    strategy = strategy.upper()
    is_loaded = prediction_service.is_model_loaded(strategy)
    available_models = prediction_service.get_available_models()

    return {
        "status": "healthy" if is_loaded else "unavailable",
        "model_loaded": is_loaded,
        "strategy": strategy,
        "available_models": available_models,
        "service": "ML Prediction Service",
        "message": f"{strategy} model ready for predictions" if is_loaded else f"{strategy} model not loaded"
    }
