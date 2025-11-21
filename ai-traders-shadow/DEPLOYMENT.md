# Production Deployment Guide - AI Trader's Shadow

This guide explains how to deploy the complete AI Trader's Shadow application stack to production using Docker and Docker Compose.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Pre-Deployment Checklist](#pre-deployment-checklist)
4. [Deployment Steps](#deployment-steps)
5. [Environment Configuration](#environment-configuration)
6. [Running the Application](#running-the-application)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)
8. [Troubleshooting](#troubleshooting)
9. [Scaling Considerations](#scaling-considerations)

---

## Architecture Overview

The production deployment consists of 4 main services:

```
┌──────────────────────────────────────────────────────────┐
│                    Nginx (Port 80)                        │
│              Reverse Proxy & Load Balancer               │
└──────────┬───────────────────────────┬───────────────────┘
           │                           │
           ▼                           ▼
┌──────────────────────┐    ┌──────────────────────┐
│  FastAPI Backend     │    │  Next.js Frontend    │
│  (Port 8000)         │    │  (Port 3000)         │
│  - API Endpoints     │    │  - Dashboard UI      │
│  - WebSocket         │    │  - Real-time UI      │
│  - ML Inference      │    └──────────────────────┘
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  TimescaleDB         │
│  (Port 5432)         │
│  - Time-series Data  │
│  - User Data         │
└──────────────────────┘
```

**Traffic Flow:**
- All external traffic → Nginx (Port 80)
- `/api/*` → Backend FastAPI
- `/ws/*` → Backend WebSocket
- `/*` → Frontend Next.js
- Backend → Database (TimescaleDB)

---

## Prerequisites

### System Requirements

- **Operating System:** Linux (Ubuntu 20.04+, Debian 11+, CentOS 8+)
- **CPU:** Minimum 2 cores, recommended 4+ cores
- **RAM:** Minimum 4GB, recommended 8GB+
- **Storage:** Minimum 20GB free space
- **Network:** Stable internet connection

### Software Requirements

1. **Docker** (version 20.10+)
   ```bash
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh

   # Verify installation
   docker --version
   ```

2. **Docker Compose** (version 2.0+)
   ```bash
   # Docker Compose is included with Docker Desktop
   # For Linux servers:
   sudo apt-get update
   sudo apt-get install docker-compose-plugin

   # Verify installation
   docker compose version
   ```

3. **Git**
   ```bash
   sudo apt-get install git
   ```

---

## Pre-Deployment Checklist

Before deploying to production, ensure you have:

- [ ] Trained ML model (`backend/models/ppo_crypto_final.zip`)
- [ ] Production environment variables configured
- [ ] Database backup strategy planned
- [ ] Domain name configured (if applicable)
- [ ] SSL certificate ready (if using HTTPS)
- [ ] Monitoring solution prepared
- [ ] Backup and disaster recovery plan

---

## Deployment Steps

### 1. Clone the Repository

```bash
# Clone the repository
git clone <your-repo-url>
cd ai-traders-shadow

# Or pull latest changes if already cloned
git pull origin main
```

### 2. Verify ML Model

Ensure the trained ML model exists:

```bash
ls -lh backend/models/ppo_crypto_final.zip
```

If the model doesn't exist, train it first:

```bash
cd backend
python -m app.ml.train_ppo
```

### 3. Configure Environment Variables

Create production environment file:

```bash
cp .env.prod.example .env.prod
```

Edit `.env.prod` with your production values:

```bash
nano .env.prod
# or
vim .env.prod
```

**IMPORTANT:** Generate strong secrets:

```bash
# Generate SECRET_KEY
python3 -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(32))"

# Generate DB_PASSWORD
python3 -c "import secrets; print('DB_PASSWORD=' + secrets.token_urlsafe(16))"
```

### 4. Update Docker Compose for Environment

Load environment variables:

```bash
export $(cat .env.prod | xargs)
```

Or modify `docker-compose.prod.yml` to use `.env.prod`:

```yaml
# Add at the top of docker-compose.prod.yml
env_file:
  - .env.prod
```

### 5. Build Docker Images

Build all images:

```bash
docker compose -f docker-compose.prod.yml build --no-cache
```

This will:
- Build backend image with ML model
- Build frontend image (multi-stage build)
- Build nginx reverse proxy

**Expected build time:** 5-15 minutes depending on internet speed and CPU.

### 6. Initialize Database

Run database initialization:

```bash
# Start only the database first
docker compose -f docker-compose.prod.yml up -d db

# Wait for database to be ready
docker compose -f docker-compose.prod.yml exec db pg_isready -U postgres

# Verify schema was created
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d ai_traders_shadow -c "\dt"
```

You should see tables like:
- `users`
- `trades_paper`
- `market_data_1m`
- `agent_status_log`
- etc.

---

## Running the Application

### Start All Services

```bash
# Start all services in detached mode
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f

# View logs for specific service
docker compose -f docker-compose.prod.yml logs -f backend
```

### Verify Services Are Running

```bash
# Check service status
docker compose -f docker-compose.prod.yml ps

# Expected output:
# NAME                          STATUS              PORTS
# ai_traders_db_prod            Up (healthy)        0.0.0.0:5432->5432/tcp
# ai_traders_backend_prod       Up (healthy)
# ai_traders_frontend_prod      Up (healthy)
# ai_traders_nginx_prod         Up (healthy)        0.0.0.0:80->80/tcp
```

### Health Checks

```bash
# Check Nginx health
curl http://localhost/health

# Check backend API health
curl http://localhost/api/health

# Check frontend
curl http://localhost/

# Check backend directly (from host)
curl http://localhost:8000/health
```

### Access the Application

- **Web Dashboard:** http://localhost (or http://your-domain.com)
- **API Documentation:** http://localhost/docs
- **API Alternative Docs:** http://localhost/redoc

---

## Environment Configuration

### Backend Environment Variables

See `backend/.env.example` for all available options.

Key production settings:

```bash
# Security
DEBUG=false
SECRET_KEY=<strong-secret-key>

# Database
DATABASE_URL=postgresql://postgres:<password>@db:5432/ai_traders_shadow

# CORS (adjust for your domain)
CORS_ORIGINS='["http://yourdomain.com", "https://yourdomain.com"]'

# Exchange API
EXCHANGE_API_KEY=<your-api-key>
EXCHANGE_API_SECRET=<your-api-secret>
EXCHANGE_TESTNET=true  # Use testnet for safety
```

### Frontend Environment Variables

```bash
# Production API URLs (via Nginx)
NEXT_PUBLIC_API_URL=http://localhost/api
NEXT_PUBLIC_WS_URL=ws://localhost/ws

# For production with domain:
# NEXT_PUBLIC_API_URL=https://yourdomain.com/api
# NEXT_PUBLIC_WS_URL=wss://yourdomain.com/ws
```

---

## Monitoring and Maintenance

### View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service with tail
docker compose -f docker-compose.prod.yml logs -f --tail=100 backend

# Backend logs (stored in volume)
docker compose -f docker-compose.prod.yml exec backend ls -la /app/logs
```

### Database Backup

```bash
# Create backup
docker compose -f docker-compose.prod.yml exec db pg_dump -U postgres ai_traders_shadow > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
docker compose -f docker-compose.prod.yml exec -T db psql -U postgres ai_traders_shadow < backup_20240113_120000.sql
```

### Update Application

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build

# Or rebuild specific service
docker compose -f docker-compose.prod.yml up -d --build backend
```

### Stop Services

```bash
# Stop all services
docker compose -f docker-compose.prod.yml down

# Stop and remove volumes (⚠️ WARNING: This deletes all data!)
docker compose -f docker-compose.prod.yml down -v
```

---

## Troubleshooting

### Services Won't Start

1. **Check logs:**
   ```bash
   docker compose -f docker-compose.prod.yml logs
   ```

2. **Verify environment variables:**
   ```bash
   docker compose -f docker-compose.prod.yml config
   ```

3. **Check port conflicts:**
   ```bash
   sudo netstat -tulpn | grep :80
   sudo netstat -tulpn | grep :5432
   ```

### Backend Can't Connect to Database

```bash
# Check database is healthy
docker compose -f docker-compose.prod.yml ps db

# Test connection from backend
docker compose -f docker-compose.prod.yml exec backend python -c "
import psycopg2
conn = psycopg2.connect('postgresql://postgres:password@db:5432/ai_traders_shadow')
print('Connection successful!')
"
```

### Frontend Can't Connect to Backend

1. **Check Nginx configuration:**
   ```bash
   docker compose -f docker-compose.prod.yml exec nginx nginx -t
   ```

2. **Verify backend is running:**
   ```bash
   docker compose -f docker-compose.prod.yml exec nginx wget -O- http://backend:8000/health
   ```

3. **Check browser console** for CORS errors

### ML Model Not Loading

```bash
# Check model file exists in container
docker compose -f docker-compose.prod.yml exec backend ls -lh /app/models/

# Check backend logs for model loading
docker compose -f docker-compose.prod.yml logs backend | grep -i "model"
```

### High Memory Usage

```bash
# Check resource usage
docker stats

# Limit resources in docker-compose.prod.yml:
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          memory: 1G
```

---

## Scaling Considerations

### Horizontal Scaling (Multiple Instances)

For high traffic, scale services:

```bash
# Scale backend to 3 instances
docker compose -f docker-compose.prod.yml up -d --scale backend=3

# Nginx will automatically load balance
```

### Database Optimization

1. **Connection Pooling:** Already configured in SQLAlchemy
2. **Indexes:** Created in `schema.sql`
3. **Continuous Aggregates:** Pre-computed for performance

### Caching Layer

Consider adding Redis for:
- Session management
- Rate limiting
- Caching API responses

```yaml
# Add to docker-compose.prod.yml
redis:
  image: redis:alpine
  container_name: ai_traders_redis_prod
  restart: unless-stopped
  networks:
    - ai_traders_network
```

### Production Checklist

- [ ] Enable HTTPS with SSL certificate
- [ ] Configure firewall (UFW/iptables)
- [ ] Set up monitoring (Prometheus, Grafana)
- [ ] Configure log rotation
- [ ] Set up automated backups
- [ ] Implement rate limiting
- [ ] Configure alerting
- [ ] Document runbooks
- [ ] Set up CI/CD pipeline

---

## Security Hardening

### 1. Use HTTPS (SSL/TLS)

Use Let's Encrypt with Certbot:

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com
```

### 2. Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 3. Environment Secrets

Never commit `.env.prod` to git:

```bash
# Add to .gitignore
echo ".env.prod" >> .gitignore
```

### 4. Regular Updates

```bash
# Update Docker images regularly
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

---

## Conclusion

You now have a fully containerized production deployment of AI Trader's Shadow. The application is accessible at `http://localhost` or your configured domain.

**Next Steps:**
1. Configure domain and SSL
2. Set up monitoring
3. Configure automated backups
4. Set up CI/CD pipeline
5. Load test the application

For questions or issues, refer to the main [README.md](./README.md) or check the logs.

**Happy Trading! 🚀📈**
