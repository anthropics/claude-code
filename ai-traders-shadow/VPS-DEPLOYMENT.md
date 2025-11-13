# VPS Deployment Guide - AI Trader's Shadow

Complete step-by-step guide to deploy AI Trader's Shadow to a production VPS.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [VPS Setup](#vps-setup)
3. [Deploy Application](#deploy-application)
4. [Setup Domain & SSL](#setup-domain--ssl)
5. [Post-Deployment](#post-deployment)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### VPS Requirements

- **Provider:** DigitalOcean, Linode, Vultr, AWS, or any VPS provider
- **OS:** Ubuntu 22.04 LTS (recommended)
- **RAM:** Minimum 4GB, recommended 8GB
- **CPU:** Minimum 2 cores, recommended 4 cores
- **Storage:** Minimum 50GB SSD
- **Network:** Static IP address

### Local Requirements

- SSH client (Terminal on Mac/Linux, PuTTY on Windows)
- Git repository with your code
- Domain name (optional but recommended)

### Accounts Needed

- VPS provider account
- Domain registrar (if using custom domain)
- Email for SSL certificates

---

## VPS Setup

### Step 1: Create VPS Instance

**DigitalOcean Example:**

```bash
# Create a droplet
# - OS: Ubuntu 22.04 LTS
# - Plan: Basic ($24/month - 4GB RAM, 2 CPU)
# - Region: Choose closest to your users
# - Authentication: SSH keys (recommended) or Password
```

### Step 2: Initial Connection

```bash
# Connect to your VPS
ssh root@YOUR_VPS_IP

# Example:
ssh root@159.89.123.45
```

### Step 3: Update SSH Configuration (Security)

```bash
# Edit SSH config
nano /etc/ssh/sshd_config

# Change these settings:
PermitRootLogin no              # Disable root login after creating user
PasswordAuthentication no       # Use SSH keys only (more secure)
Port 22                        # Or change to custom port

# Restart SSH
systemctl restart sshd
```

### Step 4: Run VPS Setup Script

```bash
# Clone repository (or download scripts)
git clone https://github.com/YOUR_USERNAME/ai-traders-shadow.git
cd ai-traders-shadow

# Run setup script as root
sudo bash deploy/setup-vps.sh
```

**What this script does:**
- ✅ Updates system packages
- ✅ Installs Docker & Docker Compose
- ✅ Configures firewall (UFW)
- ✅ Creates application user (`aitrader`)
- ✅ Installs Certbot for SSL
- ✅ Applies system optimizations
- ✅ Creates necessary directories

**Expected time:** 5-10 minutes

### Step 5: Verify Setup

```bash
# Check Docker
docker --version
docker compose version

# Check firewall
sudo ufw status

# Expected output:
# Status: active
#
# To                         Action      From
# --                         ------      ----
# 22/tcp                     ALLOW       Anywhere
# 80/tcp                     ALLOW       Anywhere
# 443/tcp                    ALLOW       Anywhere
```

---

## Deploy Application

### Step 1: Switch to Application User

```bash
# Switch to aitrader user
sudo su - aitrader

# You should now be in /home/aitrader
pwd
# Output: /home/aitrader
```

### Step 2: Clone Repository

```bash
# Clone to application directory
git clone https://github.com/YOUR_USERNAME/ai-traders-shadow.git /opt/ai-traders-shadow

# Or if already cloned as root, fix permissions:
sudo chown -R aitrader:aitrader /opt/ai-traders-shadow

cd /opt/ai-traders-shadow
```

### Step 3: Setup Environment Variables

```bash
# Copy environment template
cp .env.prod.example .env.prod

# Edit environment variables
nano .env.prod
```

**Critical variables to set:**

```bash
# Database
DB_PASSWORD=your_strong_database_password_here

# Security (generate with: python3 -c "import secrets; print(secrets.token_urlsafe(32))")
SECRET_KEY=your_strong_secret_key_here_minimum_32_characters

# Exchange API (optional for paper trading)
EXCHANGE_API_KEY=your_binance_api_key
EXCHANGE_API_SECRET=your_binance_api_secret

# Telegram Bot (optional)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_ADMIN_CHAT_ID=your_telegram_chat_id
```

**Generate strong secrets:**

```bash
# Generate DB password
python3 -c "import secrets; print('DB_PASSWORD=' + secrets.token_urlsafe(16))"

# Generate secret key
python3 -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(32))"
```

### Step 4: Setup ML Model

**Option A: Train on VPS (slow, not recommended for small VPS)**

```bash
cd /opt/ai-traders-shadow/backend
python3 -m app.ml.train_ppo
```

**Option B: Upload trained model (recommended)**

```bash
# From your local machine:
scp backend/models/ppo_crypto_final.zip aitrader@YOUR_VPS_IP:/opt/ai-traders-shadow/backend/models/

# Or use SFTP, rsync, etc.
```

### Step 5: Run Deployment Script

```bash
cd /opt/ai-traders-shadow

# Run deployment script
bash deploy/deploy-app.sh
```

**What this script does:**
- ✅ Validates prerequisites
- ✅ Checks environment variables
- ✅ Verifies ML model exists
- ✅ Builds Docker images
- ✅ Starts all services
- ✅ Runs health checks

**Expected time:** 5-15 minutes (depending on VPS specs)

### Step 6: Verify Deployment

```bash
# Check services
docker compose -f docker-compose.prod.yml ps

# Expected output (all services "Up" and "healthy"):
# NAME                        STATUS           PORTS
# ai_traders_db_prod          Up (healthy)     5432/tcp
# ai_traders_backend_prod     Up (healthy)
# ai_traders_frontend_prod    Up (healthy)
# ai_traders_nginx_prod       Up (healthy)     80/tcp

# Test endpoints
curl http://localhost/health          # Should return "healthy"
curl http://localhost/api/health      # Should return API health status

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

### Step 7: Access Application

Get your VPS IP:

```bash
curl ifconfig.me
```

Access in browser:
- **Dashboard:** `http://YOUR_VPS_IP`
- **API Docs:** `http://YOUR_VPS_IP/docs`

---

## Setup Domain & SSL

### Step 1: Configure DNS

Point your domain to your VPS IP:

**DNS Records to add:**

```
Type: A
Name: @
Value: YOUR_VPS_IP
TTL: 3600

Type: A
Name: www
Value: YOUR_VPS_IP
TTL: 3600
```

**Verify DNS propagation:**

```bash
# Check if domain points to your IP
dig +short yourdomain.com

# Should return YOUR_VPS_IP
```

Wait 5-60 minutes for DNS propagation.

### Step 2: Update docker-compose for SSL

**Edit `docker-compose.prod.yml`:**

```bash
nano /opt/ai-traders-shadow/docker-compose.prod.yml
```

**Add SSL volumes to nginx service:**

```yaml
nginx:
  build:
    context: ./nginx
    dockerfile: Dockerfile
  container_name: ai_traders_nginx_prod
  restart: unless-stopped
  depends_on:
    - backend
    - frontend
  ports:
    - "80:80"
    - "443:443"     # Add this line
  volumes:          # Add these lines
    - /etc/letsencrypt:/etc/letsencrypt:ro
    - /var/www/certbot:/var/www/certbot:ro
  networks:
    - ai_traders_network
```

### Step 3: Run SSL Setup Script

```bash
# Switch to root
exit  # Exit from aitrader user
sudo su

# Run SSL setup
cd /opt/ai-traders-shadow
bash deploy/setup-ssl.sh yourdomain.com your-email@example.com

# Example:
bash deploy/setup-ssl.sh aitraders.com admin@aitraders.com
```

**What this script does:**
- ✅ Validates DNS configuration
- ✅ Obtains SSL certificate from Let's Encrypt
- ✅ Creates Nginx SSL configuration
- ✅ Updates docker-compose with SSL volumes
- ✅ Restarts services with HTTPS
- ✅ Sets up auto-renewal (cron job)

**Expected time:** 2-5 minutes

### Step 4: Update Environment for HTTPS

```bash
# Edit .env.prod
nano /opt/ai-traders-shadow/.env.prod
```

**Update these variables:**

```bash
CORS_ORIGINS='["https://yourdomain.com", "https://www.yourdomain.com"]'
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
NEXT_PUBLIC_WS_URL=wss://yourdomain.com/ws
```

### Step 5: Restart Services

```bash
cd /opt/ai-traders-shadow
sudo su - aitrader
docker compose -f docker-compose.prod.yml restart
```

### Step 6: Verify HTTPS

Visit in browser:
- **Dashboard:** `https://yourdomain.com`
- **API Docs:** `https://yourdomain.com/docs`

Check SSL grade:
- https://www.ssllabs.com/ssltest/analyze.html?d=yourdomain.com

---

## Post-Deployment

### Security Hardening

**1. Enable Fail2Ban (Brute Force Protection)**

```bash
sudo apt-get install -y fail2ban

# Create config
sudo cat > /etc/fail2ban/jail.local <<EOF
[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600
EOF

sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

**2. Setup Unattended Upgrades (Auto Security Updates)**

```bash
sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

**3. Disable Root Login**

```bash
sudo nano /etc/ssh/sshd_config

# Set:
PermitRootLogin no

sudo systemctl restart sshd
```

### Monitoring Setup

**1. Install monitoring tools**

```bash
# Install htop for resource monitoring
sudo apt-get install -y htop

# Install netdata (comprehensive monitoring)
bash <(curl -Ss https://my-netdata.io/kickstart.sh)

# Access netdata at: http://YOUR_VPS_IP:19999
```

**2. Setup log monitoring**

```bash
# View application logs
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend

# Setup log rotation (already configured in Docker)
```

### Backup Setup

**1. Database Backup Script**

Already created at: `/opt/ai-traders-shadow/deploy/backup-db.sh`

```bash
# Run manual backup
bash /opt/ai-traders-shadow/deploy/backup-db.sh
```

**2. Setup Automated Backups**

```bash
# Add to crontab (daily at 2 AM)
crontab -e

# Add this line:
0 2 * * * /opt/ai-traders-shadow/deploy/backup-db.sh >> /var/log/ai-traders-backup.log 2>&1
```

---

## Monitoring & Maintenance

### Daily Checks

```bash
# Check service status
docker compose -f docker-compose.prod.yml ps

# Check disk usage
df -h

# Check memory usage
free -h

# Check system load
uptime
```

### View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100 backend
```

### Restart Services

```bash
# Restart all services
docker compose -f docker-compose.prod.yml restart

# Restart specific service
docker compose -f docker-compose.prod.yml restart backend
```

### Update Application

```bash
# Pull latest code
cd /opt/ai-traders-shadow
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build
```

### Database Maintenance

```bash
# Backup database
bash deploy/backup-db.sh

# Connect to database
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d ai_traders_shadow

# Check database size
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d ai_traders_shadow -c "SELECT pg_size_pretty(pg_database_size('ai_traders_shadow'));"
```

---

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs

# Check specific service
docker compose -f docker-compose.prod.yml logs backend

# Restart services
docker compose -f docker-compose.prod.yml restart
```

### SSL Certificate Issues

```bash
# Check certificate
sudo certbot certificates

# Renew manually
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Clean Docker
docker system prune -a --volumes

# Remove old logs
sudo journalctl --vacuum-time=7d
```

### High Memory Usage

```bash
# Check container stats
docker stats

# Restart services to clear memory
docker compose -f docker-compose.prod.yml restart
```

### Database Connection Issues

```bash
# Check database is running
docker compose -f docker-compose.prod.yml exec db pg_isready -U postgres

# Check connection from backend
docker compose -f docker-compose.prod.yml exec backend python -c "
import psycopg2
conn = psycopg2.connect('postgresql://postgres:password@db:5432/ai_traders_shadow')
print('Connection successful!')
"
```

---

## Quick Command Reference

```bash
# Service Management
docker compose -f docker-compose.prod.yml up -d              # Start all services
docker compose -f docker-compose.prod.yml down               # Stop all services
docker compose -f docker-compose.prod.yml restart            # Restart all services
docker compose -f docker-compose.prod.yml ps                 # Check status

# Logs
docker compose -f docker-compose.prod.yml logs -f            # Follow all logs
docker compose -f docker-compose.prod.yml logs backend       # Backend logs only
docker compose -f docker-compose.prod.yml logs --tail=100    # Last 100 lines

# Updates
git pull origin main                                         # Pull latest code
docker compose -f docker-compose.prod.yml up -d --build      # Rebuild and restart

# Backup
bash deploy/backup-db.sh                                     # Backup database

# SSL
sudo certbot renew                                           # Renew SSL certificate
sudo certbot certificates                                    # Check certificates

# System
htop                                                         # Resource monitor
df -h                                                        # Disk usage
free -h                                                      # Memory usage
docker system prune -a                                       # Clean Docker
```

---

## Support

If you encounter issues:

1. Check logs: `docker compose -f docker-compose.prod.yml logs`
2. Review this guide's troubleshooting section
3. Check firewall: `sudo ufw status`
4. Verify DNS: `dig +short yourdomain.com`
5. Test endpoints: `curl http://localhost/health`

---

## Summary

✅ **VPS Setup:** System configured with Docker, firewall, and optimizations
✅ **Application Deployed:** All services running in Docker containers
✅ **Domain & SSL:** HTTPS enabled with Let's Encrypt
✅ **Monitoring:** Logs and health checks configured
✅ **Backups:** Automated database backups scheduled
✅ **Security:** Firewall, SSH hardening, auto-updates enabled

**Your AI Trader's Shadow is now live in production! 🚀**
