// Cloudflare Pages Function — 公民档案查询代理
// GET /api/citizen?handle=Tkz02
// 代理 RSI 公民页 HTML，由前端解析成角色卡
//
// 稳定性处理（见 _rsi.js）：RSI 主域会对来自 Cloudflare 机房出口 IP 的请求概率性返回 403，
// 这里最多重试 5 次；成功结果按 handle 分别缓存 5 分钟，另有 1 天兜底（档案变化很慢）。
// 注意：404（玩家不存在）不缓存、不兜底，原样返回给前端。

import { BROWSER_UA, corsPreflight, fetchWithRetry, jsonError, serveWithCache } from './_rsi.js';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const handle = url.searchParams.get('handle')?.trim();

  if (request.method === 'OPTIONS') return corsPreflight('GET, OPTIONS');

  if (!handle) return jsonError('缺少参数 handle', 400);

  const profileUrl = `https://robertsspaceindustries.com/en/citizens/${encodeURIComponent(handle)}`;

  return serveWithCache({
    origin: url.origin,
    // 按 handle 分别缓存（RSI 的 handle 不区分大小写，统一转小写做键）
    name: 'citizen/' + handle.toLowerCase(),
    freshTtl: 600,       // 10 分钟（档案变化很慢）
    staleTtl: 86400,     // 兜底 1 天
    failMessage: 'RSI 官网暂时拒绝访问（已自动重试多次），请稍后再试',
    loader: async () => {
      const resp = await fetchWithRetry(profileUrl, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
          'User-Agent': BROWSER_UA,
        },
      }, { attempts: 8 });

      if (resp.ok) return resp;

      if (resp.status === 404) {
        return jsonError('未找到该玩家', 404);
      }
      return resp;   // 403 等交给 serveWithCache 走兜底逻辑
    },
  });
}
