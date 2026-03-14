const fs = require('fs');
const path = require('path');

let alertRules = null;
let metricsHistory = [];
let activeAlerts = [];
let stats = {
  totalRequests: 0,
  totalErrors: 0,
  totalResponseTime: 0,
  statusCodes: {},
  methods: {},
  resourceTypes: {},
  startTime: Date.now()
};

const MAX_HISTORY = 1000;

function loadAlertRules() {
  try {
    const rulesPath = path.join(__dirname, '../config/alertrules.json');
    if (fs.existsSync(rulesPath)) {
      const content = fs.readFileSync(rulesPath, 'utf8');
      alertRules = JSON.parse(content);
    }
  } catch (err) {
    console.warn('Failed to load alert rules:', err.message);
  }
  
  if (!alertRules) {
    alertRules = {
      enabled: true,
      rules: [],
      aggregation: { window_ms: 60000, min_samples: 5 }
    };
  }
}

loadAlertRules();

function resetStats() {
  stats = {
    totalRequests: 0,
    totalErrors: 0,
    totalResponseTime: 0,
    statusCodes: {},
    methods: {},
    resourceTypes: {},
    domains: {},
    slowRequests: [],
    errorRequests: [],
    startTime: Date.now()
  };
  metricsHistory = [];
  activeAlerts = [];
}

function recordRequest(requestData, responseData, responseTimeMs) {
  stats.totalRequests++;
  stats.totalResponseTime += responseTimeMs;

  const method = requestData.method || 'GET';
  stats.methods[method] = (stats.methods[method] || 0) + 1;

  const resourceType = requestData.resourceType || requestData.resource_type || 'unknown';
  stats.resourceTypes[resourceType] = (stats.resourceTypes[resourceType] || 0) + 1;

  try {
    const url = new URL(requestData.url || '');
    const domain = url.hostname;
    stats.domains[domain] = (stats.domains[domain] || 0) + 1;
  } catch {}

  const status = responseData?.status || requestData.status;
  if (status) {
    stats.statusCodes[status] = (stats.statusCodes[status] || 0) + 1;
    
    if (status >= 400) {
      stats.totalErrors++;
      stats.errorRequests.push({
        url: requestData.url,
        status: status,
        method: method,
        timestamp: Date.now()
      });
    }
  }

  if (responseTimeMs > 2000) {
    stats.slowRequests.push({
      url: requestData.url,
      responseTime: responseTimeMs,
      method: method,
      timestamp: Date.now()
    });
  }

  const metric = {
    timestamp: Date.now(),
    url: requestData.url,
    method: method,
    status: status,
    responseTime: responseTimeMs,
    resourceType: resourceType
  };

  metricsHistory.push(metric);
  if (metricsHistory.length > MAX_HISTORY) {
    metricsHistory.shift();
  }

  checkAlerts();

  return metric;
}

function recordPageLoad(url, loadTimeMs, domContentLoadedMs, resourcesCount) {
  const metric = {
    timestamp: Date.now(),
    type: 'page_load',
    url: url,
    loadTime: loadTimeMs,
    domContentLoaded: domContentLoadedMs,
    resourcesCount: resourcesCount
  };
  metricsHistory.push(metric);
  return metric;
}

function getAggregatedStats(windowMs = 60000) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const recentMetrics = metricsHistory.filter(m => m.timestamp > cutoff && !m.type);

  const aggregated = {
    windowMs: windowMs,
    totalRequests: recentMetrics.length,
    averageResponseTime: 0,
    errorRate: 0,
    requestsPerSecond: recentMetrics.length / (windowMs / 1000),
    statusCodes: {},
    methods: {},
    resourceTypes: {},
    slowCount: 0
  };

  if (recentMetrics.length === 0) return aggregated;

  let totalResponseTime = 0;
  let errorCount = 0;

  recentMetrics.forEach(m => {
    totalResponseTime += m.responseTime || 0;
    
    if (m.status >= 400) errorCount++;
    if ((m.responseTime || 0) > 2000) aggregated.slowCount++;
    
    aggregated.statusCodes[m.status] = (aggregated.statusCodes[m.status] || 0) + 1;
    aggregated.methods[m.method] = (aggregated.methods[m.method] || 0) + 1;
    aggregated.resourceTypes[m.resourceType] = (aggregated.resourceTypes[m.resourceType] || 0) + 1;
  });

  aggregated.averageResponseTime = Math.round(totalResponseTime / recentMetrics.length);
  aggregated.errorRate = Math.round((errorCount / recentMetrics.length) * 100);

  return aggregated;
}

function getTimeSeriesData(intervalMs = 5000, durationMs = 300000) {
  const now = Date.now();
  const cutoff = now - durationMs;
  const intervals = Math.ceil(durationMs / intervalMs);
  const timeSeries = [];

  for (let i = intervals - 1; i >= 0; i--) {
    const intervalStart = now - (i + 1) * intervalMs;
    const intervalEnd = now - i * intervalMs;
    
    const intervalMetrics = metricsHistory.filter(m => 
      m.timestamp >= intervalStart && m.timestamp < intervalEnd && !m.type
    );

    let avgResponseTime = 0;
    let errorCount = 0;
    let requestCount = intervalMetrics.length;

    if (requestCount > 0) {
      const totalTime = intervalMetrics.reduce((sum, m) => sum + (m.responseTime || 0), 0);
      avgResponseTime = Math.round(totalTime / requestCount);
      errorCount = intervalMetrics.filter(m => m.status >= 400).length;
    }

    timeSeries.push({
      timestamp: intervalEnd,
      requests: requestCount,
      avgResponseTime: avgResponseTime,
      errors: errorCount,
      errorRate: requestCount > 0 ? Math.round((errorCount / requestCount) * 100) : 0
    });
  }

  return timeSeries;
}

function checkAlerts() {
  if (!alertRules?.enabled || !alertRules?.rules) return;

  const windowMs = alertRules.aggregation?.window_ms || 60000;
  const minSamples = alertRules.aggregation?.min_samples || 5;
  const aggregated = getAggregatedStats(windowMs);

  if (aggregated.totalRequests < minSamples) return;

  const newAlerts = [];

  for (const rule of alertRules.rules) {
    if (!rule.enabled) continue;

    let value = 0;
    switch (rule.metric) {
      case 'response_time':
        value = aggregated.averageResponseTime;
        break;
      case 'error_rate':
        value = aggregated.errorRate;
        break;
      case '5xx_count':
        value = Object.entries(aggregated.statusCodes)
          .filter(([k]) => parseInt(k) >= 500)
          .reduce((sum, [_, v]) => sum + v, 0);
        break;
      case 'requests_per_second':
        value = aggregated.requestsPerSecond;
        break;
      case 'resource_load_time':
        value = aggregated.averageResponseTime;
        break;
    }

    let triggered = false;
    switch (rule.condition) {
      case '>': triggered = value > rule.threshold; break;
      case '<': triggered = value < rule.threshold; break;
      case '>=': triggered = value >= rule.threshold; break;
      case '<=': triggered = value <= rule.threshold; break;
      case '==': triggered = value == rule.threshold; break;
    }

    if (triggered) {
      const existingAlert = activeAlerts.find(a => a.ruleName === rule.name);
      if (!existingAlert) {
        newAlerts.push({
          id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
          ruleName: rule.name,
          metric: rule.metric,
          value: value,
          threshold: rule.threshold,
          unit: rule.unit,
          severity: rule.severity,
          timestamp: Date.now(),
          message: `${rule.metric} is ${value} ${rule.unit}, ${rule.condition} threshold ${rule.threshold} ${rule.unit}`
        });
      }
    }
  }

  activeAlerts = [
    ...activeAlerts.filter(a => Date.now() - a.timestamp < 300000),
    ...newAlerts
  ];

  return newAlerts;
}

function getActiveAlerts() {
  return activeAlerts;
}

function getSummaryStats() {
  const now = Date.now();
  const duration = now - stats.startTime;
  
  return {
    totalRequests: stats.totalRequests,
    totalErrors: stats.totalErrors,
    averageResponseTime: stats.totalRequests > 0 
      ? Math.round(stats.totalResponseTime / stats.totalRequests) 
      : 0,
    errorRate: stats.totalRequests > 0 
      ? Math.round((stats.totalErrors / stats.totalRequests) * 100) 
      : 0,
    durationMs: duration,
    requestsPerSecond: duration > 0 
      ? Math.round((stats.totalRequests / (duration / 1000)) * 100) / 100 
      : 0,
    topDomains: Object.entries(stats.domains || {})
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([domain, count]) => ({ domain, count })),
    statusCodes: stats.statusCodes,
    methods: stats.methods,
    resourceTypes: stats.resourceTypes,
    slowRequests: stats.slowRequests.slice(-10),
    errorRequests: stats.errorRequests.slice(-10)
  };
}

function getCompleteMetrics() {
  return {
    summary: getSummaryStats(),
    aggregated: getAggregatedStats(),
    timeSeries: getTimeSeriesData(),
    alerts: getActiveAlerts()
  };
}

module.exports = {
  recordRequest,
  recordPageLoad,
  resetStats,
  getAggregatedStats,
  getTimeSeriesData,
  getActiveAlerts,
  getSummaryStats,
  getCompleteMetrics,
  checkAlerts,
  loadAlertRules
};
