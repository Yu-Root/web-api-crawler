const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '../../docs/apidocs');

function ensureDocsDir() {
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
}

function inferType(value) {
  if (value === null || value === undefined) return 'string';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number';
  }
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return 'string';
}

function parseJsonSchema(obj, depth = 0) {
  if (depth > 5 || !obj || typeof obj !== 'object') {
    return { type: inferType(obj) };
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return { type: 'array', items: { type: 'string' } };
    }
    return {
      type: 'array',
      items: parseJsonSchema(obj[0], depth + 1)
    };
  }

  const properties = {};
  for (const [key, value] of Object.entries(obj)) {
    properties[key] = parseJsonSchema(value, depth + 1);
  }

  return {
    type: 'object',
    properties
  };
}

function extractPathParams(url) {
  const params = [];
  const regex = /:([^/]+)/g;
  let match;
  while ((match = regex.exec(url)) !== null) {
    params.push(match[1]);
  }
  return params;
}

function extractQueryParams(url) {
  try {
    const urlObj = new URL(url);
    const params = [];
    urlObj.searchParams.forEach((value, key) => {
      params.push({
        name: key,
        value: value,
        type: inferType(value)
      });
    });
    return params;
  } catch {
    return [];
  }
}

function generateOpenApiSpec(module, requests) {
  const baseUrl = requests.length > 0 ? new URL(requests[0].url).origin : 'http://localhost';

  const spec = {
    openapi: '3.0.0',
    info: {
      title: `${module.name} API`,
      description: module.description || `API documentation for ${module.name}`,
      version: '1.0.0',
      contact: {
        name: 'API Crawler'
      }
    },
    servers: [
      {
        url: baseUrl,
        description: 'API Server'
      }
    ],
    paths: {},
    tags: [
      {
        name: module.name,
        description: module.description || ''
      }
    ]
  };

  const groupedRequests = {};
  requests.forEach(req => {
    try {
      const urlObj = new URL(req.url);
      const pathKey = urlObj.pathname;
      
      if (!groupedRequests[pathKey]) {
        groupedRequests[pathKey] = {};
      }
      
      if (!groupedRequests[pathKey][req.method.toLowerCase()]) {
        groupedRequests[pathKey][req.method.toLowerCase()] = [];
      }
      
      groupedRequests[pathKey][req.method.toLowerCase()].push(req);
    } catch (e) {}
  });

  for (const [pathKey, methods] of Object.entries(groupedRequests)) {
    spec.paths[pathKey] = {};

    for (const [method, reqs] of Object.entries(methods)) {
      const firstReq = reqs[0];
      const operation = {
        tags: [module.name],
        summary: `${method.toUpperCase()} ${pathKey}`,
        description: `Captured ${reqs.length} request(s) for this endpoint`,
        operationId: `${method}_${pathKey.replace(/[^a-zA-Z0-9]/g, '_')}`,
        parameters: [],
        responses: {}
      };

      const queryParams = extractQueryParams(firstReq.url);
      queryParams.forEach(param => {
        operation.parameters.push({
          name: param.name,
          in: 'query',
          schema: { type: param.type },
          example: param.value
        });
      });

      if (firstReq.headers) {
        const headerNames = Object.keys(firstReq.headers).filter(h => 
          !['host', 'content-length', 'accept-encoding', 'accept-language'].includes(h.toLowerCase())
        );
        headerNames.forEach(header => {
          operation.parameters.push({
            name: header,
            in: 'header',
            schema: { type: 'string' },
            example: firstReq.headers[header]
          });
        });
      }

      if (['post', 'put', 'patch'].includes(method) && firstReq.post_data) {
        let requestBody;
        try {
          const jsonBody = JSON.parse(firstReq.post_data);
          requestBody = {
            content: {
              'application/json': {
                schema: parseJsonSchema(jsonBody),
                example: jsonBody
              }
            }
          };
        } catch {
          requestBody = {
            content: {
              'text/plain': {
                schema: { type: 'string' },
                example: firstReq.post_data
              }
            }
          };
        }
        operation.requestBody = requestBody;
      }

      const statusCodes = new Set();
      reqs.forEach(req => {
        if (req.status) {
          statusCodes.add(req.status);
        }
      });

      statusCodes.forEach(code => {
        const matchingReq = reqs.find(r => r.status === code);
        let responseSchema = { type: 'object' };
        let example = null;

        if (matchingReq && matchingReq.response_body) {
          try {
            const jsonBody = JSON.parse(matchingReq.response_body);
            responseSchema = parseJsonSchema(jsonBody);
            example = jsonBody;
          } catch {
            example = matchingReq.response_body.substring(0, 1000);
          }
        }

        operation.responses[code] = {
          description: code >= 200 && code < 300 ? 'Success' : 'Error',
          content: {
            'application/json': {
              schema: responseSchema,
              ...(example && { example })
            }
          }
        };
      });

      if (Object.keys(operation.responses).length === 0) {
        operation.responses['200'] = {
          description: 'Success',
          content: {
            'application/json': {
              schema: { type: 'object' }
            }
          }
        };
      }

      spec.paths[pathKey][method] = operation;
    }
  }

  return spec;
}

function generateSwaggerSpec(openApiSpec) {
  return {
    swagger: '2.0',
    info: {
      title: openApiSpec.info.title,
      description: openApiSpec.info.description,
      version: openApiSpec.info.version
    },
    host: openApiSpec.servers[0]?.url?.replace(/^https?:\/\//, '') || 'localhost',
    basePath: '/',
    schemes: openApiSpec.servers[0]?.url?.startsWith('https') ? ['https'] : ['http'],
    paths: convertPathsToSwagger(openApiSpec.paths),
    tags: openApiSpec.tags
  };
}

function convertPathsToSwagger(openApiPaths) {
  const swaggerPaths = {};

  for (const [path, methods] of Object.entries(openApiPaths)) {
    swaggerPaths[path] = {};

    for (const [method, operation] of Object.entries(methods)) {
      const swaggerOp = {
        tags: operation.tags,
        summary: operation.summary,
        description: operation.description,
        operationId: operation.operationId,
        produces: ['application/json'],
        parameters: [],
        responses: {}
      };

      if (operation.parameters) {
        operation.parameters.forEach(param => {
          swaggerOp.parameters.push({
            name: param.name,
            in: param.in,
            type: param.schema?.type || 'string',
            ...(param.example && { default: param.example })
          });
        });
      }

      if (operation.requestBody) {
        const content = operation.requestBody.content;
        if (content['application/json']) {
          swaggerOp.parameters.push({
            name: 'body',
            in: 'body',
            schema: content['application/json'].schema || { type: 'object' }
          });
        }
      }

      for (const [code, response] of Object.entries(operation.responses)) {
        swaggerOp.responses[code] = {
          description: response.description,
          schema: response.content?.['application/json']?.schema || { type: 'object' }
        };
      }

      swaggerPaths[path][method] = swaggerOp;
    }
  }

  return swaggerPaths;
}

function generateYaml(spec, indent = 0) {
  const spaces = '  '.repeat(indent);
  let yaml = '';

  for (const [key, value] of Object.entries(spec)) {
    const yamlKey = key.includes(':') || key.includes('#') ? `"${key}"` : key;

    if (value === null || value === undefined) {
      yaml += `${spaces}${yamlKey}: null\n`;
    } else if (typeof value === 'boolean' || typeof value === 'number') {
      yaml += `${spaces}${yamlKey}: ${value}\n`;
    } else if (typeof value === 'string') {
      if (value.includes('\n') || value.includes(':') || value.includes('#')) {
        yaml += `${spaces}${yamlKey}: |\n${spaces}  ${value.split('\n').join(`\n${spaces}  `)}\n`;
      } else {
        yaml += `${spaces}${yamlKey}: ${value}\n`;
      }
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        yaml += `${spaces}${yamlKey}: []\n`;
      } else {
        yaml += `${spaces}${yamlKey}:\n`;
        value.forEach(item => {
          if (typeof item === 'object' && item !== null) {
            yaml += `${spaces}-\n${generateYaml(item, indent + 1).replace(/^/gm, '  ')}`;
          } else {
            yaml += `${spaces}  - ${typeof item === 'string' ? item : JSON.stringify(item)}\n`;
          }
        });
      }
    } else if (typeof value === 'object') {
      yaml += `${spaces}${yamlKey}:\n${generateYaml(value, indent + 1)}`;
    }
  }

  return yaml;
}

async function generateApiDocs(module, requests) {
  ensureDocsDir();

  const openApiSpec = generateOpenApiSpec(module, requests);
  const swaggerSpec = generateSwaggerSpec(openApiSpec);

  const baseName = module.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  
  const openApiJsonPath = path.join(docsDir, `${baseName}_openapi.json`);
  const openApiYamlPath = path.join(docsDir, `${baseName}_openapi.yaml`);
  const swaggerJsonPath = path.join(docsDir, `${baseName}_swagger.json`);

  fs.writeFileSync(openApiJsonPath, JSON.stringify(openApiSpec, null, 2));
  fs.writeFileSync(openApiYamlPath, generateYaml(openApiSpec));
  fs.writeFileSync(swaggerJsonPath, JSON.stringify(swaggerSpec, null, 2));

  return {
    openApi: openApiSpec,
    swagger: swaggerSpec,
    files: {
      openApiJson: openApiJsonPath,
      openApiYaml: openApiYamlPath,
      swaggerJson: swaggerJsonPath
    }
  };
}

function getApiDoc(moduleName) {
  const baseName = moduleName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  
  try {
    const openApiJson = fs.readFileSync(path.join(docsDir, `${baseName}_openapi.json`), 'utf-8');
    return {
      success: true,
      openApi: JSON.parse(openApiJson)
    };
  } catch (e) {
    return {
      success: false,
      error: 'API documentation not found'
    };
  }
}

function listApiDocs() {
  ensureDocsDir();
  
  const files = fs.readdirSync(docsDir);
  const modules = new Set();
  
  files.forEach(file => {
    const match = file.match(/^(.+)_openapi\.json$/);
    if (match) {
      modules.add(match[1]);
    }
  });
  
  return Array.from(modules).map(name => ({
    name,
    files: files.filter(f => f.startsWith(name))
  }));
}

module.exports = {
  generateApiDocs,
  getApiDoc,
  listApiDocs,
  generateOpenApiSpec,
  generateSwaggerSpec
};
