// Cloudflare Pages Function — WBCCU 查询代理（两步：取令牌 → GraphQL 查船）
//
// 稳定性处理（见 _rsi.js）：RSI 主域会对来自 Cloudflare 机房出口 IP 的请求概率性返回 403，
// 两步调用各自最多重试 4 次，成功结果缓存 15 分钟，另有 7 天兜底数据。
// 注意：WBCCU 需要连续两次调用都成功，所以两步都必须带重试。

import { BROWSER_UA, corsPreflight, fetchWithRetry, jsonError, serveWithCache } from './_rsi.js';

const TOKEN_URL = 'https://robertsspaceindustries.com/api/account/v2/setAuthToken';
const GRAPHQL_URL = 'https://robertsspaceindustries.com/pledge-store/api/upgrade/graphql';

const GRAPHQL_QUERY = `query filterShips($fromId: Int, $toId: Int, $fromFilters: [FilterConstraintValues], $toFilters: [FilterConstraintValues]) {
        from(to: $toId, filters: $fromFilters) { ships { id } }
        to(from: $fromId, filters: $toFilters) {
          featured { reason style tagLabel tagStyle footNotes shipId }
          ships { id skus { id price upgradePrice unlimitedStock showStock available availableStock } }
        }
      }`;

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') return corsPreflight('POST, OPTIONS');

  if (request.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  return serveWithCache({
    origin: new URL(request.url).origin,
    name: 'wbccu',
    freshTtl: 900,       // 15 分钟缓存（WBCCU 只在特卖期间变化）
    staleTtl: 604800,    // 兜底 7 天
    failMessage: 'RSI 服务器暂时拒绝访问（已自动重试多次），请稍后再试',
    loader: async () => {
      // 第一步：获取匿名令牌
      const tokenResp = await fetchWithRetry(TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': BROWSER_UA,
        },
      }, { attempts: 4 });

      if (!tokenResp.ok) return tokenResp;   // 交给 serveWithCache 走兜底逻辑

      let authToken = null;
      try {
        authToken = (await tokenResp.json())?.data;
      } catch (error) {
        authToken = null;
      }
      if (!authToken) return jsonError('RSI 令牌解析失败，请稍后再试', 502);

      // 第二步：查询所有舰船的价格与折扣
      return fetchWithRetry(GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': BROWSER_UA,
          'Cookie': 'Rsi-Account-Auth=' + authToken,
        },
        body: JSON.stringify([{
          operationName: 'filterShips',
          variables: { fromFilters: [], toFilters: [] },
          query: GRAPHQL_QUERY,
        }]),
      }, { attempts: 4 });
    },
  });
}
