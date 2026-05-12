// WBCCU 数据代理服务器
// 在项目目录运行: node proxy.mjs
// 然后访问 http://localhost:3000

const http = require('http');
const https = require('https');

const PORT = 3000;

// ---- 静态文件服务 ----
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.avif': 'image/avif',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
  '.json': 'application/json',
  '.xml':  'application/xml',
  '.txt':  'text/plain',
};

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ---- RSI API 代理 ----
function proxyRSI(method, apiPath, body, callback) {
  const options = {
    hostname: 'robertsspaceindustries.com',
    port: 443,
    path: apiPath,
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
  };

  if (body) options.headers['Content-Length'] = Buffer.byteLength(body);

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => callback(null, res.statusCode, data));
  });

  req.on('error', (e) => callback(e));

  if (body) req.write(body);
  req.end();
}

// ---- 主服务器 ----
http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS 允许本地页面调用
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API 代理端点：/api/wbccu
  if (url.pathname === '/api/wbccu') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      // 1) 获取令牌
      proxyRSI('POST', '/api/account/v2/setAuthToken', null, (err1, status1, tokenRes) => {
        if (err1) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Token request failed: ' + err1.message }));
          return;
        }
        let tokenData;
        try { tokenData = JSON.parse(tokenRes); } catch(e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Token parse failed' }));
          return;
        }
        if (!tokenData?.data) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No token: ' + tokenRes.slice(0,200) }));
          return;
        }
        const authToken = tokenData.data;

        // 2) 查询 GraphQL（带 Cookie 头）
        const gqlBody = JSON.stringify([{
          operationName: 'filterShips',
          variables: { fromFilters: [], toFilters: [] },
          query: 'query filterShips($fromId: Int, $toId: Int, $fromFilters: [FilterConstraintValues], $toFilters: [FilterConstraintValues]) { from(to: $toId, filters: $fromFilters) { ships { id } } to(from: $fromId, filters: $toFilters) { featured { reason style tagLabel tagStyle footNotes shipId } ships { id skus { id price upgradePrice unlimitedStock showStock available availableStock } } } }'
        }]);

        const proxyOpts = {
          hostname: 'robertsspaceindustries.com',
          port: 443,
          path: '/pledge-store/api/upgrade/graphql',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': 'Rsi-Account-Auth=' + authToken,
          },
        };

        const gqlReq = https.request(proxyOpts, (gqlRes) => {
          let gqlData = '';
          gqlRes.on('data', chunk => gqlData += chunk);
          gqlRes.on('end', () => {
            res.writeHead(gqlRes.statusCode, { 'Content-Type': 'application/json' });
            res.end(gqlData);
          });
        });
        gqlReq.on('error', (e) => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'GraphQL request failed: ' + e.message }));
        });
        gqlReq.write(gqlBody);
        gqlReq.end();
      });
    });
    return;
  }

  // ---- 汇率查询代理（从中国银行官网获取）----
  if (url.pathname === '/api/exchange-rate') {
    const currency = url.searchParams.get('currency') || '美元';

    // 获取中国银行外汇牌价页面
    const bocUrls = [
      'https://www.boc.cn/sourcedb/whpj/',
      'https://www.boc.cn/sourcedb/whpj/index_1.html',
    ];

    let html = '';
    let errCount = 0;

    function fetchBoC(index) {
      if (index >= bocUrls.length) {
        // 所有页面都抓取完毕，开始解析
        if (!html) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '无法获取中国银行汇率数据' }));
          return;
        }

        // 正则提取：现汇买入价（第1列）和现汇卖出价（第3列）
        const sellRegex = new RegExp(
          `<td>${currency}<\\/td>\\s*<td>([\\d.]+)<\\/td>\\s*<td>[\\d.]+<\\/td>\\s*<td>([\\d.]+)<\\/td>`,
          'i'
        );
        const buyRegex = new RegExp(
          `<td>${currency}<\\/td>\\s*<td>([\\d.]+)<\\/td>\\s*<td>[\\d.]+<\\/td>\\s*<td>[\\d.]+<\\/td>\\s*<td>([\\d.]+)<\\/td>`,
          'i'
        );

        const sellMatch = html.match(sellRegex);
        const buyMatch = html.match(buyRegex);

        if (sellMatch && buyMatch) {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({
            currency: currency,
            buy: parseFloat(buyMatch[1]),   // 现汇买入价
            sell: parseFloat(sellMatch[2]), // 现汇卖出价
            updateTime: new Date().toISOString(),
          }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `找不到 ${currency} 的汇率数据` }));
        }
        return;
      }

      https.get(bocUrls[index], (resp) => {
        let data = '';
        resp.on('data', chunk => data += chunk);
        resp.on('end', () => {
          html += data;
          fetchBoC(index + 1);
        });
      }).on('error', () => {
        fetchBoC(index + 1);
      });
    }

    fetchBoC(0);
    return;
  }

  // ---- 募集资金统计数据代理（官方 RSI API）----
  if (url.pathname === '/api/crowdfund-stats') {
    const body = JSON.stringify({
      chart: 'day',
      fans: true,
      funds: true,
      alpha_slots: true,
      fleet: true,
    });

    const postOpts = {
      hostname: 'robertsspaceindustries.com',
      port: 443,
      path: '/api/stats/getCrowdfundStats',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'Mozilla/5.0',
      },
    };

    const apiReq = https.request(postOpts, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => data += chunk);
      apiRes.on('end', () => {
        res.writeHead(apiRes.statusCode, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(data);
      });
    });
    apiReq.on('error', (e) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    });
    apiReq.write(body);
    apiReq.end();
    return;
  }

  // 静态文件服务
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  serveFile(res, path.join(__dirname, filePath));
}).listen(PORT, () => {
  console.log(`✓ 代理服务器已启动: http://localhost:${PORT}`);
  console.log(`  WBCCU:           /api/wbccu`);
  console.log(`  汇率查询:         /api/exchange-rate?currency=美元`);
  console.log(`  募集资金统计:     /api/crowdfund-stats`);
});
