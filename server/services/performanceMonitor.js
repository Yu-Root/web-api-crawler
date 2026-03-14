const fs = require('fs');
const path = require('path');

let alertRules = { rules: [], notifications: { enabled: false } };
try {
  alertRules = require('../config/alertRules.json');
} catch (e) {
  console.warn('Using default alert rules');
}

const metrics = {
  requests: [],
  errors: [],
  responseTimes: [],
  memoryUsage: [],
  startTime: Date.now()
};

const alerts = [];
const MAX_METRICS_HISTORY = 1000;

function recordRequest(request) {
  const timestamp = Date.now();
  
  metrics.requests.push({
    timestamp,
    url: request.url,
    method: request.method,
    status: request.status,
    responseTime: request.responseTime || 0,
    isError: request.status >= 400 || request.status === 0
  });
  
  if (request.responseTime) {
    metrics.responseTimes.push({
      timestamp,
      value: request.responseTime
    });
  }
  
  if (request.status >= 400 || request.status === 0) {
    metrics.errors.push({
      timestamp,
      url: request.url,
      method: request.method,
      status: request.status,
      error: request.error
    });
  }
  
  trimMetrics();
  
  checkAlerts();
}

function recordMemoryUsage() {
  const usage = process.memoryUsage();
  metrics.memoryUsage.push({
    timestamp: Date.now(),
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    rss: usage.rss,
    external: usage.external
  });
  
  if (metrics.memoryUsage.length > MAX_METRICS_HISTORY) {
    metrics.memoryUsage = metrics.memoryUsage.slice(-MAX_METRICS_HISTORY);
  }
}

function trimMetrics() {
  if (metrics.requests.length > MAX_METRICS_HISTORY) {
    metrics.requests = metrics.requests.slice(-MAX_METRICS_HISTORY);
  }
  if (metrics.errors.length > MAX_METRICS_HISTORY) {
    metrics.errors = metrics.errors.slice(-MAX_METRICS_HISTORY);
  }
  if (metrics.responseTimes.length > MAX_METRICS_HISTORY) {
    metrics.responseTimes = metrics.responseTimes.slice(-MAX_METRICS_HISTORY);
  }
}

function calculateStats(windowMs = 60000) {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  const recentRequests = metrics.requests.filter(r => r.timestamp >= windowStart);
  const recentErrors = metrics.errors.filter(e => e.timestamp >= windowStart);
  const recentResponseTimes = metrics.responseTimes.filter(rt => rt.timestamp >= windowStart);
  
  const totalRequests = recentRequests.length;
  const errorCount = recentErrors.length;
  const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;
  
  const avgResponseTime = recentResponseTimes.length > 0
    ? recentResponseTimes.reduce((sum, rt) => sum + rt.value, 0) / recentResponseTimes.length
    : 0;
  
  const maxResponseTime = recentResponseTimes.length > 0
    ? Math.max(...recentResponseTimes.map(rt => rt.value))
    : 0;
  
  const minResponseTime = recentResponseTimes.length > 0
    ? Math.min(...recentResponseTimes.map(rt => rt.value))
    : 0;
  
  const requestRate = totalRequests / (windowMs / 1000);
  
  const memoryUsage = metrics.memoryUsage.length > 0
    ? metrics.memoryUsage[metrics.memoryUsage.length - 1]
    : null;
  
  const memoryUsagePercent = memoryUsage
    ? (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
    : 0;
  
  return {
    windowMs,
    totalRequests,
    errorCount,
    errorRate: errorRate.toFixed(4),
    avgResponseTime: Math.round(avgResponseTime),
    maxResponseTime,
    minResponseTime,
    requestRate: requestRate.toFixed(2),
    memoryUsage: memoryUsage ? {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      percent: memoryUsagePercent.toFixed(1)
    } : null,
    uptime: Math.round((now - metrics.startTime) / 1000)
  };
}

function checkAlerts() {
  if (!alertRules.rules) return;
  
  alertRules.rules.forEach(rule => {
    if (!rule.enabled) return;
    
    const stats = calculateStats(rule.condition.windowMs);
    let value;
    
    switch (rule.condition.metric) {
      case 'error_rate':
        value = parseFloat(stats.errorRate);
        break;
      case 'avg_response_time':
        value = stats.avgResponseTime;
        break;
      case 'request_rate':
        value = parseFloat(stats.requestRate);
        break;
      case 'memory_usage':
        value = stats.memoryUsage ? parseFloat(stats.memoryUsage.percent) : 0;
        break;
      case 'duplicate_rate':
        value = calculateDuplicateRate();
        break;
      default:
        return;
    }
    
    const threshold = rule.condition.threshold;
    const shouldAlert = evaluateCondition(value, rule.condition.operator, threshold);
    
    const recentAlert = alerts.find(a => 
      a.ruleId === rule.id && 
      Date.now() - a.timestamp < rule.condition.windowMs
    );
    
    if (shouldAlert && !recentAlert) {
      const alert = {
        id: `${rule.id}_${Date.now()}`,
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        message: `${rule.name}: ${rule.condition.metric} is ${value} (threshold: ${rule.condition.operator} ${threshold})`,
        timestamp: Date.now(),
        value,
        threshold,
        actions: rule.actions
      };
      
      alerts.push(alert);
      
      if (alerts.length > 100) {
        alerts.shift();
      }
      
      if (rule.actions.includes('log')) {
        console.log(`[ALERT][${rule.severity.toUpperCase()}] ${alert.message}`);
      }
    }
  });
}

function evaluateCondition(value, operator, threshold) {
  switch (operator) {
    case '>': return value > threshold;
    case '<': return value < threshold;
    case '>=': return value >= threshold;
    case '<=': return value <= threshold;
    case '==': return value === threshold;
    default: return false;
  }
}

function calculateDuplicateRate() {
  const recentRequests = metrics.requests.slice(-100);
  if (recentRequests.length === 0) return 0;
  
  const urlMap = new Map();
  let duplicates = 0;
  
  recentRequests.forEach(req => {
    const key = `${req.method}:${req.url}`;
    if (urlMap.has(key)) {
      duplicates++;
    } else {
      urlMap.set(key, true);
    }
  });
  
  return duplicates / recentRequests.length;
}

function getAlerts(limit = 20) {
  return alerts.slice(-limit);
}

function clearAlerts() {
  alerts.length = 0;
}

function getMetricsHistory(type = 'requests', limit = 100) {
  switch (type) {
    case 'requests':
      return metrics.requests.slice(-limit);
    case 'errors':
      return metrics.errors.slice(-limit);
    case 'responseTimes':
      return metrics.responseTimes.slice(-limit);
    case 'memory':
      return metrics.memoryUsage.slice(-limit);
    default:
      return [];
  }
}

function getPerformanceReport() {
  const stats1m = calculateStats(60000);
  const stats5m = calculateStats(300000);
  const stats15m = calculateStats(900000);
  
  return {
    summary: {
      totalRequests: metrics.requests.length,
      totalErrors: metrics.errors.length,
      uptime: stats1m.uptime
    },
    windows: {
      '1min': stats1m,
      '5min': stats5m,
      '15min': stats15m
    },
    recentAlerts: getAlerts(10)
  };
}

function reset() {
  metrics.requests = [];
  metrics.errors = [];
  metrics.responseTimes = [];
  metrics.memoryUsage = [];
  metrics.startTime = Date.now();
  alerts.length = 0;
}

function loadAlertRules(rules) {
  alertRules = rules;
}

function getAlertRules() {
  return alertRules;
}

setInterval(recordMemoryUsage, 5000);

module.exports = {
  recordRequest,
  recordMemoryUsage,
  calculateStats,
  getAlerts,
  clearAlerts,
  getMetricsHistory,
  getPerformanceReport,
  reset,
  loadAlertRules,
  getAlertRules
};
