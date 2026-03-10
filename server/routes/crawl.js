const express = require('express');
const router = express.Router();
const crawler = require('../services/playwright');

// Start crawl
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

module.exports = router;
