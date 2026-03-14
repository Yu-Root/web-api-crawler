const { chromium } = require('playwright');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const classifier = require('./classifier');
const performanceMonitor = require('./performancemonitor');

const dedupConfigPath = path.join(__dirname, '..', 'config', 'deduplication.json');
let dedupConfig = { enabled: true };
if (fs.existsSync(dedupConfigPath)) {
  try {
    dedupConfig = JSON.parse(fs.readFileSync(dedupConfigPath, 'utf8'));
  } catch (e) {}
}

let currentBrowser = null;
let currentContext = null;
let currentPage = null;
let crawlResults = [];
let isRunning = false;
let seenRequests = new Map();

// Interactive mode state
let crawlMode = null;           // 'one-shot' | 'interactive'
let navigationHistory = [];     // 导航历史
let interactiveFilters = {};    // 交互式模式的过滤器

// Helper to create page with stealth settings
async function createStealthPage(context) {
  const page = await context.newPage();

  // Inject script to mask automation
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

  const { cookies = [], waitTime = 10000, filters = {}, headless = true } = options;

  isRunning = true;
  crawlResults = [];
  resetDeduplication();
  performanceMonitor.resetStats();

  try {
    // Launch browser
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

    // Create context
    currentContext = await currentBrowser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      cookies: cookies,
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
      locale: 'en-US'
    });

    // Create page with stealth
    currentPage = await createStealthPage(currentContext);

    // Track requests
    const pendingRequests = new Map();

    // Listen to requests
    currentPage.on('request', (request) => {
      const requestUrl = request.url();

      const requestData = {
        id: uuidv4(),
        url: requestUrl,
        method: request.method(),
        headers: request.headers(),
        postData: request.postData() ? request.postData().toString() : null,
        resourceType: request.resourceType(),
        timestamp: Date.now(),
        status: null,
        responseBody: null,
        responseHeaders: null
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

      const dedupResult = processRequestDeduplication(requestData);
      if (!dedupResult.shouldAdd) return;

      crawlResults.push(requestData);
      pendingRequests.set(requestUrl, requestData);
      requestData.requestStart = Date.now();
    });

    // Listen to responses
    currentPage.on('response', async (response) => {
      const responseUrl = response.url();
      const req = pendingRequests.get(responseUrl);

      if (req) {
        req.status = response.status();
        req.responseHeaders = response.headers();
        req.responseTime = Date.now() - req.requestStart;

        try {
          const body = await response.text();
          req.responseBody = body;
        } catch (e) {}

        try {
          performanceMonitor.recordRequest(req, { status: req.status }, req.responseTime);
        } catch (e) {}

        try {
          req.tags = classifier.classifyAndTag(req, url);
        } catch (e) {}

        pendingRequests.delete(responseUrl);
      }
    });

    // Listen to failures
    currentPage.on('requestfailed', (request) => {
      const requestUrl = request.url();
      const req = pendingRequests.get(requestUrl);

      if (req) {
        req.status = 0;
        req.responseTime = Date.now() - req.requestStart;
        const failure = request.failure();
        req.error = failure ? failure.errorText : 'Request failed';

        try {
          performanceMonitor.recordRequest(req, { status: 0 }, req.responseTime);
        } catch (e) {}

        try {
          req.tags = classifier.classifyAndTag(req, url);
        } catch (e) {}

        pendingRequests.delete(requestUrl);
      }
    });

    // Navigate
    try {
      await currentPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) {
      try {
        await currentPage.goto(url, { waitUntil: 'load', timeout: 30000 });
      } catch (e2) {}
    }

    await currentPage.waitForTimeout(3000);

    // Wait for pending
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

    return { success: true, requests: crawlResults, total: crawlResults.length };

  } catch (error) {
    try {
      if (currentPage) await currentPage.close();
      if (currentContext) await currentContext.close();
      if (currentBrowser) await currentBrowser.close();
    } catch (e) {}

    currentPage = null;
    currentContext = null;
    currentBrowser = null;

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
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getStatus() {
  return { isRunning, totalRequests: crawlResults.length, requests: crawlResults };
}

function getRequests() {
  return crawlResults;
}

function normalizeUrl(url) {
  if (!dedupConfig.enabled) return url;
  try {
    const urlObj = new URL(url);
    
    if (dedupConfig.url_normalization?.remove_hash) {
      urlObj.hash = '';
    }
    
    if (dedupConfig.url_normalization?.remove_query_params) {
      dedupConfig.url_normalization.remove_query_params.forEach(param => {
        urlObj.searchParams.delete(param);
      });
    }
    
    if (dedupConfig.url_normalization?.sort_query_params) {
      urlObj.searchParams.sort();
    }
    
    let normalized = urlObj.toString();
    if (dedupConfig.url_normalization?.lowercase_path) {
      const pathStart = normalized.indexOf(urlObj.pathname);
      const pathEnd = normalized.indexOf('?') !== -1 ? normalized.indexOf('?') : normalized.length;
      normalized = normalized.substring(0, pathStart) + 
                   normalized.substring(pathStart, pathEnd).toLowerCase() + 
                   normalized.substring(pathEnd);
    }
    
    return normalized;
  } catch (e) {
    return url;
  }
}

function normalizeBody(body) {
  if (!dedupConfig.enabled || !body) return body;
  try {
    if (dedupConfig.body_normalization?.parse_json) {
      const parsed = JSON.parse(body);
      if (dedupConfig.body_normalization?.ignore_fields) {
        dedupConfig.body_normalization.ignore_fields.forEach(field => {
          delete parsed[field];
        });
      }
      return JSON.stringify(Object.keys(parsed).sort().reduce((obj, key) => {
        obj[key] = parsed[key];
        return obj;
      }, {}));
    }
  } catch (e) {}
  return body;
}

function getRequestKey(requestData) {
  const normalizedUrl = normalizeUrl(requestData.url);
  const normalizedBody = normalizeBody(requestData.postData);
  return `${requestData.method}:${normalizedUrl}:${normalizedBody || ''}`;
}

function isSimilarRequest(existing, newReq) {
  if (!dedupConfig.enabled) return false;
  
  const timeDiff = Math.abs(newReq.timestamp - existing.timestamp);
  if (timeDiff > (dedupConfig.time_window_ms || 5000)) {
    return false;
  }
  
  return true;
}

function mergeRequests(existing, newReq) {
  if (!dedupConfig.merge_strategy?.use_latest_response) {
    return existing;
  }
  
  if (newReq.status !== null) {
    existing.status = newReq.status;
  }
  if (newReq.responseBody) {
    existing.responseBody = newReq.responseBody;
  }
  if (newReq.responseHeaders) {
    existing.responseHeaders = newReq.responseHeaders;
  }
  if (newReq.error) {
    existing.error = newReq.error;
  }
  
  existing.lastUpdated = newReq.timestamp;
  existing.mergeCount = (existing.mergeCount || 1) + 1;
  
  return existing;
}

function shouldDeduplicate(requestData) {
  if (!dedupConfig.enabled) return false;
  
  try {
    const urlObj = new URL(requestData.url);
    if (dedupConfig.ignore_domains) {
      const matches = dedupConfig.ignore_domains.some(domain => 
        urlObj.hostname.includes(domain) || urlObj.hostname === domain
      );
      if (matches) return true;
    }
  } catch (e) {}
  
  return false;
}

function processRequestDeduplication(requestData) {
  if (!dedupConfig.enabled) return { shouldAdd: true, isDuplicate: false };
  
  if (shouldDeduplicate(requestData)) {
    return { shouldAdd: false, isDuplicate: true };
  }
  
  const key = getRequestKey(requestData);
  const existing = seenRequests.get(key);
  
  if (existing && isSimilarRequest(existing, requestData)) {
    mergeRequests(existing, requestData);
    return { shouldAdd: false, isDuplicate: true, existing };
  }
  
  seenRequests.set(key, requestData);
  return { shouldAdd: true, isDuplicate: false };
}

function resetDeduplication() {
  seenRequests.clear();
}

// Interactive mode functions

// Start interactive mode (browser stays open)
async function startInteractive(url, options = {}) {
  if (isRunning) {
    throw new Error('Crawl already in progress');
  }

  const { cookies = [], headless = true, filters = {} } = options;

  isRunning = true;
  crawlResults = [];
  navigationHistory = [];
  resetDeduplication();
  performanceMonitor.resetStats();
  interactiveFilters = filters;
  crawlMode = 'interactive';

  try {
    // Launch browser
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

    // Create context
    currentContext = await currentBrowser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      cookies: cookies,
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
      locale: 'en-US'
    });

    // Create page with stealth
    currentPage = await createStealthPage(currentContext);

    // Set up request tracking
    setupRequestListeners(currentPage);

    // Navigate to URL
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

// Set up request/response listeners
function setupRequestListeners(page) {
  const pendingRequests = new Map();

  page.on('request', (request) => {
    const requestUrl = request.url();

    const requestData = {
      id: uuidv4(),
      url: requestUrl,
      method: request.method(),
      headers: request.headers(),
      postData: request.postData() ? request.postData().toString() : null,
      resourceType: request.resourceType(),
      timestamp: Date.now(),
      status: null,
      responseBody: null,
      responseHeaders: null
    };

    // Apply filters
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

    const dedupResult = processRequestDeduplication(requestData);
    if (!dedupResult.shouldAdd) return;

    crawlResults.push(requestData);
    pendingRequests.set(requestUrl, requestData);
    requestData.requestStart = Date.now();
  });

  page.on('response', async (response) => {
      const responseUrl = response.url();
      const req = pendingRequests.get(responseUrl);

      if (req) {
        req.status = response.status();
        req.responseHeaders = response.headers();
        req.responseTime = Date.now() - req.requestStart;

        try {
          const body = await response.text();
          req.responseBody = body;
        } catch (e) {}

        try {
          performanceMonitor.recordRequest(req, { status: req.status }, req.responseTime);
        } catch (e) {}

        try {
          req.tags = classifier.classifyAndTag(req, currentPage?.url() || '');
        } catch (e) {}

        pendingRequests.delete(responseUrl);
      }
    });

  page.on('requestfailed', (request) => {
    const requestUrl = request.url();
    const req = pendingRequests.get(requestUrl);

    if (req) {
      req.status = 0;
      req.responseTime = Date.now() - req.requestStart;
      const failure = request.failure();
      req.error = failure ? failure.errorText : 'Request failed';

      try {
        performanceMonitor.recordRequest(req, { status: 0 }, req.responseTime);
      } catch (e) {}

      try {
        req.tags = classifier.classifyAndTag(req, currentPage?.url() || '');
      } catch (e) {}

      pendingRequests.delete(requestUrl);
    }
  });
}

// Navigate to a new URL in interactive mode
async function navigateToUrl(url) {
  if (!currentPage) {
    throw new Error('No active browser session');
  }

  try {
    // Clear previous results when navigating to new URL
    crawlResults = [];
    resetDeduplication();

    try {
      await currentPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) {
      try {
        await currentPage.goto(url, { waitUntil: 'load', timeout: 30000 });
      } catch (e2) {}
    }

    await currentPage.waitForTimeout(2000);

    // Add to navigation history
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

// Get all clickable links from the current page
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

    // Remove duplicates
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

// Click an element on the page
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

// Close interactive mode
async function closeInteractive() {
  await cleanup();
  crawlMode = null;
  navigationHistory = [];
  interactiveFilters = {};
  return { success: true };
}

// Get interactive status
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
    isBrowserOpen: !!currentBrowser
  };
}

// Helper to cleanup resources
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
  startInteractive,
  navigateToUrl,
  getPageLinks,
  clickElement,
  closeInteractive,
  getInteractiveStatus
};
