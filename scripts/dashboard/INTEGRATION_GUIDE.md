# 🔗 Dashboard Integration Guide

Complete guide for integrating the Termux Deployment Dashboard with your applications.

## Quick Start Integration

### 1. Start Dashboard Before Deployment

```bash
# Terminal 1: Start dashboard
~/start-dashboard.sh

# Terminal 2: Deploy your app
cd ~/claude-code/scripts
./termux-deploy.sh
```

### 2. Auto-Register Your App

Add to your deployed `server.js`:

```javascript
// After server starts, register with dashboard
const registerWithDashboard = async () => {
    try {
        await fetch('http://localhost:3001/api/apps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: process.env.APP_NAME || 'My App',
                url: process.env.APP_URL || 'http://localhost:3000',
                status: 'active'
            })
        });
        console.log('✅ Registered with dashboard');
    } catch (error) {
        console.log('Dashboard not available');
    }
};

// Call after server starts
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    registerWithDashboard();
});
```

---

## Integration Methods

### Method 1: Manual Registration

Use curl to register your app:

```bash
curl -X POST http://localhost:3001/api/apps \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Publishing Empire",
    "url": "https://your-app.railway.app",
    "status": "active"
  }'
```

### Method 2: Deployment Script Integration

Modify `termux-deploy.sh` to auto-register:

```bash
# Add after Railway deployment
if command -v curl &> /dev/null; then
    echo "Registering with dashboard..."
    curl -X POST http://localhost:3001/api/apps \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"$PROJECT_NAME\",
            \"url\": \"https://$RAILWAY_DOMAIN\",
            \"status\": \"active\"
        }" 2>/dev/null && echo "✅ Registered with dashboard" || true
fi
```

### Method 3: Application Health Reporting

Send health status from your app:

```javascript
// In your deployed app
const reportHealth = async () => {
    try {
        await fetch('http://localhost:3001/api/feed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'success',
                message: `${process.env.APP_NAME} health check OK`,
                timestamp: new Date().toISOString()
            })
        });
    } catch (error) {
        // Dashboard not available, ignore
    }
};

// Report every 5 minutes
setInterval(reportHealth, 5 * 60 * 1000);
```

---

## Live Feed Events

### Sending Custom Events

```javascript
const sendDashboardEvent = async (type, message, data = {}) => {
    try {
        const response = await fetch('http://localhost:3001/api/feed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type,      // 'success', 'error', 'warning', 'info'
                message,   // Event message
                timestamp: new Date().toISOString(),
                ...data
            })
        });
        return response.ok;
    } catch (error) {
        return false;
    }
};

// Usage examples
await sendDashboardEvent('success', 'Payment processed: $50.00');
await sendDashboardEvent('error', 'Database connection failed');
await sendDashboardEvent('warning', 'High memory usage detected');
await sendDashboardEvent('info', 'New user registered');
```

### Event Types

| Type | Color | Use Case |
|------|-------|----------|
| `success` | Green | Successful operations |
| `error` | Red | Failures and errors |
| `warning` | Yellow | Warnings and alerts |
| `info` | Blue | General information |

---

## Advanced Integrations

### 1. Deployment Progress Tracking

Track deployment steps in real-time:

```bash
# In your deployment script
report_step() {
    local step=$1
    local message=$2
    curl -X POST http://localhost:3001/api/feed \
        -H "Content-Type: application/json" \
        -d "{
            \"type\": \"info\",
            \"message\": \"Step $step: $message\",
            \"timestamp\": \"$(date -Iseconds)\"
        }" 2>/dev/null || true
}

# Use during deployment
report_step 1 "Installing dependencies..."
npm install
report_step 2 "Building application..."
npm run build
report_step 3 "Deploying to Railway..."
git push
```

### 2. Webhook Integration

Receive webhooks from external services:

```javascript
// Dashboard webhook endpoint
app.post('/api/webhook/:source', (req, res) => {
    const { source } = req.params;
    const payload = req.body;

    // Broadcast to dashboard
    broadcastEvent('info', `Webhook received from ${source}`, {
        source,
        payload
    });

    res.json({ received: true });
});
```

Configure webhooks:
- **Stripe:** `https://your-phone-ip:3001/api/webhook/stripe`
- **GitHub:** `https://your-phone-ip:3001/api/webhook/github`
- **Railway:** `https://your-phone-ip:3001/api/webhook/railway`

### 3. Metrics Collection

Send custom metrics to dashboard:

```javascript
const reportMetrics = async (metrics) => {
    await fetch('http://localhost:3001/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            timestamp: new Date().toISOString(),
            ...metrics
        })
    });
};

// Report metrics
await reportMetrics({
    activeUsers: 42,
    requestsPerMinute: 120,
    memoryUsage: process.memoryUsage().heapUsed,
    cpuUsage: process.cpuUsage()
});
```

### 4. Error Tracking

Automatically report errors:

```javascript
// Global error handler
process.on('uncaughtException', async (error) => {
    await sendDashboardEvent('error', `Uncaught exception: ${error.message}`, {
        stack: error.stack,
        type: error.name
    });
});

// Express error middleware
app.use(async (err, req, res, next) => {
    await sendDashboardEvent('error', `${req.method} ${req.url}: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
});
```

---

## Network Configuration

### Local Network Access

Make dashboard accessible from other devices:

```bash
# Find your phone's IP
ip addr show wlan0 | grep inet

# Access from another device
http://192.168.1.100:3001
```

### Port Forwarding

For external access (advanced):

```bash
# Using SSH tunnel
ssh -L 3001:localhost:3001 user@your-phone-ip

# Or use ngrok (if available)
ngrok http 3001
```

### Reverse Proxy

Use nginx for HTTPS:

```nginx
server {
    listen 443 ssl;
    server_name dashboard.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/events {
        proxy_pass http://localhost:3001;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
        proxy_buffering off;
        proxy_cache off;
    }
}
```

---

## Best Practices

### 1. Graceful Degradation

Always handle dashboard unavailability:

```javascript
const dashboardAvailable = async () => {
    try {
        const response = await fetch('http://localhost:3001/api/metrics', {
            timeout: 1000
        });
        return response.ok;
    } catch {
        return false;
    }
};

// Use before sending events
if (await dashboardAvailable()) {
    await sendDashboardEvent('info', 'App started');
}
```

### 2. Rate Limiting

Don't overwhelm the dashboard:

```javascript
let lastEventTime = 0;
const MIN_EVENT_INTERVAL = 1000; // 1 second

const rateLimitedEvent = async (type, message) => {
    const now = Date.now();
    if (now - lastEventTime < MIN_EVENT_INTERVAL) {
        return; // Skip event
    }
    lastEventTime = now;
    await sendDashboardEvent(type, message);
};
```

### 3. Event Batching

Batch multiple events:

```javascript
let eventQueue = [];

const queueEvent = (type, message) => {
    eventQueue.push({ type, message, timestamp: new Date().toISOString() });
};

const flushEvents = async () => {
    if (eventQueue.length === 0) return;

    await fetch('http://localhost:3001/api/feed/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: eventQueue })
    });

    eventQueue = [];
};

// Flush every 5 seconds
setInterval(flushEvents, 5000);
```

### 4. Secure Communication

Use API keys for authentication:

```javascript
const DASHBOARD_API_KEY = process.env.DASHBOARD_API_KEY;

const authenticatedFetch = (url, options = {}) => {
    return fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'X-API-Key': DASHBOARD_API_KEY
        }
    });
};
```

---

## Testing Integration

### Test Dashboard Connection

```bash
# Check if dashboard is running
curl http://localhost:3001/api/metrics

# Send test event
curl -X POST http://localhost:3001/api/feed \
  -H "Content-Type: application/json" \
  -d '{"type":"info","message":"Test event"}'

# Register test app
curl -X POST http://localhost:3001/api/apps \
  -H "Content-Type: application/json" \
  -d '{"name":"Test App","url":"http://test.com","status":"active"}'
```

### Automated Tests

```javascript
// test-dashboard-integration.js
const assert = require('assert');

async function testDashboardIntegration() {
    const baseUrl = 'http://localhost:3001';

    // Test 1: Dashboard is running
    const health = await fetch(`${baseUrl}/api/metrics`);
    assert(health.ok, 'Dashboard should be accessible');

    // Test 2: Can register app
    const register = await fetch(`${baseUrl}/api/apps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Test',
            url: 'http://test.com',
            status: 'active'
        })
    });
    assert(register.ok, 'Should register app');

    // Test 3: Can send events
    const event = await fetch(`${baseUrl}/api/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'info',
            message: 'Test event'
        })
    });
    assert(event.ok, 'Should send event');

    console.log('✅ All integration tests passed');
}

testDashboardIntegration().catch(console.error);
```

---

## Troubleshooting

### Dashboard Not Receiving Events

```bash
# Check if dashboard is running
ps aux | grep dashboard-server

# Check dashboard logs
tail -f ~/dashboard.log

# Test manually
curl -v http://localhost:3001/api/feed
```

### Connection Refused

```bash
# Check port is open
netstat -an | grep 3001

# Check firewall (if any)
# Termux usually doesn't have firewall issues

# Try different port
DASHBOARD_PORT=8080 node dashboard-server.js
```

### Events Not Showing

1. Check browser console for errors
2. Verify SSE connection is established
3. Refresh the dashboard page
4. Clear browser cache

---

## Examples

### Complete Integration Example

```javascript
// app.js - Your deployed application

const express = require('express');
const app = express();

// Dashboard integration
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3001';
const APP_NAME = process.env.APP_NAME || 'My App';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Helper function
const notifyDashboard = async (type, message, data = {}) => {
    try {
        await fetch(`${DASHBOARD_URL}/api/feed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type,
                message: `[${APP_NAME}] ${message}`,
                timestamp: new Date().toISOString(),
                ...data
            }),
            timeout: 2000
        });
    } catch (error) {
        // Silently fail if dashboard unavailable
    }
};

// Register on startup
const registerApp = async () => {
    try {
        await fetch(`${DASHBOARD_URL}/api/apps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: APP_NAME,
                url: APP_URL,
                status: 'active'
            }),
            timeout: 2000
        });
        console.log('✅ Registered with dashboard');
    } catch (error) {
        console.log('⚠️  Dashboard not available');
    }
};

// Your routes
app.get('/', (req, res) => {
    res.send('Hello World');
});

// Health endpoint
app.get('/health', (req, res) => {
    const health = {
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    };
    res.json(health);
});

// Payment endpoint with dashboard integration
app.post('/api/payment', async (req, res) => {
    try {
        const { amount } = req.body;

        // Process payment
        const payment = await processPayment(amount);

        // Notify dashboard
        await notifyDashboard('success', `Payment processed: $${amount}`, {
            paymentId: payment.id,
            amount
        });

        res.json({ success: true, payment });
    } catch (error) {
        // Notify dashboard of error
        await notifyDashboard('error', `Payment failed: ${error.message}`);

        res.status(500).json({ error: error.message });
    }
});

// Error handler
app.use(async (err, req, res, next) => {
    await notifyDashboard('error', `${req.method} ${req.url}: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await registerApp();
    await notifyDashboard('info', 'Application started');
});

// Periodic health reports
setInterval(async () => {
    await notifyDashboard('info', 'Health check', {
        uptime: process.uptime(),
        memory: process.memoryUsage().heapUsed
    });
}, 5 * 60 * 1000); // Every 5 minutes

// Graceful shutdown
process.on('SIGTERM', async () => {
    await notifyDashboard('warning', 'Application shutting down');
    process.exit(0);
});
```

---

**Need Help?** Open an issue or check the main documentation!

**Happy Integrating!** 🔗📊🚀
