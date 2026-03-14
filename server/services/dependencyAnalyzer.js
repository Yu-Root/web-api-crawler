const crypto = require('crypto');

class DependencyAnalyzer {
  constructor() {
    this.dependencies = new Map();
    this.requestGraph = new Map();
    this.sessionData = new Map();
  }

  analyzeDependencies(requests, options = {}) {
    const { 
      timeWindow = 5000, 
      analyzeHeaders = true,
      analyzeBody = true,
      analyzeResponse = true 
    } = options;

    const graph = {
      nodes: [],
      edges: [],
      groups: []
    };

    const sortedRequests = [...requests].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    const requestMap = new Map();
    sortedRequests.forEach((req, index) => {
      const nodeId = this.generateNodeId(req);
      requestMap.set(req.id || index, {
        ...req,
        nodeId,
        index
      });
      
      graph.nodes.push({
        id: nodeId,
        requestId: req.id || index,
        url: req.url,
        method: req.method,
        status: req.status,
        timestamp: req.timestamp,
        resourceType: req.resourceType,
        group: this.inferGroup(req)
      });
    });

    for (let i = 0; i < sortedRequests.length; i++) {
      const current = requestMap.get(sortedRequests[i].id || i);
      
      for (let j = i + 1; j < sortedRequests.length; j++) {
        const next = requestMap.get(sortedRequests[j].id || j);
        const timeDiff = (next.timestamp || 0) - (current.timestamp || 0);
        
        if (timeDiff > timeWindow) break;
        
        const dependencyStrength = this.calculateDependencyStrength(current, next, {
          analyzeHeaders,
          analyzeBody,
          analyzeResponse
        });
        
        if (dependencyStrength > 0.3) {
          graph.edges.push({
            source: current.nodeId,
            target: next.nodeId,
            strength: dependencyStrength,
            type: this.classifyDependency(current, next),
            timeDiff
          });
        }
      }
    }

    const groups = this.groupByDomain(graph.nodes);
    graph.groups = groups;

    this.analyzeDataFlow(graph);
    this.detectCircularDependencies(graph);

    return {
      graph,
      stats: this.calculateStats(graph),
      criticalPath: this.findCriticalPath(graph),
      recommendations: this.generateRecommendations(graph)
    };
  }

  generateNodeId(request) {
    const data = `${request.url}_${request.method}_${request.timestamp || Date.now()}`;
    return crypto.createHash('md5').update(data).digest('hex').substring(0, 12);
  }

  inferGroup(request) {
    try {
      const urlObj = new URL(request.url);
      const parts = urlObj.pathname.split('/').filter(p => p);
      
      if (parts.length > 0) {
        return parts[0];
      }
      
      if (request.resourceType) {
        return request.resourceType;
      }
      
      return 'default';
    } catch (e) {
      return 'default';
    }
  }

  calculateDependencyStrength(req1, req2, options) {
    let score = 0;
    let weights = 0;

    const timeDiff = (req2.timestamp || 0) - (req1.timestamp || 0);
    if (timeDiff < 1000) {
      score += 0.3;
    } else if (timeDiff < 3000) {
      score += 0.2;
    } else if (timeDiff < 5000) {
      score += 0.1;
    }
    weights += 0.3;

    if (options.analyzeHeaders && req1.headers && req2.headers) {
      const headerScore = this.compareHeaders(req1.headers, req2.headers);
      score += headerScore * 0.2;
      weights += 0.2;
    }

    if (options.analyzeBody && req1.responseBody && req2.postData) {
      const dataFlowScore = this.analyzeDataFlowBetween(req1, req2);
      score += dataFlowScore * 0.3;
      weights += 0.3;
    }

    if (options.analyzeResponse && req1.responseBody && req2.responseBody) {
      const responseScore = this.compareResponses(req1.responseBody, req2.responseBody);
      score += responseScore * 0.2;
      weights += 0.2;
    }

    try {
      const url1 = new URL(req1.url);
      const url2 = new URL(req2.url);
      
      if (url1.hostname === url2.hostname) {
        score += 0.1;
        weights += 0.1;
      }
      
      const path1 = url1.pathname.split('/').filter(p => p);
      const path2 = url2.pathname.split('/').filter(p => p);
      
      const commonSegments = path1.filter(seg => path2.includes(seg));
      if (commonSegments.length > 0) {
        score += (commonSegments.length / Math.max(path1.length, path2.length)) * 0.1;
        weights += 0.1;
      }
    } catch (e) {}

    return weights > 0 ? score / weights : 0;
  }

  compareHeaders(headers1, headers2) {
    const keys1 = Object.keys(headers1).map(k => k.toLowerCase());
    const keys2 = Object.keys(headers2).map(k => k.toLowerCase());
    
    const commonKeys = keys1.filter(k => keys2.includes(k));
    const totalKeys = new Set([...keys1, ...keys2]).size;
    
    if (totalKeys === 0) return 0;
    
    let valueMatches = 0;
    commonKeys.forEach(key => {
      const val1 = headers1[Object.keys(headers1).find(k => k.toLowerCase() === key)];
      const val2 = headers2[Object.keys(headers2).find(k => k.toLowerCase() === key)];
      if (val1 === val2) valueMatches++;
    });
    
    return (commonKeys.length / totalKeys + valueMatches / Math.max(commonKeys.length, 1)) / 2;
  }

  analyzeDataFlowBetween(req1, req2) {
    try {
      let responseData = req1.responseBody;
      let requestData = req2.postData;
      
      if (typeof responseData === 'string') {
        try {
          responseData = JSON.parse(responseData);
        } catch {
          responseData = null;
        }
      }
      
      if (typeof requestData === 'string') {
        try {
          requestData = JSON.parse(requestData);
        } catch {
          requestData = null;
        }
      }
      
      if (!responseData || !requestData) return 0;
      
      const responseValues = this.extractValues(responseData);
      const requestValues = this.extractValues(requestData);
      
      const matches = responseValues.filter(v => 
        requestValues.some(rv => rv === v || rv.includes(v) || v.includes(rv))
      );
      
      return matches.length / Math.max(responseValues.length, requestValues.length, 1);
    } catch (e) {
      return 0;
    }
  }

  extractValues(obj, prefix = '') {
    const values = [];
    
    if (obj === null || obj === undefined) return values;
    
    if (typeof obj === 'string') {
      return [obj];
    }
    
    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return [String(obj)];
    }
    
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        values.push(...this.extractValues(item, `${prefix}[${index}]`));
      });
    } else if (typeof obj === 'object') {
      Object.entries(obj).forEach(([key, value]) => {
        values.push(...this.extractValues(value, `${prefix}.${key}`));
      });
    }
    
    return values;
  }

  compareResponses(body1, body2) {
    try {
      let data1 = body1;
      let data2 = body2;
      
      if (typeof body1 === 'string') {
        try {
          data1 = JSON.parse(body1);
        } catch {
          return this.stringSimilarity(body1, body2);
        }
      }
      
      if (typeof body2 === 'string') {
        try {
          data2 = JSON.parse(body2);
        } catch {
          return this.stringSimilarity(body1, body2);
        }
      }
      
      return this.objectSimilarity(data1, data2);
    } catch (e) {
      return 0;
    }
  }

  stringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
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

  objectSimilarity(obj1, obj2) {
    if (typeof obj1 !== typeof obj2) return 0;
    if (obj1 === null || obj2 === null) return obj1 === obj2 ? 1 : 0;
    
    if (typeof obj1 !== 'object') {
      return obj1 === obj2 ? 1 : 0;
    }
    
    if (Array.isArray(obj1) && Array.isArray(obj2)) {
      if (obj1.length === 0 && obj2.length === 0) return 1;
      const matches = obj1.filter((item, i) => 
        i < obj2.length && this.objectSimilarity(item, obj2[i]) > 0.8
      ).length;
      return matches / Math.max(obj1.length, obj2.length);
    }
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    const commonKeys = keys1.filter(k => keys2.includes(k));
    
    if (commonKeys.length === 0) return 0;
    
    let similaritySum = 0;
    commonKeys.forEach(key => {
      similaritySum += this.objectSimilarity(obj1[key], obj2[key]);
    });
    
    return similaritySum / Math.max(keys1.length, keys2.length);
  }

  classifyDependency(req1, req2) {
    if (req1.method === 'GET' && ['POST', 'PUT', 'PATCH'].includes(req2.method)) {
      return 'data-provider';
    }
    
    if (['POST', 'PUT', 'PATCH'].includes(req1.method) && req2.method === 'GET') {
      return 'data-consumer';
    }
    
    if (req1.method === 'DELETE') {
      return 'cleanup';
    }
    
    if (req1.status >= 400) {
      return 'error-chain';
    }
    
    return 'sequential';
  }

  groupByDomain(nodes) {
    const groups = new Map();
    
    nodes.forEach(node => {
      try {
        const urlObj = new URL(node.url);
        const domain = urlObj.hostname;
        
        if (!groups.has(domain)) {
          groups.set(domain, {
            id: domain,
            name: domain,
            nodes: []
          });
        }
        
        groups.get(domain).nodes.push(node.id);
      } catch (e) {
        const defaultGroup = 'default';
        if (!groups.has(defaultGroup)) {
          groups.set(defaultGroup, {
            id: defaultGroup,
            name: 'Default',
            nodes: []
          });
        }
        groups.get(defaultGroup).nodes.push(node.id);
      }
    });
    
    return Array.from(groups.values());
  }

  analyzeDataFlow(graph) {
    const flowPatterns = [];
    
    graph.edges.forEach(edge => {
      if (edge.strength > 0.7) {
        flowPatterns.push({
          source: edge.source,
          target: edge.target,
          type: edge.type,
          strength: edge.strength
        });
      }
    });
    
    graph.dataFlow = flowPatterns;
  }

  detectCircularDependencies(graph) {
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];

    const dfs = (nodeId, path = []) => {
      if (recursionStack.has(nodeId)) {
        const cycleStart = path.indexOf(nodeId);
        cycles.push(path.slice(cycleStart));
        return;
      }

      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const outgoingEdges = graph.edges.filter(e => e.source === nodeId);
      for (const edge of outgoingEdges) {
        dfs(edge.target, [...path]);
      }

      recursionStack.delete(nodeId);
    };

    graph.nodes.forEach(node => {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    });

    graph.cycles = cycles;
    return cycles;
  }

  findCriticalPath(graph) {
    const inDegree = new Map();
    const distances = new Map();
    const predecessors = new Map();

    graph.nodes.forEach(node => {
      inDegree.set(node.id, 0);
      distances.set(node.id, 0);
    });

    graph.edges.forEach(edge => {
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    });

    const queue = [];
    graph.nodes.forEach(node => {
      if (inDegree.get(node.id) === 0) {
        queue.push(node.id);
      }
    });

    while (queue.length > 0) {
      const current = queue.shift();
      const outgoingEdges = graph.edges.filter(e => e.source === current);

      for (const edge of outgoingEdges) {
        const newDist = distances.get(current) + edge.timeDiff;
        if (newDist > distances.get(edge.target)) {
          distances.set(edge.target, newDist);
          predecessors.set(edge.target, current);
        }

        inDegree.set(edge.target, inDegree.get(edge.target) - 1);
        if (inDegree.get(edge.target) === 0) {
          queue.push(edge.target);
        }
      }
    }

    let maxDist = 0;
    let endNode = null;
    distances.forEach((dist, nodeId) => {
      if (dist > maxDist) {
        maxDist = dist;
        endNode = nodeId;
      }
    });

    const path = [];
    let current = endNode;
    while (current) {
      path.unshift(current);
      current = predecessors.get(current);
    }

    return {
      path,
      totalTime: maxDist
    };
  }

  calculateStats(graph) {
    const totalNodes = graph.nodes.length;
    const totalEdges = graph.edges.length;
    
    const avgDegree = totalNodes > 0 ? (totalEdges * 2) / totalNodes : 0;
    
    const methodDistribution = {};
    graph.nodes.forEach(node => {
      methodDistribution[node.method] = (methodDistribution[node.method] || 0) + 1;
    });

    const statusDistribution = {};
    graph.nodes.forEach(node => {
      const statusGroup = node.status ? `${Math.floor(node.status / 100)}xx` : 'unknown';
      statusDistribution[statusGroup] = (statusDistribution[statusGroup] || 0) + 1;
    });

    const avgEdgeStrength = totalEdges > 0 
      ? graph.edges.reduce((sum, e) => sum + e.strength, 0) / totalEdges 
      : 0;

    return {
      totalNodes,
      totalEdges,
      avgDegree: avgDegree.toFixed(2),
      avgEdgeStrength: avgEdgeStrength.toFixed(2),
      methodDistribution,
      statusDistribution,
      cycleCount: graph.cycles ? graph.cycles.length : 0,
      groupCount: graph.groups.length
    };
  }

  generateRecommendations(graph) {
    const recommendations = [];

    if (graph.cycles && graph.cycles.length > 0) {
      recommendations.push({
        type: 'warning',
        message: `检测到 ${graph.cycles.length} 个循环依赖，建议检查是否存在不必要的循环调用`,
        details: graph.cycles
      });
    }

    const isolatedNodes = graph.nodes.filter(node => 
      !graph.edges.some(e => e.source === node.id || e.target === node.id)
    );

    if (isolatedNodes.length > 0) {
      recommendations.push({
        type: 'info',
        message: `${isolatedNodes.length} 个请求没有检测到依赖关系，可能是独立的API调用`,
        count: isolatedNodes.length
      });
    }

    const highDegreeNodes = graph.nodes.filter(node => {
      const degree = graph.edges.filter(e => e.source === node.id || e.target === node.id).length;
      return degree > 5;
    });

    if (highDegreeNodes.length > 0) {
      recommendations.push({
        type: 'suggestion',
        message: `${highDegreeNodes.length} 个请求具有较高的依赖度，可能是核心API`,
        nodes: highDegreeNodes.map(n => n.url)
      });
    }

    const slowEdges = graph.edges.filter(e => e.timeDiff > 3000);
    if (slowEdges.length > 0) {
      recommendations.push({
        type: 'performance',
        message: `${slowEdges.length} 个请求间隔超过3秒，可能存在性能瓶颈`,
        count: slowEdges.length
      });
    }

    return recommendations;
  }

  clear() {
    this.dependencies.clear();
    this.requestGraph.clear();
    this.sessionData.clear();
  }
}

module.exports = new DependencyAnalyzer();
