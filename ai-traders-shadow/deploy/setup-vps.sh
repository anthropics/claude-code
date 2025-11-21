#!/bin/bash

################################################################################
# VPS Setup Script for AI Trader's Shadow
# Ubuntu 22.04 LTS
#
# This script will:
# 1. Update system packages
# 2. Install Docker and Docker Compose
# 3. Configure firewall (UFW)
# 4. Setup non-root user with Docker permissions
# 5. Install essential tools
# 6. Configure system optimizations
#
# Usage: sudo bash setup-vps.sh
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root (use sudo)"
    exit 1
fi

log_info "Starting VPS setup for AI Trader's Shadow..."
echo ""

################################################################################
# 1. System Update
################################################################################
log_info "Step 1: Updating system packages..."
apt-get update
apt-get upgrade -y
log_success "System packages updated"
echo ""

################################################################################
# 2. Install Essential Tools
################################################################################
log_info "Step 2: Installing essential tools..."
apt-get install -y \
    curl \
    wget \
    git \
    vim \
    nano \
    htop \
    net-tools \
    ufw \
    ca-certificates \
    gnupg \
    lsb-release \
    software-properties-common \
    apt-transport-https \
    build-essential \
    python3 \
    python3-pip

log_success "Essential tools installed"
echo ""

################################################################################
# 3. Install Docker
################################################################################
log_info "Step 3: Installing Docker..."

# Remove old versions if any
apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# Add Docker's official GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# Set up the repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start and enable Docker
systemctl start docker
systemctl enable docker

log_success "Docker installed successfully"
docker --version
docker compose version
echo ""

################################################################################
# 4. Configure Docker (Optional Optimizations)
################################################################################
log_info "Step 4: Configuring Docker..."

# Create Docker daemon config for logging
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
EOF

systemctl restart docker
log_success "Docker configured"
echo ""

################################################################################
# 5. Setup Non-Root User (if not exists)
################################################################################
log_info "Step 5: Setting up application user..."

APP_USER="aitrader"

if id "$APP_USER" &>/dev/null; then
    log_warning "User $APP_USER already exists"
else
    # Create user
    useradd -m -s /bin/bash $APP_USER
    log_success "User $APP_USER created"
fi

# Add user to docker group
usermod -aG docker $APP_USER
log_success "User $APP_USER added to docker group"

# Create app directory
mkdir -p /opt/ai-traders-shadow
chown -R $APP_USER:$APP_USER /opt/ai-traders-shadow
log_success "Application directory created at /opt/ai-traders-shadow"
echo ""

################################################################################
# 6. Configure Firewall (UFW)
################################################################################
log_info "Step 6: Configuring firewall (UFW)..."

# Reset UFW to defaults
ufw --force reset

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (IMPORTANT!)
ufw allow 22/tcp comment 'SSH'

# Allow HTTP and HTTPS
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Allow Docker subnet (optional, for internal communication)
# ufw allow from 172.16.0.0/12 to any

# Enable UFW
ufw --force enable

log_success "Firewall configured"
ufw status
echo ""

################################################################################
# 7. Install Certbot (for SSL certificates)
################################################################################
log_info "Step 7: Installing Certbot for SSL..."

apt-get install -y certbot python3-certbot-nginx

log_success "Certbot installed"
echo ""

################################################################################
# 8. System Optimizations
################################################################################
log_info "Step 8: Applying system optimizations..."

# Increase file limits
cat >> /etc/security/limits.conf <<EOF
# AI Trader's Shadow - Increased limits
* soft nofile 65536
* hard nofile 65536
* soft nproc 65536
* hard nproc 65536
EOF

# Kernel parameters
cat >> /etc/sysctl.conf <<EOF
# AI Trader's Shadow - Network optimizations
net.core.somaxconn = 65536
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 1024 65535
vm.swappiness = 10
EOF

sysctl -p

log_success "System optimizations applied"
echo ""

################################################################################
# 9. Setup Timezone (Optional)
################################################################################
log_info "Step 9: Setting timezone..."

# Set timezone to UTC (change if needed)
timedatectl set-timezone UTC

log_success "Timezone set to $(timedatectl | grep 'Time zone' | awk '{print $3}')"
echo ""

################################################################################
# 10. Create deployment helper scripts
################################################################################
log_info "Step 10: Creating helper scripts..."

# Create logs directory
mkdir -p /var/log/ai-traders-shadow
chown -R $APP_USER:$APP_USER /var/log/ai-traders-shadow

# Create backup directory
mkdir -p /backup/ai-traders-shadow
chown -R $APP_USER:$APP_USER /backup/ai-traders-shadow

log_success "Helper directories created"
echo ""

################################################################################
# Summary
################################################################################
echo "========================================================================"
log_success "VPS Setup Complete!"
echo "========================================================================"
echo ""
echo "System Information:"
echo "  OS: $(lsb_release -d | cut -f2)"
echo "  Kernel: $(uname -r)"
echo "  Docker: $(docker --version | cut -d' ' -f3 | cut -d',' -f1)"
echo "  Docker Compose: $(docker compose version | cut -d' ' -f4)"
echo ""
echo "Application User: $APP_USER"
echo "Application Directory: /opt/ai-traders-shadow"
echo "Logs Directory: /var/log/ai-traders-shadow"
echo "Backup Directory: /backup/ai-traders-shadow"
echo ""
echo "Firewall Status:"
ufw status numbered
echo ""
echo "Next Steps:"
echo "  1. Switch to application user: sudo su - $APP_USER"
echo "  2. Clone repository: git clone <repo-url> /opt/ai-traders-shadow"
echo "  3. Run deployment script: cd /opt/ai-traders-shadow && bash deploy/deploy-app.sh"
echo ""
log_success "Setup script finished successfully!"
