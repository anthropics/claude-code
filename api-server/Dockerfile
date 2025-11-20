FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy server code
COPY server.py .

# Expose port
EXPOSE 8000

# Set environment variables (can be overridden)
ENV HOST=0.0.0.0
ENV PORT=8000
ENV ENABLE_AUTH=true
ENV CLAUDE_CODE_PATH=claude
ENV DEFAULT_WORKING_DIR=/workspace

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run server
CMD ["python", "server.py"]
