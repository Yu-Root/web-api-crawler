const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

function guessDataType(value) {
  if (typeof value === 'number') {
    return value % 1 === 0 ? 'integer' : 'number';
  }
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'object') {
    return 'object';
  }
  return 'string';
}

function inferSchema(data, maxDepth = 2, currentDepth = 0) {
  if (currentDepth >= maxDepth) {
    return { type: guessDataType(data) };
  }

  const type = guessDataType(data);

  if (type === 'object' && data !== null) {
    const properties = {};
    for (const [key, value] of Object.entries(data)) {
      properties[key] = inferSchema(value, maxDepth, currentDepth + 1);
    }
    return { type: 'object', properties };
  }

  if (type === 'array' && data.length > 0) {
    return { type: 'array', items: inferSchema(data[0], maxDepth, currentDepth + 1) };
  }

  return { type };
}

function parseJsonBody(body) {
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch (e) {
    return null;
  }
}

function extractPathFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch (e) {
    return '/';
  }
}

function extractServerUrl(url) {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}`;
  } catch (e) {
    return 'http://localhost';
  }
}

function generateOpenApiSpec(requests, options = {}) {
  const title = options.title || 'Generated API Documentation';
  const version = options.version || '1.0.0';

  const paths = {};
  const servers = new Set();
  const tags = new Set();

  for (const req of requests) {
    if (!req.url || !req.method) continue;

    const serverUrl = extractServerUrl(req.url);
    servers.add(serverUrl);

    const path = extractPathFromUrl(req.url);
    const method = req.method.toLowerCase();

    if (!paths[path]) {
      paths[path] = {};
    }

    const operation = {
      summary: `${req.method} ${path}`,
      operationId: `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
      responses: {}
    };

    const pathParts = path.split('/').filter(p => p);
    if (pathParts.length > 0) {
      tags.add(pathParts[0]);
      operation.tags = [pathParts[0]];
    }

    if (req.postData) {
      const parsedBody = parseJsonBody(req.postData);
      if (parsedBody) {
        operation.requestBody = {
          content: {
            'application/json': {
              schema: inferSchema(parsedBody)
            }
          }
        };
      }
    }

    if (req.status) {
      const response = {
        description: `HTTP ${req.status}`
      };

      if (req.responseBody) {
        const parsedResponse = parseJsonBody(req.responseBody);
        if (parsedResponse) {
          response.content = {
            'application/json': {
              schema: inferSchema(parsedResponse)
            }
          };
        }
      }

      operation.responses[req.status.toString()] = response;
    }

    if (!operation.responses['200']) {
      operation.responses['200'] = { description: 'Success' };
    }

    paths[path][method] = operation;
  }

  const spec = {
    openapi: '3.0.3',
    info: {
      title,
      version
    },
    servers: Array.from(servers).map(url => ({ url })),
    paths,
    tags: Array.from(tags).map(tag => ({ name: tag }))
  };

  return spec;
}

function saveToFiles(spec, outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const jsonPath = path.join(outputDir, 'swagger.json');
  const yamlPath = path.join(outputDir, 'openapi.yaml');

  fs.writeFileSync(jsonPath, JSON.stringify(spec, null, 2));
  fs.writeFileSync(yamlPath, YAML.stringify(spec));

  return { jsonPath, yamlPath };
}

function generateDocsFromRequests(requests, outputDir) {
  const apiRequests = requests.filter(r => 
    r.resourceType === 'xhr' || r.resourceType === 'fetch' || 
    r.url.includes('/api/') || r.url.includes('/v1/') || r.url.includes('/v2/')
  );

  const spec = generateOpenApiSpec(apiRequests);
  return saveToFiles(spec, outputDir);
}

module.exports = {
  generateOpenApiSpec,
  generateDocsFromRequests,
  saveToFiles,
  inferSchema,
  extractPathFromUrl
};
