const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class PerformanceMonitor extends EventEmitter {
  constructor() {
    super();
    this.metrics = new Map();
    this.alertRules = [];
    this.alertHistory = [];
    this.monitoringInterval = null;
    this.isMonitoring = false;
    this.config = this.loadConfig();
    this.sessionStats = {
      startTime: null,
      requests: [],
      alerts: []
    };
  }

  loadConfig() {
    try {
      const configPath = path.join(__dirname, '../config/alertrules.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);
      this.alertRules = config.rules || [];
      return config;
    } catch (error) {
      console.warn('Failed to load alert rules config:', error.message);
      this.alertRules = this.getDefaultRules();
      return { enabled: true, rules: this.alertRules };
    }
  }

  getDefaultRules() {
    return [
      {
        id: 'high_error_rate',
        name: '高错误率告警',
        enabled: true,
        condition: { metric: 'error_rate', operator: '>', threshold: 0.2 },
        severity: 'critical'
      },
      {
        id: 'slow_response',
        name: '响应缓慢告警',
        enabled: true,
        condition: { metric: 'avg_response_time', operator: '>', threshold: 5000 },
        severity: 'warning'
      }
    ];
  }

  startMonitoring(intervalMs = 5000) {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.sessionStats.startTime = Date.now();
    
    this.monitoringInterval = setInterval(() => {
      this.checkAlerts();
    }, intervalMs);

    this.emit('monitoring-started', { timestamp: Date.now() });
  }

  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.emit('monitoring-stopped', { 
      timestamp: Date.now(),
      duration: Date.now() - this.sessionStats.startTime
    });
  }

  recordRequest(requestData) {
    const timestamp = Date.now();
    const metric = {
      id: requestData.id || `req_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
      url: requestData.url,
      method: requestData.method,
      status: requestData.status,
      timestamp,
      responseTime: requestData.responseTime || 0,
      resourceType: requestData.resourceType,
      error: requestData.error || null
    };

    this.sessionStats.requests.push(metric);
    this.updateMetrics(metric);
    
    this.emit('request-recorded', metric);
    
    return metric;
  }

  updateMetrics(metric) {
    const minute = Math.floor(metric.timestamp / 60000);
    
    if (!this.metrics.has(minute)) {
      this.metrics.set(minute, {
        timestamp: minute * 60000,
        count: 0,
        errors: 0,
        totalResponseTime: 0,
        statusCodes: {},
        methods: {},
        urls: new Set()
      });
    }

    const minuteMetrics = this.metrics.get(minute);
    minuteMetrics.count++;
    minuteMetrics.totalResponseTime += metric.responseTime;
    minuteMetrics.statusCodes[metric.status] = (minuteMetrics.statusCodes[metric.status] || 0) + 1;
    minuteMetrics.methods[metric.method] = (minuteMetrics.methods[metric.method] || 0) + 1;
    minuteMetrics.urls.add(metric.url);

    if (metric.status >= 400 || metric.error) {
      minuteMetrics.errors++;
    }
  }

  checkAlerts() {
    if (!this.config.enabled) return;

    const currentStats = this.getCurrentStats();
    
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      const metricValue = this.getMetricValue(rule.condition.metric, currentStats);
      
      if (metricValue === null) continue;

      const shouldAlert = this.evaluateCondition(
        metricValue,
        rule.condition.operator,
        rule.condition.threshold
      );

      if (shouldAlert) {
        this.triggerAlert(rule, metricValue, currentStats);
      }
    }
  }

  getCurrentStats() {
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000);
    const last5Minutes = [];

    for (let i = 0; i < 5; i++) {
      const minute = currentMinute - i;
      if (this.metrics.has(minute)) {
        last5Minutes.push(this.metrics.get(minute));
      }
    }

    const totalRequests = last5Minutes.reduce((sum, m) => sum + m.count, 0);
    const totalErrors = last5Minutes.reduce((sum, m) => sum + m.errors, 0);
    const totalResponseTime = last5Minutes.reduce((sum, m) => sum + m.totalResponseTime, 0);

    const statusCodes = {};
    const methods = {};
    
    last5Minutes.forEach(m => {
      Object.entries(m.statusCodes).forEach(([code, count]) => {
        statusCodes[code] = (statusCodes[code] || 0) + count;
      });
      Object.entries(m.methods).forEach(([method, count]) => {
        methods[method] = (methods[method] || 0) + count;
      });
    });

    return {
      totalRequests,
      totalErrors,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      avgResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      statusCodes,
      methods,
      timeRange: {
        start: (currentMinute - 4) * 60000,
        end: now
      }
    };
  }

  getMetricValue(metricName, stats) {
    const metricMap = {
      'error_rate': stats.errorRate,
      'avg_response_time': stats.avgResponseTime,
      'request_count': stats.totalRequests,
      '4xx_rate': this.calculateStatusRate(stats.statusCodes, 400, 499),
      '5xx_rate': this.calculateStatusRate(stats.statusCodes, 500, 599)
    };

    return metricMap[metricName] !== undefined ? metricMap[metricName] : null;
  }

  calculateStatusRate(statusCodes, min, max) {
    const total = Object.values(statusCodes).reduce((sum, count) => sum + count, 0);
    if (total === 0) return 0;

    const rangeCount = Object.entries(statusCodes)
      .filter(([code]) => {
        const codeNum = parseInt(code);
        return codeNum >= min && codeNum <= max;
      })
      .reduce((sum, [, count]) => sum + count, 0);

    return rangeCount / total;
  }

  evaluateCondition(value, operator, threshold) {
    switch (operator) {
      case '>': return value > threshold;
      case '>=': return value >= threshold;
      case '<': return value < threshold;
      case '<=': return value <= threshold;
      case '==': return value === threshold;
      case '!=': return value !== threshold;
      default: return false;
    }
  }

  triggerAlert(rule, currentValue, stats) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: `${rule.name}: 当前值 ${currentValue.toFixed(2)}, 阈值 ${rule.condition.threshold}`,
      timestamp: Date.now(),
      currentValue,
      threshold: rule.condition.threshold,
      stats: {
        totalRequests: stats.totalRequests,
        errorRate: stats.errorRate,
        avgResponseTime: stats.avgResponseTime
      }
    };

    this.alertHistory.push(alert);
    this.sessionStats.alerts.push(alert);

    const maxHistory = this.config.alertHistory?.maxSize || 1000;
    if (this.alertHistory.length > maxHistory) {
      this.alertHistory = this.alertHistory.slice(-maxHistory);
    }

    if (rule.notification?.console) {
      console.warn(`[${rule.severity.toUpperCase()}] ${alert.message}`);
    }

    this.emit('alert', alert);
  }

  getStats(timeRange = '5m') {
    const ranges = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '1h': 60,
      '24h': 1440
    };

    const minutes = ranges[timeRange] || 5;
    const currentMinute = Math.floor(Date.now() / 60000);
    const selectedMinutes = [];

    for (let i = 0; i < minutes; i++) {
      const minute = currentMinute - i;
      if (this.metrics.has(minute)) {
        selectedMinutes.push(this.metrics.get(minute));
      }
    }

    const totalRequests = selectedMinutes.reduce((sum, m) => sum + m.count, 0);
    const totalErrors = selectedMinutes.reduce((sum, m) => sum + m.errors, 0);
    const totalResponseTime = selectedMinutes.reduce((sum, m) => sum + m.totalResponseTime, 0);

    const statusCodes = {};
    const methods = {};
    const uniqueUrls = new Set();

    selectedMinutes.forEach(m => {
      Object.entries(m.statusCodes).forEach(([code, count]) => {
        statusCodes[code] = (statusCodes[code] || 0) + count;
      });
      Object.entries(m.methods).forEach(([method, count]) => {
        methods[method] = (methods[method] || 0) + count;
      });
      m.urls.forEach(url => uniqueUrls.add(url));
    });

    return {
      timeRange,
      totalRequests,
      totalErrors,
      errorRate: totalRequests > 0 ? (totalErrors / totalRequests * 100).toFixed(2) + '%' : '0%',
      avgResponseTime: totalRequests > 0 ? Math.round(totalResponseTime / totalRequests) : 0,
      requestsPerMinute: totalRequests / Math.max(minutes, 1),
      uniqueUrls: uniqueUrls.size,
      statusCodes,
      methods,
      timeline: selectedMinutes.map(m => ({
        timestamp: m.timestamp,
        count: m.count,
        errors: m.errors,
        avgResponseTime: m.count > 0 ? Math.round(m.totalResponseTime / m.count) : 0
      })).reverse()
    };
  }

  getAlerts(options = {}) {
    const { severity, ruleId, limit = 50, since } = options;
    
    let alerts = [...this.alertHistory];

    if (severity) {
      alerts = alerts.filter(a => a.severity === severity);
    }

    if (ruleId) {
      alerts = alerts.filter(a => a.ruleId === ruleId);
    }

    if (since) {
      alerts = alerts.filter(a => a.timestamp >= since);
    }

    return alerts
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  getPerformanceReport() {
    const stats5m = this.getStats('5m');
    const stats1h = this.getStats('1h');
    const stats24h = this.getStats('24h');

    return {
      summary: {
        totalRequests: stats24h.totalRequests,
        totalErrors: stats24h.totalErrors,
        overallErrorRate: stats24h.errorRate,
        avgResponseTime: stats24h.avgResponseTime
      },
      trends: {
        '5m': stats5m,
        '1h': stats1h,
        '24h': stats24h
      },
      topUrls: this.getTopUrls(10),
      slowestRequests: this.getSlowestRequests(10),
      errorBreakdown: this.getErrorBreakdown(),
      alerts: {
        total: this.alertHistory.length,
        recent: this.getAlerts({ limit: 10 })
      }
    };
  }

  getTopUrls(limit = 10) {
    const urlCounts = new Map();
    
    this.sessionStats.requests.forEach(req => {
      try {
        const urlObj = new URL(req.url);
        const key = `${req.method} ${urlObj.pathname}`;
        urlCounts.set(key, (urlCounts.get(key) || 0) + 1);
      } catch (e) {
        urlCounts.set(req.url, (urlCounts.get(req.url) || 0) + 1);
      }
    });

    return Array.from(urlCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([url, count]) => ({ url, count }));
  }

  getSlowestRequests(limit = 10) {
    return this.sessionStats.requests
      .filter(req => req.responseTime > 0)
      .sort((a, b) => b.responseTime - a.responseTime)
      .slice(0, limit)
      .map(req => ({
        url: req.url,
        method: req.method,
        responseTime: req.responseTime,
        status: req.status,
        timestamp: req.timestamp
      }));
  }

  getErrorBreakdown() {
    const errors = this.sessionStats.requests.filter(req => req.status >= 400 || req.error);
    
    const byStatus = {};
    const byUrl = {};

    errors.forEach(req => {
      const status = req.status || 'unknown';
      byStatus[status] = (byStatus[status] || 0) + 1;

      try {
        const urlObj = new URL(req.url);
        const key = `${req.method} ${urlObj.pathname}`;
        byUrl[key] = (byUrl[key] || 0) + 1;
      } catch (e) {
        byUrl[req.url] = (byUrl[req.url] || 0) + 1;
      }
    });

    return {
      total: errors.length,
      byStatus,
      byUrl: Object.entries(byUrl)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .reduce((obj, [url, count]) => {
          obj[url] = count;
          return obj;
        }, {})
    };
  }

  clear() {
    this.metrics.clear();
    this.alertHistory = [];
    this.sessionStats = {
      startTime: null,
      requests: [],
      alerts: []
    };
  }

  getHealthStatus() {
    const stats = this.getStats('5m');
    
    let status = 'healthy';
    const issues = [];

    if (parseFloat(stats.errorRate) > 10) {
      status = 'critical';
      issues.push('错误率过高');
    } else if (parseFloat(stats.errorRate) > 5) {
      status = 'warning';
      issues.push('错误率偏高');
    }

    if (stats.avgResponseTime > 5000) {
      status = status === 'healthy' ? 'warning' : status;
      issues.push('响应时间过长');
    }

    return {
      status,
      issues,
      lastCheck: Date.now(),
      stats: {
        errorRate: stats.errorRate,
        avgResponseTime: stats.avgResponseTime,
        totalRequests: stats.totalRequests
      }
    };
  }
}

module.exports = new PerformanceMonitor();
