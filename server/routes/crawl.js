const express = require('express');
const router = express.Router();
const crawler = require('../services/playwright');
const performanceMonitor = require('../services/performanceMonitor');
const classifier = require('../services/classifier');

// Start crawl (one-shot mode)
router.post('/start', async (req, res) => {
  try {
    const { url, mode, cookies, filters, waitTime, headless } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    const options = {
      cookies: cookies || [],
      filters: filters || {},
      waitTime: waitTime || 10000,
      headless: headless !== undefined ? headless : true
    };

    const result = await crawler.startCrawl(url, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop crawl
router.post('/stop', async (req, res) => {
  try {
    const result = await crawler.stopCrawl();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get status
router.get('/status', (req, res) => {
  const status = crawler.getStatus();
  res.json(status);
});

// Get all requests
router.get('/requests', (req, res) => {
  const requests = crawler.getRequests();
  res.json({ requests, total: requests.length });
});

// ============ Interactive Mode Routes ============

// Start interactive mode
router.post('/interactive/start', async (req, res) => {
  try {
    const { url, cookies, filters, headless } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    const options = {
      cookies: cookies || [],
      filters: filters || {},
      headless: headless !== undefined ? headless : true
    };

    const result = await crawler.startInteractive(url, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Navigate to new URL in interactive mode
router.post('/interactive/navigate', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    const result = await crawler.navigateToUrl(url);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get page links in interactive mode
router.get('/interactive/links', async (req, res) => {
  try {
    const result = await crawler.getPageLinks();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Click element in interactive mode
router.post('/interactive/click', async (req, res) => {
  try {
    const { selector } = req.body;

    if (!selector) {
      return res.status(400).json({ error: 'Selector is required' });
    }

    const result = await crawler.clickElement(selector);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get interactive status
router.get('/interactive/status', (req, res) => {
  const status = crawler.getInteractiveStatus();
  res.json(status);
});

// Close interactive mode
router.post('/interactive/close', async (req, res) => {
  try {
    const result = await crawler.closeInteractive();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Performance Monitoring Routes ============

// Get performance stats
router.get('/performance/stats', (req, res) => {
  const stats = performanceMonitor.calculateStats(60000);
  res.json(stats);
});

// Get performance alerts
router.get('/performance/alerts', (req, res) => {
  const alerts = performanceMonitor.getAlerts(50);
  res.json({ alerts });
});

// Clear performance alerts
router.post('/performance/alerts/clear', (req, res) => {
  performanceMonitor.clearAlerts();
  res.json({ success: true });
});

// Get performance history
router.get('/performance/history', (req, res) => {
  const { type = 'requests', limit = 100 } = req.query;
  const history = performanceMonitor.getMetricsHistory(type, parseInt(limit));
  res.json({ [type]: history });
});

// Get performance report
router.get('/performance/report', (req, res) => {
  const report = performanceMonitor.getPerformanceReport();
  res.json(report);
});

// Reset performance metrics
router.post('/performance/reset', (req, res) => {
  performanceMonitor.reset();
  res.json({ success: true });
});

// ============ Deduplication Routes ============

// Get deduplication stats
router.get('/deduplication/stats', (req, res) => {
  const stats = crawler.getDeduplicationStats();
  res.json(stats);
});

// Get duplicate groups
router.get('/deduplication/groups', (req, res) => {
  const groups = crawler.getDuplicateGroups();
  res.json({ groups });
});

// Reset deduplication cache
router.post('/deduplication/reset', (req, res) => {
  crawler.resetDeduplication();
  res.json({ success: true });
});

// Toggle deduplication
router.post('/deduplication/toggle', (req, res) => {
  const { enabled } = req.body;
  crawler.setDeduplicationEnabled(enabled);
  res.json({ success: true, enabled });
});

// ============ Classification Routes ============

// Classify current crawl requests
router.post('/classify', (req, res) => {
  try {
    const requests = crawler.getRequests();
    const classified = classifier.classifyRequests(requests);
    res.json({ success: true, requests: classified });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get available tags from current crawl
router.get('/tags', (req, res) => {
  try {
    const requests = crawler.getRequests();
    const tags = classifier.getAvailableTags(requests);
    res.json({ success: true, tags });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
