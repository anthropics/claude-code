"""
Simplified Modal deployment for AI Trader's Shadow Backend.

This is a minimal, working deployment that can be extended.

Usage:
    python -m modal deploy modal_simple
"""
import modal
import os

# Create the Modal app
app = modal.App(name="ai-traders-shadow-backend")

# Build a Docker image with dependencies
image = (
    modal.Image.debian_slim()
    .pip_install(
        "fastapi==0.109.0",
        "uvicorn[standard]==0.27.0",
        "pydantic==2.5.3",
        "pydantic-settings==2.1.0",
        "python-multipart==0.0.6",
        "httpx==0.26.0",
        "websockets==12.0",
    )
)


@app.function(image=image, max_containers=100)
@modal.asgi_app()
def web():
    """Simple FastAPI app deployed to Modal."""
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    
    app_instance = FastAPI(title="AI Trader's Shadow Backend")
    
    @app_instance.get("/health")
    async def health():
        return JSONResponse({"status": "healthy", "service": "ai-traders-shadow-backend"})
    
    @app_instance.get("/")
    async def root():
        return JSONResponse({
            "message": "AI Trader's Shadow Backend",
            "version": "0.1.0",
            "endpoints": {
                "health": "/health",
                "api_docs": "/docs",
                "redoc": "/redoc"
            }
        })
    
    @app_instance.get("/api/status")
    async def status():
        return JSONResponse({
            "status": "running",
            "model": "PPO",
            "database": "Supabase"
        })
    
    return app_instance
