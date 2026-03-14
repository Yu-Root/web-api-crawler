const classificationRules = {
  categories: {
    auth: {
      patterns: [
        /login/i, /signin/i, /sign-in/i, /logout/i, /signout/i, /sign-out/i,
        /auth/i, /authenticate/i, /token/i, /oauth/i, /session/i,
        /password/i, /credential/i, /verify/i, /captcha/i
      ],
      tags: ['authentication', 'security']
    },
    user: {
      patterns: [
        /user/i, /profile/i, /account/i, /me/i, /avatar/i, /settings/i,
        /preference/i, /subscription/i, /membership/i
      ],
      tags: ['user', 'profile']
    },
    data: {
      patterns: [
        /data/i, /list/i, /query/i, /search/i, /filter/i, /sort/i,
        /page/i, /paginate/i, /fetch/i, /load/i, /get/i
      ],
      tags: ['data', 'fetch']
    },
    content: {
      patterns: [
        /content/i, /article/i, /post/i, /comment/i, /thread/i, /message/i,
        /notification/i, /feed/i, /news/i, /story/i, /media/i, /image/i, /video/i
      ],
      tags: ['content', 'media']
    },
    commerce: {
      patterns: [
        /order/i, /cart/i, /checkout/i, /payment/i, /purchase/i, /buy/i,
        /product/i, /item/i, /price/i, /inventory/i, /stock/i, /shipping/i
      ],
      tags: ['commerce', 'transaction']
    },
    analytics: {
      patterns: [
        /analytics/i, /track/i, /event/i, /metric/i, /stat/i, /report/i,
        /log/i, /monitor/i, /measure/i, /collect/i
      ],
      tags: ['analytics', 'tracking']
    },
    config: {
      patterns: [
        /config/i, /setting/i, /option/i, /feature/i, /flag/i, /toggle/i,
        /version/i, /health/i, /status/i, /ping/i
      ],
      tags: ['config', 'system']
    },
    api: {
      patterns: [
        /api/i, /v1/i, /v2/i, /v3/i, /graphql/i, /rest/i, /endpoint/i
      ],
      tags: ['api', 'backend']
    },
    websocket: {
      patterns: [
        /ws/i, /websocket/i, /socket/i, /realtime/i, /stream/i, /push/i
      ],
      tags: ['websocket', 'realtime']
    },
    static: {
      patterns: [
        /\.js$/i, /\.css$/i, /\.html$/i, /\.png$/i, /\.jpg$/i, /\.gif$/i,
        /\.svg$/i, /\.woff/i, /\.ttf/i, /static/i, /asset/i, /cdn/i
      ],
      tags: ['static', 'asset']
    }
  },
  
  methodCategories: {
    GET: 'read',
    POST: 'create',
    PUT: 'update',
    PATCH: 'update',
    DELETE: 'delete'
  },
  
  statusCategories: {
    success: [200, 201, 202, 204],
    redirect: [301, 302, 303, 307, 308],
    clientError: [400, 401, 403, 404, 405, 408, 409, 410, 422, 429],
    serverError: [500, 502, 503, 504, 505]
  }
};

function classifyRequest(request) {
  const tags = new Set();
  let category = 'other';
  
  const url = request.url || '';
  const method = request.method || 'GET';
  const status = request.status;
  const resourceType = request.resourceType || '';
  
  for (const [catName, catConfig] of Object.entries(classificationRules.categories)) {
    for (const pattern of catConfig.patterns) {
      if (pattern.test(url)) {
        category = catName;
        catConfig.tags.forEach(tag => tags.add(tag));
        break;
      }
    }
    if (category !== 'other' && category === catName) break;
  }
  
  const methodCategory = classificationRules.methodCategories[method];
  if (methodCategory) {
    tags.add(methodCategory);
  }
  
  if (status) {
    if (classificationRules.statusCategories.success.includes(status)) {
      tags.add('success');
    } else if (classificationRules.statusCategories.redirect.includes(status)) {
      tags.add('redirect');
    } else if (classificationRules.statusCategories.clientError.includes(status)) {
      tags.add('client-error');
      tags.add('error');
    } else if (classificationRules.statusCategories.serverError.includes(status)) {
      tags.add('server-error');
      tags.add('error');
    }
  }
  
  if (resourceType) {
    tags.add(resourceType);
  }
  
  if (request.postData || request.post_data) {
    tags.add('has-body');
    
    const postData = request.postData || request.post_data;
    try {
      JSON.parse(postData);
      tags.add('json-body');
    } catch (e) {
      if (postData.includes('=')) {
        tags.add('form-data');
      }
    }
  }
  
  if (request.responseBody || request.response_body) {
    tags.add('has-response');
    
    const responseBody = request.responseBody || request.response_body;
    try {
      const json = JSON.parse(responseBody);
      tags.add('json-response');
      
      if (Array.isArray(json)) {
        tags.add('array-response');
      } else if (json.data) {
        tags.add('data-wrapper');
      }
      if (json.pagination || json.page || json.total) {
        tags.add('paginated');
      }
      if (json.error || json.errors) {
        tags.add('error-response');
      }
    } catch (e) {}
  }
  
  try {
    const urlObj = new URL(url);
    
    if (urlObj.searchParams.size > 0) {
      tags.add('has-params');
    }
    
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    pathParts.forEach(part => {
      if (/^\d+$/.test(part)) {
        tags.add('has-id-param');
      }
      if (/^[a-f0-9]{24}$/i.test(part)) {
        tags.add('mongodb-id');
      }
      if (/^[a-f0-9-]{36}$/i.test(part)) {
        tags.add('uuid-param');
      }
    });
    
    const domain = urlObj.hostname;
    if (domain.includes('api.')) {
      tags.add('api-subdomain');
    }
    if (domain.includes('.cdn.')) {
      tags.add('cdn');
    }
  } catch (e) {}
  
  return {
    category,
    tags: Array.from(tags),
    confidence: calculateConfidence(tags.size)
  };
}

function calculateConfidence(tagCount) {
  if (tagCount >= 5) return 'high';
  if (tagCount >= 3) return 'medium';
  return 'low';
}

function classifyRequests(requests) {
  return requests.map(req => {
    const classification = classifyRequest(req);
    return {
      ...req,
      category: classification.category,
      tags: classification.tags
    };
  });
}

function getAvailableTags(requests) {
  const tagSet = new Set();
  
  requests.forEach(req => {
    const classification = classifyRequest(req);
    classification.tags.forEach(tag => tagSet.add(tag));
  });
  
  return Array.from(tagSet).sort();
}

function getCategories(requests) {
  const categoryMap = new Map();
  
  requests.forEach(req => {
    const classification = classifyRequest(req);
    const cat = classification.category;
    
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, {
        name: cat,
        count: 0,
        tags: new Set()
      });
    }
    
    const catData = categoryMap.get(cat);
    catData.count++;
    classification.tags.forEach(tag => catData.tags.add(tag));
  });
  
  return Array.from(categoryMap.values()).map(cat => ({
    ...cat,
    tags: Array.from(cat.tags)
  }));
}

function suggestTags(request) {
  const classification = classifyRequest(request);
  const suggestions = [];
  
  const url = request.url || '';
  
  if (url.includes('/api/')) {
    suggestions.push({ tag: 'api', reason: 'URL contains /api/' });
  }
  
  if (request.method === 'POST' && !request.postData) {
    suggestions.push({ tag: 'empty-body', reason: 'POST request without body' });
  }
  
  if (request.status === 401) {
    suggestions.push({ tag: 'requires-auth', reason: '401 status indicates authentication required' });
  }
  
  if (request.status === 404) {
    suggestions.push({ tag: 'not-found', reason: '404 status indicates resource not found' });
  }
  
  return {
    currentTags: classification.tags,
    suggestions
  };
}

function setClassificationRules(rules) {
  Object.assign(classificationRules, rules);
}

function getClassificationRules() {
  return { ...classificationRules };
}

module.exports = {
  classifyRequest,
  classifyRequests,
  getAvailableTags,
  getCategories,
  suggestTags,
  setClassificationRules,
  getClassificationRules
};
