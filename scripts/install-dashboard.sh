#!/data/data/com.termux/files/usr/bin/bash

# ============================================
# TERMUX DASHBOARD INSTALLATION SCRIPT
# ============================================
# Install and configure the deployment dashboard
# with live-feed monitoring capabilities

set -e

# Colors
G='\033[0;32m' # Green
Y='\033[1;33m' # Yellow
B='\033[0;34m' # Blue
C='\033[0;36m' # Cyan
R='\033[0;31m' # Red
NC='\033[0m'   # No Color

echo "╔════════════════════════════════════════════════════════╗"
echo "║                                                        ║"
echo "║    📊 DASHBOARD INSTALLATION 📊                      ║"
echo "║                                                        ║"
echo "║  Real-time monitoring for your deployments            ║"
echo "║                                                        ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${Y}Node.js not found. Installing...${NC}"
    pkg install -y nodejs
else
    echo -e "${G}✅ Node.js already installed ($(node --version))${NC}"
fi

# Check if we're in the scripts directory
if [[ ! -d "dashboard" ]]; then
    echo -e "${Y}Creating dashboard directory...${NC}"
    mkdir -p dashboard
fi

echo ""
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${B}📦 Setting up Dashboard${NC}"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Make dashboard server executable
chmod +x dashboard/dashboard-server.js

echo -e "${G}✅ Dashboard files ready${NC}"
echo ""

# Create systemd-style service file for Termux
cat > ~/dashboard-service.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash

# Dashboard Service Runner
cd "$(dirname "$0")/scripts/dashboard" || exit 1

echo "Starting Termux Deployment Dashboard..."
node dashboard-server.js
EOF

chmod +x ~/dashboard-service.sh

echo -e "${G}✅ Service script created${NC}"
echo ""

# Create quick start script
cat > ~/start-dashboard.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash

echo "╔════════════════════════════════════════════════════════╗"
echo "║                                                        ║"
echo "║    📊 STARTING DASHBOARD 📊                          ║"
echo "║                                                        ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

cd "$HOME/claude-code/scripts/dashboard" || {
    echo "Error: Dashboard directory not found"
    exit 1
}

# Start in background
nohup node dashboard-server.js > ~/dashboard.log 2>&1 &
DASHBOARD_PID=$!

echo $DASHBOARD_PID > ~/dashboard.pid

echo "✅ Dashboard started!"
echo ""
echo "📊 Access your dashboard:"
echo "   http://localhost:3001"
echo ""
echo "🔍 View logs:"
echo "   tail -f ~/dashboard.log"
echo ""
echo "🛑 To stop:"
echo "   kill $(cat ~/dashboard.pid)"
echo ""
EOF

chmod +x ~/start-dashboard.sh

# Create stop script
cat > ~/stop-dashboard.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash

if [[ -f ~/dashboard.pid ]]; then
    PID=$(cat ~/dashboard.pid)
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID"
        rm ~/dashboard.pid
        echo "✅ Dashboard stopped"
    else
        echo "⚠️  Dashboard not running"
        rm ~/dashboard.pid
    fi
else
    echo "⚠️  Dashboard PID file not found"
fi
EOF

chmod +x ~/stop-dashboard.sh

echo -e "${G}✅ Quick start scripts created${NC}"
echo ""

# Test if dashboard can start
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${B}🧪 Testing Dashboard${NC}"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd dashboard
timeout 3 node dashboard-server.js &> /dev/null && echo -e "${G}✅ Dashboard test passed${NC}" || echo -e "${Y}⚠️  Dashboard test skipped${NC}"
cd ..

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║                                                        ║"
echo "║         ✅ DASHBOARD INSTALLED! ✅                    ║"
echo "║                                                        ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

echo -e "${C}📊 START DASHBOARD:${NC}"
echo "  ~/start-dashboard.sh"
echo ""
echo -e "${C}📊 STOP DASHBOARD:${NC}"
echo "  ~/stop-dashboard.sh"
echo ""
echo -e "${C}📊 ACCESS DASHBOARD:${NC}"
echo "  http://localhost:3001"
echo ""
echo -e "${C}📊 VIEW LOGS:${NC}"
echo "  tail -f ~/dashboard.log"
echo ""

echo -e "${Y}🎯 NEXT STEPS:${NC}"
echo ""
echo "1️⃣  Start the dashboard:"
echo "   ~/start-dashboard.sh"
echo ""
echo "2️⃣  Open in browser:"
echo "   - Termux: termux-open-url http://localhost:3001"
echo "   - Phone browser: http://localhost:3001"
echo "   - Network: Check ~/dashboard.log for URL"
echo ""
echo "3️⃣  Deploy an app to see it on dashboard:"
echo "   ./termux-deploy.sh"
echo ""

# Create desktop shortcut if termux-open-url exists
if command -v termux-open-url &> /dev/null; then
    cat > ~/open-dashboard.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
termux-open-url http://localhost:3001
EOF
    chmod +x ~/open-dashboard.sh
    echo -e "${G}✅ Quick access script created: ~/open-dashboard.sh${NC}"
    echo ""
fi

echo -e "${C}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${G}🎊 Installation complete! Ready to monitor! 🎊${NC}"
echo -e "${C}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
