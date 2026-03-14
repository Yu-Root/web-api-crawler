const dependencyGraph = {
  nodes: [],
  edges: []
};

let analysisConfig = {
  maxDepth: 3,
  ignoreDomains: ['google-analytics.com', 'googletagmanager.com'],
  dataFieldPatterns: ['id', '_id', 'uid', 'user_id', 'postId', 'threadId', 'itemId']
};

function extractIdsFromData(data, patterns = analysisConfig.dataFieldPatterns) {
  const ids = new Set();
  
  if (!data) return ids;
  
  const extractRecursive = (obj, depth = 0) => {
    if (depth > 5) return;
    
    if (Array.isArray(obj)) {
      obj.forEach(item => extractRecursive(item, depth + 1));
      return;
    }
    
    if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        
        patterns.forEach(pattern => {
          if (lowerKey.includes(pattern.toLowerCase())) {
            if (typeof value === 'string' || typeof value === 'number') {
              ids.add(String(value));
            }
          }
        });
        
        extractRecursive(value, depth + 1);
      }
    }
  };
  
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    extractRecursive(parsed);
  } catch (e) {}
  
  return ids;
}

function extractUrlsFromData(data) {
  const urls = new Set();
  
  if (!data) return urls;
  
  const urlRegex = /https?:\/\/[^\s"'<>]+/g;
  const matches = data.match(urlRegex);
  
  if (matches) {
    matches.forEach(url => {
      try {
        new URL(url);
        urls.add(url);
      } catch (e) {}
    });
  }
  
  return urls;
}

function extractParamsFromUrl(url) {
  const params = new Map();
  
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.forEach((value, key) => {
      params.set(key, value);
    });
  } catch (e) {}
  
  return params;
}

function analyzeDependencies(requests) {
  const nodes = [];
  const edges = [];
  const requestMap = new Map();
  const idToRequests = new Map();
  
  requests.forEach((req, index) => {
    const nodeId = req.id || `req_${index}`;
    const node = {
      id: nodeId,
      url: req.url,
      method: req.method,
      status: req.status,
      timestamp: req.timestamp,
      resourceType: req.resourceType,
      dependencies: [],
      dependents: []
    };
    
    nodes.push(node);
    requestMap.set(nodeId, node);
    
    if (req.response_body) {
      const ids = extractIdsFromData(req.response_body);
      ids.forEach(id => {
        if (!idToRequests.has(id)) {
          idToRequests.set(id, []);
        }
        idToRequests.get(id).push(nodeId);
      });
    }
    
    if (req.post_data) {
      const ids = extractIdsFromData(req.post_data);
      ids.forEach(id => {
        if (!idToRequests.has(id)) {
          idToRequests.set(id, []);
        }
        idToRequests.get(id).push(nodeId);
      });
    }
  });
  
  requests.forEach((req, index) => {
    const sourceId = req.id || `req_${index}`;
    const sourceNode = requestMap.get(sourceId);
    
    const urlParams = extractParamsFromUrl(req.url);
    urlParams.forEach((value, key) => {
      const matchingRequests = idToRequests.get(value);
      if (matchingRequests) {
        matchingRequests.forEach(targetId => {
          if (targetId !== sourceId) {
            const targetNode = requestMap.get(targetId);
            if (targetNode && targetNode.timestamp < sourceNode.timestamp) {
              const edgeKey = `${targetId}->${sourceId}`;
              const existingEdge = edges.find(e => e.source === targetId && e.target === sourceId);
              
              if (!existingEdge) {
                edges.push({
                  source: targetId,
                  target: sourceId,
                  type: 'param',
                  param: key,
                  value: value
                });
                
                sourceNode.dependencies.push(targetId);
                targetNode.dependents.push(sourceId);
              }
            }
          }
        });
      }
    });
    
    if (req.post_data) {
      const ids = extractIdsFromData(req.post_data);
      ids.forEach(id => {
        const matchingRequests = idToRequests.get(id);
        if (matchingRequests) {
          matchingRequests.forEach(targetId => {
            if (targetId !== sourceId) {
              const targetNode = requestMap.get(targetId);
              if (targetNode && targetNode.timestamp < sourceNode.timestamp) {
                const existingEdge = edges.find(e => e.source === targetId && e.target === sourceId);
                
                if (!existingEdge) {
                  edges.push({
                    source: targetId,
                    target: sourceId,
                    type: 'body',
                    value: id
                  });
                  
                  sourceNode.dependencies.push(targetId);
                  targetNode.dependents.push(sourceId);
                }
              }
            }
          });
        }
      });
    }
    
    if (req.response_body) {
      const urls = extractUrlsFromData(req.response_body);
      urls.forEach(url => {
        const targetNode = nodes.find(n => 
          n.url === url && n.timestamp > sourceNode.timestamp
        );
        
        if (targetNode) {
          const existingEdge = edges.find(e => 
            e.source === sourceId && e.target === targetNode.id
          );
          
          if (!existingEdge) {
            edges.push({
              source: sourceId,
              target: targetNode.id,
              type: 'url'
            });
            
            targetNode.dependencies.push(sourceId);
            sourceNode.dependents.push(targetNode.id);
          }
        }
      });
    }
  });
  
  return {
    nodes,
    edges,
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      avgDependencies: nodes.length > 0 
        ? (nodes.reduce((sum, n) => sum + n.dependencies.length, 0) / nodes.length).toFixed(2)
        : 0,
      maxDepth: calculateMaxDepth(nodes, edges)
    }
  };
}

function calculateMaxDepth(nodes, edges) {
  if (nodes.length === 0) return 0;
  
  const adjList = new Map();
  nodes.forEach(n => adjList.set(n.id, []));
  edges.forEach(e => {
    if (adjList.has(e.source)) {
      adjList.get(e.source).push(e.target);
    }
  });
  
  let maxDepth = 0;
  const visited = new Set();
  
  const dfs = (nodeId, depth) => {
    if (depth > maxDepth) maxDepth = depth;
    visited.add(nodeId);
    
    const neighbors = adjList.get(nodeId) || [];
    neighbors.forEach(neighbor => {
      if (!visited.has(neighbor)) {
        dfs(neighbor, depth + 1);
      }
    });
    
    visited.delete(nodeId);
  };
  
  nodes.forEach(node => {
    if (node.dependencies.length === 0) {
      dfs(node.id, 0);
    }
  });
  
  return maxDepth;
}

function getDependencyChain(requests, targetId) {
  const graph = analyzeDependencies(requests);
  const chain = [];
  const visited = new Set();
  
  const traverse = (nodeId, depth = 0) => {
    if (visited.has(nodeId) || depth > 10) return;
    visited.add(nodeId);
    
    const node = graph.nodes.find(n => n.id === nodeId);
    if (node) {
      chain.push({
        ...node,
        depth
      });
      
      node.dependencies.forEach(depId => {
        traverse(depId, depth + 1);
      });
    }
  };
  
  traverse(targetId);
  
  return chain;
}

function getCriticalPath(requests) {
  const graph = analyzeDependencies(requests);
  
  const nodesByDependents = [...graph.nodes].sort(
    (a, b) => b.dependents.length - a.dependents.length
  );
  
  return nodesByDependents.slice(0, 10).map(node => ({
    id: node.id,
    url: node.url,
    method: node.method,
    dependents: node.dependents.length,
    dependencies: node.dependencies.length
  }));
}

function setConfig(newConfig) {
  analysisConfig = { ...analysisConfig, ...newConfig };
}

function getConfig() {
  return { ...analysisConfig };
}

module.exports = {
  analyzeDependencies,
  getDependencyChain,
  getCriticalPath,
  extractIdsFromData,
  extractUrlsFromData,
  setConfig,
  getConfig
};
