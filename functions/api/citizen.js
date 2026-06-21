// Cloudflare Pages Function — 公民查询代理
// GET /api/citizen?handle=Tzk02
// 代理 RSI 公民页 HTML，前端负责解析

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const handle = url.searchParams.get('handle')?.trim();

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
    });
  }

  if (!handle) {
    return new Response(JSON.stringify({ error: '缺少参数 handle' }), {
      status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const resp = await fetch(`https://robertsspaceindustries.com/en/citizens/${encodeURIComponent(handle)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: resp.status === 404 ? '未找到该玩家' : 'RSI 官网请求失败: ' + resp.status }), {
        status: resp.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const html = await resp.text();

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
