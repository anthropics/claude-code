"""
FastAPI server for executing Claude Code commands via HTTP API.

This server provides REST endpoints to:
- Execute Claude Code commands
- Stream responses in real-time
- Handle authentication via API keys
"""

import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime

from fastapi import FastAPI, HTTPException, Depends, Header, status
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn


# Configuration
API_KEY = os.getenv("CLAUDE_API_KEY", "")
CLAUDE_CODE_PATH = os.getenv("CLAUDE_CODE_PATH", "claude")
DEFAULT_WORKING_DIR = os.getenv("DEFAULT_WORKING_DIR", os.getcwd())
ENABLE_AUTH = os.getenv("ENABLE_AUTH", "true").lower() == "true"


# Request/Response Models
class ExecuteRequest(BaseModel):
    """Request model for executing Claude Code commands."""
    prompt: str = Field(..., description="The prompt/task for Claude Code to execute")
    working_directory: Optional[str] = Field(None, description="Working directory for execution")
    session_id: Optional[str] = Field(None, description="Optional session ID for continuity")
    stream: bool = Field(False, description="Enable streaming response")
    timeout: Optional[int] = Field(300, description="Timeout in seconds (default: 300)")
    env_vars: Optional[Dict[str, str]] = Field(None, description="Additional environment variables")


class ExecuteResponse(BaseModel):
    """Response model for Claude Code execution."""
    success: bool = Field(..., description="Whether execution was successful")
    output: str = Field(..., description="Complete output from Claude Code")
    error: Optional[str] = Field(None, description="Error message if execution failed")
    exit_code: int = Field(..., description="Exit code from Claude Code process")
    execution_time: float = Field(..., description="Execution time in seconds")
    timestamp: str = Field(..., description="ISO timestamp of execution")


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = Field(..., description="Service status")
    version: str = Field(..., description="API version")
    claude_code_available: bool = Field(..., description="Whether Claude Code is accessible")


# FastAPI App
app = FastAPI(
    title="Claude Code API Server",
    description="HTTP API for executing Claude Code commands",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Authentication
async def verify_api_key(x_api_key: Optional[str] = Header(None)):
    """Verify API key from request headers."""
    if not ENABLE_AUTH:
        return True

    if not API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server authentication not configured"
        )

    if not x_api_key or x_api_key != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key"
        )

    return True


# Utility functions
def check_claude_code_available() -> bool:
    """Check if Claude Code CLI is available."""
    try:
        result = subprocess.run(
            [CLAUDE_CODE_PATH, "--version"],
            capture_output=True,
            timeout=5
        )
        return result.returncode == 0
    except Exception:
        return False


async def execute_claude_code(
    prompt: str,
    working_directory: Optional[str] = None,
    timeout: Optional[int] = 300,
    env_vars: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Execute Claude Code with the given prompt.

    Args:
        prompt: The task/prompt for Claude Code
        working_directory: Directory to execute in
        timeout: Timeout in seconds
        env_vars: Additional environment variables

    Returns:
        Dictionary with execution results
    """
    start_time = datetime.now()
    work_dir = working_directory or DEFAULT_WORKING_DIR

    # Prepare environment
    env = os.environ.copy()
    if env_vars:
        env.update(env_vars)

    # Prepare command
    cmd = [CLAUDE_CODE_PATH]

    try:
        # Execute Claude Code
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=work_dir,
            env=env
        )

        # Send prompt and get output
        stdout, stderr = await asyncio.wait_for(
            process.communicate(input=prompt.encode()),
            timeout=timeout
        )

        end_time = datetime.now()
        execution_time = (end_time - start_time).total_seconds()

        output = stdout.decode('utf-8', errors='replace')
        error_output = stderr.decode('utf-8', errors='replace')

        return {
            "success": process.returncode == 0,
            "output": output,
            "error": error_output if error_output else None,
            "exit_code": process.returncode,
            "execution_time": execution_time,
            "timestamp": start_time.isoformat()
        }

    except asyncio.TimeoutError:
        end_time = datetime.now()
        execution_time = (end_time - start_time).total_seconds()

        return {
            "success": False,
            "output": "",
            "error": f"Execution timed out after {timeout} seconds",
            "exit_code": -1,
            "execution_time": execution_time,
            "timestamp": start_time.isoformat()
        }

    except Exception as e:
        end_time = datetime.now()
        execution_time = (end_time - start_time).total_seconds()

        return {
            "success": False,
            "output": "",
            "error": str(e),
            "exit_code": -1,
            "execution_time": execution_time,
            "timestamp": start_time.isoformat()
        }


async def stream_claude_code(
    prompt: str,
    working_directory: Optional[str] = None,
    env_vars: Optional[Dict[str, str]] = None
):
    """
    Stream Claude Code output in real-time.

    Yields lines of output as they become available.
    """
    work_dir = working_directory or DEFAULT_WORKING_DIR

    # Prepare environment
    env = os.environ.copy()
    if env_vars:
        env.update(env_vars)

    # Prepare command
    cmd = [CLAUDE_CODE_PATH]

    try:
        # Start process
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=work_dir,
            env=env
        )

        # Send prompt
        process.stdin.write(prompt.encode())
        process.stdin.close()

        # Stream output
        while True:
            line = await process.stdout.readline()
            if not line:
                break

            yield line.decode('utf-8', errors='replace')

        # Wait for process to complete
        await process.wait()

        # Send final status
        yield f"\n[Execution completed with exit code: {process.returncode}]\n"

    except Exception as e:
        yield f"\n[Error during execution: {str(e)}]\n"


# API Endpoints
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        claude_code_available=check_claude_code_available()
    )


@app.post("/api/execute", response_model=ExecuteResponse)
async def execute(
    request: ExecuteRequest,
    authenticated: bool = Depends(verify_api_key)
):
    """
    Execute a Claude Code command and return the complete response.

    Requires X-API-Key header for authentication (if ENABLE_AUTH=true).
    """
    if request.stream:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use /api/execute/stream endpoint for streaming responses"
        )

    result = await execute_claude_code(
        prompt=request.prompt,
        working_directory=request.working_directory,
        timeout=request.timeout,
        env_vars=request.env_vars
    )

    return ExecuteResponse(**result)


@app.post("/api/execute/stream")
async def execute_stream(
    request: ExecuteRequest,
    authenticated: bool = Depends(verify_api_key)
):
    """
    Execute a Claude Code command and stream the response in real-time.

    Requires X-API-Key header for authentication (if ENABLE_AUTH=true).
    Returns a text/event-stream response.
    """
    return StreamingResponse(
        stream_claude_code(
            prompt=request.prompt,
            working_directory=request.working_directory,
            env_vars=request.env_vars
        ),
        media_type="text/event-stream"
    )


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "Claude Code API Server",
        "version": "1.0.0",
        "endpoints": {
            "health": "GET /health",
            "execute": "POST /api/execute",
            "execute_stream": "POST /api/execute/stream"
        },
        "documentation": "/docs"
    }


# Main entry point
if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")

    print(f"Starting Claude Code API Server on {host}:{port}")
    print(f"Authentication: {'enabled' if ENABLE_AUTH else 'disabled'}")
    print(f"Claude Code path: {CLAUDE_CODE_PATH}")
    print(f"Default working directory: {DEFAULT_WORKING_DIR}")
    print(f"\nAPI Documentation: http://{host}:{port}/docs")

    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info"
    )
