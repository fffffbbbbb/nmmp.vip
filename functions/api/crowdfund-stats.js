// Cloudflare Pages Function — 募集资金 / 玩家数统计（官方 RSI API）
//
// 稳定性处理（见 _rsi.js）：RSI 主域会对来自 Cloudflare 机房出口 IP 的请求概率性返回 403，
// 这里用「最多 5 次重试 + 30 分钟边缘缓存 + 7 天兜底数据」保证前端不再出现「获取失败」。

import { BROWSER_UA, corsPreflight, fetchWithRetry, serveWithCache } from './_rsi.js';

const RSI_URL = 'https://robertsspaceindustries.com/api/stats/getCrowdfundStats';
const RSI_BODY = JSON.stringify({ chart: 'day', fans: true, funds: true, alpha_slots: true, fleet: true });

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') return corsPreflight('POST, OPTIONS');

  return serveWithCache({
    origin: new URL(request.url).origin,
    name: 'crowdfund-stats',
    freshTtl: 1800,      // 30 分钟内直接命中缓存，不再抓 RSI
    staleTtl: 604800,    // 抓取彻底失败时，最多回退到 7 天前的数据
    failMessage: 'RSI 服务器暂时拒绝访问（已自动重试多次），请稍后再试',
    loader: () => fetchWithRetry(RSI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': BROWSER_UA,
      },
      body: RSI_BODY,
    }, { attempts: 6 }),
  });
}
