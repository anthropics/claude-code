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
    include_explanation: bool = False
):
    """
    Get ML prediction for a trading symbol.

    Args:
        symbol: Trading pair symbol (e.g., "BTC-USDT" or "BTC/USDT")
        include_explanation: Include human-readable explanation

    Returns:
        Prediction with action recommendation
    """
    if not prediction_service.is_model_loaded():
        raise HTTPException(
            status_code=503,
            detail="ML model not loaded. Train a model first: python -m app.ml.train_ppo"
        )

    logger.info(f"Prediction request for {symbol}")

    prediction = await prediction_service.get_predicted_action(symbol)

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
async def check_model_health():
    """
    Check if ML model is loaded and ready.

    Returns:
        Health status of ML inference service
    """
    is_loaded = prediction_service.is_model_loaded()

    return {
        "status": "healthy" if is_loaded else "unavailable",
        "model_loaded": is_loaded,
        "service": "ML Prediction Service",
        "message": "Model ready for predictions" if is_loaded else "Model not loaded"
    }
