const url = require('url');

const CATEGORIES = {
  API: {
    patterns: ['/api/', '/rest/', '/graphql', '/v1/', '/v2/', '/v3/', '/json/', '/rpc/'],
    keywords: ['api', 'rest', 'endpoint', 'service']
  },
  AUTH: {
    patterns: ['/auth/', '/login', '/logout', '/signin', '/signup', '/oauth', '/token'],
    keywords: ['auth', 'login', 'logout', 'signin', 'signup', 'oauth', 'token', 'jwt', 'session']
  },
  DATA: {
    patterns: ['/data/', '/query/', '/search/', '/find/', '/get/'],
    keywords: ['data', 'query', 'search', 'find', 'list', 'fetch', 'load']
  },
  CRUD: {
    patterns: ['/create', '/update', '/delete', '/save', '/remove'],
    keywords: ['create', 'update', 'delete', 'save', 'remove', 'insert', 'edit']
  },
  MEDIA: {
    patterns: ['/media/', '/image/', '/video/', '/audio/', '/file/', '/upload/', '/download/'],
    keywords: ['media', 'image', 'video', 'audio', 'file', 'upload', 'download', 'asset']
  },
  ADMIN: {
    patterns: ['/admin/', '/manage/', '/control/'],
    keywords: ['admin', 'manage', 'control', 'dashboard', 'panel']
  }
};

const TAGS = {
  SLOW: 'slow',
  ERROR: 'error',
  LARGE_RESPONSE: 'large-response',
  AUTHENTICATED: 'authenticated',
  JSON_API: 'json-api',
  FORM_DATA: 'form-data',
  CORS: 'cors',
  CACHED: 'cached',
  EXTERNAL: 'external'
};

function classifyRequest(requestData, baseUrl = '') {
  const tags = [];
  const requestUrl = requestData.url || '';
  const method = (requestData.method || 'GET').toUpperCase();
  const headers = requestData.headers || {};
  const postData = requestData.postData || requestData.post_data || '';
  const status = requestData.status || 0;
  const responseBody = requestData.responseBody || requestData.response_body || '';
  const responseTime = requestData.responseTime || 0;

  tags.push(...classifyByCategory(requestUrl, method, postData));
  tags.push(...classifyByHeaders(headers));
  tags.push(...classifyByStatusCode(status));
  tags.push(...classifyByResponse(responseBody, responseTime));
  tags.push(...classifyByUrlType(requestUrl, baseUrl));
  tags.push(...classifyByMethod(method));
  tags.push(...classifyByPostData(postData));

  return [...new Set(tags)];
}

function classifyByCategory(requestUrl, method, postData) {
  const tags = [];
  const lowerUrl = requestUrl.toLowerCase();
  const lowerPostData = postData.toLowerCase();

  for (const [category, config] of Object.entries(CATEGORIES)) {
    for (const pattern of config.patterns) {
      if (lowerUrl.includes(pattern)) {
        tags.push(category.toLowerCase());
        break;
      }
    }

    if (!tags.includes(category.toLowerCase())) {
      for (const keyword of config.keywords) {
        if (lowerUrl.includes(keyword) || lowerPostData.includes(keyword)) {
          tags.push(category.toLowerCase());
          break;
        }
      }
    }
  }

  return tags;
}

function classifyByMethod(method) {
  const tags = [];
  
  switch (method) {
    case 'GET':
      tags.push('read-only');
      tags.push('get-request');
      break;
    case 'POST':
      tags.push('write-request');
      tags.push('post-request');
      break;
    case 'PUT':
    case 'PATCH':
      tags.push('update-request');
      tags.push('write-request');
      break;
    case 'DELETE':
      tags.push('delete-request');
      tags.push('write-request');
      break;
  }

  return tags;
}

function classifyByHeaders(headers) {
  const tags = [];
  const lowerHeaders = {};
  
  for (const [key, value] of Object.entries(headers)) {
    lowerHeaders[key.toLowerCase()] = value;
  }

  if (lowerHeaders['authorization'] || 
      lowerHeaders['x-auth-token'] || 
      lowerHeaders['cookie']) {
    tags.push(TAGS.AUTHENTICATED);
  }

  if (lowerHeaders['content-type']) {
    const contentType = lowerHeaders['content-type'];
    if (contentType.includes('application/json')) {
      tags.push(TAGS.JSON_API);
    }
    if (contentType.includes('multipart/form-data') || 
        contentType.includes('application/x-www-form-urlencoded')) {
      tags.push(TAGS.FORM_DATA);
    }
  }

  if (lowerHeaders['access-control-allow-origin']) {
    tags.push(TAGS.CORS);
  }

  if (lowerHeaders['cache-control']) {
    const cacheControl = lowerHeaders['cache-control'];
    if (cacheControl.includes('public') || 
        cacheControl.includes('max-age')) {
      tags.push(TAGS.CACHED);
    }
  }

  return tags;
}

function classifyByStatusCode(status) {
  const tags = [];
  
  if (status >= 400) {
    tags.push(TAGS.ERROR);
  }

  if (status >= 200 && status < 300) {
    tags.push('success');
  } else if (status >= 300 && status < 400) {
    tags.push('redirect');
  } else if (status >= 400 && status < 500) {
    tags.push('client-error');
  } else if (status >= 500) {
    tags.push('server-error');
  }

  return tags;
}

function classifyByResponse(responseBody, responseTime) {
  const tags = [];
  
  if (responseTime > 5000) {
    tags.push(TAGS.SLOW);
  } else if (responseTime > 2000) {
    tags.push('medium-speed');
  } else {
    tags.push('fast');
  }

  if (responseBody && responseBody.length > 100000) {
    tags.push(TAGS.LARGE_RESPONSE);
  }

  return tags;
}

function classifyByUrlType(requestUrl, baseUrl) {
  const tags = [];
  
  try {
    const parsedUrl = new url.URL(requestUrl);
    
    if (baseUrl) {
      const parsedBase = new url.URL(baseUrl);
      if (parsedUrl.hostname !== parsedBase.hostname) {
        tags.push(TAGS.EXTERNAL);
      } else {
        tags.push('internal');
      }
    }

    const path = parsedUrl.pathname.toLowerCase();
    if (path.endsWith('.json') || path.endsWith('.js') || path.endsWith('.css')) {
      tags.push('static');
    }

    if (path.includes('.') && !path.endsWith('/')) {
      const ext = path.split('.').pop();
      if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'bmp', 'ico'].includes(ext)) {
        tags.push('image');
      } else if (['js', 'css', 'html', 'htm'].includes(ext)) {
        tags.push('asset');
      }
    }
  } catch {}

  return tags;
}

function classifyByPostData(postData) {
  const tags = [];
  
  if (!postData) return tags;

  try {
    JSON.parse(postData);
    if (!tags.includes(TAGS.JSON_API)) {
      tags.push(TAGS.JSON_API);
    }
  } catch {}

  if (postData.includes('FormData') || postData.includes('------WebKitFormBoundary')) {
    tags.push(TAGS.FORM_DATA);
  }

  return tags;
}

function getResourceTypeTags(resourceType) {
  const tags = [];
  const rt = (resourceType || '').toLowerCase();
  
  if (rt) {
    tags.push(`type:${rt}`);
  }

  return tags;
}

function classifyAndTag(request, baseUrl = '') {
  const tags = classifyRequest(request, baseUrl);
  
  if (request.resourceType || request.resource_type) {
    tags.push(...getResourceTypeTags(request.resourceType || request.resource_type));
  }

  return [...new Set(tags)];
}

async function classifyAndSave(requests, baseUrl = '') {
  const classified = [];
  const Request = require('../database/models/Request');

  for (const req of requests) {
    const tags = classifyAndTag(req, baseUrl);
    classified.push({ ...req, tags });

    if (req.id) {
      await Request.update(
        { tags: tags },
        { where: { id: req.id } }
      );
    }
  }

  return classified;
}

function getAllTagsFromRequests(requests) {
  const allTags = new Set();
  
  requests.forEach(req => {
    (req.tags || []).forEach(tag => allTags.add(tag));
  });

  return Array.from(allTags).sort();
}

function groupRequestsByTag(requests) {
  const groups = {};
  
  requests.forEach(req => {
    (req.tags || []).forEach(tag => {
      if (!groups[tag]) groups[tag] = [];
      groups[tag].push(req);
    });
  });

  return groups;
}

module.exports = {
  classifyRequest,
  classifyAndTag,
  classifyAndSave,
  getAllTagsFromRequests,
  groupRequestsByTag,
  TAGS,
  CATEGORIES
};
