const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class RequestDeduplicator {
  constructor() {
    this.config = this.loadConfig();
    this.requestGroups = new Map();
    this.duplicateIndex = new Map();
  }

  loadConfig() {
    try {
      const configPath = path.join(__dirname, '../config/deduplication.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.warn('Failed to load deduplication config, using defaults:', error.message);
      return this.getDefaultConfig();
    }
  }

  getDefaultConfig() {
    return {
      enabled: true,
      rules: {
        urlPattern: {
          enabled: true,
          ignoreParams: ['_t', 'timestamp', '_', 'v', 'version'],
          normalizePath: true
        },
        method: { enabled: true },
        bodyHash: {
          enabled: true,
          ignoreFields: ['timestamp', '_token', 'csrf'],
          maxBodyLength: 10000
        }
      },
      mergeStrategy: { keep: 'latest' },
      similarityThreshold: 0.95
    };
  }

  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      
      if (this.config.rules.urlPattern.normalizePath) {
        urlObj.pathname = urlObj.pathname.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
      }

      const ignoreParams = this.config.rules.urlPattern.ignoreParams || [];
      const sortedParams = new URLSearchParams();
      
      for (const [key, value] of urlObj.searchParams) {
        if (!ignoreParams.includes(key.toLowerCase())) {
          sortedParams.append(key, value);
        }
      }
      
      const sortedKeys = Array.from(sortedParams.keys()).sort();
      const finalParams = new URLSearchParams();
      sortedKeys.forEach(key => {
        sortedParams.getAll(key).forEach(val => finalParams.append(key, val));
      });
      
      urlObj.search = finalParams.toString();
      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}${urlObj.search}`;
    } catch (e) {
      return url;
    }
  }

  normalizeBody(body) {
    if (!body) return null;
    
    try {
      let data = body;
      if (typeof body === 'string') {
        try {
          data = JSON.parse(body);
        } catch {
          return body.substring(0, this.config.rules.bodyHash.maxBodyLength);
        }
      }

      if (typeof data === 'object' && data !== null) {
        const ignoreFields = this.config.rules.bodyHash.ignoreFields || [];
        const filtered = {};
        
        Object.keys(data).sort().forEach(key => {
          if (!ignoreFields.includes(key.toLowerCase())) {
            filtered[key] = data[key];
          }
        });
        
        return JSON.stringify(filtered);
      }
      
      return String(data).substring(0, this.config.rules.bodyHash.maxBodyLength);
    } catch (e) {
      return String(body).substring(0, this.config.rules.bodyHash.maxBodyLength);
    }
  }

  generateFingerprint(request) {
    const parts = [];
    
    if (this.config.rules.urlPattern.enabled) {
      parts.push(this.normalizeUrl(request.url));
    } else {
      parts.push(request.url);
    }
    
    if (this.config.rules.method.enabled) {
      parts.push(request.method);
    }
    
    if (this.config.rules.bodyHash.enabled && request.postData) {
      parts.push(this.normalizeBody(request.postData));
    }
    
    const fingerprint = crypto.createHash('md5').update(parts.join('|')).digest('hex');
    return fingerprint;
  }

  calculateSimilarity(req1, req2) {
    let score = 0;
    let weights = 0;
    
    const url1 = this.normalizeUrl(req1.url);
    const url2 = this.normalizeUrl(req2.url);
    const urlSimilarity = this.stringSimilarity(url1, url2);
    score += urlSimilarity * 0.5;
    weights += 0.5;
    
    if (req1.method === req2.method) {
      score += 1 * 0.3;
    }
    weights += 0.3;
    
    if (req1.postData && req2.postData) {
      const body1 = this.normalizeBody(req1.postData);
      const body2 = this.normalizeBody(req2.postData);
      const bodySimilarity = this.stringSimilarity(body1, body2);
      score += bodySimilarity * 0.2;
      weights += 0.2;
    }
    
    return weights > 0 ? score / weights : 0;
  }

  stringSimilarity(str1, str2) {
    if (!str1 || !str2) return str1 === str2 ? 1 : 0;
    
    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);
    
    if (maxLen === 0) return 1;
    
    const distance = this.levenshteinDistance(str1, str2);
    return 1 - distance / maxLen;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  processRequests(requests) {
    if (!this.config.enabled) {
      return {
        unique: requests,
        duplicates: [],
        groups: [],
        stats: { total: requests.length, unique: requests.length, duplicates: 0 }
      };
    }

    const groups = new Map();
    const duplicates = [];
    const processedRequests = [];

    for (const request of requests) {
      const fingerprint = this.generateFingerprint(request);
      
      if (groups.has(fingerprint)) {
        const group = groups.get(fingerprint);
        group.duplicates.push({
          ...request,
          _isDuplicate: true,
          _groupId: group.id,
          _originalId: group.original.id
        });
        duplicates.push(request);
      } else {
        const groupId = crypto.randomUUID();
        const enhancedRequest = {
          ...request,
          _isDuplicate: false,
          _groupId: groupId,
          _duplicateCount: 0
        };
        
        groups.set(fingerprint, {
          id: groupId,
          fingerprint,
          original: enhancedRequest,
          duplicates: []
        });
        
        processedRequests.push(enhancedRequest);
      }
    }

    for (const group of groups.values()) {
      group.original._duplicateCount = group.duplicates.length;
    }

    const groupList = Array.from(groups.values()).map(g => ({
      id: g.id,
      fingerprint: g.fingerprint,
      original: g.original,
      duplicateCount: g.duplicates.length,
      duplicates: g.duplicates
    }));

    return {
      unique: processedRequests,
      duplicates: duplicates,
      groups: groupList,
      stats: {
        total: requests.length,
        unique: processedRequests.length,
        duplicates: duplicates.length,
        reductionRate: requests.length > 0 
          ? ((duplicates.length / requests.length) * 100).toFixed(2) + '%'
          : '0%'
      }
    };
  }

  mergeRequests(requests) {
    const result = this.processRequests(requests);
    
    if (this.config.mergeStrategy.keep === 'all') {
      return [...result.unique, ...result.duplicates];
    }
    
    return result.unique;
  }

  getGroups() {
    return Array.from(this.requestGroups.values());
  }

  clear() {
    this.requestGroups.clear();
    this.duplicateIndex.clear();
  }
}

module.exports = new RequestDeduplicator();
