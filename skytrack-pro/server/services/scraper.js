/**
 * scraper.js
 * Puppeteer-based scraper targeting SkyKing Courier Service (skyking.co.in)
 * Includes retry logic, rate limiting, and structured data extraction.
 */

const puppeteer = require('puppeteer');
const logger = require('./logger');

const SKYKING_URL = 'https://www.skyking.co.in';
const DELAY_MS = parseInt(process.env.SCRAPER_DELAY_MS) || 3000;
const MAX_RETRIES = parseInt(process.env.SCRAPER_MAX_RETRIES) || 3;

let browserInstance = null;

/**
 * Get or create a shared browser instance.
 */
async function getBrowser() {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }
  browserInstance = await puppeteer.launch({
    headless: process.env.PUPPETEER_HEADLESS !== 'false',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
    defaultViewport: { width: 1280, height: 800 },
  });
  logger.info('🌐 Puppeteer browser instance created');
  return browserInstance;
}

/**
 * Close browser instance (call on app shutdown).
 */
async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    logger.info('🌐 Puppeteer browser closed');
  }
}

/**
 * Sleep helper.
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Exponential backoff delay.
 */
const backoffDelay = (attempt) => sleep(Math.pow(2, attempt) * 1000);

/**
 * Normalize status string to our enum values.
 */
function normalizeStatus(rawStatus) {
  if (!rawStatus) return 'Unknown';
  const s = rawStatus.toLowerCase().trim();

  if (s.includes('delivered')) return 'Delivered';
  if (s.includes('out for delivery') || s.includes('out-for-delivery')) return 'Out for Delivery';
  if (s.includes('in transit') || s.includes('intransit') || s.includes('dispatched')) return 'In Transit';
  if (s.includes('booked') || s.includes('pickup') || s.includes('collected')) return 'Booked';
  if (s.includes('exception') || s.includes('hold') || s.includes('failed') || s.includes('undelivered')) return 'Exception';
  return 'In Transit'; // default for any other known state
}

/**
 * Track a single consignment on SkyKing's website.
 * @param {string} consignmentNo - The consignment/AWB number
 * @returns {Object} tracking result
 */
async function trackConsignment(consignmentNo) {
  let attempt = 0;
  let lastError = null;

  while (attempt < MAX_RETRIES) {
    attempt++;
    logger.info(`📦 Tracking ${consignmentNo} (attempt ${attempt}/${MAX_RETRIES})`);

    try {
      const browser = await getBrowser();
      const page = await browser.newPage();

      // Set realistic user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Set extra headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-IN,en;q=0.9',
      });

      // Navigate to SkyKing tracking page
      await page.goto(SKYKING_URL, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Try to find and fill the tracking input
      // NOTE: Selectors may need adjustment based on actual site structure.
      // Common patterns for tracking forms:
      const trackingInputSelectors = [
        'input[name="consignment_no"]',
        'input[name="awbno"]',
        'input[name="tracking_no"]',
        'input[placeholder*="consignment" i]',
        'input[placeholder*="tracking" i]',
        'input[placeholder*="awb" i]',
        '#consignment_no',
        '#awbno',
        '#tracking_input',
        '.tracking-input input',
        'form input[type="text"]',
      ];

      let inputFound = false;
      for (const selector of trackingInputSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.click(selector);
          await page.keyboard.down('Control');
          await page.keyboard.press('a');
          await page.keyboard.up('Control');
          await page.type(selector, consignmentNo, { delay: 50 });
          inputFound = true;
          logger.debug(`Found tracking input with selector: ${selector}`);
          break;
        } catch {
          // Try next selector
        }
      }

      if (!inputFound) {
        throw new Error('Could not find tracking input field on SkyKing website');
      }

      // Submit the form
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        '.track-btn',
        '.tracking-btn',
        'button.btn-primary',
        'button:contains("Track")',
        'a:contains("Track")',
      ];

      let submitted = false;
      for (const sel of submitSelectors) {
        try {
          await page.click(sel);
          submitted = true;
          break;
        } catch {
          // Try next
        }
      }

      if (!submitted) {
        // Try pressing Enter
        await page.keyboard.press('Enter');
      }

      // Wait for tracking results to load
      await page.waitForNetworkIdle({ timeout: 15000 }).catch(() => {});
      await sleep(2000);

      // Extract tracking data
      // These selectors are educated guesses based on common courier site patterns.
      // Adjust after inspecting actual SkyKing HTML.
      const trackingData = await page.evaluate((cNo) => {
        const getText = (selectors) => {
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.innerText.trim()) return el.innerText.trim();
          }
          return '';
        };

        const getAllText = (selectors) => {
          for (const sel of selectors) {
            const els = document.querySelectorAll(sel);
            if (els.length > 0) {
              return Array.from(els).map(el => ({
                text: el.innerText.trim(),
                html: el.innerHTML,
              }));
            }
          }
          return [];
        };

        // Current status
        const status = getText([
          '.current-status',
          '.tracking-status',
          '.status-text',
          '.shipment-status',
          '[class*="status"]',
          '.track-status',
          'h3.status',
          '.delivery-status',
        ]);

        // Location
        const location = getText([
          '.current-location',
          '.location',
          '.track-location',
          '[class*="location"]',
          '.hub',
        ]);

        // Origin & destination
        const origin = getText(['.origin', '.from', '[class*="origin"]', '.source']);
        const destination = getText(['.destination', '.to', '[class*="destination"]', '.dest']);

        // Delivered to
        const deliveredTo = getText(['.receiver', '.delivered-to', '.consignee', '[class*="receiver"]']);

        // Timeline / history entries
        const historyRows = getAllText([
          '.tracking-timeline tr',
          '.track-history tr',
          '.timeline-item',
          '[class*="timeline"] li',
          '.history-table tr',
          'table.tracking tr',
          '.events-list li',
        ]);

        // Check if there's an error message
        const errorMsg = getText([
          '.error-message',
          '.no-result',
          '.not-found',
          '[class*="error"]',
          '.alert-danger',
        ]);

        return { status, location, origin, destination, deliveredTo, historyRows, errorMsg };
      }, consignmentNo);

      await page.close();

      // If we got an error message from the site
      if (trackingData.errorMsg && !trackingData.status) {
        return {
          success: false,
          consignmentNo,
          error: `Site returned: ${trackingData.errorMsg}`,
          rawData: trackingData,
        };
      }

      // Parse history entries into structured objects
      const history = trackingData.historyRows.map((row) => {
        const text = row.text;
        // Try to extract date/time from text
        const dateMatch = text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/);
        const timeMatch = text.match(/\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?/i);

        return {
          status: normalizeStatus(text.split('\n')[0] || text.substring(0, 50)),
          location: '',
          description: text.replace(/\n+/g, ' ').substring(0, 200),
          timestamp: dateMatch
            ? new Date(`${dateMatch[0]} ${timeMatch ? timeMatch[0] : ''}`)
            : new Date(),
          checkedAt: new Date(),
        };
      }).filter(h => h.description.length > 2);

      // If no history parsed, create one entry from current status
      if (history.length === 0 && trackingData.status) {
        history.push({
          status: normalizeStatus(trackingData.status),
          location: trackingData.location || '',
          description: trackingData.status,
          timestamp: new Date(),
          checkedAt: new Date(),
        });
      }

      const result = {
        success: true,
        consignmentNo,
        currentStatus: normalizeStatus(trackingData.status),
        currentLocation: trackingData.location || '',
        origin: trackingData.origin || '',
        destination: trackingData.destination || '',
        deliveredTo: trackingData.deliveredTo || '',
        history,
        scrapedAt: new Date(),
      };

      logger.info(`✅ Successfully tracked ${consignmentNo}: ${result.currentStatus}`);
      return result;

    } catch (error) {
      lastError = error;
      logger.warn(`⚠️  Tracking attempt ${attempt} failed for ${consignmentNo}: ${error.message}`);

      // Close the browser if it seems broken
      if (error.message.includes('Target closed') || error.message.includes('Session closed')) {
        browserInstance = null;
      }

      if (attempt < MAX_RETRIES) {
        await backoffDelay(attempt);
      }
    }
  }

  logger.error(`❌ All ${MAX_RETRIES} attempts failed for ${consignmentNo}: ${lastError?.message}`);
  return {
    success: false,
    consignmentNo,
    error: lastError?.message || 'Unknown scraping error',
  };
}

/**
 * Track multiple consignments with a delay between each.
 * @param {string[]} consignmentNos
 * @param {Function} onProgress - callback(consignmentNo, result, index, total)
 */
async function trackBatch(consignmentNos, onProgress = null) {
  const results = [];

  for (let i = 0; i < consignmentNos.length; i++) {
    const cNo = consignmentNos[i];

    const result = await trackConsignment(cNo);
    results.push(result);

    if (onProgress) {
      await onProgress(cNo, result, i + 1, consignmentNos.length);
    }

    // Rate-limiting delay between requests
    if (i < consignmentNos.length - 1) {
      logger.debug(`⏳ Waiting ${DELAY_MS}ms before next scrape...`);
      await sleep(DELAY_MS);
    }
  }

  return results;
}

module.exports = { trackConsignment, trackBatch, getBrowser, closeBrowser };
