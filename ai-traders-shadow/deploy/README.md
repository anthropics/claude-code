# Deployment Scripts - AI Trader's Shadow

This directory contains all scripts needed for VPS deployment and management.

## 📁 Files Overview

| Script | Purpose | Usage |
|--------|---------|-------|
| `setup-vps.sh` | Initial VPS setup (Docker, firewall, users) | `sudo bash setup-vps.sh` |
| `deploy-app.sh` | Deploy/update application | `bash deploy-app.sh` |
| `setup-ssl.sh` | Configure SSL with Let's Encrypt | `sudo bash setup-ssl.sh <domain> <email>` |
| `backup-db.sh` | Backup database | `bash backup-db.sh` |
| `health-check.sh` | System health monitoring | `bash health-check.sh` |
| `monitor.sh` | Interactive monitoring TUI | `bash monitor.sh` |

---

## 🚀 Quick Start Deployment

### 1. Initial VPS Setup (Run Once)

```bash
# SSH into your VPS
ssh root@YOUR_VPS_IP

# Clone repository
git clone https://github.com/YOUR_USERNAME/ai-traders-shadow.git
cd ai-traders-shadow

# Run VPS setup (installs Docker, firewall, etc.)
sudo bash deploy/setup-vps.sh
```

**Time:** ~5-10 minutes

### 2. Deploy Application

```bash
# Switch to app user
sudo su - aitrader

# Go to app directory
cd /opt/ai-traders-shadow

# Setup environment
cp .env.prod.example .env.prod
nano .env.prod  # Edit with your values

# Deploy
bash deploy/deploy-app.sh
```

**Time:** ~5-15 minutes

### 3. Setup SSL (Optional but Recommended)

```bash
# Point your domain to VPS IP first!
# Then run (as root):
sudo bash deploy/setup-ssl.sh yourdomain.com your-email@example.com
```

**Time:** ~2-5 minutes

---

## 📖 Detailed Script Documentation

### setup-vps.sh

**Purpose:** Prepare a fresh Ubuntu 22.04 VPS for deployment

**What it does:**
- ✅ Updates system packages
- ✅ Installs Docker & Docker Compose
- ✅ Configures UFW firewall (ports 22, 80, 443)
- ✅ Creates `aitrader` user with Docker permissions
- ✅ Installs Certbot for SSL
- ✅ Applies system optimizations (file limits, network tuning)
- ✅ Creates directories (/opt/ai-traders-shadow, /backup, /var/log)

**Usage:**
```bash
sudo bash deploy/setup-vps.sh
```

**Requirements:**
- Ubuntu 22.04 LTS
- Root access
- Minimum 4GB RAM

**Post-script:**
- Switch to `aitrader` user: `sudo su - aitrader`
- Clone repository
- Run `deploy-app.sh`

---

### deploy-app.sh

**Purpose:** Build and start the application

**What it does:**
- ✅ Validates prerequisites (Docker, environment)
- ✅ Checks ML model exists
- ✅ Builds Docker images
- ✅ Starts all services (db, backend, frontend, nginx)
- ✅ Runs health checks
- ✅ Displays service URLs

**Usage:**
```bash
cd /opt/ai-traders-shadow
bash deploy/deploy-app.sh
```

**Before running:**
1. Ensure `.env.prod` is configured
2. ML model exists at `backend/models/ppo_crypto_final.zip`

**After deployment:**
- Access: `http://YOUR_VPS_IP`
- API docs: `http://YOUR_VPS_IP/docs`

---

### setup-ssl.sh

**Purpose:** Configure HTTPS with Let's Encrypt SSL

**What it does:**
- ✅ Validates DNS configuration
- ✅ Obtains SSL certificate from Let's Encrypt
- ✅ Creates Nginx SSL configuration (HTTP→HTTPS redirect)
- ✅ Updates docker-compose with SSL volumes
- ✅ Restarts services with HTTPS
- ✅ Sets up auto-renewal cron job (daily at 3 AM)

**Usage:**
```bash
sudo bash deploy/setup-ssl.sh yourdomain.com your-email@example.com
```

**Prerequisites:**
- Domain must point to VPS IP (A record)
- Port 80 must be accessible
- Run as root

**After setup:**
- Access: `https://yourdomain.com`
- Certificate auto-renews every 90 days

---

### backup-db.sh

**Purpose:** Backup TimescaleDB database

**What it does:**
- ✅ Creates timestamped SQL dump
- ✅ Compresses with gzip
- ✅ Stores in `/backup/ai-traders-shadow/`
- ✅ Cleans backups older than 7 days
- ✅ Logs backup status

**Usage:**
```bash
bash deploy/backup-db.sh
```

**Automation (Cron):**
```bash
# Add to crontab (daily at 2 AM)
crontab -e

# Add this line:
0 2 * * * /opt/ai-traders-shadow/deploy/backup-db.sh >> /var/log/ai-traders-backup.log 2>&1
```

**Restore backup:**
```bash
gunzip -c /backup/ai-traders-shadow/db_backup_20240113_020000.sql.gz | \
docker compose -f docker-compose.prod.yml exec -T db psql -U postgres ai_traders_shadow
```

---

### health-check.sh

**Purpose:** Comprehensive health monitoring

**What it checks:**
- ✅ Docker service status (all 4 containers)
- ✅ Health endpoints (HTTP)
- ✅ Database connectivity
- ✅ Disk space (alert if >80%)
- ✅ Memory usage (alert if >80%)
- ✅ CPU load
- ✅ Container stats

**Usage:**
```bash
bash deploy/health-check.sh
```

**Automation (Cron - every 5 minutes):**
```bash
crontab -e

# Add this line:
*/5 * * * * /opt/ai-traders-shadow/deploy/health-check.sh >> /var/log/ai-traders-health.log 2>&1
```

**Configure email alerts:**
Edit script and set:
```bash
ALERT_EMAIL="admin@yourdomain.com"
```

**Logs:**
- Location: `/var/log/ai-traders-shadow/health-check.log`

---

### monitor.sh

**Purpose:** Interactive monitoring dashboard (TUI)

**Features:**
1. **Service Status** - Container status
2. **Live Logs** - Follow logs (all/backend/frontend)
3. **Resource Stats** - Real-time CPU/Memory per container
4. **Health Check** - Run health checks
5. **Recent Errors** - Show error logs
6. **Database Status** - Connection, size, recent trades
7. **System Resources** - CPU, memory, disk, network

**Usage:**
```bash
bash deploy/monitor.sh
```

**Navigation:**
- Select option 1-9
- Press Ctrl+C to exit live logs
- Press Enter to return to menu

---

## 🔧 Common Tasks

### Update Application

```bash
cd /opt/ai-traders-shadow
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

### Restart Services

```bash
# All services
docker compose -f docker-compose.prod.yml restart

# Specific service
docker compose -f docker-compose.prod.yml restart backend
```

### View Logs

```bash
# All services (live)
docker compose -f docker-compose.prod.yml logs -f

# Backend only
docker compose -f docker-compose.prod.yml logs -f backend

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100
```

### Database Operations

```bash
# Backup
bash deploy/backup-db.sh

# Connect to database
docker compose -f docker-compose.prod.yml exec db psql -U postgres ai_traders_shadow

# Check size
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d ai_traders_shadow -c "SELECT pg_size_pretty(pg_database_size('ai_traders_shadow'));"
```

### SSL Certificate Management

```bash
# Check certificates
sudo certbot certificates

# Renew manually
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run
```

### System Cleanup

```bash
# Clean Docker (free disk space)
docker system prune -a --volumes

# Clean logs
sudo journalctl --vacuum-time=7d

# Clean old backups
find /backup/ai-traders-shadow -type f -mtime +30 -delete
```

---

## 🔐 Security Best Practices

1. **SSH Hardening**
   ```bash
   # Disable root login
   sudo nano /etc/ssh/sshd_config
   # Set: PermitRootLogin no
   sudo systemctl restart sshd
   ```

2. **Firewall Check**
   ```bash
   sudo ufw status
   # Only 22, 80, 443 should be open
   ```

3. **Fail2Ban (Brute Force Protection)**
   ```bash
   sudo apt-get install fail2ban
   sudo systemctl enable fail2ban
   ```

4. **Auto Updates**
   ```bash
   sudo apt-get install unattended-upgrades
   sudo dpkg-reconfigure -plow unattended-upgrades
   ```

5. **Strong Passwords**
   - Use generated passwords for `.env.prod`
   - Never commit `.env.prod` to git
   - Rotate secrets regularly

---

## 📊 Monitoring Setup

### Option 1: Built-in Health Checks

```bash
# Add to crontab
crontab -e

# Health check every 5 minutes
*/5 * * * * /opt/ai-traders-shadow/deploy/health-check.sh >> /var/log/ai-traders-health.log 2>&1

# Daily backup at 2 AM
0 2 * * * /opt/ai-traders-shadow/deploy/backup-db.sh >> /var/log/ai-traders-backup.log 2>&1
```

### Option 2: Netdata (Advanced)

```bash
# Install Netdata
sudo bash <(curl -Ss https://my-netdata.io/kickstart.sh)

# Access at: http://YOUR_VPS_IP:19999
```

### Option 3: Prometheus + Grafana (Production)

See: [MONITORING.md](../docs/MONITORING.md) (if available)

---

## 🆘 Troubleshooting

### Services won't start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs

# Check specific service
docker compose -f docker-compose.prod.yml logs backend

# Restart
docker compose -f docker-compose.prod.yml restart
```

### Out of disk space

```bash
# Check usage
df -h

# Clean Docker
docker system prune -a --volumes

# Clean logs
sudo journalctl --vacuum-time=7d
```

### SSL certificate issues

```bash
# Check certificate
sudo certbot certificates

# Renew
sudo certbot renew

# Check Nginx config
docker compose -f docker-compose.prod.yml exec nginx nginx -t
```

### Database connection failed

```bash
# Check database is running
docker compose -f docker-compose.prod.yml ps db

# Test connection
docker compose -f docker-compose.prod.yml exec db pg_isready -U postgres
```

### High memory usage

```bash
# Check stats
docker stats

# Restart services
docker compose -f docker-compose.prod.yml restart
```

---

## 📞 Support

For detailed deployment guide, see:
- [VPS-DEPLOYMENT.md](../VPS-DEPLOYMENT.md) - Complete deployment walkthrough
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Docker deployment guide

---

## ✅ Deployment Checklist

- [ ] VPS setup completed (`setup-vps.sh`)
- [ ] Application deployed (`deploy-app.sh`)
- [ ] Environment variables configured (`.env.prod`)
- [ ] SSL certificate obtained (`setup-ssl.sh`)
- [ ] Automated backups scheduled (cron)
- [ ] Health checks scheduled (cron)
- [ ] Firewall configured (UFW)
- [ ] SSH hardened (no root, key-only)
- [ ] Monitoring setup (Netdata/custom)
- [ ] Domain DNS configured
- [ ] Tested: `https://yourdomain.com`

---

**Happy Deploying! 🚀**
