import http from 'node:http';

// The remote server where your API and Database actually live
const GATEWAY_HOST = process.env.GATEWAY_HOST || '192.168.1.50'; // Change to your remote IP
const GATEWAY_PORT = 8080; 

const server = http.createServer((req, res) => {
  // 1. Manually handle CORS to allow your local Vite dev server (port 5173)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 2. Configure the proxy request to the remote backend
  const options = {
    hostname: GATEWAY_HOST,
    port: GATEWAY_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
    // CRITICAL: Force IPv4 to avoid the Node.js 24 + Vite 7 DNS resolution bug
    family: 4 
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy Error:', err.message);
    res.writeHead(502);
    res.end('Bad Gateway');
  });

  req.pipe(proxyReq);
});

// The proxy sits on 5174, listening for Vite's requests
server.listen(5174, '127.0.0.1', () => {
  console.log(`🚀 Proxy bridging Local (5174) -> Remote (${GATEWAY_HOST}:${GATEWAY_PORT})`);
});