const express = require('express');
const router = express.Router();
const crawler = require('../services/playwright');
const requestDeduplicator = require('../services/requestDeduplicator');
const classifier = require('../services/classifier');
const dependencyAnalyzer = require('../services/dependencyAnalyzer');
const performanceMonitor = require('../services/performanceMonitor');
const docGenerator = require('../services/docGenerator');

// Get deduplication info
router.get('/deduplication', (req, res) => {
  try {
    const groups = crawler.getDeduplicationInfo();
    res.json({
      success: true,
      groups,
      totalGroups: groups.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Process requests with deduplication
router.post('/deduplication/process', (req, res) => {
  try {
    const { requests } = req.body;
    
    if (!requests || !Array.isArray(requests)) {
      return res.status(400).json({ success: false, error: 'Requests array is required' });
    }

    const result = requestDeduplicator.processRequests(requests);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get deduplication config
router.get('/deduplication/config', (req, res) => {
  try {
    const config = requestDeduplicator.config;
    res.json({
      success: true,
      config
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Classify requests
router.post('/classify', (req, res) => {
  try {
    const { requests } = req.body;
    
    if (!requests || !Array.isArray(requests)) {
      return res.status(400).json({ success: false, error: 'Requests array is required' });
    }

    const result = classifier.classifyBatch(requests);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Classify single request
router.post('/classify/single', (req, res) => {
  try {
    const { request } = req.body;
    
    if (!request) {
      return res.status(400).json({ success: false, error: 'Request object is required' });
    }

    const result = classifier.classify(request);
    res.json({
      success: true,
      classification: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all categories
router.get('/classify/categories', (req, res) => {
  try {
    const categories = classifier.getCategories();
    res.json({
      success: true,
      categories
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get tag suggestions
router.get('/classify/suggestions', (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ success: false, error: 'Query parameter q is required' });
    }

    const suggestions = classifier.getTagSuggestions(q);
    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analyze dependencies
router.get('/dependencies', (req, res) => {
  try {
    const options = {
      timeWindow: parseInt(req.query.timeWindow) || 5000,
      analyzeHeaders: req.query.analyzeHeaders !== 'false',
      analyzeBody: req.query.analyzeBody !== 'false',
      analyzeResponse: req.query.analyzeResponse !== 'false'
    };

    const result = crawler.analyzeDependencies(options);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analyze dependencies for specific requests
router.post('/dependencies/analyze', (req, res) => {
  try {
    const { requests } = req.body;
    const options = {
      timeWindow: parseInt(req.query.timeWindow) || 5000,
      analyzeHeaders: req.query.analyzeHeaders !== 'false',
      analyzeBody: req.query.analyzeBody !== 'false',
      analyzeResponse: req.query.analyzeResponse !== 'false'
    };

    if (!requests || !Array.isArray(requests)) {
      return res.status(400).json({ success: false, error: 'Requests array is required' });
    }

    const result = dependencyAnalyzer.analyzeDependencies(requests, options);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get performance stats
router.get('/performance/stats', (req, res) => {
  try {
    const timeRange = req.query.timeRange || '5m';
    const stats = performanceMonitor.getStats(timeRange);
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get performance report
router.get('/performance/report', (req, res) => {
  try {
    const report = crawler.getPerformanceReport();
    res.json({
      success: true,
      report
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get health status
router.get('/performance/health', (req, res) => {
  try {
    const health = performanceMonitor.getHealthStatus();
    res.json({
      success: true,
      health
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get alerts
router.get('/performance/alerts', (req, res) => {
  try {
    const options = {
      severity: req.query.severity,
      ruleId: req.query.ruleId,
      limit: parseInt(req.query.limit) || 50,
      since: req.query.since ? parseInt(req.query.since) : undefined
    };

    const alerts = performanceMonitor.getAlerts(options);
    res.json({
      success: true,
      alerts,
      total: alerts.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate API documentation
router.post('/docs/generate', async (req, res) => {
  try {
    const { title, version, description } = req.body;
    const options = { title, version, description };

    const result = await crawler.generateApiDocs(options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate docs for specific requests
router.post('/docs/generate-custom', async (req, res) => {
  try {
    const { requests, title, version, description } = req.body;
    const options = { title, version, description };

    if (!requests || !Array.isArray(requests)) {
      return res.status(400).json({ success: false, error: 'Requests array is required' });
    }

    const result = await docGenerator.generateDocs(requests, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get OpenAPI spec
router.get('/docs/openapi', (req, res) => {
  try {
    const path = require('path');
    const fs = require('fs');
    const openApiPath = path.join(__dirname, '../../docs/apidocs/openapi.yaml');
    
    if (!fs.existsSync(openApiPath)) {
      return res.status(404).json({ success: false, error: 'OpenAPI spec not found. Generate docs first.' });
    }

    const content = fs.readFileSync(openApiPath, 'utf8');
    res.setHeader('Content-Type', 'text/yaml');
    res.send(content);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Swagger spec
router.get('/docs/swagger', (req, res) => {
  try {
    const path = require('path');
    const fs = require('fs');
    const swaggerPath = path.join(__dirname, '../../docs/apidocs/swagger.json');
    
    if (!fs.existsSync(swaggerPath)) {
      return res.status(404).json({ success: false, error: 'Swagger spec not found. Generate docs first.' });
    }

    const content = fs.readFileSync(swaggerPath, 'utf8');
    const spec = JSON.parse(content);
    res.json({ success: true, spec });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get comprehensive analysis
router.get('/comprehensive', (req, res) => {
  try {
    const requests = crawler.getRequests();
    
    const dedupResult = requestDeduplicator.processRequests(requests);
    const classificationResult = classifier.classifyBatch(dedupResult.unique);
    const dependencyResult = dependencyAnalyzer.analyzeDependencies(dedupResult.unique);
    const performanceStats = performanceMonitor.getStats('5m');
    const healthStatus = performanceMonitor.getHealthStatus();

    res.json({
      success: true,
      summary: {
        totalRequests: requests.length,
        uniqueRequests: dedupResult.unique.length,
        duplicateCount: dedupResult.duplicates.length,
        reductionRate: dedupResult.stats.reductionRate,
        classifiedCount: classificationResult.stats.classified,
        healthStatus: healthStatus.status
      },
      deduplication: dedupResult.stats,
      classification: classificationResult.stats,
      dependencies: {
        stats: dependencyResult.stats,
        criticalPath: dependencyResult.criticalPath,
        recommendations: dependencyResult.recommendations
      },
      performance: {
        stats: performanceStats,
        health: healthStatus
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
