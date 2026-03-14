const crypto = require('crypto');

let config = {
  deduplication: {
    enabled: true,
    strategy: 'url-body-hash',
    windowMs: 5000,
    maxCacheSize: 1000,
    ignoreParams: ['timestamp', '_t', '_', 'random', 'nonce', 'csrf_token'],
    ignoreHeaders: ['cookie', 'user-agent', 'accept-language', 'accept-encoding', 'referer', 'origin'],
    mergeStrategy: {
      sameUrl: 'keep-first',
      similarBody: 'merge-diff'
    }
  },
  similarity: {
    urlThreshold: 0.85,
    bodyThreshold: 0.9,
    enabled: true
  }
};

try {
  const loadedConfig = require('../config/deduplication.json');
  config = { ...config, ...loadedConfig };
} catch (e) {
  console.warn('Using default deduplication config');
}

const requestCache = new Map();
const stats = {
  total: 0,
  duplicates: 0,
  merged: 0
};

function loadConfig() {
  try {
    const loadedConfig = require('../config/deduplication.json');
    config = { ...config, ...loadedConfig };
  } catch (e) {}
  return config;
}

function normalizeUrl(url, ignoreParams = []) {
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);
    
    ignoreParams.forEach(param => params.delete(param));
    
    const sortedParams = Array.from(params.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const newSearch = sortedParams.length > 0 
      ? '?' + sortedParams.map(([k, v]) => `${k}=${v}`).join('&')
      : '';
    
    return urlObj.origin + urlObj.pathname + newSearch;
  } catch (e) {
    return url;
  }
}

function normalizeHeaders(headers, ignoreHeaders = []) {
  if (!headers || typeof headers !== 'object') return {};
  
  const normalized = {};
  const ignoreLower = ignoreHeaders.map(h => h.toLowerCase());
  
  Object.entries(headers).forEach(([key, value]) => {
    if (!ignoreLower.includes(key.toLowerCase())) {
      normalized[key.toLowerCase()] = value;
    }
  });
  
  return normalized;
}

function generateRequestHash(request) {
  const normalizedUrl = normalizeUrl(request.url, config.deduplication.ignoreParams);
  const normalizedHeaders = normalizeHeaders(request.headers, config.deduplication.ignoreHeaders);
  
  const hashContent = {
    url: normalizedUrl,
    method: request.method,
    headers: normalizedHeaders,
    body: request.postData || null
  };
  
  const hashString = JSON.stringify(hashContent, Object.keys(hashContent).sort());
  return crypto.createHash('md5').update(hashString).digest('hex');
}

function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return str1 === str2 ? 1 : 0;
  if (str1 === str2) return 1;
  
  const len1 = str1.length;
  const len2 = str2.length;
  const maxLen = Math.max(len1, len2);
  
  if (maxLen === 0) return 1;
  
  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
  
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const distance = matrix[len1][len2];
  return 1 - distance / maxLen;
}

function isSimilarRequest(req1, req2) {
  if (req1.method !== req2.method) return false;
  
  const normUrl1 = normalizeUrl(req1.url, config.deduplication.ignoreParams);
  const normUrl2 = normalizeUrl(req2.url, config.deduplication.ignoreParams);
  
  const urlSimilarity = calculateSimilarity(normUrl1, normUrl2);
  if (urlSimilarity < config.similarity.urlThreshold) return false;
  
  if (req1.postData && req2.postData) {
    const bodySimilarity = calculateSimilarity(req1.postData, req2.postData);
    if (bodySimilarity < config.similarity.bodyThreshold) return false;
  }
  
  return true;
}

function findSimilarRequest(request, cache) {
  if (!config.similarity.enabled) return null;
  
  for (const [hash, cached] of cache) {
    if (isSimilarRequest(request, cached.request)) {
      return { hash, request: cached.request };
    }
  }
  return null;
}

function processRequest(request) {
  if (!config.deduplication.enabled) {
    stats.total++;
    return { isDuplicate: false, request, mergedWith: null };
  }
  
  stats.total++;
  
  const hash = generateRequestHash(request);
  const now = Date.now();
  
  cleanOldEntries(now);
  
  if (requestCache.has(hash)) {
    const cached = requestCache.get(hash);
    cached.count++;
    cached.lastSeen = now;
    stats.duplicates++;
    
    return { 
      isDuplicate: true, 
      request: cached.request, 
      mergedWith: hash,
      count: cached.count
    };
  }
  
  const similar = findSimilarRequest(request, requestCache);
  if (similar) {
    const cached = requestCache.get(similar.hash);
    cached.count++;
    cached.lastSeen = now;
    cached.similarRequests = cached.similarRequests || [];
    cached.similarRequests.push({
      url: request.url,
      timestamp: now
    });
    stats.merged++;
    
    return {
      isDuplicate: true,
      isSimilar: true,
      request: cached.request,
      mergedWith: similar.hash,
      count: cached.count
    };
  }
  
  requestCache.set(hash, {
    request,
    hash,
    firstSeen: now,
    lastSeen: now,
    count: 1
  });
  
  return { isDuplicate: false, request, hash };
}

function cleanOldEntries(now) {
  const windowMs = config.deduplication.windowMs;
  const maxSize = config.deduplication.maxCacheSize;
  
  if (requestCache.size > maxSize) {
    const entries = Array.from(requestCache.entries());
    entries.sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    
    const toDelete = entries.slice(0, Math.floor(maxSize * 0.3));
    toDelete.forEach(([hash]) => requestCache.delete(hash));
  }
  
  if (windowMs > 0) {
    const cutoff = now - windowMs * 10;
    for (const [hash, entry] of requestCache) {
      if (entry.lastSeen < cutoff) {
        requestCache.delete(hash);
      }
    }
  }
}

function getStats() {
  return {
    ...stats,
    cacheSize: requestCache.size,
    duplicateRate: stats.total > 0 ? (stats.duplicates / stats.total).toFixed(4) : 0
  };
}

function resetStats() {
  stats.total = 0;
  stats.duplicates = 0;
  stats.merged = 0;
  requestCache.clear();
}

function getDuplicateGroups() {
  const groups = [];
  const seen = new Set();
  
  for (const [hash, entry] of requestCache) {
    if (entry.count > 1 && !seen.has(hash)) {
      seen.add(hash);
      groups.push({
        hash,
        url: entry.request.url,
        method: entry.request.method,
        count: entry.count,
        similarRequests: entry.similarRequests || []
      });
    }
  }
  
  return groups.sort((a, b) => b.count - a.count);
}

module.exports = {
  processRequest,
  getStats,
  resetStats,
  getDuplicateGroups,
  loadConfig,
  generateRequestHash,
  normalizeUrl,
  calculateSimilarity
};
