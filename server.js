const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || '';

if (!API_KEY) {
  console.error('❌  Chybí ANTHROPIC_API_KEY. Spusť:\n   ANTHROPIC_API_KEY=sk-ant-... node server.js');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Serve HTML
  if (req.method === 'GET' && (req.url === '/' || req.url === '/prekladac.html')) {
    const file = fs.readFileSync(path.join(__dirname, 'prekladac.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(file);
    return;
  }

  // Proxy /translate → Anthropic API (streaming)
  if (req.method === 'POST' && req.url === '/translate') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const payload = Buffer.from(body);

      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
        }
      };

      const apiReq = https.request(options, apiRes => {
        res.writeHead(apiRes.statusCode, {
          'Content-Type': apiRes.headers['content-type'] || 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        apiRes.pipe(res);
      });

      apiReq.on('error', err => {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      });

      apiReq.write(payload);
      apiReq.end();
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`✅  Server běží na http://localhost:${PORT}`);
  console.log(`   Otevři prohlížeč na http://localhost:${PORT}`);
});
