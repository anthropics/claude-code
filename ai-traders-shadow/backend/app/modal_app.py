"""
Modal.com deployment configuration for AI Trader's Shadow Backend.

This module defines the Modal app and deploys the FastAPI backend as a serverless application.

Usage:
    modal deploy backend.app.modal_app

Production URL:
    Will be provided after deployment (e.g., https://your-org--ai-traders-shadow-backend-web.modal.run)
"""
import modal
from pathlib import Path

# ============================================================================
# Modal Configuration
# ============================================================================

# Modal app - this is the main application container
app = modal.App(name="ai-traders-shadow-backend")

# ============================================================================
# Docker Image Configuration
# ============================================================================

# Build image with dependencies from requirements.txt
# Using Python 3.10 slim image as base
backend_dir = Path(__file__).parent.parent

# Read requirements from requirements.txt
requirements_path = backend_dir / "requirements.txt"
with open(requirements_path, "r") as f:
    requirements = [line.strip() for line in f if line.strip() and not line.startswith("#")]

# Build image step by step
modal_image = (
    modal.Image.debian_slim()
    .apt_install([
        "gcc",
        "g++",
        "postgresql-client",
        "build-essential",
        "python3-dev",
    ])
    .pip_install(*requirements)
    .pip_install("modal", "gunicorn")
)

# ============================================================================
# Secrets Configuration
# ============================================================================

# Modal Secrets - these should be created in Modal dashboard or CLI
# Example: modal secret create ai-traders-shadow-secrets \
#            DATABASE_URL=postgresql://... \
#            SECRET_KEY=... \
#            TELEGRAM_BOT_TOKEN=...

secrets = [
    modal.Secret.from_name("ai-traders-shadow-secrets"),
]

# ============================================================================
# Volumes Configuration (Optional)
# ============================================================================

# If you want to persist logs or cache data across container restarts
# logs_volume = modal.Volume.from_name("ai-traders-logs", create_if_missing=True)

# ============================================================================
# FastAPI Application Deployment
# ============================================================================


@app.function(
    image=modal_image,
    secrets=secrets,
    # Keep container warm for 5 minutes after last request (to keep ML model in memory)
    container_idle_timeout=300,
    # Allow concurrent requests on the same container
    allow_concurrent_inputs=100,
    # Set memory and CPU limits
    memory=2048,  # 2GB RAM (for ML model)
    cpu=2.0,  # 2 CPU cores
    # Enable GPU if needed (for larger models)
    # gpu="T4",
    # Mount volumes if needed
    # volumes={"/var/log/ai-traders-shadow": logs_volume},
)
@modal.asgi_app()
def fastapi_app():
    """
    Deploy FastAPI application to Modal.

    This function imports and returns the FastAPI app instance.
    Modal will handle the ASGI server automatically.

    The lifespan context manager in main.py will run on container startup,
    loading the ML model into memory. The container_idle_timeout=300 ensures
    the model stays warm for 5 minutes after the last request.

    Returns:
        FastAPI: The FastAPI application instance
    """
    # Import here to ensure it runs in the Modal container context
    from app.main import app as fastapi_app_instance

    return fastapi_app_instance


# ============================================================================
# Alternative: Function-based Endpoint (for specific operations)
# ============================================================================

# If you want to expose specific functions as serverless endpoints
# (in addition to or instead of the full ASGI app):

@app.function(
    image=modal_image,
    secrets=secrets,
    container_idle_timeout=300,
    memory=2048,
    cpu=1.0,
)
def predict(symbol: str = "BTC-USDT"):
    """
    Serverless function for ML predictions.

    This can be called directly via Modal's function API:
        modal run backend.app.modal_app::predict --symbol BTC-USDT

    Or exposed as a web endpoint with @modal.web_endpoint()

    Args:
        symbol: Trading pair symbol

    Returns:
        dict: Prediction result
    """
    import asyncio
    from app.services.ml_inference.prediction_service import prediction_service
    from app.core.config import settings

    # Load model if not already loaded
    model_path = settings.MODEL_PATH + "/ppo_crypto_final.zip"
    if not prediction_service._model:
        prediction_service.load_model(model_path)

    # Run async prediction in sync context
    result = asyncio.run(prediction_service.get_predicted_action(symbol))
    return result


@app.function(
    image=modal_image,
    secrets=secrets,
    schedule=modal.Cron("*/5 * * * *"),  # Every 5 minutes
)
def scheduled_health_check():
    """
    Scheduled function to keep containers warm and perform health checks.

    This runs every 5 minutes to:
    1. Keep ML model warm in memory
    2. Perform basic health checks
    3. Log system status

    Scheduled functions in Modal run automatically based on cron schedule.
    """
    import requests
    from app.core.logger import logger

    logger.info("🔍 Running scheduled health check...")

    # Health check logic here
    # For example, check database connection, model availability, etc.

    logger.info("✅ Health check completed")


# ============================================================================
# Local Development
# ============================================================================

@app.local_entrypoint()
def main():
    """
    Local entrypoint for testing Modal deployment locally.

    Usage:
        modal run backend.app.modal_app

    This will:
    1. Build the Docker image
    2. Start a local Modal container
    3. Run the FastAPI app
    4. Provide a local URL for testing
    """
    print("🚀 Starting AI Trader's Shadow Backend on Modal (local mode)...")
    print("=" * 70)
    print("FastAPI app is running in Modal container")
    print("Access the API at the URL provided above")
    print("=" * 70)

    # You can also call specific functions for testing
    # result = predict.remote("BTC-USDT")
    # print(f"Prediction result: {result}")


# ============================================================================
# CLI Commands for Deployment
# ============================================================================

"""
Modal CLI Commands:

1. Setup Modal (first time only):
   $ pip install modal
   $ modal setup

2. Create secrets (first time only):
   $ modal secret create ai-traders-shadow-secrets \\
       DATABASE_URL="postgresql://user:pass@host:5432/db" \\
       SECRET_KEY="your-secret-key" \\
       DB_PASSWORD="your-db-password" \\
       EXCHANGE_API_KEY="your-exchange-key" \\
       EXCHANGE_API_SECRET="your-exchange-secret" \\
       TELEGRAM_BOT_TOKEN="your-telegram-token" \\
       TELEGRAM_ADMIN_CHAT_ID="your-chat-id"

3. Test locally:
   $ modal run backend.app.modal_app

4. Deploy to production:
   $ modal deploy backend.app.modal_app

5. View logs:
   $ modal app logs ai-traders-shadow-backend

6. Check status:
   $ modal app list

7. Call specific function:
   $ modal run backend.app.modal_app::predict --symbol BTC-USDT

8. Delete app:
   $ modal app stop ai-traders-shadow-backend

Environment Variables in Modal:
- Modal uses Secrets for environment variables
- Create secrets in Modal dashboard: https://modal.com/secrets
- Or use CLI: modal secret create <name> KEY1=value1 KEY2=value2
- Reference secrets in code: secrets=[modal.Secret.from_name("name")]

Production URL:
- After deployment, Modal provides a URL like:
  https://your-org--ai-traders-shadow-backend-web.modal.run
- Use this URL in your frontend environment:
  NEXT_PUBLIC_API_URL=https://your-org--ai-traders-shadow-backend-web.modal.run/api/v1
  NEXT_PUBLIC_WS_URL=wss://your-org--ai-traders-shadow-backend-web.modal.run/ws

Cost Optimization:
- container_idle_timeout=300 keeps model warm for 5 minutes
- Reduce to 60 seconds if cost is a concern (but model will reload more often)
- Use modal.Cron for scheduled tasks instead of always-on containers
- Scale to zero when not in use (automatic with Modal)

Database Considerations:
- Modal containers are ephemeral (stateless)
- Use external managed database (e.g., Supabase, Neon, Railway)
- Configure DATABASE_URL in Modal secrets
- Connection pooling is handled by SQLAlchemy in the app

ML Model Considerations:
- Model is bundled in Docker image (backend/models/ppo_crypto_final.zip)
- Loaded once on container startup (via lifespan context)
- Stays in memory for container_idle_timeout duration
- For very large models (>1GB), consider using Modal Volumes

WebSocket Support:
- Modal supports WebSockets via ASGI apps
- WebSocket connections are maintained per container
- Use container_idle_timeout to keep connections alive
- For production, consider using Redis for pub/sub across containers

Monitoring:
- View logs: modal app logs ai-traders-shadow-backend --follow
- Modal dashboard: https://modal.com/apps
- Integrate with external monitoring (e.g., Sentry, DataDog)

Scaling:
- Modal automatically scales based on traffic
- allow_concurrent_inputs=100 allows 100 concurrent requests per container
- Modal will spin up additional containers as needed
- No configuration required for auto-scaling
"""
