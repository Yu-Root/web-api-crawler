const url = require('url');
const crypto = require('crypto');

class DependencyAnalyzer {
  constructor() {
    this.requestChain = [];
    this.baseUrl = '';
  }

  reset() {
    this.requestChain = [];
    this.baseUrl = '';
  }

  setBaseUrl(url) {
    this.baseUrl = url;
  }

  addRequest(requestData, navigationOrder = 0) {
    const enrichedRequest = {
      ...requestData,
      navigation_order: navigationOrder,
      dependencies: [],
      dependents: [],
      dependency_type: null
    };
    this.requestChain.push(enrichedRequest);
    return enrichedRequest;
  }

  analyzeDependencies() {
    if (this.requestChain.length < 2) return this.requestChain;

    this.analyzeChainedDependencies();
    this.analyzeDataDependencies();
    this.analyzeResourceDependencies();
    this.analyzeApiDependencies();

    return this.requestChain;
  }

  analyzeChainedDependencies() {
    const sortedRequests = [...this.requestChain].sort((a, b) => 
      (a.navigation_order || 0) - (b.navigation_order || 0) || a.timestamp - b.timestamp
    );

    for (let i = 1; i < sortedRequests.length; i++) {
      const current = sortedRequests[i];
      const previous = sortedRequests[i - 1];
      
      const timeDiff = current.timestamp - previous.timestamp;
      if (timeDiff < 10000) {
        this.addDependency(current, previous, 'navigation_chain');
      }
    }
  }

  analyzeDataDependencies() {
    const responseMap = new Map();
    
    for (const req of this.requestChain) {
      if (req.responseBody) {
        const responseHash = crypto.createHash('md5').update(req.responseBody.substring(0, 1000)).digest('hex');
        responseMap.set(responseHash, req);
      }
    }

    for (const currentReq of this.requestChain) {
      const postData = currentReq.postData || currentReq.post_data || '';
      const headers = currentReq.headers || {};
      
      for (const [hash, prevReq] of responseMap.entries()) {
        if (currentReq === prevReq) continue;
        
        if (prevReq.responseBody && postData) {
          const prevBodySample = prevReq.responseBody.substring(0, 500);
          if (postData.includes(prevBodySample.substring(0, 20)) || 
              this.containsIdReference(postData, prevReq.responseBody)) {
            this.addDependency(currentReq, prevReq, 'data_flow');
          }
        }
      }
    }
  }

  containsIdReference(source, target) {
    const idPatterns = [/"id"?\s*:\s*"?(\w+)"?/g, /(\w+)_id"?\s*=\s*"?(\w+)"?/g];
    const ids = new Set();
    
    for (const pattern of idPatterns) {
      let match;
      while ((match = pattern.exec(target)) !== null) {
        if (match[1] && match[1].length > 3) ids.add(match[1]);
        if (match[2] && match[2].length > 3) ids.add(match[2]);
      }
    }
    
    for (const id of ids) {
      if (id.length > 3 && source.includes(id)) return true;
    }
    return false;
  }

  analyzeResourceDependencies() {
    const pageRequests = this.requestChain.filter(r => 
      r.resourceType === 'document' || r.resource_type === 'document'
    );
    
    for (const pageReq of pageRequests) {
      const pageUrl = pageReq.url || '';
      const pageOrigin = url.parse(pageUrl).origin;
      
      for (const resourceReq of this.requestChain) {
        if (resourceReq === pageReq) continue;
        
        const resourceUrl = resourceReq.url || '';
        const resourceOrigin = url.parse(resourceUrl).origin;
        
        if (pageOrigin === resourceOrigin) {
          const timeDiff = Math.abs((resourceReq.timestamp || 0) - (pageReq.timestamp || 0));
          if (timeDiff < 30000) {
            this.addDependency(resourceReq, pageReq, 'page_resource');
          }
        }
      }
    }
  }

  analyzeApiDependencies() {
    const apiRequests = this.requestChain.filter(r => {
      const urlStr = r.url || '';
      return urlStr.includes('/api/') || urlStr.includes('/v1/') || urlStr.includes('/v2/');
    });

    for (let i = 0; i < apiRequests.length; i++) {
      for (let j = i + 1; j < apiRequests.length; j++) {
        const reqA = apiRequests[i];
        const reqB = apiRequests[j];
        
        const pathA = url.parse(reqA.url || '').pathname || '';
        const pathB = url.parse(reqB.url || '').pathname || '';
        
        if (this.areRelatedPaths(pathA, pathB)) {
          const timeDiff = Math.abs((reqA.timestamp || 0) - (reqB.timestamp || 0));
          if (timeDiff < 60000) {
            this.addDependency(reqB, reqA, 'api_sequence');
          }
        }
      }
    }
  }

  areRelatedPaths(pathA, pathB) {
    const segmentsA = pathA.split('/').filter(s => s.length > 0);
    const segmentsB = pathB.split('/').filter(s => s.length > 0);
    
    if (segmentsA[0] === segmentsB[0]) return true;
    
    const idPattern = /^\d+|[a-f0-9-]{8,}$/i;
    const normalizedA = segmentsA.map(s => idPattern.test(s) ? '{id}' : s).join('/');
    const normalizedB = segmentsB.map(s => idPattern.test(s) ? '{id}' : s).join('/');
    
    return normalizedA === normalizedB;
  }

  addDependency(dependent, dependency, type) {
    const depId = dependency.id || dependency.url;
    const dpdId = dependent.id || dependent.url;
    
    if (!dependent.dependencies) dependent.dependencies = [];
    if (!dependency.dependents) dependency.dependents = [];
    
    if (!dependent.dependencies.some(d => (d.id || d.url) === depId)) {
      dependent.dependencies.push({
        id: dependency.id,
        url: dependency.url,
        method: dependency.method,
        type: type
      });
    }
    
    if (!dependency.dependents.some(d => (d.id || d.url) === dpdId)) {
      dependency.dependents.push({
        id: dependent.id,
        url: dependent.url,
        method: dependent.method
      });
    }
    
    if (!dependent.dependency_type) {
      dependent.dependency_type = type;
    }
  }

  getDependencyGraph() {
    const nodes = [];
    const links = [];
    const nodeMap = new Map();

    this.requestChain.forEach((req, index) => {
      const nodeId = req.id || `node_${index}`;
      const urlStr = req.url || '';
      const method = req.method || 'GET';
      
      let nodeType = 'other';
      if (req.resourceType === 'document' || req.resource_type === 'document') {
        nodeType = 'page';
      } else if (urlStr.includes('/api/') || urlStr.includes('/v1/') || urlStr.includes('/v2/')) {
        nodeType = 'api';
      } else if (req.resourceType === 'xhr' || req.resource_type === 'fetch') {
        nodeType = 'xhr';
      }

      const node = {
        id: nodeId,
        url: urlStr,
        method: method,
        type: nodeType,
        status: req.status,
        navigation_order: req.navigation_order,
        dependencies: req.dependencies || [],
        dependents: req.dependents || []
      };
      
      nodes.push(node);
      nodeMap.set(nodeId, node);
    });

    this.requestChain.forEach((req, reqIndex) => {
      const sourceId = req.id || `node_${reqIndex}`;
      
      (req.dependencies || []).forEach(dep => {
        const targetId = dep.id;
        if (targetId && nodeMap.has(targetId.toString())) {
          links.push({
            source: sourceId,
            target: targetId.toString(),
            type: dep.type || 'unknown'
          });
        }
      });
    });

    return { nodes, links };
  }

  async analyzeAndSave(requests, moduleId = null) {
    this.reset();
    requests.forEach((req, idx) => {
      this.addRequest(req, req.navigation_order || idx);
    });
    
    this.analyzeDependencies();
    
    if (moduleId) {
      const Request = require('../database/models/Request');
      for (const req of this.requestChain) {
        if (req.id) {
          await Request.update(
            {
              dependencies: req.dependencies,
              dependents: req.dependents,
              dependency_type: req.dependency_type,
              navigation_order: req.navigation_order
            },
            { where: { id: req.id } }
          );
        }
      }
    }
    
    return this.requestChain;
  }
}

const analyzer = new DependencyAnalyzer();

module.exports = {
  DependencyAnalyzer,
  analyzer,
  analyzeDependencies: (requests) => {
    const tempAnalyzer = new DependencyAnalyzer();
    requests.forEach((req, idx) => tempAnalyzer.addRequest(req, idx));
    tempAnalyzer.analyzeDependencies();
    return tempAnalyzer.requestChain;
  },
  getDependencyGraph: (requests) => {
    const tempAnalyzer = new DependencyAnalyzer();
    requests.forEach((req, idx) => tempAnalyzer.addRequest(req, idx));
    tempAnalyzer.analyzeDependencies();
    return tempAnalyzer.getDependencyGraph();
  }
};
