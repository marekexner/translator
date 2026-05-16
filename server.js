const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const API_KEY = process.env.DEEPL_API_KEY || '';

if (!API_KEY) {
  console.error('❌  Chybí DEEPL_API_KEY. Spusť:\n   DEEPL_API_KEY=... node server.js');
  process.exit(1);
}

const server = http.createServer((req, res) => {
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

  // Proxy /translate → DeepL API
  if (req.method === 'POST' && req.url === '/translate') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid JSON' })); return;
      }

      const { text, source_lang, target_lang, model_type = 'latency_optimized' } = parsed;

      if (!text || !target_lang) {
        res.writeHead(400); res.end(JSON.stringify({ error: 'Missing text or target_lang' })); return;
      }

      const payload = Buffer.from(JSON.stringify({
        text: [text],
        source_lang: source_lang || undefined,
        target_lang,
        model_type,
      }));

      const options = {
        hostname: 'api-free.deepl.com',
        path: '/v2/translate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `DeepL-Auth-Key ${API_KEY}`,
          'Content-Length': payload.length,
        }
      };

      const apiReq = https.request(options, apiRes => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (apiRes.statusCode !== 200) {
              res.writeHead(apiRes.statusCode, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ error: json.message || 'DeepL API error' }));
              return;
            }
            const translation = json.translations?.[0]?.text || '';
            const detected_lang = json.translations?.[0]?.detected_source_language || null;
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ translation, detected_lang }));
          } catch {
            res.writeHead(500, { 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Failed to parse DeepL response' }));
          }
        });
      });

      apiReq.on('error', err => {
        res.writeHead(500, { 'Access-Control-Allow-Origin': '*' });
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
