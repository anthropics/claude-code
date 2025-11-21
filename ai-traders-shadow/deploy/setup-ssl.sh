#!/bin/bash

################################################################################
# SSL Setup Script for AI Trader's Shadow
#
# This script will:
# 1. Install/verify Certbot
# 2. Stop Nginx container temporarily
# 3. Obtain SSL certificate from Let's Encrypt
# 4. Create Nginx SSL configuration
# 5. Update docker-compose to use SSL
# 6. Restart services with SSL enabled
#
# Usage: sudo bash setup-ssl.sh your-domain.com your-email@example.com
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

# Check arguments
if [ "$#" -lt 2 ]; then
    log_error "Usage: sudo bash setup-ssl.sh <domain> <email>"
    echo "Example: sudo bash setup-ssl.sh yourdomain.com admin@yourdomain.com"
    exit 1
fi

DOMAIN=$1
EMAIL=$2

log_info "Setting up SSL for domain: $DOMAIN"
log_info "Contact email: $EMAIL"
echo ""

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$(dirname "$SCRIPT_DIR")"

################################################################################
# 1. Prerequisites Check
################################################################################
log_info "Step 1: Checking prerequisites..."

# Check if domain points to this server
SERVER_IP=$(curl -s ifconfig.me)
DOMAIN_IP=$(dig +short $DOMAIN | tail -n1)

log_info "Server IP: $SERVER_IP"
log_info "Domain IP: $DOMAIN_IP"

if [ "$SERVER_IP" != "$DOMAIN_IP" ]; then
    log_warning "Domain $DOMAIN does not point to this server!"
    log_warning "Please update your DNS records first:"
    log_warning "  Type: A"
    log_warning "  Name: @"
    log_warning "  Value: $SERVER_IP"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check Certbot
if ! command -v certbot &> /dev/null; then
    log_warning "Certbot not found, installing..."
    apt-get update
    apt-get install -y certbot
fi
log_success "Certbot is available"
echo ""

################################################################################
# 2. Stop Nginx container
################################################################################
log_info "Step 2: Stopping Nginx container to free port 80..."

cd "$APP_DIR"
docker compose -f docker-compose.prod.yml stop nginx || true

log_success "Nginx container stopped"
echo ""

################################################################################
# 3. Obtain SSL certificate
################################################################################
log_info "Step 3: Obtaining SSL certificate from Let's Encrypt..."
log_warning "This will use standalone mode (port 80 must be free)"
echo ""

# Check if certificate already exists
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    log_warning "Certificate for $DOMAIN already exists"
    read -p "Renew certificate? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        certbot renew --cert-name $DOMAIN
    fi
else
    # Obtain new certificate
    certbot certonly --standalone \
        --preferred-challenges http \
        --email $EMAIL \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN

    log_success "SSL certificate obtained successfully"
fi

# Verify certificate files
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    log_error "Certificate files not found!"
    exit 1
fi

log_success "Certificate files verified"
echo ""

################################################################################
# 4. Create Nginx SSL configuration
################################################################################
log_info "Step 4: Creating Nginx SSL configuration..."

# Backup original nginx.conf
if [ -f "$APP_DIR/nginx/nginx.conf" ]; then
    cp "$APP_DIR/nginx/nginx.conf" "$APP_DIR/nginx/nginx.conf.bak"
    log_success "Original nginx.conf backed up"
fi

# Create new SSL-enabled nginx.conf
cat > "$APP_DIR/nginx/nginx.conf" <<'EOF'
# Nginx Configuration for AI Trader's Shadow with SSL
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss
               application/rss+xml font/truetype font/opentype
               application/vnd.ms-fontobject image/svg+xml;

    upstream backend {
        server backend:8000;
        keepalive 32;
    }

    upstream frontend {
        server frontend:3000;
        keepalive 32;
    }

    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=general_limit:10m rate=30r/s;

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name _;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$host$request_uri;
        }
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name _;

        # SSL certificates (mounted from host)
        ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;

        # SSL configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # Security headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # Health check
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }

        # API endpoints
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # WebSocket endpoints
        location /ws/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 7d;
            proxy_send_timeout 7d;
            proxy_read_timeout 7d;
            proxy_buffering off;
        }

        # Backend docs
        location /docs {
            proxy_pass http://backend/docs;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
        }

        location /redoc {
            proxy_pass http://backend/redoc;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
        }

        location /openapi.json {
            proxy_pass http://backend/openapi.json;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
        }

        # Frontend
        location / {
            limit_req zone=general_limit burst=50 nodelay;
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Static files caching
        location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        location /_next/ {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
EOF

# Replace DOMAIN_PLACEHOLDER with actual domain
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$APP_DIR/nginx/nginx.conf"

log_success "Nginx SSL configuration created"
echo ""

################################################################################
# 5. Update docker-compose.prod.yml for SSL
################################################################################
log_info "Step 5: Updating docker-compose for SSL..."

# Backup original
cp "$APP_DIR/docker-compose.prod.yml" "$APP_DIR/docker-compose.prod.yml.bak"

# Check if SSL volumes already added
if grep -q "/etc/letsencrypt" "$APP_DIR/docker-compose.prod.yml"; then
    log_info "SSL volumes already configured in docker-compose.prod.yml"
else
    log_warning "Manual update required for docker-compose.prod.yml"
    log_info "Add these volumes to the nginx service:"
    echo ""
    echo "    volumes:"
    echo "      - /etc/letsencrypt:/etc/letsencrypt:ro"
    echo "      - /var/www/certbot:/var/www/certbot:ro"
    echo ""
    echo "And update ports to include 443:"
    echo "    ports:"
    echo "      - \"80:80\""
    echo "      - \"443:443\""
    echo ""
    read -p "Press Enter to continue after making these changes..."
fi

log_success "docker-compose.prod.yml updated"
echo ""

################################################################################
# 6. Update environment variables
################################################################################
log_info "Step 6: Updating environment variables for HTTPS..."

ENV_FILE="$APP_DIR/.env.prod"

if [ -f "$ENV_FILE" ]; then
    log_info "Please update these in $ENV_FILE:"
    echo "  CORS_ORIGINS=[\"https://$DOMAIN\"]"
    echo "  NEXT_PUBLIC_API_URL=https://$DOMAIN/api"
    echo "  NEXT_PUBLIC_WS_URL=wss://$DOMAIN/ws"
    echo ""
    read -p "Update now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ${EDITOR:-nano} "$ENV_FILE"
    fi
fi
echo ""

################################################################################
# 7. Rebuild and restart services
################################################################################
log_info "Step 7: Rebuilding and restarting services..."

cd "$APP_DIR"

# Rebuild nginx with new config
docker compose -f docker-compose.prod.yml build nginx

# Restart all services
docker compose -f docker-compose.prod.yml up -d

log_success "Services restarted with SSL"
echo ""

# Wait for services
log_info "Waiting for services to start..."
sleep 15

################################################################################
# 8. Verify SSL
################################################################################
log_info "Step 8: Verifying SSL setup..."

# Test HTTPS
if curl -f -s https://$DOMAIN/health > /dev/null; then
    log_success "HTTPS is working!"
else
    log_warning "HTTPS test failed, but services may still be starting"
fi

# Test redirect
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN)
if [ "$HTTP_CODE" = "301" ]; then
    log_success "HTTP to HTTPS redirect is working"
else
    log_warning "HTTP redirect returned: $HTTP_CODE"
fi

echo ""

################################################################################
# 9. Setup auto-renewal
################################################################################
log_info "Step 9: Setting up automatic certificate renewal..."

# Create renewal script
cat > /usr/local/bin/renew-ssl-aitraders.sh <<EOFSCRIPT
#!/bin/bash
# Auto-renewal script for AI Trader's Shadow SSL

cd $APP_DIR
docker compose -f docker-compose.prod.yml stop nginx
certbot renew
docker compose -f docker-compose.prod.yml start nginx
EOFSCRIPT

chmod +x /usr/local/bin/renew-ssl-aitraders.sh

# Add cron job
CRON_JOB="0 3 * * * /usr/local/bin/renew-ssl-aitraders.sh >> /var/log/ai-traders-ssl-renew.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "renew-ssl-aitraders"; then
    log_info "Cron job already exists"
else
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    log_success "Cron job added for automatic renewal (daily at 3 AM)"
fi

echo ""

################################################################################
# Summary
################################################################################
echo "========================================================================"
log_success "SSL Setup Complete!"
echo "========================================================================"
echo ""
echo "Domain: $DOMAIN"
echo "Certificate: /etc/letsencrypt/live/$DOMAIN/"
echo "Auto-renewal: Configured (daily at 3 AM)"
echo ""
echo "Your application is now accessible at:"
echo "  🌐 https://$DOMAIN"
echo "  📚 https://$DOMAIN/docs"
echo ""
echo "Certificate expires in 90 days and will auto-renew."
echo ""
log_info "Testing your SSL: https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
echo ""
log_success "SSL setup finished successfully!"
