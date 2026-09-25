// RSI 抓取共用工具：带重试的抓取 + 边缘缓存 + 过期数据兜底
//
// 背景（实测结论）：
//   RSI 主域 robertsspaceindustries.com 会对来自 Cloudflare 机房出口 IP 的请求
//   概率性返回 403。实测 12 次采样单次成功率：众筹 58%、WBCCU 67%、公民档案 50%，
//   且 403/200 交错出现（说明每次请求落到不同出口 IP）。与 User-Agent 等请求头无关，
//   改请求头无效。因此这里做三层防护：
//     1) fetchWithRetry —— 多次重试 + 随机退避：单次 58% → 重试 5 次约 98.7%
//     2) 短缓存         —— 成功结果进 Cache API（边缘缓存），大幅减少真实抓取次数
//     3) 长期兜底       —— 另存一份长期备份，全部重试失败时回退旧数据，前端不再报错
//
// 依赖：只用 Pages Functions 自带的 Cache API（caches.default），无需 KV / Cron。

export const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const CACHE_ORIGIN = 'https://rsi-cache.internal';
const JSON_TYPE = 'application/json; charset=utf-8';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 这些状态码值得重试；404 / 400 这类确定性错误直接返回，不浪费重试
export function isRetryableStatus(status) {
  return status === 403 || status === 408 || status === 425 || status === 429 || status >= 500;
}

/**
 * 带重试的 fetch：遇到 403/429/5xx 或网络异常时重试，带随机退避。
 * 返回最后一次的 Response（可能是失败状态），由调用方决定如何处理。
 */
export async function fetchWithRetry(url, init = {}, options = {}) {
  const attempts = options.attempts || 5;
  const baseDelay = options.baseDelay == null ? 150 : options.baseDelay;
  let lastResponse = null;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, init);
      if (!isRetryableStatus(response.status)) return response;
      lastResponse = response;
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) {
      // 随机退避：让重试尽量落到不同的出口 IP 上
      await sleep(baseDelay + Math.random() * baseDelay * 2);
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError || new Error('网络请求失败');
}

function cacheRequest(name) {
  return new Request(CACHE_ORIGIN + '/' + encodeURIComponent(name), { method: 'GET' });
}

export async function cacheRead(name) {
  try {
    const hit = await caches.default.match(cacheRequest(name));
    return hit || null;
  } catch (error) {
    return null;
  }
}

async function cacheWrite(name, body, ttl, contentType) {
  try {
    await caches.default.put(cacheRequest(name), new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=' + ttl,
        'Access-Control-Allow-Origin': '*',
      },
    }));
  } catch (error) {
    // 缓存写入失败不影响本次正常返回
  }
}

export function jsonError(message, status = 502) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': JSON_TYPE, 'Access-Control-Allow-Origin': '*' },
  });
}

export function corsPreflight(methods) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': methods || 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/**
 * 统一入口：先读短缓存 → 未命中则抓取（loader 内部请用 fetchWithRetry）
 * → 成功写「短缓存 + 长期备份」；彻底失败则回退长期备份，仍无数据才返回中文错误。
 *
 * @param {object}   options
 * @param {string}   options.name        缓存键名（公民查询请带上 handle）
 * @param {number}   options.freshTtl    短缓存秒数
 * @param {number}   options.staleTtl    长期备份秒数
 * @param {Function} options.loader      返回 Response 的异步函数
 * @param {string}   options.failMessage 全部失败且无备份时的中文提示
 */
export async function serveWithCache(options) {
  const {
    name,
    freshTtl = 900,
    staleTtl = 604800,
    loader,
    failMessage = 'RSI 服务器暂时拒绝访问（已自动重试），请稍后再试',
  } = options;

  const fresh = await cacheRead(name);
  if (fresh) return fresh;

  let response = null;
  let thrown = null;
  try {
    response = await loader();
  } catch (error) {
    thrown = error;
  }

  if (response && response.ok) {
    const contentType = response.headers.get('Content-Type') || JSON_TYPE;
    const body = await response.arrayBuffer();
    await cacheWrite(name, body, freshTtl, contentType);
    await cacheWrite(name + '|backup', body, staleTtl, contentType);
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=' + freshTtl,
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const status = response ? response.status : 0;
  const shouldFallback = thrown !== null || isRetryableStatus(status);

  if (shouldFallback) {
    const backup = await cacheRead(name + '|backup');
    if (backup) {
      const contentType = backup.headers.get('Content-Type') || JSON_TYPE;
      const body = await backup.arrayBuffer();
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-store',
          'X-Data-Stale': '1',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
    return jsonError(failMessage, 502);
  }

  return response;
}

// 本文件只是共享工具，不应被当成接口访问
export function onRequest() {
  return new Response('Not Found', { status: 404 });
}
