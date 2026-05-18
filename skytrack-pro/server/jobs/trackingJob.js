/**
 * trackingJob.js
 * node-cron job that runs every N hours to auto-track all active consignments.
 */

const cron = require('node-cron');
const Consignment = require('../models/Consignment');
const { trackBatch } = require('../services/scraper');
const { notifyStatusChange, notifyTrackingComplete } = require('../services/notificationService');
const { Settings } = require('../models/index');
const logger = require('../services/logger');

let cronJob = null;
let isRunning = false;

/**
 * Core tracking logic — can be called by cron or manually.
 */
async function runTrackingJob() {
  if (isRunning) {
    logger.warn('⚡ Tracking job already in progress, skipping.');
    return { skipped: true };
  }

  isRunning = true;
  const startTime = Date.now();
  logger.info('🚀 Starting auto-tracking job...');

  try {
    // Fetch all non-delivered consignments
    const activeConsignments = await Consignment.find({
      currentStatus: { $nin: ['Delivered'] },
      isArchived: false,
    }).sort({ lastChecked: 1 }); // Track least recently checked first

    if (activeConsignments.length === 0) {
      logger.info('✅ No active consignments to track.');
      isRunning = false;
      return { tracked: 0, updated: 0, errors: 0 };
    }

    logger.info(`📦 Tracking ${activeConsignments.length} active consignment(s)...`);

    const consignmentNos = activeConsignments.map(c => c.consignmentNo);
    let updatedCount = 0;
    let errorCount = 0;

    await trackBatch(consignmentNos, async (cNo, result, index, total) => {
      logger.info(`[${index}/${total}] Processing result for ${cNo}`);

      const consignment = activeConsignments.find(c => c.consignmentNo === cNo);
      if (!consignment) return;

      if (!result.success) {
        // Record the error
        consignment.scrapeError = result.error;
        consignment.retryCount = (consignment.retryCount || 0) + 1;
        consignment.lastChecked = new Date();
        await consignment.save();
        errorCount++;
        return;
      }

      // Check if status changed
      const oldStatus = consignment.currentStatus;
      const newStatus = result.currentStatus;
      const statusChanged = oldStatus !== newStatus;

      // Update consignment fields
      consignment.currentStatus = newStatus;
      consignment.currentLocation = result.currentLocation || consignment.currentLocation;
      consignment.origin = result.origin || consignment.origin;
      consignment.destination = result.destination || consignment.destination;
      consignment.lastChecked = new Date();
      consignment.scrapeError = null;
      consignment.retryCount = 0;

      // Append new history entries (avoid duplicates)
      if (result.history && result.history.length > 0) {
        const existingTimestamps = new Set(
          consignment.history.map(h => h.timestamp?.toISOString())
        );

        const newEntries = result.history.filter(
          h => !existingTimestamps.has(new Date(h.timestamp)?.toISOString())
        );

        if (newEntries.length > 0) {
          consignment.history.push(...newEntries);
        }
      } else if (statusChanged) {
        // Manually add a history entry if status changed but no history was scraped
        consignment.history.push({
          status: newStatus,
          location: result.currentLocation || '',
          description: `Status updated to ${newStatus}`,
          timestamp: new Date(),
          checkedAt: new Date(),
        });
      }

      // Handle delivery
      if (newStatus === 'Delivered' && !consignment.deliveredAt) {
        consignment.deliveredAt = new Date();
        consignment.deliveredTo = result.deliveredTo || '';
      }

      await consignment.save();

      // Send notifications if status changed
      if (statusChanged) {
        updatedCount++;
        logger.info(`🔄 ${cNo}: ${oldStatus} → ${newStatus}`);
        await notifyStatusChange(consignment, oldStatus, newStatus);
      }
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`✅ Tracking job complete in ${duration}s. Updated: ${updatedCount}, Errors: ${errorCount}`);

    await notifyTrackingComplete(updatedCount, activeConsignments.length);

    isRunning = false;
    return {
      tracked: activeConsignments.length,
      updated: updatedCount,
      errors: errorCount,
      duration: `${duration}s`,
    };

  } catch (err) {
    logger.error(`❌ Tracking job failed: ${err.message}`, { stack: err.stack });
    isRunning = false;
    throw err;
  }
}

/**
 * Build a cron expression for a given interval in hours.
 */
function buildCronExpression(intervalHours) {
  switch (intervalHours) {
    case 2:  return '0 */2 * * *';
    case 5:  return '0 */5 * * *';
    case 12: return '0 */12 * * *';
    case 24: return '0 0 * * *';
    default: return '0 */5 * * *';
  }
}

/**
 * Initialize cron jobs based on settings.
 */
async function initCronJobs() {
  // Get interval from DB settings (fall back to env)
  let intervalHours = parseInt(process.env.TRACKING_INTERVAL_HOURS) || 5;

  try {
    const settings = await Settings.findOne();
    if (settings?.trackingIntervalHours) {
      intervalHours = settings.trackingIntervalHours;
    }
  } catch {
    // Use default
  }

  const cronExpr = buildCronExpression(intervalHours);
  logger.info(`⏰ Scheduling auto-tracking: every ${intervalHours} hour(s) [${cronExpr}]`);

  if (cronJob) {
    cronJob.stop();
  }

  cronJob = cron.schedule(cronExpr, async () => {
    logger.info('⏰ Cron triggered: running tracking job');
    try {
      await runTrackingJob();
    } catch (err) {
      logger.error(`Cron job error: ${err.message}`);
    }
  });

  logger.info('✅ Tracking cron job initialized');
}

/**
 * Restart cron with a new interval (called from settings API).
 */
async function restartCronWithInterval(intervalHours) {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }

  const cronExpr = buildCronExpression(intervalHours);
  logger.info(`🔄 Restarting cron: every ${intervalHours} hour(s) [${cronExpr}]`);

  cronJob = cron.schedule(cronExpr, async () => {
    try {
      await runTrackingJob();
    } catch (err) {
      logger.error(`Cron job error: ${err.message}`);
    }
  });
}

module.exports = { initCronJobs, runTrackingJob, restartCronWithInterval };
