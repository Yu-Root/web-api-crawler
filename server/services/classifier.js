const fs = require('fs');
const path = require('path');

class Classifier {
  constructor() {
    this.categories = this.loadCategories();
    this.patterns = this.loadPatterns();
    this.tagHistory = new Map();
  }

  loadCategories() {
    return {
      authentication: {
        name: '认证授权',
        description: '登录、注册、Token刷新、权限验证',
        priority: 1,
        keywords: ['login', 'logout', 'auth', 'token', 'session', 'oauth', 'sso', 'password', 'register', 'signin', 'signup']
      },
      user: {
        name: '用户管理',
        description: '用户信息、个人中心、账户设置',
        priority: 2,
        keywords: ['user', 'profile', 'account', 'member', 'person', 'avatar', 'setting']
      },
      data: {
        name: '数据操作',
        description: 'CRUD操作、数据查询、列表、详情',
        priority: 3,
        keywords: ['list', 'get', 'query', 'search', 'detail', 'info', 'data', 'fetch']
      },
      create: {
        name: '创建操作',
        description: '新建、添加、提交数据',
        priority: 4,
        keywords: ['create', 'add', 'new', 'insert', 'post', 'submit', 'save']
      },
      update: {
        name: '更新操作',
        description: '修改、编辑、更新数据',
        priority: 5,
        keywords: ['update', 'edit', 'modify', 'change', 'put', 'patch']
      },
      delete: {
        name: '删除操作',
        description: '删除、移除数据',
        priority: 6,
        keywords: ['delete', 'remove', 'del', 'destroy', 'clear']
      },
      file: {
        name: '文件处理',
        description: '文件上传、下载、存储',
        priority: 7,
        keywords: ['file', 'upload', 'download', 'image', 'video', 'audio', 'document', 'attachment', 'media']
      },
      notification: {
        name: '消息通知',
        description: '消息、通知、邮件、推送',
        priority: 8,
        keywords: ['message', 'notification', 'notice', 'email', 'sms', 'push', 'alert', 'remind']
      },
      payment: {
        name: '支付交易',
        description: '支付、订单、交易、财务',
        priority: 9,
        keywords: ['pay', 'payment', 'order', 'trade', 'transaction', 'bill', 'invoice', 'money', 'price', 'cost']
      },
      analytics: {
        name: '统计分析',
        description: '统计、报表、分析、监控',
        priority: 10,
        keywords: ['stat', 'analytics', 'report', 'chart', 'dashboard', 'metric', 'count', 'summary', 'overview']
      },
      system: {
        name: '系统服务',
        description: '系统配置、健康检查、日志',
        priority: 11,
        keywords: ['system', 'config', 'setting', 'health', 'ping', 'log', 'monitor', 'admin']
      },
      content: {
        name: '内容管理',
        description: '文章、内容、CMS相关',
        priority: 12,
        keywords: ['content', 'article', 'post', 'blog', 'news', 'cms', 'page', 'text']
      },
      social: {
        name: '社交互动',
        description: '评论、点赞、分享、关注',
        priority: 13,
        keywords: ['comment', 'like', 'share', 'follow', 'friend', 'social', 'review', 'rating']
      },
      thirdParty: {
        name: '第三方服务',
        description: '外部API、第三方集成',
        priority: 14,
        keywords: ['third', 'external', 'api', 'integration', 'webhook', 'callback', 'oauth']
      },
      static: {
        name: '静态资源',
        description: 'JS、CSS、图片等静态文件',
        priority: 99,
        keywords: ['.js', '.css', '.png', '.jpg', '.gif', '.svg', '.woff', '.ttf']
      }
    };
  }

  loadPatterns() {
    return {
      restPatterns: [
        { pattern: /GET\s+.*\/\w+\/\d+$/, category: 'data', confidence: 0.9, description: '获取单个资源' },
        { pattern: /GET\s+.*\/\w+$/, category: 'data', confidence: 0.8, description: '获取资源列表' },
        { pattern: /POST\s+.*\/\w+$/, category: 'create', confidence: 0.9, description: '创建资源' },
        { pattern: /PUT\s+.*\/\w+\/\d+$/, category: 'update', confidence: 0.9, description: '更新资源' },
        { pattern: /PATCH\s+.*\/\w+\/\d+$/, category: 'update', confidence: 0.9, description: '部分更新' },
        { pattern: /DELETE\s+.*\/\w+\/\d+$/, category: 'delete', confidence: 0.95, description: '删除资源' }
      ],
      urlPatterns: [
        { pattern: /\/api\/v\d+\//, category: 'system', confidence: 0.5, description: 'API版本路径' },
        { pattern: /\/graphql/, category: 'data', confidence: 0.8, description: 'GraphQL端点' },
        { pattern: /\/rest\/|\/restful\//, category: 'data', confidence: 0.7, description: 'REST端点' },
        { pattern: /\/public\/|\/static\//, category: 'static', confidence: 0.9, description: '公共资源' }
      ]
    };
  }

  classify(request) {
    const results = [];
    
    const urlLower = request.url.toLowerCase();
    const pathMatch = urlLower.match(/^https?:\/\/[^\/]+(\/[^?#]*)/);
    const path = pathMatch ? pathMatch[1] : urlLower;
    
    const method = request.method ? request.method.toUpperCase() : 'GET';
    
    for (const [key, category] of Object.entries(this.categories)) {
      let score = 0;
      let matchedKeywords = [];
      
      for (const keyword of category.keywords) {
        if (path.includes(keyword.toLowerCase())) {
          score += 1;
          matchedKeywords.push(keyword);
        }
      }
      
      if (score > 0) {
        results.push({
          category: key,
          categoryName: category.name,
          score: score / category.keywords.length,
          matchedKeywords,
          source: 'keyword'
        });
      }
    }

    for (const pattern of this.patterns.restPatterns) {
      const testString = `${method} ${path}`;
      if (pattern.pattern.test(testString)) {
        results.push({
          category: pattern.category,
          categoryName: this.categories[pattern.category]?.name || pattern.category,
          score: pattern.confidence,
          description: pattern.description,
          source: 'rest-pattern'
        });
      }
    }

    for (const pattern of this.patterns.urlPatterns) {
      if (pattern.pattern.test(path)) {
        results.push({
          category: pattern.category,
          categoryName: this.categories[pattern.category]?.name || pattern.category,
          score: pattern.confidence,
          description: pattern.description,
          source: 'url-pattern'
        });
      }
    }

    const methodCategory = this.classifyByMethod(method);
    if (methodCategory) {
      results.push({
        category: methodCategory.category,
        categoryName: this.categories[methodCategory.category]?.name || methodCategory.category,
        score: methodCategory.confidence,
        source: 'http-method'
      });
    }

    const contentTypeCategory = this.classifyByContentType(request.headers);
    if (contentTypeCategory) {
      results.push({
        category: contentTypeCategory.category,
        categoryName: this.categories[contentTypeCategory.category]?.name || contentTypeCategory.category,
        score: contentTypeCategory.confidence,
        source: 'content-type'
      });
    }

    const mergedResults = this.mergeResults(results);
    
    const finalTags = mergedResults
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(r => ({
        category: r.category,
        name: r.categoryName,
        confidence: Math.round(r.score * 100) / 100,
        source: r.source
      }));

    return {
      primary: finalTags[0] || null,
      tags: finalTags,
      allCandidates: mergedResults.sort((a, b) => b.score - a.score),
      confidence: finalTags[0]?.confidence || 0
    };
  }

  classifyByMethod(method) {
    const methodMap = {
      'GET': { category: 'data', confidence: 0.6 },
      'POST': { category: 'create', confidence: 0.7 },
      'PUT': { category: 'update', confidence: 0.8 },
      'PATCH': { category: 'update', confidence: 0.8 },
      'DELETE': { category: 'delete', confidence: 0.9 }
    };
    
    return methodMap[method] || null;
  }

  classifyByContentType(headers) {
    if (!headers) return null;
    
    const contentType = headers['content-type'] || headers['Content-Type'] || '';
    
    if (contentType.includes('multipart/form-data')) {
      return { category: 'file', confidence: 0.9 };
    }
    if (contentType.includes('image/') || contentType.includes('video/') || contentType.includes('audio/')) {
      return { category: 'file', confidence: 0.95 };
    }
    if (contentType.includes('application/json')) {
      return { category: 'data', confidence: 0.5 };
    }
    
    return null;
  }

  mergeResults(results) {
    const merged = new Map();
    
    for (const result of results) {
      const key = result.category;
      if (merged.has(key)) {
        const existing = merged.get(key);
        existing.score = Math.max(existing.score, result.score);
        existing.sources = existing.sources || [existing.source];
        existing.sources.push(result.source);
        existing.source = existing.sources.join(', ');
      } else {
        merged.set(key, { ...result });
      }
    }
    
    return Array.from(merged.values());
  }

  classifyBatch(requests) {
    const results = [];
    const categoryStats = {};
    
    for (const request of requests) {
      const classification = this.classify(request);
      
      results.push({
        requestId: request.id,
        url: request.url,
        method: request.method,
        classification
      });
      
      if (classification.primary) {
        const cat = classification.primary.category;
        categoryStats[cat] = (categoryStats[cat] || 0) + 1;
      }
    }
    
    const total = requests.length;
    const distribution = Object.entries(categoryStats)
      .map(([category, count]) => ({
        category,
        name: this.categories[category]?.name || category,
        count,
        percentage: Math.round((count / total) * 1000) / 10
      }))
      .sort((a, b) => b.count - a.count);
    
    return {
      results,
      stats: {
        total,
        classified: results.filter(r => r.classification.primary).length,
        distribution
      }
    };
  }

  getCategories() {
    return Object.entries(this.categories).map(([key, value]) => ({
      id: key,
      name: value.name,
      description: value.description,
      priority: value.priority,
      keywords: value.keywords
    }));
  }

  addCategory(id, config) {
    this.categories[id] = {
      name: config.name,
      description: config.description,
      priority: config.priority || 99,
      keywords: config.keywords || []
    };
  }

  updateCategory(id, updates) {
    if (this.categories[id]) {
      Object.assign(this.categories[id], updates);
    }
  }

  removeCategory(id) {
    delete this.categories[id];
  }

  autoTagRequest(request) {
    const classification = this.classify(request);
    
    return {
      ...request,
      tags: classification.tags.map(t => t.category),
      primaryTag: classification.primary?.category || null,
      tagConfidence: classification.confidence,
      tagDetails: classification
    };
  }

  getTagSuggestions(partialTag) {
    const suggestions = [];
    const partial = partialTag.toLowerCase();
    
    for (const [key, category] of Object.entries(this.categories)) {
      if (key.includes(partial) || category.name.toLowerCase().includes(partial)) {
        suggestions.push({
          id: key,
          name: category.name,
          description: category.description
        });
      }
      
      for (const keyword of category.keywords) {
        if (keyword.includes(partial)) {
          suggestions.push({
            id: key,
            name: category.name,
            keyword,
            description: category.description
          });
        }
      }
    }
    
    return [...new Map(suggestions.map(s => [s.id, s])).values()];
  }

  analyzeTagDistribution(requests) {
    const distribution = new Map();
    const methodDistribution = new Map();
    const domainDistribution = new Map();
    
    for (const request of requests) {
      const classification = this.classify(request);
      
      for (const tag of classification.tags) {
        if (!distribution.has(tag.category)) {
          distribution.set(tag.category, {
            count: 0,
            requests: [],
            avgConfidence: 0,
            totalConfidence: 0
          });
        }
        
        const stats = distribution.get(tag.category);
        stats.count++;
        stats.requests.push(request);
        stats.totalConfidence += tag.confidence;
        stats.avgConfidence = stats.totalConfidence / stats.count;
      }
      
      const method = request.method || 'UNKNOWN';
      methodDistribution.set(method, (methodDistribution.get(method) || 0) + 1);
      
      try {
        const urlObj = new URL(request.url);
        const domain = urlObj.hostname;
        domainDistribution.set(domain, (domainDistribution.get(domain) || 0) + 1);
      } catch (e) {}
    }
    
    return {
      byTag: Array.from(distribution.entries())
        .map(([tag, stats]) => ({
          tag,
          name: this.categories[tag]?.name || tag,
          count: stats.count,
          avgConfidence: Math.round(stats.avgConfidence * 100) / 100
        }))
        .sort((a, b) => b.count - a.count),
      byMethod: Array.from(methodDistribution.entries())
        .map(([method, count]) => ({ method, count }))
        .sort((a, b) => b.count - a.count),
      byDomain: Array.from(domainDistribution.entries())
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count)
    };
  }
}

module.exports = new Classifier();
