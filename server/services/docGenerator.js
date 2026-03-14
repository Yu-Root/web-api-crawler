const fs = require('fs');
const path = require('path');

class DocGenerator {
  constructor() {
    this.outputDir = path.join(__dirname, '../../docs/apidocs');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  generateOpenApiSpec(requests, options = {}) {
    const { title = 'API Documentation', version = '1.0.0', description = '' } = options;
    
    const paths = {};
    const schemas = {};
    const tags = new Set();

    for (const req of requests) {
      try {
        const urlObj = new URL(req.url);
        const pathKey = this.normalizePath(urlObj.pathname);
        const method = req.method.toLowerCase();
        
        const tag = this.inferTag(urlObj.pathname);
        tags.add(tag);

        if (!paths[pathKey]) {
          paths[pathKey] = {};
        }

        const operation = this.buildOperation(req, tag);
        paths[pathKey][method] = operation;

        if (req.responseBody) {
          const schemaName = this.generateSchemaName(pathKey, method);
          schemas[schemaName] = this.inferSchema(req.responseBody);
        }
      } catch (e) {
        console.warn(`Failed to process request: ${req.url}`, e.message);
      }
    }

    const spec = {
      openapi: '3.0.3',
      info: {
        title,
        version,
        description,
        contact: {
          name: 'API Crawler'
        }
      },
      servers: [
        {
          url: '{baseUrl}',
          variables: {
            baseUrl: {
              default: 'https://api.example.com',
              description: 'API base URL'
            }
          }
        }
      ],
      tags: Array.from(tags).map(tag => ({
        name: tag,
        description: `${tag} related operations`
      })),
      paths,
      components: {
        schemas: {
          Error: {
            type: 'object',
            properties: {
              code: { type: 'integer' },
              message: { type: 'string' },
              details: { type: 'string' }
            }
          },
          ...schemas
        }
      }
    };

    return spec;
  }

  generateSwaggerSpec(requests, options = {}) {
    const openApiSpec = this.generateOpenApiSpec(requests, options);
    
    const swaggerSpec = {
      swagger: '2.0',
      info: openApiSpec.info,
      basePath: '/',
      schemes: ['https', 'http'],
      consumes: ['application/json'],
      produces: ['application/json'],
      tags: openApiSpec.tags,
      paths: this.convertToSwaggerPaths(openApiSpec.paths),
      definitions: openApiSpec.components.schemas
    };

    return swaggerSpec;
  }

  normalizePath(pathname) {
    return pathname.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  }

  inferTag(pathname) {
    const parts = pathname.split('/').filter(p => p && !p.match(/^\d+$/));
    if (parts.length >= 1) {
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
    return 'Default';
  }

  buildOperation(req, tag) {
    const operationId = this.generateOperationId(req);
    
    const operation = {
      tags: [tag],
      summary: `${req.method} ${new URL(req.url).pathname}`,
      operationId,
      parameters: this.extractParameters(req),
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: req.responseBody ? this.inferSchema(req.responseBody) : { type: 'object' }
            }
          }
        },
        '400': {
          description: 'Bad request',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        '500': {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      }
    };

    if (req.headers && Object.keys(req.headers).length > 0) {
      const headerParams = Object.entries(req.headers)
        .filter(([key]) => !['host', 'connection', 'content-length'].includes(key.toLowerCase()))
        .map(([key, value]) => ({
          name: key,
          in: 'header',
          required: false,
          schema: { type: 'string' },
          example: value
        }));
      
      operation.parameters.push(...headerParams);
    }

    return operation;
  }

  generateOperationId(req) {
    const urlObj = new URL(req.url);
    const parts = urlObj.pathname.split('/').filter(p => p && !p.match(/^\d+$/));
    const method = req.method.toLowerCase();
    
    if (parts.length === 0) return method;
    
    const action = parts[parts.length - 1];
    const resource = parts.length > 1 ? parts[parts.length - 2] : '';
    
    return `${method}${resource.charAt(0).toUpperCase() + resource.slice(1)}${action.charAt(0).toUpperCase() + action.slice(1)}`;
  }

  extractParameters(req) {
    const parameters = [];
    
    try {
      const urlObj = new URL(req.url);
      
      for (const [key, value] of urlObj.searchParams) {
        parameters.push({
          name: key,
          in: 'query',
          required: false,
          schema: { type: this.inferType(value) },
          example: value
        });
      }
      
      const pathParams = req.url.match(/\{([^}]+)\}/g);
      if (pathParams) {
        pathParams.forEach(param => {
          const paramName = param.slice(1, -1);
          parameters.push({
            name: paramName,
            in: 'path',
            required: true,
            schema: { type: 'string' }
          });
        }
      }
      
      const pathParts = urlObj.pathname.split('/');
      pathParts.forEach((part, index) => {
        if (part.match(/^\d+$/)) {
          const prevPart = pathParts[index - 1];
          if (prevPart) {
            const paramName = prevPart.replace(/s$/, '') + 'Id';
            if (!parameters.find(p => p.name === paramName && p.in === 'path')) {
              parameters.push({
                name: paramName,
                in: 'path',
                required: true,
                schema: { type: 'integer' },
                example: parseInt(part)
              });
            }
          }
        }
      });
    } catch (e) {}

    if (req.postData && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
      parameters.push({
        name: 'body',
        in: 'body',
        required: true,
        schema: this.inferSchema(req.postData)
      });
    }

    return parameters;
  }

  inferType(value) {
    if (value === 'true' || value === 'false') return 'boolean';
    if (!isNaN(value) && !isNaN(parseFloat(value))) return 'number';
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'string';
    return 'string';
  }

  inferSchema(data) {
    try {
      let parsed = data;
      if (typeof data === 'string') {
        try {
          parsed = JSON.parse(data);
        } catch {
          return { type: 'string', example: data.substring(0, 100) };
        }
      }

      if (parsed === null) return { type: 'null' };
      if (typeof parsed === 'boolean') return { type: 'boolean' };
      if (typeof parsed === 'number') return { type: 'number' };
      if (typeof parsed === 'string') return { type: 'string', example: parsed.substring(0, 100) };
      
      if (Array.isArray(parsed)) {
        return {
          type: 'array',
          items: parsed.length > 0 ? this.inferSchema(parsed[0]) : { type: 'object' }
        };
      }
      
      if (typeof parsed === 'object') {
        const properties = {};
        const required = [];
        
        for (const [key, value] of Object.entries(parsed)) {
          properties[key] = this.inferSchema(value);
          if (value !== null && value !== undefined) {
            required.push(key);
          }
        }
        
        return {
          type: 'object',
          properties,
          required: required.slice(0, 5)
        };
      }
      
      return { type: 'object' };
    } catch (e) {
      return { type: 'object' };
    }
  }

  generateSchemaName(path, method) {
    const parts = path.split('/').filter(p => p);
    const name = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    return `${method.toUpperCase()}${name}Response`;
  }

  convertToSwaggerPaths(openApiPaths) {
    const swaggerPaths = {};
    
    for (const [path, methods] of Object.entries(openApiPaths)) {
      swaggerPaths[path] = {};
      
      for (const [method, operation] of Object.entries(methods)) {
        const swaggerOp = { ...operation };
        
        if (swaggerOp.parameters) {
          swaggerOp.parameters = swaggerOp.parameters.map(param => {
            if (param.in === 'body') {
              return {
                name: 'body',
                in: 'body',
                required: param.required,
                schema: param.schema
              };
            }
            return param;
          });
        }
        
        if (swaggerOp.responses) {
          for (const [code, response] of Object.entries(swaggerOp.responses)) {
            if (response.content && response.content['application/json']) {
              swaggerPaths[path][method].responses[code] = {
                description: response.description,
                schema: response.content['application/json'].schema
              };
            }
          }
        }
        
        swaggerPaths[path][method] = swaggerOp;
      }
    }
    
    return swaggerPaths;
  }

  async generateDocs(requests, options = {}) {
    try {
      const openApiSpec = this.generateOpenApiSpec(requests, options);
      const swaggerSpec = this.generateSwaggerSpec(requests, options);

      const openApiPath = path.join(this.outputDir, 'openapi.yaml');
      const swaggerPath = path.join(this.outputDir, 'swagger.json');

      fs.writeFileSync(openApiPath, this.toYaml(openApiSpec), 'utf8');
      fs.writeFileSync(swaggerPath, JSON.stringify(swaggerSpec, null, 2), 'utf8');

      return {
        success: true,
        files: {
          openapi: openApiPath,
          swagger: swaggerPath
        },
        stats: {
          paths: Object.keys(openApiSpec.paths).length,
          schemas: Object.keys(openApiSpec.components.schemas).length,
          tags: openApiSpec.tags.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  toYaml(obj, indent = 0) {
    const spaces = '  '.repeat(indent);
    let yaml = '';

    if (obj === null) {
      return 'null';
    }

    if (typeof obj === 'string') {
      if (obj.includes('\n') || obj.includes(':') || obj.includes('#')) {
        return `|2\n${spaces}  ${obj.split('\n').join('\n' + spaces + '  ')}`;
      }
      return obj;
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return String(obj);
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      for (const item of obj) {
        if (typeof item === 'object' && item !== null) {
          yaml += `\n${spaces}- ${this.toYaml(item, indent + 1).trimStart()}`;
        } else {
          yaml += `\n${spaces}- ${this.toYaml(item, 0)}`;
        }
      }
      return yaml;
    }

    if (typeof obj === 'object') {
      const entries = Object.entries(obj);
      if (entries.length === 0) return '{}';
      
      for (const [key, value] of entries) {
        if (value === undefined) continue;
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          yaml += `\n${spaces}${key}:`;
          const childYaml = this.toYaml(value, indent + 1);
          if (childYaml) {
            yaml += childYaml;
          }
        } else if (Array.isArray(value)) {
          yaml += `\n${spaces}${key}:`;
          if (value.length === 0) {
            yaml += ' []';
          } else {
            yaml += this.toYaml(value, indent + 1);
          }
        } else {
          yaml += `\n${spaces}${key}: ${this.toYaml(value, 0)}`;
        }
      }
      return yaml;
    }

    return String(obj);
  }
}

module.exports = new DocGenerator();
