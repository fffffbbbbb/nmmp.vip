// Cloudflare Pages Function — 汇率查询代理
// 从中国银行官网获取外汇牌价
// 访问: /api/exchange-rate?currency=美元

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const currency = url.searchParams.get('currency') || '美元';

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
    });
  }

  try {
    // 抓取中国银行外汇牌价页面
    const [html1, html2] = await Promise.allSettled([
      fetch('https://www.boc.cn/sourcedb/whpj/').then(r => r.text()),
      fetch('https://www.boc.cn/sourcedb/whpj/index_1.html').then(r => r.text()),
    ]);

    let html = '';
    if (html1.status === 'fulfilled') html += html1.value;
    if (html2.status === 'fulfilled') html += html2.value;

    if (!html) {
      return new Response(JSON.stringify({ error: '无法获取中国银行汇率数据' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
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

    if (!sellMatch || !buyMatch) {
      return new Response(JSON.stringify({ error: `找不到 ${currency} 的汇率数据` }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      currency,
      buy: parseFloat(buyMatch[1]),
      sell: parseFloat(sellMatch[2]),
      updateTime: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
