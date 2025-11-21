"""
Test script for ML inference service.

Tests the prediction service without running the full FastAPI server.

Usage:
    python test_inference.py
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.ml_inference.prediction_service import prediction_service
from app.core.logger import logger


async def test_model_loading():
    """Test model loading."""
    logger.info("=" * 80)
    logger.info("TEST 1: Model Loading")
    logger.info("=" * 80)

    model_path = "./models/ppo_crypto_final.zip"

    # Check if model file exists
    if not Path(model_path).exists():
        logger.error(f"❌ Model file not found: {model_path}")
        logger.info("Train a model first: python -m app.ml.train_ppo")
        return False

    # Load model
    success = prediction_service.load_model(model_path)

    if success:
        logger.info("✅ Model loaded successfully")

        # Get model info
        info = prediction_service.get_model_info()
        logger.info(f"Model info: {info}")
        return True
    else:
        logger.error("❌ Failed to load model")
        return False


async def test_prediction():
    """Test prediction generation."""
    logger.info("\n" + "=" * 80)
    logger.info("TEST 2: Prediction Generation")
    logger.info("=" * 80)

    if not prediction_service.is_model_loaded():
        logger.error("❌ Model not loaded, skipping prediction test")
        return False

    symbol = "BTC/USDT"
    logger.info(f"Getting prediction for {symbol}...")

    try:
        prediction = await prediction_service.get_predicted_action(symbol)

        if prediction is None:
            logger.error("❌ Prediction returned None")
            return False

        logger.info("✅ Prediction generated successfully")
        logger.info(f"Result: {prediction}")

        # Verify prediction structure
        required_fields = ['action_id', 'action_name', 'symbol', 'timestamp']
        missing = [f for f in required_fields if f not in prediction]

        if missing:
            logger.error(f"❌ Missing fields in prediction: {missing}")
            return False

        # Verify action is valid
        if prediction['action_id'] not in [0, 1, 2]:
            logger.error(f"❌ Invalid action_id: {prediction['action_id']}")
            return False

        if prediction['action_name'] not in ['HOLD', 'BUY', 'SELL']:
            logger.error(f"❌ Invalid action_name: {prediction['action_name']}")
            return False

        logger.info("✅ Prediction structure valid")
        return True

    except Exception as e:
        logger.error(f"❌ Prediction failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_explanation():
    """Test explanation generation."""
    logger.info("\n" + "=" * 80)
    logger.info("TEST 3: Explanation Generation")
    logger.info("=" * 80)

    if not prediction_service.is_model_loaded():
        logger.error("❌ Model not loaded, skipping explanation test")
        return False

    symbol = "BTC/USDT"

    try:
        prediction = await prediction_service.get_predicted_action(symbol)

        if prediction is None:
            logger.error("❌ Cannot test explanation without prediction")
            return False

        explanation = await prediction_service.get_action_explanation(symbol, prediction)

        if not explanation:
            logger.error("❌ Explanation is empty")
            return False

        logger.info("✅ Explanation generated")
        logger.info(f"Explanation:\n{explanation}")
        return True

    except Exception as e:
        logger.error(f"❌ Explanation failed: {e}")
        return False


async def test_multiple_predictions():
    """Test multiple predictions in sequence."""
    logger.info("\n" + "=" * 80)
    logger.info("TEST 4: Multiple Predictions")
    logger.info("=" * 80)

    if not prediction_service.is_model_loaded():
        logger.error("❌ Model not loaded, skipping multiple predictions test")
        return False

    symbols = ["BTC/USDT", "ETH/USDT"]
    predictions = []

    for symbol in symbols:
        logger.info(f"Predicting for {symbol}...")
        prediction = await prediction_service.get_predicted_action(symbol)

        if prediction is None:
            logger.warning(f"⚠️ Prediction failed for {symbol}")
            continue

        predictions.append(prediction)
        logger.info(
            f"  {symbol}: {prediction['action_name']} "
            f"(price: ${prediction.get('current_price', 'N/A')})"
        )

    if len(predictions) > 0:
        logger.info(f"✅ Generated {len(predictions)}/{len(symbols)} predictions")
        return True
    else:
        logger.error("❌ All predictions failed")
        return False


async def main():
    """Run all tests."""
    logger.info("🧪 Starting ML Inference Service Tests\n")

    results = {
        "Model Loading": await test_model_loading(),
        "Prediction Generation": await test_prediction(),
        "Explanation Generation": await test_explanation(),
        "Multiple Predictions": await test_multiple_predictions(),
    }

    # Summary
    logger.info("\n" + "=" * 80)
    logger.info("TEST SUMMARY")
    logger.info("=" * 80)

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        logger.info(f"{test_name}: {status}")

    logger.info("\n" + "=" * 80)
    logger.info(f"Results: {passed}/{total} tests passed")
    logger.info("=" * 80)

    if passed == total:
        logger.info("\n🎉 All tests passed!")
        return 0
    else:
        logger.error(f"\n❌ {total - passed} test(s) failed")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
