#!/usr/bin/env node

/**
 * Termux Deployment Dashboard Server
 * Real-time monitoring and live feed for deployments
 *
 * Copyright (c) 2025 Ljupco Arsovski
 * Author: Ljupco Arsovski <lousta79@gmail.com>
 * Licensed under MIT License
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Configuration
const PORT = process.env.DASHBOARD_PORT || 3001;
const HOST = '0.0.0.0';

// Store for SSE clients
const clients = [];

// Deployment data store
const deploymentData = {
    deployments: [],
    apps: [],
    metrics: {
        totalDeployments: 0,
        activeApps: 0,
        successRate: 100,
        avgDeployTime: '15m',
        uptime: '99.9%'
    },
    events: []
};

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Create HTTP server
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Routes
    if (pathname === '/' || pathname === '/dashboard') {
        serveDashboard(req, res);
    } else if (pathname === '/api/events') {
        handleSSE(req, res);
    } else if (pathname === '/api/deployments') {
        handleDeployments(req, res);
    } else if (pathname === '/api/apps') {
        handleApps(req, res);
    } else if (pathname === '/api/metrics') {
        handleMetrics(req, res);
    } else if (pathname === '/api/feed') {
        handleFeed(req, res);
    } else if (pathname.startsWith('/api/deploy')) {
        handleNewDeployment(req, res);
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

// Serve dashboard HTML
function serveDashboard(req, res) {
    const dashboardPath = path.join(__dirname, 'dashboard.html');
    fs.readFile(dashboardPath, 'utf8', (err, content) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error loading dashboard');
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
    });
}

// Handle Server-Sent Events for live feed
function handleSSE(req, res) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    // Add client to list
    const clientId = Date.now();
    const newClient = { id: clientId, res };
    clients.push(newClient);

    console.log(`📡 Client ${clientId} connected. Total clients: ${clients.length}`);

    // Send initial connection event
    sendEvent(res, {
        type: 'connected',
        message: 'Connected to live feed',
        timestamp: new Date().toISOString()
    });

    // Remove client on disconnect
    req.on('close', () => {
        const index = clients.findIndex(c => c.id === clientId);
        if (index !== -1) {
            clients.splice(index, 1);
        }
        console.log(`📡 Client ${clientId} disconnected. Total clients: ${clients.length}`);
    });
}

// Send event to specific client
function sendEvent(res, data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// Broadcast event to all clients
function broadcastEvent(eventType, message, data = {}) {
    const event = {
        type: eventType,
        message,
        timestamp: new Date().toISOString(),
        ...data
    };

    deploymentData.events.unshift(event);
    if (deploymentData.events.length > 100) {
        deploymentData.events = deploymentData.events.slice(0, 100);
    }

    clients.forEach(client => {
        sendEvent(client.res, event);
    });

    console.log(`📢 Broadcast: [${eventType}] ${message}`);
}

// Handle deployments API
function handleDeployments(req, res) {
    if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(deploymentData.deployments));
    } else if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const deployment = JSON.parse(body);
                deployment.id = Date.now();
                deployment.timestamp = new Date().toISOString();
                deploymentData.deployments.push(deployment);
                updateMetrics();
                broadcastEvent('success', `New deployment: ${deployment.name}`, { deployment });
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(deployment));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    }
}

// Handle apps API
function handleApps(req, res) {
    if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(deploymentData.apps));
    } else if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const app = JSON.parse(body);
                app.id = Date.now();
                app.createdAt = new Date().toISOString();
                deploymentData.apps.push(app);
                updateMetrics();
                broadcastEvent('success', `New app deployed: ${app.name}`, { app });
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(app));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    }
}

// Handle metrics API
function handleMetrics(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(deploymentData.metrics));
}

// Handle feed API
function handleFeed(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(deploymentData.events));
}

// Handle new deployment trigger
function handleNewDeployment(req, res) {
    broadcastEvent('info', '🚀 New deployment started');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Deployment started' }));
}

// Update metrics
function updateMetrics() {
    deploymentData.metrics.totalDeployments = deploymentData.deployments.length;
    deploymentData.metrics.activeApps = deploymentData.apps.filter(a => a.status === 'active').length;

    const successCount = deploymentData.deployments.filter(d => d.status === 'success').length;
    deploymentData.metrics.successRate = deploymentData.deployments.length > 0
        ? Math.round((successCount / deploymentData.deployments.length) * 100)
        : 100;
}

// Simulate deployment events (for demo)
function simulateEvents() {
    const events = [
        { type: 'info', message: 'System health check running...' },
        { type: 'success', message: 'All services are operational' },
        { type: 'info', message: 'Checking for updates...' }
    ];

    setInterval(() => {
        const event = events[Math.floor(Math.random() * events.length)];
        broadcastEvent(event.type, event.message);
    }, 30000); // Every 30 seconds
}

// Start server
server.listen(PORT, HOST, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║        📊 TERMUX DEPLOYMENT DASHBOARD SERVER              ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

🚀 Server running on:
   Local:    http://localhost:${PORT}
   Network:  http://${getLocalIP()}:${PORT}

📡 Live Feed: Ready for connections
📊 API Base:  http://localhost:${PORT}/api

📱 Access from:
   - Local browser: http://localhost:${PORT}
   - Network devices: http://${getLocalIP()}:${PORT}
   - Termux browser: Open URL above

🔗 API Endpoints:
   GET  /                    - Dashboard UI
   GET  /api/events          - Live event stream (SSE)
   GET  /api/deployments     - List deployments
   POST /api/deployments     - Add deployment
   GET  /api/apps            - List apps
   POST /api/apps            - Add app
   GET  /api/metrics         - Get metrics
   GET  /api/feed            - Get event feed

Press Ctrl+C to stop
    `);

    // Start event simulation
    simulateEvents();

    // Send initial events
    setTimeout(() => {
        broadcastEvent('info', '📊 Dashboard server started');
        broadcastEvent('info', '📡 Live feed active');
    }, 1000);
});

// Get local IP address
function getLocalIP() {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip internal and non-IPv4 addresses
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return '0.0.0.0';
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n📊 Dashboard server shutting down...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n\n📊 Dashboard server shutting down...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
