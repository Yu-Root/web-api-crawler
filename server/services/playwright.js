const { chromium } = require('playwright');
const { v4: uuidv4 } = require('uuid');
const requestDeduplicator = require('./requestDeduplicator');
const classifier = require('./classifier');
const dependencyAnalyzer = require('./dependencyAnalyzer');
const performanceMonitor = require('./performanceMonitor');
const docGenerator = require('./docGenerator');

let currentBrowser = null;
let currentContext = null;
let currentPage = null;
let crawlResults = [];
let isRunning = false;

// Interactive mode state
let crawlMode = null;
let navigationHistory = [];
let interactiveFilters = {};

// Helper to create page with stealth settings
async function createStealthPage(context) {
  const page = await context.newPage();

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.navigator.chrome = true;
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  });

  return page;
}

async function startCrawl(url, options = {}) {
  if (isRunning) {
    throw new Error('Crawl already in progress');
  }

  const { cookies = [], waitTime = 10000, filters = {}, headless = true, enableDeduplication = true, enableClassification = true } = options;

  isRunning = true;
  crawlResults = [];

  // Start performance monitoring
  performanceMonitor.startMonitoring();
  performanceMonitor.clear();

  try {
    currentBrowser = await chromium.launch({
      headless: headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--disable-web-security'
      ]
    });

    currentContext = await currentBrowser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      cookies: cookies,
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
      locale: 'en-US'
    });

    currentPage = await createStealthPage(currentContext);

    const pendingRequests = new Map();
    const requestStartTimes = new Map();

    currentPage.on('request', (request) => {
      const requestUrl = request.url();
      const requestId = uuidv4();
      
      requestStartTimes.set(requestUrl, Date.now());

      const requestData = {
        id: requestId,
        url: requestUrl,
        method: request.method(),
        headers: request.headers(),
        postData: request.postData() ? request.postData().toString() : null,
        resourceType: request.resourceType(),
        timestamp: Date.now(),
        status: null,
        responseBody: null,
        responseHeaders: null,
        responseTime: null,
        requestSize: request.postData() ? request.postData().length : 0
      };

      // Apply filters
      if (filters.domains && filters.domains.length > 0) {
        try {
          const urlObj = new URL(requestUrl);
          const matchesDomain = filters.domains.some(domain =>
            urlObj.hostname.includes(domain) || urlObj.hostname === domain
          );
          if (!matchesDomain) return;
        } catch (e) {
          return;
        }
      }

      if (filters.methods && filters.methods.length > 0) {
        if (!filters.methods.includes(request.method())) return;
      }

      crawlResults.push(requestData);
      pendingRequests.set(requestUrl, requestData);
    });

    currentPage.on('response', async (response) => {
      const responseUrl = response.url();
      const req = pendingRequests.get(responseUrl);

      if (req) {
        const startTime = requestStartTimes.get(responseUrl);
        req.status = response.status();
        req.responseHeaders = response.headers();
        req.responseTime = startTime ? Date.now() - startTime : null;

        try {
          const body = await response.text();
          req.responseBody = body;
          req.responseSize = body.length;
        } catch (e) {}

        // Record for performance monitoring
        performanceMonitor.recordRequest({
          id: req.id,
          url: req.url,
          method: req.method,
          status: req.status,
          responseTime: req.responseTime,
          resourceType: req.resourceType
        });

        pendingRequests.delete(responseUrl);
        requestStartTimes.delete(responseUrl);
      }
    });

    currentPage.on('requestfailed', (request) => {
      const requestUrl = request.url();
      const req = pendingRequests.get(requestUrl);

      if (req) {
        req.status = 0;
        const failure = request.failure();
        req.error = failure ? failure.errorText : 'Request failed';
        
        performanceMonitor.recordRequest({
          id: req.id,
          url: req.url,
          method: req.method,
          status: 0,
          responseTime: null,
          error: req.error
        });

        pendingRequests.delete(requestUrl);
        requestStartTimes.delete(requestUrl);
      }
    });

    try {
      await currentPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) {
      try {
        await currentPage.goto(url, { waitUntil: 'load', timeout: 30000 });
      } catch (e2) {}
    }

    await currentPage.waitForTimeout(3000);

    let waitAttempts = 0;
    while (pendingRequests.size > 0 && waitAttempts < 8) {
      await currentPage.waitForTimeout(1000);
      waitAttempts++;
    }

    if (waitTime > 0) {
      await currentPage.waitForTimeout(waitTime);
    }

    await currentPage.close();
    await currentContext.close();
    await currentBrowser.close();

    currentPage = null;
    currentContext = null;
    currentBrowser = null;

    // Process results with deduplication
    let processedResults = crawlResults;
    let dedupStats = null;
    
    if (enableDeduplication) {
      const dedupResult = requestDeduplicator.processRequests(crawlResults);
      processedResults = dedupResult.unique;
      dedupStats = dedupResult.stats;
    }

    // Classify requests
    let classificationResults = null;
    if (enableClassification) {
      classificationResults = classifier.classifyBatch(processedResults);
      processedResults = classificationResults.results.map(r => ({
        ...r,
        ...r.classification.tags[0]
      }));
    }

    // Analyze dependencies
    const dependencyAnalysis = dependencyAnalyzer.analyzeDependencies(processedResults);

    // Get performance stats
    const performanceStats = performanceMonitor.getStats('5m');
    const healthStatus = performanceMonitor.getHealthStatus();

    // Stop monitoring
    performanceMonitor.stopMonitoring();

    return { 
      success: true, 
      requests: processedResults, 
      total: processedResults.length,
      rawTotal: crawlResults.length,
      deduplication: dedupStats,
      classification: classificationResults?.stats,
      dependencies: {
        stats: dependencyAnalysis.stats,
        criticalPath: dependencyAnalysis.criticalPath,
        recommendations: dependencyAnalysis.recommendations
      },
      performance: {
        stats: performanceStats,
        health: healthStatus
      }
    };

  } catch (error) {
    try {
      if (currentPage) await currentPage.close();
      if (currentContext) await currentContext.close();
      if (currentBrowser) await currentBrowser.close();
    } catch (e) {}

    currentPage = null;
    currentContext = null;
    currentBrowser = null;
    performanceMonitor.stopMonitoring();

    return { success: false, error: error.message, requests: crawlResults, total: crawlResults.length };
  } finally {
    isRunning = false;
  }
}

async function stopCrawl() {
  try {
    if (currentPage) await currentPage.close();
    if (currentContext) await currentContext.close();
    if (currentBrowser) await currentBrowser.close();
    currentPage = null;
    currentContext = null;
    currentBrowser = null;
    isRunning = false;
    performanceMonitor.stopMonitoring();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getStatus() {
  return { 
    isRunning, 
    totalRequests: crawlResults.length, 
    requests: crawlResults,
    performance: performanceMonitor.isMonitoring ? performanceMonitor.getStats('1m') : null
  };
}

function getRequests() {
  return crawlResults;
}

// Get deduplication info
function getDeduplicationInfo() {
  return requestDeduplicator.getGroups();
}

// Get dependency analysis
function analyzeDependencies(options = {}) {
  return dependencyAnalyzer.analyzeDependencies(crawlResults, options);
}

// Get performance report
function getPerformanceReport() {
  return performanceMonitor.getPerformanceReport();
}

// Generate API documentation
async function generateApiDocs(options = {}) {
  return docGenerator.generateDocs(crawlResults, options);
}

// Classify requests
function classifyRequests() {
  return classifier.classifyBatch(crawlResults);
}

// Interactive mode functions

async function startInteractive(url, options = {}) {
  if (isRunning) {
    throw new Error('Crawl already in progress');
  }

  const { cookies = [], headless = true, filters = {} } = options;

  isRunning = true;
  crawlResults = [];
  navigationHistory = [];
  interactiveFilters = filters;
  crawlMode = 'interactive';

  performanceMonitor.startMonitoring();
  performanceMonitor.clear();

  try {
    currentBrowser = await chromium.launch({
      headless: headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--disable-web-security'
      ]
    });

    currentContext = await currentBrowser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      cookies: cookies,
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
      locale: 'en-US'
    });

    currentPage = await createStealthPage(currentContext);

    setupRequestListeners(currentPage);

    await navigateToUrl(url);

    return {
      success: true,
      mode: 'interactive',
      currentUrl: url,
      navigationHistory: navigationHistory,
      totalRequests: crawlResults.length
    };

  } catch (error) {
    await cleanup();
    return { success: false, error: error.message };
  }
}

function setupRequestListeners(page) {
  const pendingRequests = new Map();
  const requestStartTimes = new Map();

  page.on('request', (request) => {
    const requestUrl = request.url();
    const requestId = uuidv4();
    
    requestStartTimes.set(requestUrl, Date.now());

    const requestData = {
      id: requestId,
      url: requestUrl,
      method: request.method(),
      headers: request.headers(),
      postData: request.postData() ? request.postData().toString() : null,
      resourceType: request.resourceType(),
      timestamp: Date.now(),
      status: null,
      responseBody: null,
      responseHeaders: null,
      responseTime: null
    };

    if (interactiveFilters.domains && interactiveFilters.domains.length > 0) {
      try {
        const urlObj = new URL(requestUrl);
        const matchesDomain = interactiveFilters.domains.some(domain =>
          urlObj.hostname.includes(domain) || urlObj.hostname === domain
        );
        if (!matchesDomain) return;
      } catch (e) {
        return;
      }
    }

    if (interactiveFilters.methods && interactiveFilters.methods.length > 0) {
      if (!interactiveFilters.methods.includes(request.method())) return;
    }

    crawlResults.push(requestData);
    pendingRequests.set(requestUrl, requestData);
  });

  page.on('response', async (response) => {
    const responseUrl = response.url();
    const req = pendingRequests.get(responseUrl);

    if (req) {
      const startTime = requestStartTimes.get(responseUrl);
      req.status = response.status();
      req.responseHeaders = response.headers();
      req.responseTime = startTime ? Date.now() - startTime : null;

      try {
        const body = await response.text();
        req.responseBody = body;
      } catch (e) {}

      performanceMonitor.recordRequest({
        id: req.id,
        url: req.url,
        method: req.method,
        status: req.status,
        responseTime: req.responseTime
      });

      pendingRequests.delete(responseUrl);
      requestStartTimes.delete(responseUrl);
    }
  });

  page.on('requestfailed', (request) => {
    const requestUrl = request.url();
    const req = pendingRequests.get(requestUrl);

    if (req) {
      req.status = 0;
      const failure = request.failure();
      req.error = failure ? failure.errorText : 'Request failed';
      
      performanceMonitor.recordRequest({
        id: req.id,
        url: req.url,
        method: req.method,
        status: 0,
        error: req.error
      });

      pendingRequests.delete(requestUrl);
      requestStartTimes.delete(requestUrl);
    }
  });
}

async function navigateToUrl(url) {
  if (!currentPage) {
    throw new Error('No active browser session');
  }

  try {
    crawlResults = [];

    try {
      await currentPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) {
      try {
        await currentPage.goto(url, { waitUntil: 'load', timeout: 30000 });
      } catch (e2) {}
    }

    await currentPage.waitForTimeout(2000);

    navigationHistory.push({
      url: url,
      timestamp: Date.now(),
      title: await currentPage.title().catch(() => '')
    });

    return {
      success: true,
      currentUrl: url,
      title: await currentPage.title().catch(() => ''),
      totalRequests: crawlResults.length
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getPageLinks() {
  if (!currentPage) {
    throw new Error('No active browser session');
  }

  try {
    const links = await currentPage.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      return anchors.map(a => ({
        href: a.href,
        text: a.textContent.trim().substring(0, 100),
        tagName: a.tagName
      })).filter(l => l.href && l.href.startsWith('http'));
    });

    const uniqueLinks = [];
    const seen = new Set();
    for (const link of links) {
      if (!seen.has(link.href)) {
        seen.add(link.href);
        uniqueLinks.push(link);
      }
    }

    return { success: true, links: uniqueLinks };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function clickElement(selector) {
  if (!currentPage) {
    throw new Error('No active browser session');
  }

  try {
    await currentPage.click(selector);
    await currentPage.waitForTimeout(2000);

    return {
      success: true,
      currentUrl: currentPage.url(),
      title: await currentPage.title().catch(() => ''),
      totalRequests: crawlResults.length
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function closeInteractive() {
  await cleanup();
  crawlMode = null;
  navigationHistory = [];
  interactiveFilters = {};
  performanceMonitor.stopMonitoring();
  return { success: true };
}

function getInteractiveStatus() {
  if (crawlMode !== 'interactive') {
    return {
      active: false,
      mode: null,
      currentUrl: null,
      navigationHistory: [],
      totalRequests: 0
    };
  }

  return {
    active: true,
    mode: 'interactive',
    currentUrl: currentPage ? currentPage.url() : null,
    navigationHistory: navigationHistory,
    totalRequests: crawlResults.length,
    isBrowserOpen: !!currentBrowser,
    performance: performanceMonitor.getStats('1m')
  };
}

async function cleanup() {
  try {
    if (currentPage) await currentPage.close();
    if (currentContext) await currentContext.close();
    if (currentBrowser) await currentBrowser.close();
  } catch (e) {}

  currentPage = null;
  currentContext = null;
  currentBrowser = null;
  isRunning = false;
}

module.exports = {
  startCrawl,
  stopCrawl,
  getStatus,
  getRequests,
  getDeduplicationInfo,
  analyzeDependencies,
  getPerformanceReport,
  generateApiDocs,
  classifyRequests,
  startInteractive,
  navigateToUrl,
  getPageLinks,
  clickElement,
  closeInteractive,
  getInteractiveStatus
};
