const { chromium } = require('playwright');
const { v4: uuidv4 } = require('uuid');

let currentBrowser = null;
let currentContext = null;
let currentPage = null;
let crawlResults = [];
let isRunning = false;

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

      crawlResults.push(requestData);
      pendingRequests.set(requestUrl, requestData);
    });

    // Listen to responses
    currentPage.on('response', async (response) => {
      const responseUrl = response.url();
      const req = pendingRequests.get(responseUrl);

      if (req) {
        req.status = response.status();
        req.responseHeaders = response.headers();

        try {
          const body = await response.text();
          req.responseBody = body;
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
        const failure = request.failure();
        req.error = failure ? failure.errorText : 'Request failed';
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

module.exports = { startCrawl, stopCrawl, getStatus, getRequests };
