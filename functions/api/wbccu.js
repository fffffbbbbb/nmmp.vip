// Cloudflare Pages Function — WBCCU 查询代理
// 部署步骤：
//   1. 将此文件放在项目的 functions/api/wbccu.js
//   2. 在 Cloudflare Pages 控制台设置 "Functions" 为 "启用"
//   3. 部署后访问 https://你的域名/api/wbccu (POST)

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    // 1) 获取令牌
    const tokenResp = await fetch('https://robertsspaceindustries.com/api/account/v2/setAuthToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!tokenResp.ok) {
      return new Response(JSON.stringify({ error: 'Token request failed: ' + tokenResp.status }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    const tokenData = await tokenResp.json();
    if (!tokenData?.data) {
      return new Response(JSON.stringify({ error: 'No token in response' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    const authToken = tokenData.data;

    // 2) 查询 GraphQL
    const gqlBody = JSON.stringify([{
      operationName: 'filterShips',
      variables: { fromFilters: [], toFilters: [] },
      query: `query filterShips($fromId: Int, $toId: Int, $fromFilters: [FilterConstraintValues], $toFilters: [FilterConstraintValues]) {
        from(to: $toId, filters: $fromFilters) { ships { id } }
        to(from: $fromId, filters: $toFilters) {
          featured { reason style tagLabel tagStyle footNotes shipId }
          ships { id skus { id price upgradePrice unlimitedStock showStock available availableStock } }
        }
      }`,
    }]);

    const graphqlResp = await fetch('https://robertsspaceindustries.com/pledge-store/api/upgrade/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'Rsi-Account-Auth=' + authToken,
      },
      body: gqlBody,
    });

    const data = await graphqlResp.text();

    return new Response(data, {
      status: graphqlResp.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
