// Cloudflare Pages Function — 中国银行汇率 HTML 代理
// 访问: /api/boc-rates (GET)
// 返回原始 HTML，由前端解析所有币种

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' },
    });
  }

  try {
    const resp = await fetch('https://www.boc.cn/sourcedb/whpj/', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    const html = await resp.text();

    return new Response(html, {
      status: resp.status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
