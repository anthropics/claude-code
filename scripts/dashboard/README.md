# 📊 Termux Deployment Dashboard

Real-time monitoring and live-feed dashboard for your Termux deployments.

## Features

### 📈 Real-Time Monitoring
- Live deployment status
- Active application tracking
- Success rate metrics
- Performance monitoring
- Response time tracking

### 📡 Live Feed
- Real-time event streaming
- Deployment notifications
- Health check updates
- Error alerts
- System status updates

### 📊 Dashboard Metrics
- **Overview**
  - Total deployments
  - Active apps
  - Success rate

- **Performance**
  - Average deploy time
  - System uptime
  - Response times

- **Revenue Tracking**
  - Daily revenue
  - Monthly revenue
  - Total revenue

### 🚀 Deployment Management
- View all deployments
- Track deployment status
- Monitor progress
- Access deployed apps
- Quick redeploy

## Installation

### Quick Install

```bash
cd ~/claude-code/scripts
./install-dashboard.sh
```

### Manual Installation

1. **Ensure Node.js is installed:**
   ```bash
   pkg install nodejs
   ```

2. **Make server executable:**
   ```bash
   chmod +x dashboard/dashboard-server.js
   ```

3. **Ready to use!**

## Usage

### Starting the Dashboard

```bash
# Quick start (background)
~/start-dashboard.sh

# Or run directly
cd ~/claude-code/scripts/dashboard
node dashboard-server.js
```

### Accessing the Dashboard

**From Termux:**
```bash
termux-open-url http://localhost:3001
# Or use the quick script
~/open-dashboard.sh
```

**From Phone Browser:**
```
http://localhost:3001
```

**From Network (other devices):**
```
http://<your-phone-ip>:3001
```

### Stopping the Dashboard

```bash
~/stop-dashboard.sh
```

### View Logs

```bash
tail -f ~/dashboard.log
```

## API Endpoints

The dashboard server provides a REST API:

### Events (Live Feed)
```
GET /api/events
```
Server-Sent Events stream for real-time updates

### Deployments
```
GET  /api/deployments    # List all deployments
POST /api/deployments    # Add new deployment
```

Example POST:
```json
{
  "name": "my-app",
  "status": "success",
  "url": "https://my-app.railway.app"
}
```

### Applications
```
GET  /api/apps    # List deployed apps
POST /api/apps    # Register new app
```

Example POST:
```json
{
  "name": "Publishing Empire",
  "url": "https://publishing-empire.railway.app",
  "status": "active"
}
```

### Metrics
```
GET /api/metrics    # Get dashboard metrics
```

Response:
```json
{
  "totalDeployments": 5,
  "activeApps": 3,
  "successRate": 100,
  "avgDeployTime": "15m",
  "uptime": "99.9%"
}
```

### Feed
```
GET /api/feed    # Get recent events
```

## Integration with Deployment Script

The dashboard automatically integrates with `termux-deploy.sh`. When you deploy:

1. **Deployment starts** → Dashboard shows progress
2. **App created** → Registered in dashboard
3. **Deployment complete** → Success notification
4. **App running** → Health monitoring begins

### Manual Integration

Add to your deployment script:

```bash
# After successful deployment
curl -X POST http://localhost:3001/api/apps \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My App",
    "url": "https://my-app.railway.app",
    "status": "active"
  }'
```

## Features Detail

### Live Feed

The live feed shows real-time events:
- ✅ Success events (green)
- ℹ️ Info events (blue)
- ⚠️ Warning events (yellow)
- ❌ Error events (red)

Events include:
- Deployment starts/stops
- Health check results
- System status updates
- Error notifications
- Performance alerts

### Deployment Status

Track each deployment:
- **Success Count** - Completed deployments
- **Pending Count** - In-progress deployments
- **Failed Count** - Failed deployments
- **Progress Bar** - Visual progress

### App Monitoring

Each deployed app shows:
- App name
- Live URL (clickable)
- Status badge (Active/Inactive)
- Last health check

### Automatic Health Checks

Dashboard automatically checks:
- Every 30 seconds for all apps
- Calls `/health` endpoint
- Updates status in real-time
- Logs results to feed

## Configuration

### Environment Variables

```bash
# Change dashboard port
export DASHBOARD_PORT=3001

# Run dashboard
node dashboard-server.js
```

### Custom Port

Edit `dashboard-server.js`:
```javascript
const PORT = process.env.DASHBOARD_PORT || 3001;
```

Or pass when starting:
```bash
DASHBOARD_PORT=8080 node dashboard-server.js
```

## Architecture

### Technology Stack
- **Frontend:** Pure HTML/CSS/JavaScript
- **Backend:** Node.js (no dependencies!)
- **Real-time:** Server-Sent Events (SSE)
- **Storage:** In-memory (no database needed)

### How It Works

1. **Dashboard Server** runs on port 3001
2. **Frontend** served as static HTML
3. **SSE Connection** established for live updates
4. **Events** broadcast to all connected clients
5. **API** stores deployment data in memory

### Benefits
- ✅ No external dependencies
- ✅ Lightweight and fast
- ✅ Works on Termux
- ✅ Real-time updates
- ✅ Mobile-friendly UI

## Screenshots

### Dashboard Overview
```
┌────────────────────────────────────────────┐
│  📱 Termux Deployment Dashboard  ● LIVE   │
├────────────────────────────────────────────┤
│                                            │
│  📊 Overview        ⚡ Performance         │
│  Total: 5          Avg: 15m               │
│  Active: 3         Uptime: 99.9%          │
│  Success: 100%     Response: 120ms        │
│                                            │
│  🚀 Current Deployment                    │
│  Success: 3  Pending: 0  Failed: 0        │
│  ████████████████░░░░ 80%                 │
│                                            │
│  📡 Live Feed                              │
│  ✓ Health check passed                    │
│  ℹ Checking deployment status...          │
│  ✓ All systems operational                │
└────────────────────────────────────────────┘
```

## Troubleshooting

### Dashboard Won't Start

```bash
# Check if Node.js is installed
node --version

# Check if port is in use
netstat -an | grep 3001

# Try different port
DASHBOARD_PORT=8080 node dashboard-server.js
```

### Can't Access Dashboard

```bash
# Check if server is running
ps aux | grep dashboard-server

# Check logs
cat ~/dashboard.log

# Restart dashboard
~/stop-dashboard.sh
~/start-dashboard.sh
```

### Live Feed Not Updating

- Refresh the page
- Check browser console for errors
- Ensure JavaScript is enabled
- Check network connection

### Apps Not Showing

- Manually add via API:
  ```bash
  curl -X POST http://localhost:3001/api/apps \
    -H "Content-Type: application/json" \
    -d '{"name":"Test","url":"https://test.com","status":"active"}'
  ```
- Check browser localStorage
- Clear browser cache

## Advanced Usage

### Run as Service

Using `termux-services`:

```bash
# Install termux-services
pkg install termux-services

# Create service
mkdir -p ~/.termux/services
ln -sf ~/dashboard-service.sh ~/.termux/services/dashboard

# Start service
sv-enable dashboard
sv up dashboard
```

### Multiple Dashboards

Run multiple instances on different ports:

```bash
# Dashboard 1
DASHBOARD_PORT=3001 node dashboard-server.js &

# Dashboard 2
DASHBOARD_PORT=3002 node dashboard-server.js &
```

### Persistent Data

Save deployment data:

```javascript
// Add to dashboard-server.js
fs.writeFileSync('deployments.json', JSON.stringify(deploymentData));
```

Load on startup:

```javascript
// Add to dashboard-server.js
if (fs.existsSync('deployments.json')) {
    deploymentData = JSON.parse(fs.readFileSync('deployments.json'));
}
```

## Security

### Production Considerations

1. **Add Authentication**
   - Basic auth
   - JWT tokens
   - API keys

2. **Use HTTPS**
   - SSL/TLS certificates
   - Reverse proxy (nginx)

3. **Rate Limiting**
   - Prevent abuse
   - Limit API calls

4. **CORS Configuration**
   - Restrict origins
   - Production domains only

### Example: Basic Auth

```javascript
// Add to server
const auth = require('basic-auth');

function checkAuth(req, res) {
    const credentials = auth(req);
    if (!credentials || credentials.name !== 'admin' || credentials.pass !== 'password') {
        res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Dashboard"' });
        res.end('Access denied');
        return false;
    }
    return true;
}
```

## FAQ

**Q: Does the dashboard need to run all the time?**
A: No, you can start it when you need to monitor deployments.

**Q: Can I access it from another device?**
A: Yes, use your phone's IP address: `http://<phone-ip>:3001`

**Q: Does it use a database?**
A: No, it stores data in memory. Restart clears data.

**Q: Can I customize the UI?**
A: Yes, edit `dashboard.html` - it's just HTML/CSS/JS.

**Q: How do I add my deployed apps?**
A: Use the API or they'll be added automatically on next deployment.

**Q: Is it secure?**
A: Basic setup is for local use. Add auth for production.

## Support

- **Issues:** https://github.com/LOUSTA79/claude-code/issues
- **Docs:** See main README.md
- **Questions:** Open a GitHub discussion

## Future Enhancements

- [ ] Persistent storage (SQLite)
- [ ] Authentication system
- [ ] Email notifications
- [ ] Slack/Discord webhooks
- [ ] Export reports
- [ ] Custom metrics
- [ ] Multi-user support
- [ ] Dark mode toggle
- [ ] Mobile app

---

**Happy Monitoring!** 📊📡🚀
